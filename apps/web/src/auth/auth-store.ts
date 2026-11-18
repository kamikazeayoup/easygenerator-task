import { create } from 'zustand';
import { authApi } from './auth-api';
import type { PublicUser } from './auth-schemas';

type AuthState =
  | { status: 'checking' }
  | { status: 'signedIn'; user: PublicUser }
  | { status: 'signedOut' }
  | { status: 'unavailable' };

type AuthStore = {
  auth: AuthState;
  isSigningOut: boolean;
  checkLogin: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthStore>((set, get) => {
  let activeCheck: Promise<void> | undefined;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;

  function scheduleCheck(delay: number): void {
    refreshTimer = setTimeout(() => void get().checkLogin(), Math.max(1_000, delay));
  }

  return {
    auth: { status: 'checking' },
    isSigningOut: false,
    async checkLogin() {
      if (get().isSigningOut) return;
      if (activeCheck) return activeCheck;

      clearTimeout(refreshTimer);
      if (get().auth.status !== 'signedIn') set({ auth: { status: 'checking' } });

      activeCheck = authApi.getLogin().then((login) => {
        if (get().isSigningOut) return;
        set({ auth: login ? { status: 'signedIn', user: login.user } : { status: 'signedOut' } });
        if (login) scheduleCheck(login.refreshInMs);
      }).catch(() => {
        if (!get().isSigningOut) set({ auth: { status: 'unavailable' } });
      }).finally(() => {
        activeCheck = undefined;
      });
      return activeCheck;
    },
    async signOut() {
      if (get().isSigningOut) return;

      clearTimeout(refreshTimer);
      set({ isSigningOut: true });
      // Let any in-flight refresh finish writing cookies before logout clears them.
      await activeCheck;

      try {
        await authApi.logout();
        set({ auth: { status: 'signedOut' } });
      } catch (error) {
        if (get().auth.status === 'signedIn') scheduleCheck(5_000);
        throw error;
      } finally {
        set({ isSigningOut: false });
      }
    },
  };
});
