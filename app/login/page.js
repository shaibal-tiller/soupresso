'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLang } from '../LangProvider';
import LangToggle from '../LangToggle';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="login-shell" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLang();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t('Login failed.'));
        setLoading(false);
        return;
      }
      const next = searchParams.get('next') || '/entry';
      router.push(next);
      router.refresh();
    } catch {
      setError(t('Could not reach the server. Check your connection and try again.'));
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}><LangToggle /></div>
        <div className="login-logo"><img src="/logo.jpg" alt="Soupresso" /></div>
        <h1 style={{ fontSize: 20, color: 'var(--brand-green)', marginBottom: 4 }}>Soupresso</h1>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 22 }}>{t('Cash register — sign in to continue')}</p>

        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
          <div className="field">
            <label>{t('Email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="username"
            />
          </div>
          <div className="field">
            <label>{t('Password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {error && <div className="status-msg err">{error}</div>}
          <button type="submit" className="btn block" disabled={loading}>
            {loading ? t('Signing in…') : t('Sign in')}
          </button>
        </form>
      </div>
    </div>
  );
}
