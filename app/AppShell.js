'use client';

import { usePathname, useRouter } from 'next/navigation';

const TABS = [
  { href: '/entry', label: 'Daily Entry' },
  { href: '/history', label: 'Receipts' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/products', label: 'Products' },
];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();

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
          <button className="btn secondary" style={{ padding: '7px 14px', fontSize: 12.5 }} onClick={logout}>
            Log out
          </button>
        </div>
        <nav className="tabbar">
          {TABS.map((t) => (
            <a key={t.href} href={t.href} className={pathname.startsWith(t.href) ? 'active' : ''}>
              {t.label}
            </a>
          ))}
        </nav>
      </div>
      <main>{children}</main>
    </>
  );
}
