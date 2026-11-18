import { LogOut, UserRound } from 'lucide-react';
import { useState } from 'react';
import type { PublicUser } from '../auth/auth-schemas';
import { useAuthStore } from '../auth/auth-store';
import { AppLayout } from '../components/AppLayout';
import { Notice } from '../components/Notice';
import { PageHeading } from '../components/PageHeading';

export function AccountPage({ user }: { user: PublicUser }) {
  const signOut = useAuthStore((store) => store.signOut);
  const isSigningOut = useAuthStore((store) => store.isSigningOut);
  const [signOutFailed, setSignOutFailed] = useState(false);

  async function handleSignOut() {
    setSignOutFailed(false);
    try {
      await signOut();
    } catch {
      setSignOutFailed(true);
    }
  }

  return (
    <AppLayout>
      <div className="page-heading">
        <PageHeading>Welcome to the application.</PageHeading>
      </div>
      <div className="account-details">
        <span className="account-icon"><UserRound aria-hidden="true" /></span>
        <div>
          <p className="account-name"><bdi>{user.name}</bdi></p>
          <p className="account-email"><bdi>{user.email}</bdi></p>
        </div>
      </div>
      {signOutFailed && <Notice kind="error">We couldn’t sign you out. Try again.</Notice>}
      <button className="button button--secondary" type="button" onClick={handleSignOut} disabled={isSigningOut}>
        <LogOut aria-hidden="true" />
        {isSigningOut ? 'Signing out…' : 'Sign out'}
      </button>
    </AppLayout>
  );
}
