import { isIP } from 'node:net';

export const CONFIG = Symbol('CONFIG');

export interface ActionLimits {
  ipLimit: number;
  emailLimit: number;
  windowMs: number;
}

export interface Config {
  publicOrigin: string;
  secureCookies: boolean;
  jwtSecret: string;
  proxyAddress: string | undefined;
  mongoUri: string;
  mongoDatabase: string;
  host: string;
  port: number;
  rateLimitMaxKeys: number;
  signIn: ActionLimits;
  signUp: ActionLimits;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  function integer(name: string, fallback: number, max: number): number {
    const raw = env[name] ?? String(fallback);
    const value = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < 1 || value > max) {
      throw new Error(`${name} must be an integer between 1 and ${max}.`);
    }
    return value;
  }

  const rawOrigin = env.PUBLIC_ORIGIN ?? 'http://localhost:8080';
  const origin = URL.parse(rawOrigin);
  if (!origin || origin.origin !== rawOrigin || !['http:', 'https:'].includes(origin.protocol)) {
    throw new Error('PUBLIC_ORIGIN must be an HTTP(S) origin without a trailing slash.');
  }
  const secureCookies = origin.protocol === 'https:';
  const localHosts = ['localhost', '127.0.0.1', '[::1]'];
  if (!secureCookies && (env.NODE_ENV === 'production' || env.ALLOW_INSECURE_HTTP !== 'true' || !localHosts.includes(origin.hostname))) {
    throw new Error('HTTP requires a loopback public origin and ALLOW_INSECURE_HTTP=true outside production.');
  }

  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret || Buffer.byteLength(jwtSecret) < 32 || !jwtSecret.trim()) {
    throw new Error('JWT_SECRET must contain at least 32 bytes from a securely generated value.');
  }

  const proxyAddress = env.TRUST_PROXY_ADDRESS || undefined;
  if (proxyAddress && !isIP(proxyAddress)) {
    throw new Error('TRUST_PROXY_ADDRESS must be the IP address of the trusted proxy.');
  }

  return {
    publicOrigin: rawOrigin,
    secureCookies,
    jwtSecret,
    proxyAddress,
    mongoUri: env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017',
    mongoDatabase: env.MONGODB_DATABASE ?? 'easygenerator',
    host: env.HOST ?? '127.0.0.1',
    port: integer('PORT', 3000, 65_535),
    rateLimitMaxKeys: integer('RATE_LIMIT_MAX_KEYS', 10_000, 100_000),
    signIn: {
      ipLimit: integer('SIGN_IN_IP_LIMIT', 60, 10_000),
      emailLimit: integer('SIGN_IN_EMAIL_LIMIT', 5, 10_000),
      windowMs: integer('SIGN_IN_WINDOW_SECONDS', 300, 86_400) * 1000,
    },
    signUp: {
      ipLimit: integer('SIGN_UP_IP_LIMIT', 20, 10_000),
      emailLimit: integer('SIGN_UP_EMAIL_LIMIT', 5, 10_000),
      windowMs: integer('SIGN_UP_WINDOW_SECONDS', 900, 86_400) * 1000,
    },
  };
}
