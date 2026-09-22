'use client';

import { usePathname, useRouter } from 'next/navigation';
import LangToggle from './LangToggle';
import { useLang } from './LangProvider';

const TABS = [
  { href: '/entry', label: 'Daily Entry' },
  { href: '/history', label: 'Receipts' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/expenses', label: 'Expenses' },
  { href: '/products', label: 'Products' },
  { href: '/investments', label: 'Investments' },
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
    <div className="shell-layout">
      {/* Desktop-only sidenav (CSS hides it below 900px; the tabbar below takes over) */}
      <nav className="sidenav no-print">
        <div className="sidenav-brand">
          <div className="brand-logo"><img src="/logo.jpg" alt="Soupresso" /></div>
          <div className="brand-name">Soupresso</div>
        </div>
        <div className="sidenav-links">
          {TABS.map((tab) => (
            <a key={tab.href} href={tab.href} className={pathname.startsWith(tab.href) ? 'active' : ''}>
              {t(tab.label)}
            </a>
          ))}
        </div>
        <div className="sidenav-footer">
          <LangToggle />
          <button className="btn secondary" style={{ padding: '7px 14px', fontSize: 12.5 }} onClick={logout}>
            {t('Log out')}
          </button>
        </div>
      </nav>

      <div className="shell-main">
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
          {/* Phone/tablet menu bar — CSS hides this at desktop widths in favor of the sidenav */}
          <nav className="tabbar">
            {TABS.map((tab) => (
              <a key={tab.href} href={tab.href} className={pathname.startsWith(tab.href) ? 'active' : ''}>
                {t(tab.label)}
              </a>
            ))}
          </nav>
        </div>
        <main>{children}</main>
      </div>
    </div>
  );
}
