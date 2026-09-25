'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import LangToggle from './LangToggle';
import { useLang } from './LangProvider';

const TABS = [
  { href: '/entry', label: 'Daily Entry' },
  { href: '/history', label: 'Receipts' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/expenses', label: 'Expenses' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/products', label: 'Products' },
  { href: '/bazar-items', label: 'Bazar Catalog' },
  { href: '/investments', label: 'Investments' },
  { href: '/cash-in-hand', label: 'Cash in Hand' },
];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLang();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [drawerOpen]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="shell-layout">
      {/* Desktop-only sidenav (CSS hides it below 900px; the drawer below takes over) */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="menu-btn"
                aria-label={t('Menu')}
                aria-expanded={drawerOpen}
                onClick={() => setDrawerOpen(true)}
              >
                <span /><span /><span />
              </button>
              <div className="brand">
                <div className="brand-logo"><img src="/logo.jpg" alt="Soupresso" /></div>
                <div className="brand-name">Soupresso</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <LangToggle />
              <button className="btn secondary" style={{ padding: '7px 14px', fontSize: 12.5 }} onClick={logout}>
                {t('Log out')}
              </button>
            </div>
          </div>
        </div>
        <main>{children}</main>
      </div>

      {/* Phone/tablet drawer nav — CSS hides this entirely at desktop widths in favor of the sidenav */}
      <div
        className={`drawer-overlay no-print${drawerOpen ? ' open' : ''}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />
      <nav className={`drawer no-print${drawerOpen ? ' open' : ''}`} aria-hidden={!drawerOpen}>
        <div className="sidenav-brand">
          <div className="brand-logo"><img src="/logo.jpg" alt="Soupresso" /></div>
          <div className="brand-name">Soupresso</div>
        </div>
        <div className="sidenav-links">
          {TABS.map((tab) => (
            <a
              key={tab.href}
              href={tab.href}
              className={pathname.startsWith(tab.href) ? 'active' : ''}
              onClick={() => setDrawerOpen(false)}
            >
              {t(tab.label)}
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}
