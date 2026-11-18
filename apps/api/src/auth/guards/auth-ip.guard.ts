import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthRateLimitService } from '../services/auth-rate-limit.service.js';
import type { AuthAction } from '../services/auth-rate-limit.service.js';

export const AuthRateLimitAction = Reflector.createDecorator<AuthAction>();

export function clientIp(request: Request): string {
  return request.ip ?? 'unknown';
}

@Injectable()
export class AuthIpGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly limits: AuthRateLimitService) {}

  canActivate(context: ExecutionContext): boolean {
    const action = this.reflector.get(AuthRateLimitAction, context.getHandler());
    const request = context.switchToHttp().getRequest<Request>();
    this.limits.checkIp(action, clientIp(request), request.body);
    return true;
  }
}
