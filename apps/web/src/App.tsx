import { RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { SignInPage } from './auth/SignInPage';
import { SignUpPage } from './auth/SignUpPage';
import { useAuthStore } from './auth/auth-store';
import { AppLayout } from './components/AppLayout';
import { PageHeading } from './components/PageHeading';
import { AccountPage } from './pages/AccountPage';

export function App() {
  const auth = useAuthStore((store) => store.auth);
  const checkLogin = useAuthStore((store) => store.checkLogin);

  useEffect(() => {
    void checkLogin();
    function checkOnReturn() {
      if (document.visibilityState === 'visible' && useAuthStore.getState().auth.status === 'signedIn') {
        void checkLogin();
      }
    }
    document.addEventListener('visibilitychange', checkOnReturn);
    return () => document.removeEventListener('visibilitychange', checkOnReturn);
  }, [checkLogin]);

  if (auth.status === 'checking') {
    return (
      <AppLayout>
        <div role="status" className="page-heading">
          <PageHeading>Checking your session…</PageHeading>
        </div>
      </AppLayout>
    );
  }

  if (auth.status === 'unavailable') {
    return (
      <AppLayout>
        <div className="page-heading">
          <PageHeading>We couldn’t check your session.</PageHeading>
          <p>Check your connection and try again.</p>
        </div>
        <button className="button button--primary" type="button" onClick={() => void checkLogin()}>
          Try again <RefreshCw aria-hidden="true" />
        </button>
      </AppLayout>
    );
  }

  if (auth.status === 'signedIn') {
    return (
      <Routes>
        <Route path="/app" element={<AccountPage user={auth.user} />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/sign-up" element={<SignUpPage />} />
      <Route path="*" element={<Navigate to="/sign-in" replace />} />
    </Routes>
  );
}
