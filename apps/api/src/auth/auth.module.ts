import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AuthController } from './controllers/auth.controller.js';
import { AccessTokenGuard } from './guards/access-token.guard.js';
import { AuthIpGuard } from './guards/auth-ip.guard.js';
import { AuthLoginsRepository } from './repositories/auth-logins.repository.js';
import { UsersRepository } from './repositories/users.repository.js';
import { AuthRateLimitService } from './services/auth-rate-limit.service.js';
import { AuthTokensService } from './services/auth-tokens.service.js';
import { AuthService } from './services/auth.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [AccessTokenGuard, AuthIpGuard, AuthLoginsRepository, AuthRateLimitService, AuthService, AuthTokensService, UsersRepository],
})
export class AuthModule {}
