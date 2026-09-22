'use client';

import { useEffect, useState } from 'react';

// A full-viewport branded loading screen shown briefly on cold load. Native
// PWA splash screens (driven by manifest.json) can only ever show a small
// centered icon on a flat background color — there's no way to make that
// full-bleed from the manifest alone. This component is the actual
// full-window "photo" experience: logo, name and a little steam doodle on a
// warm thematic gradient, self-dismissing once the app has had a moment to
// settle in.
export default function SplashScreen() {
  // null = not yet determined (nothing renders, avoids a flash on browser
  // tabs/desktop); true = installed PWA cold start, show + auto-dismiss.
  const [show, setShow] = useState(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setShow(isStandalone);
    if (!isStandalone) return;
    const timer = setTimeout(() => setHidden(true), 1100);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div className={`splash-screen${hidden ? ' hidden' : ''}`} aria-hidden={hidden}>
      <div className="splash-dot" style={{ width: 10, height: 10, top: '18%', left: '22%', background: '#fff' }} />
      <div className="splash-dot" style={{ width: 6, height: 6, top: '28%', left: '76%', background: '#1F5C42' }} />
      <div className="splash-dot" style={{ width: 14, height: 14, top: '72%', left: '80%', background: '#fff' }} />
      <div className="splash-dot" style={{ width: 8, height: 8, top: '78%', left: '16%', background: '#1F5C42' }} />

      <span className="splash-doodle" style={{ top: '14%', left: '12%', animationDelay: '0s' }}>🛒</span>
      <span className="splash-doodle" style={{ top: '20%', left: '78%', animationDelay: '0.6s' }}>🥟</span>
      <span className="splash-doodle" style={{ top: '64%', left: '10%', animationDelay: '1.1s' }}>🌶️</span>
      <span className="splash-doodle" style={{ top: '68%', left: '72%', animationDelay: '0.3s' }}>🍲</span>
      <span className="splash-doodle" style={{ top: '85%', left: '40%', animationDelay: '0.9s' }}>🥣</span>

      <svg width="90" height="44" viewBox="0 0 90 44" style={{ marginBottom: -6 }}>
        <path className="splash-steam-line" d="M18 40 C 10 28, 26 22, 18 10" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.7" />
        <path className="splash-steam-line" style={{ animationDelay: '0.4s' }} d="M45 40 C 37 26, 53 20, 45 6" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.85" />
        <path className="splash-steam-line" style={{ animationDelay: '0.8s' }} d="M72 40 C 64 28, 80 22, 72 10" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.7" />
      </svg>

      <img src="/icon-512.png" alt="Soupresso" className="splash-logo" />
      <div className="splash-name">Soupresso</div>
      <div className="splash-tag">Soup &amp; Momo</div>
    </div>
  );
}
