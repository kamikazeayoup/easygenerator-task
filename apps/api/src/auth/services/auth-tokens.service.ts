import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { errors, jwtVerify, SignJWT } from 'jose';
import { ObjectId } from 'mongodb';
import { randomUUID } from 'node:crypto';
import { CONFIG } from '../../config/config.js';
import type { Config } from '../../config/config.js';
import { AuthLoginsRepository } from '../repositories/auth-logins.repository.js';
import type { AuthLogin } from '../repositories/auth-logins.repository.js';

const accessLifetimeSeconds = 5 * 60;
const loginLifetimeSeconds = 8 * 60 * 60;
const algorithm = 'HS256';
const audiences = { access: 'easygenerator-api', refresh: 'easygenerator-refresh' } as const;
const objectId = /^[a-f0-9]{24}$/;

type TokenKind = keyof typeof audiences;

interface VerifiedToken {
  loginId: ObjectId;
  userId: string;
  tokenId: string;
  expiresAt: number;
}

export interface TokenPair {
  access: { value: string; expires: Date };
  refresh: { value: string; expires: Date };
}

export type PresentedTokens = Partial<Record<TokenKind, string>>;

@Injectable()
export class AuthTokensService {
  private readonly key: Uint8Array;

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    private readonly logins: AuthLoginsRepository,
  ) {
    this.key = Buffer.from(config.jwtSecret);
  }

  async signIn(userId: string, previousTokens: PresentedTokens): Promise<TokenPair> {
    const now = Math.floor(Date.now() / 1000);
    const login: AuthLogin = {
      _id: new ObjectId(),
      userId,
      expiresAt: new Date((now + loginLifetimeSeconds) * 1000),
      refreshId: randomUUID(),
    };
    const tokens = await this.issue(login, now);
    await this.revoke(previousTokens);
    await this.logins.insert(login);
    return tokens;
  }

  async authenticate(value?: string): Promise<{ userId: string; expiresAt: number }> {
    const token = await this.verify(value, 'access');
    if (!token || !await this.logins.isActive(token.loginId, token.userId)) {
      throw new UnauthorizedException('Authentication required.');
    }
    return { userId: token.userId, expiresAt: token.expiresAt };
  }

  async refresh(value?: string): Promise<TokenPair> {
    const token = await this.verify(value, 'refresh');
    if (!token) throw new UnauthorizedException('Authentication required.');

    const login: AuthLogin = {
      _id: token.loginId,
      userId: token.userId,
      expiresAt: new Date(token.expiresAt * 1000),
      refreshId: randomUUID(),
    };
    const tokens = await this.issue(login);
    if (!await this.logins.rotateRefreshToken(login, token.tokenId)) {
      throw new UnauthorizedException('Authentication required.');
    }
    return tokens;
  }

  async revoke(presented: PresentedTokens): Promise<void> {
    const tokens = await Promise.all([this.verify(presented.access, 'access'), this.verify(presented.refresh, 'refresh')]);
    await this.logins.revoke(tokens.flatMap((token) => token ? [token.loginId] : []));
  }

  private async issue(login: AuthLogin, now = Math.floor(Date.now() / 1000)): Promise<TokenPair> {
    const refreshExpiry = login.expiresAt.getTime() / 1000;
    const accessExpiry = Math.min(now + accessLifetimeSeconds, refreshExpiry);
    const [access, refresh] = await Promise.all([
      this.sign('access', login, randomUUID(), now, accessExpiry),
      this.sign('refresh', login, login.refreshId, now, refreshExpiry),
    ]);
    return {
      access: { value: access, expires: new Date(accessExpiry * 1000) },
      refresh: { value: refresh, expires: login.expiresAt },
    };
  }

  private sign(kind: TokenKind, login: AuthLogin, tokenId: string, now: number, expiresAt: number): Promise<string> {
    return new SignJWT({ sid: login._id.toHexString() })
      .setProtectedHeader({ alg: algorithm, typ: `eg-${kind}+jwt` })
      .setIssuer(this.config.publicOrigin)
      .setAudience(audiences[kind])
      .setSubject(login.userId)
      .setJti(tokenId)
      .setIssuedAt(now)
      .setExpirationTime(expiresAt)
      .sign(this.key);
  }

  private async verify(value: string | undefined, kind: TokenKind): Promise<VerifiedToken | null> {
    if (!value) return null;

    try {
      const { payload } = await jwtVerify(value, this.key, {
        algorithms: [algorithm],
        issuer: this.config.publicOrigin,
        audience: audiences[kind],
        typ: `eg-${kind}+jwt`,
        requiredClaims: ['sub', 'jti', 'iat', 'exp', 'sid'],
      });
      const { sub, jti, exp, sid } = payload;
      if (typeof sub !== 'string' || !objectId.test(sub) || typeof sid !== 'string' || !objectId.test(sid) ||
          typeof jti !== 'string' || !jti || typeof exp !== 'number' || !Number.isSafeInteger(exp)) return null;
      return { userId: sub, loginId: new ObjectId(sid), tokenId: jti, expiresAt: exp };
    } catch (error) {
      if (error instanceof errors.JOSEError) return null;
      throw error;
    }
  }
}
