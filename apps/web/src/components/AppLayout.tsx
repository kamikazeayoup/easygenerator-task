import type { ReactNode } from 'react';
import { Link } from 'react-router';
import artwork from '../assets/authentication-coral.webp';
import logo from '../assets/easygenerator-logo.png';

type AppLayoutProps = {
  children: ReactNode;
  navigation?: ReactNode;
};

export function AppLayout({ children, navigation }: AppLayoutProps) {
  return (
    <div className="app-layout">
      <header className="brand-panel">
        <img className="brand-artwork" src={artwork} alt="" />
        <Link className="brand" to="/">
          <img className="brand-logo" src={logo} alt="Easygenerator" width={497} height={176} />
        </Link>
      </header>
      <div className="page-panel">
        <main className="page-content">{children}</main>
        {navigation && (
          <nav className="account-navigation" aria-label="Account">
            {navigation}
          </nav>
        )}
      </div>
    </div>
  );
}
