'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useLang } from '../LangProvider';
import DatePicker from '../DatePicker';
import { cachedFetchJson, peekCache } from '@/lib/clientCache';
import { todayStr, shiftDateStr } from '@/lib/dates';
import { DATA_START } from '@/lib/periods';
import { unitLabel } from '@/lib/units';
import { GROUP_COLORS } from '@/lib/expense-groups';
import { buildDayCard, latestRecordedDate } from '@/lib/expense-gallery';
import { firstRecordedDate } from '@/lib/expense-cumulative';
import CumulativeCard from './CumulativeCard';

const URL_ALL = '/api/expenses?range=all';

// Past days rarely change, so the whole history is also kept in localStorage: the gallery opens instantly
// (even after a reload) from that copy and quietly refreshes it from the server. Small (~tens of KB).
const STORE_KEY = 'soupresso_gallery_history_v1';
const MODE_KEY = 'soupresso_gallery_cum_mode';
function readStored() {
  try { const v = JSON.parse(localStorage.getItem(STORE_KEY)); return v && v.data && v.data.daily ? v.data : null; } catch { return null; }
}
function writeStored(data) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ savedAt: Date.now(), data })); } catch { /* storage full or blocked: just skip */ }
}
function readMode() {
  try { return localStorage.getItem(MODE_KEY) === 'all' ? 'all' : 'month'; } catch { return 'month'; }
}

// Fullscreen, scrollable overlay: one card per day. Move with the ‹ › buttons, the arrow keys or a
// swipe; jump with the calendar or Today. Opens on the latest recorded day.
export default function ExpenseGallery({ open, onClose }) {
  const { t, taka, digits, dateShort } = useLang();
  const today = todayStr();
  const [data, setData] = useState(() => peekCache(URL_ALL) ?? null);
  const [cumMode, setCumMode] = useState('month');
  const [failed, setFailed] = useState(false);
  const [date, setDate] = useState(null);
  const [slide, setSlide] = useState('');
  const touch = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setFailed(false);
    setCumMode(readMode());
    // instant paint from the stored copy if the in-memory cache is empty, then refresh in the background
    if (!peekCache(URL_ALL)) { const stored = readStored(); if (stored) setData((cur) => cur || stored); }
    cachedFetchJson(URL_ALL)
      .then((d) => { if (alive) { setData(d); writeStored(d); } })
      .catch(() => { if (alive && !peekCache(URL_ALL) && !readStored()) setFailed(true); });
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // the overlay scrolls, the page behind it must not
    return () => { alive = false; document.body.style.overflow = prevOverflow; };
  }, [open]);

  // First time the data is here, open on the newest recorded day.
  useEffect(() => {
    if (data && date == null) setDate(latestRecordedDate(data.daily || [], today));
  }, [data, date, today]);

  function go(next, dir) {
    if (!next) return;
    const clamped = next < DATA_START ? DATA_START : next > today ? today : next;
    if (clamped === date) return;
    setSlide(dir ? `gallery-slide-${dir}` : 'gallery-fade');
    setDate(clamped);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }
  const step = (n) => { if (date) go(shiftDateStr(date, n), n > 0 ? 'next' : 'prev'); }; // nothing to step from until the data is in

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const firstDate = useMemo(() => (data ? firstRecordedDate(data.daily || [], data.lines || []) : null), [data]);
  const pickMode = (m) => { setCumMode(m); try { localStorage.setItem(MODE_KEY, m); } catch { /* ignore */ } };
  const card = useMemo(() => (data && date ? buildDayCard(date, data.daily || [], data.lines || []) : null), [data, date]);
  if (!open) return null;

  function onTouchStart(e) { const p = e.touches[0]; touch.current = { x: p.clientX, y: p.clientY }; }
  function onTouchEnd(e) {
    const s = touch.current; touch.current = null;
    if (!s) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - s.x; const dy = p.clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1); // swipe left = next day
  }

  const qty = (l) => {
    if (l.quantity == null || !l.unit) return null;
    const u = unitLabel(l.unit);
    return `${digits(String(Math.round(Number(l.quantity) * 1000) / 1000))}${/^\d/.test(u) ? ' × ' : ' '}${u}`;
  };

  return (
    <div className="gallery-overlay" role="dialog" aria-modal="true" aria-label={t('Expense gallery')}>
      <div className="gallery-bar">
        <button type="button" className="gallery-close" onClick={onClose} aria-label={t('Close')}>✕</button>
        <div className="gallery-nav">
          <button type="button" onClick={() => step(-1)} disabled={!date || date <= DATA_START} aria-label={t('Previous day')}>‹</button>
          {date && <DatePicker value={date} onChange={(d) => go(d, null)} minDate={DATA_START} />}
          <button type="button" onClick={() => step(1)} disabled={!date || date >= today} aria-label={t('Next day')}>›</button>
        </div>
        <button type="button" className="btn secondary btn-small" onClick={() => go(today, today > (date || '') ? 'next' : 'prev')} disabled={date === today}>
          {t('Today')}
        </button>
      </div>

      <div className="gallery-scroll" ref={scrollRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {failed ? (
          <p className="gallery-note">{t('Could not load expenses.')}</p>
        ) : !card ? (
          <p className="gallery-note">{t('Loading…')}</p>
        ) : (
          <div className="gallery-cards">
          <div key={date} className={`gallery-card ${slide}`}>
            <div className="gallery-date">{dateShort(date, { weekday: 'long', year: 'numeric' })}</div>

            {card.isOffDay && <div className="insight amber">🚫 {t('Shop closed')}</div>}

            {!card.hasData ? (
              <p className="gallery-note">{t('No expense recorded for this day.')}</p>
            ) : (
              <>
                <div className="kpi-row" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 12 }}>
                  <div className="kpi"><div className="kpi-label">{t('Expense')}</div><div className="kpi-value r">{taka(card.recorded)}</div></div>
                  <div className="kpi"><div className="kpi-label">{t('Sales')}</div><div className="kpi-value">{card.sales != null ? taka(card.sales) : '—'}</div></div>
                  <div className="kpi"><div className="kpi-label">{t('% of sales')}</div><div className="kpi-value">{card.expensePct != null ? `${digits(String(Math.round(card.expensePct * 100)))}%` : '—'}</div></div>
                </div>

                {card.groups.length > 0 && (
                  <div style={{ display: 'flex', height: 14, borderRadius: 5, overflow: 'hidden', gap: 2, marginBottom: 14 }}>
                    {card.groups.map((g) => (
                      <div key={g.group} style={{ width: `${Math.max(g.share * 100, 0)}%`, background: GROUP_COLORS[g.group], minWidth: g.total > 0 ? 3 : 0 }} title={`${t(g.group)}: ${taka(g.total)}`} />
                    ))}
                  </div>
                )}

                {card.groups.map((g) => (
                  <div key={g.group} className="gallery-group">
                    <div className="gallery-group-head">
                      <span><i style={{ background: GROUP_COLORS[g.group] }} />{t(g.group)} <small>{digits(String(Math.round(g.share * 100)))}%</small></span>
                      <b>{taka(g.total)}</b>
                    </div>
                    {g.items.map((l, i) => (
                      <div key={i} className="gallery-item">
                        <span className="gallery-item-name">
                          {l.unitemized ? <em>{t('Unitemized (saved as one total)')}</em> : l.name}
                          {qty(l) && <small>{qty(l)}</small>}
                        </span>
                        <span className="gallery-item-amt">{taka(l.lineTotal)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
          <CumulativeCard data={data} date={date} firstDate={firstDate} mode={cumMode} onMode={pickMode} slideClass={slide} />
          </div>
        )}
        <p className="gallery-note" style={{ fontSize: 11.5 }}>{t('Swipe, or use ‹ › / ← → to change day.')}</p>
      </div>
    </div>
  );
}
