import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CONFIG } from '../../config/config.js';
import type { Config } from '../../config/config.js';
import { SignInDto, SignUpDto } from '../dto/auth.dto.js';
import { AccessTokenGuard } from '../guards/access-token.guard.js';
import type { AuthenticatedRequest } from '../guards/access-token.guard.js';
import { AuthIpGuard, AuthRateLimitAction, clientIp } from '../guards/auth-ip.guard.js';
import { AuthRequestPipe } from '../pipes/auth-request.pipe.js';
import { UsersRepository } from '../repositories/users.repository.js';
import type { PublicUser } from '../repositories/users.repository.js';
import { AuthService } from '../services/auth.service.js';
import { AuthTokensService } from '../services/auth-tokens.service.js';
import { clearAuthCookies, readAuthCookies, writeAuthCookies } from '../tokens/auth-cookies.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: AuthTokensService,
    private readonly users: UsersRepository,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  @Post('sign-up')
  @HttpCode(204)
  @AuthRateLimitAction('signUp')
  @UseGuards(AuthIpGuard)
  async signUp(@Body(new AuthRequestPipe(SignUpDto)) input: SignUpDto, @Req() request: Request): Promise<void> {
    await this.auth.register(input, clientIp(request));
  }

  @Post('sign-in')
  @HttpCode(204)
  @AuthRateLimitAction('signIn')
  @UseGuards(AuthIpGuard)
  async signIn(
    @Body(new AuthRequestPipe(SignInDto)) input: SignInDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const userId = await this.auth.authenticate(input, clientIp(request));
    const previous = readAuthCookies(request, this.config.secureCookies);
    const tokens = await this.tokens.signIn(userId, previous);
    writeAuthCookies(response, this.config.secureCookies, tokens);
  }

  @Post('refresh')
  @HttpCode(204)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    const { refresh } = readAuthCookies(request, this.config.secureCookies);
    const tokens = await this.tokens.refresh(refresh);
    writeAuthCookies(response, this.config.secureCookies, tokens);
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  async me(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response): Promise<PublicUser> {
    const { userId, expiresAt } = request.auth;
    const user = await this.users.findPublicUser(userId);
    if (!user) throw new UnauthorizedException('Authentication required.');
    response.setHeader('X-Access-Expires-In-Ms', Math.max(0, expiresAt * 1000 - Date.now()));
    return user;
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.tokens.revoke(readAuthCookies(request, this.config.secureCookies));
    clearAuthCookies(response, this.config.secureCookies);
  }
}
