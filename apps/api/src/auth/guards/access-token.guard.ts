import { Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { CONFIG } from '../../config/config.js';
import type { Config } from '../../config/config.js';
import { AuthTokensService } from '../services/auth-tokens.service.js';
import { readAuthCookies } from '../tokens/auth-cookies.js';

export type AuthenticatedRequest = Request & { auth: { userId: string; expiresAt: number } };

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    @Inject(CONFIG) private readonly config: Config,
    private readonly tokens: AuthTokensService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { access } = readAuthCookies(request, this.config.secureCookies);
    request.auth = await this.tokens.authenticate(access);
    return true;
  }
}
