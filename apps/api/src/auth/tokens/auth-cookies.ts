import type { Request, Response } from 'express';
import type { PresentedTokens, TokenPair } from '../services/auth-tokens.service.js';

const tokenKinds = ['access', 'refresh'] as const;

function cookieName(kind: typeof tokenKinds[number], secure: boolean): string {
  return `${secure ? '__Host-' : ''}eg.${kind}`;
}

function cookieOptions(secure: boolean) {
  return { path: '/', httpOnly: true, sameSite: 'lax' as const, secure };
}

export function readAuthCookies(request: Request, secure: boolean): PresentedTokens {
  const cookies = request.headers.cookie?.split(';').map((cookie) => cookie.trimStart()) ?? [];
  const tokens: PresentedTokens = {};
  for (const kind of tokenKinds) {
    const prefix = `${cookieName(kind, secure)}=`;
    tokens[kind] = cookies.find((cookie) => cookie.startsWith(prefix))?.slice(prefix.length);
  }
  return tokens;
}

export function writeAuthCookies(response: Response, secure: boolean, tokens: TokenPair): void {
  for (const kind of tokenKinds) {
    const { value, expires } = tokens[kind];
    response.cookie(cookieName(kind, secure), value, { ...cookieOptions(secure), expires });
  }
}

export function clearAuthCookies(response: Response, secure: boolean): void {
  for (const kind of tokenKinds) response.clearCookie(cookieName(kind, secure), cookieOptions(secure));
}
