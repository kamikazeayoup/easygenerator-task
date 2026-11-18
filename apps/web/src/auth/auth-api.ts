import { z } from 'zod';
import { publicUserSchema } from './auth-schemas';
import type { SignInInput, SignUpInput } from './auth-schemas';

const validationErrorSchema = z.object({
  fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
  formErrors: z.array(z.string()).optional(),
});

export class AuthApiError extends Error {
  constructor(
    readonly status: number,
    readonly validation?: z.infer<typeof validationErrorSchema>,
    readonly retryAfterSeconds?: number,
  ) {
    super(`Auth request failed with status ${status}`);
  }
}

async function request(path: string, options?: RequestInit) {
  return fetch(`/api/auth/${path}`, {
    ...options,
    credentials: 'same-origin',
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
}

async function post(path: string, payload?: SignInInput | SignUpInput) {
  const response = await request(path, {
    method: 'POST',
    ...(payload && {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  });

  if (response.status === 204) return;

  const validation = response.status === 400
    ? validationErrorSchema.safeParse(await response.json().catch(() => undefined)).data
    : undefined;
  const retryAfter = response.headers.get('Retry-After') ?? '';
  const seconds = Number(retryAfter);
  const retryAfterSeconds = seconds > 0 && Number.isSafeInteger(seconds) ? seconds : undefined;
  throw new AuthApiError(response.status, validation, retryAfterSeconds);
}

function withAuthCookies<T>(operation: () => Promise<T>): Promise<T> {
  // Tabs share the cookies. Let each refresh read the result of the preceding one.
  return navigator.locks ? navigator.locks.request('easygenerator-auth', operation) : operation();
}

async function getCurrentLogin() {
  const response = await request('me');
  if (response.status === 401) return null;
  if (response.status !== 200) throw new AuthApiError(response.status);

  const expiry = response.headers.get('X-Access-Expires-In-Ms');
  const refreshInMs = Number(expiry);
  if (expiry === null || !Number.isSafeInteger(refreshInMs) || refreshInMs < 0) {
    throw new Error('Invalid access token expiry.');
  }
  return { user: publicUserSchema.parse(await response.json()), refreshInMs };
}

export const authApi = {
  signUp: (input: SignUpInput) => post('sign-up', input),
  signIn: (input: SignInInput) => withAuthCookies(() => post('sign-in', input)),
  logout: () => withAuthCookies(() => post('logout')),
  getLogin() {
    return withAuthCookies(async () => {
      const login = await getCurrentLogin();
      if (login) return login;

      try {
        await post('refresh');
      } catch (error) {
        if (!(error instanceof AuthApiError) || error.status !== 401) throw error;
        // A concurrent tab may have renewed the cookies in browsers without Web Locks.
        return navigator.locks ? null : getCurrentLogin();
      }
      return getCurrentLogin();
    });
  },
};
