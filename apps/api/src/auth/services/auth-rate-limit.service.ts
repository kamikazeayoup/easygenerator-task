import { Inject, Injectable } from '@nestjs/common';
import { CONFIG } from '../../config/config.js';
import type { ActionLimits, Config } from '../../config/config.js';
import { RateLimitExceeded } from '../../http/api-errors.js';
import { SignInDto, SignUpDto } from '../dto/auth.dto.js';
import { validateAuthRequest } from '../validation/auth-request.validation.js';
import { FixedWindowCounter } from './fixed-window-counter.js';

export type AuthAction = 'signIn' | 'signUp';

@Injectable()
export class AuthRateLimitService {
  private readonly counters;

  constructor(@Inject(CONFIG) config: Config) {
    const makeCounters = ({ ipLimit, emailLimit, windowMs }: ActionLimits) => ({
      ip: new FixedWindowCounter(ipLimit, windowMs, config.rateLimitMaxKeys),
      email: new FixedWindowCounter(emailLimit, windowMs, config.rateLimitMaxKeys),
    });
    this.counters = { signIn: makeCounters(config.signIn), signUp: makeCounters(config.signUp) };
  }

  checkIp(action: AuthAction, ip: string, payload: unknown): void {
    const counters = this.counters[action];
    const result = counters.ip.reserve(ip);
    if ('release' in result) return;

    const dto = action === 'signIn' ? SignInDto : SignUpDto;
    const submission = validateAuthRequest(dto, payload);
    const emailWait = submission.success ? counters.email.retryAfterMs(submission.data.email) : 0;
    throw new RateLimitExceeded(Math.max(result.retryAfterMs, emailWait));
  }

  reserveEmail(action: AuthAction, email: string, ip: string): () => void {
    const counters = this.counters[action];
    const result = counters.email.reserve(email);
    if ('retryAfterMs' in result) {
      throw new RateLimitExceeded(Math.max(result.retryAfterMs, counters.ip.retryAfterMs(ip)));
    }
    return result.release;
  }
}
