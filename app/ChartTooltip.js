'use client';

import { useState, useEffect, useCallback } from 'react';

// Hover (mouse) / tap (touch) tooltip for hand-rolled charts. Uses pointer
// events only, so it never interferes with an element's own onClick.
//
//   const { bind, view } = useChartTip();
//   <div {...bind({ title: '4 Oct', rows: [{ label: 'Sales', value: '৳4,200', color: '#1F8C5A' }] })} />
//   ... {view}
export function useChartTip() {
  const [tip, setTip] = useState(null); // { x, y, title, rows }

  const show = useCallback((e, content) => {
    if (!content) return;
    setTip({ x: e.clientX, y: e.clientY, ...content });
  }, []);

  // Touch has no "leave": a tap anywhere else, or scrolling, dismisses it.
  useEffect(() => {
    if (!tip) return undefined;
    const hide = () => setTip(null);
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [tip]);

  const bind = (content) => ({
    onPointerEnter: (e) => show(e, content),
    onPointerMove: (e) => show(e, content),
    onPointerLeave: (e) => { if (e.pointerType !== 'touch') setTip(null); },
    onPointerDown: (e) => { if (e.pointerType === 'touch') show(e, content); },
  });

  const W = 230;
  const left = tip ? Math.max(8, Math.min(tip.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 400) - W - 8)) : 0;
  const top = tip ? Math.max(8, tip.y - 12 - 24 - (tip.rows?.length || 0) * 18) : 0;

  const view = tip ? (
    <div className="chart-tip" style={{ left, top, width: W }} role="tooltip">
      {tip.title && <div className="chart-tip-title">{tip.title}</div>}
      {(tip.rows || []).map((r, i) => (
        <div key={i} className="chart-tip-row">
          <span>{r.color && <i style={{ background: r.color }} />}{r.label}</span>
          <b>{r.value}</b>
        </div>
      ))}
    </div>
  ) : null;

  return { bind, view };
}
