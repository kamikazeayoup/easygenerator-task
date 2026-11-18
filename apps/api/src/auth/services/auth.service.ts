import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { hash, verify, argon2id } from 'argon2';
import { randomBytes } from 'node:crypto';
import type { SignInDto, SignUpDto } from '../dto/auth.dto.js';
import { UsersRepository } from '../repositories/users.repository.js';
import { AuthRateLimitService } from './auth-rate-limit.service.js';

const passwordOptions = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash!: string;

  constructor(private readonly users: UsersRepository, private readonly limits: AuthRateLimitService) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await hash(randomBytes(32), passwordOptions);
  }

  async register(input: SignUpDto, ip: string): Promise<void> {
    this.limits.reserveEmail('signUp', input.email, ip);
    await this.users.insertIfNew(input, await hash(input.password, passwordOptions));
  }

  async authenticate({ email, password }: SignInDto, ip: string): Promise<string> {
    const release = this.limits.reserveEmail('signIn', email, ip);
    let user: Awaited<ReturnType<UsersRepository['findCredentials']>>;
    let matches: boolean;
    try {
      user = await this.users.findCredentials(email);
      matches = await verify(user?.passwordHash ?? this.dummyHash, password);
    } catch (error) {
      release();
      throw error;
    }

    if (!user || !matches) throw new UnauthorizedException('Invalid credentials.');
    release();
    return user.id;
  }
}
