'use client';

import { usePathname, useRouter } from 'next/navigation';
import LangToggle from './LangToggle';
import { useLang } from './LangProvider';

const TABS = [
  { href: '/entry', label: 'Daily Entry' },
  { href: '/history', label: 'Receipts' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/products', label: 'Products' },
];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLang();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      <div className="topbar no-print">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-logo"><img src="/logo.jpg" alt="Soupresso" /></div>
            <div className="brand-name">Soupresso</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LangToggle />
            <button className="btn secondary" style={{ padding: '7px 14px', fontSize: 12.5 }} onClick={logout}>
              {t('Log out')}
            </button>
          </div>
        </div>
        <nav className="tabbar">
          {TABS.map((tab) => (
            <a key={tab.href} href={tab.href} className={pathname.startsWith(tab.href) ? 'active' : ''}>
              {t(tab.label)}
            </a>
          ))}
        </nav>
      </div>
      <main>{children}</main>
    </>
  );
}
