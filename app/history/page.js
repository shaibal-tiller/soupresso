'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AppShell from '../AppShell';
import { useLang } from '../LangProvider';
import { todayStr, shiftDateStr } from '@/lib/dates';

export default function HistoryPage() {
  const { t, taka, dateLong, dateDisplay } = useLang();
  const [date, setDate] = useState(todayStr());
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const dateRef = useRef(null);

  const load = useCallback(async (d) => {
    setLoading(true); setNotFound(false);
    try {
      const res = await fetch(`/api/entries?date=${d}`);
      const data = await res.json();
      if (data.entry) { setEntry(data.entry); } else { setEntry(null); setNotFound(true); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  return (
    <AppShell>
      <div className="day-nav no-print">
        <button onClick={() => setDate(shiftDateStr(date, -1))}>‹</button>
        <button className="date-picker-btn" onClick={() => dateRef.current?.showPicker?.()}>
          <span className="cal-icon">📅</span>
          <span>{dateDisplay(date)}</span>
          <input
            ref={dateRef}
            type="date" value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="date-hidden-input"
          />
        </button>
        <button onClick={() => setDate(shiftDateStr(date, 1))}>›</button>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text2)' }}>{t('Loading…')}</div>
      ) : notFound ? (
        <div className="card" style={{ textAlign: 'center', padding: 30 }}>
          <p style={{ color: 'var(--text2)', marginBottom: 12 }}>{t('No entry for this day yet.')}</p>
          <a href="/entry" className="btn" style={{ display: 'inline-flex' }}>{t('Go to Daily Entry')}</a>
        </div>
      ) : entry.is_off_day ? (
        <div className="receipt-card">
          <div className="receipt-header">
            <img src="/logo.jpg" alt="Soupresso" className="receipt-logo" />
            <div>
              <div className="receipt-brand">Soupresso</div>
              <div className="receipt-subtitle">{t('Daily Cash Receipt')}</div>
            </div>
          </div>
          <div className="receipt-date">{dateLong(date)}</div>
          <div className="receipt-divider" />
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🚫</div>
            <h3 style={{ color: 'var(--text)', marginBottom: 4 }}>{t('Shop Closed')}</h3>
            {entry.notes && <p style={{ fontSize: 13, color: 'var(--text2)' }}>{entry.notes}</p>}
          </div>
          <div className="receipt-footer">
            <button className="btn secondary no-print" style={{ flex: 1 }} onClick={() => window.print()}>🖨 {t('Print')}</button>
            <a href="/entry" className="btn no-print" style={{ flex: 1, justifyContent: 'center' }}>✎ {t('Edit')}</a>
          </div>
        </div>
      ) : (
        <div className="receipt-card">
          <div className="receipt-header">
            <img src="/logo.jpg" alt="Soupresso" className="receipt-logo" />
            <div>
              <div className="receipt-brand">Soupresso</div>
              <div className="receipt-subtitle">{t('Daily Cash Receipt')}</div>
            </div>
          </div>
          <div className="receipt-date">{dateLong(date)}</div>
          <div className="receipt-divider" />

          <div className="receipt-row highlight green">
            <span className="receipt-label">{t('Total Sales')}</span>
            <span className="receipt-value">{taka(entry.total_sales)}</span>
          </div>
          <div className="receipt-row highlight red">
            <span className="receipt-label">{t('Expense (Bazar)')}</span>
            <span className="receipt-value">{taka(entry.bazar_actual_cost)}</span>
          </div>

          <div className="receipt-divider dashed" />

          <div className="receipt-row">
            <span className="receipt-label">{t('Next day bazar advance')}</span>
            <span className="receipt-value">{taka(entry.next_bazar_advance)}</span>
          </div>
          <div className="receipt-row">
            <span className="receipt-label">{t('Bhangti in box')}</span>
            <span className="receipt-value">{taka(entry.next_bhangti)}</span>
          </div>

          <div className="receipt-divider" />

          <div className="receipt-row highlight big">
            <span className="receipt-label">{t('Cash Taken Home')}</span>
            <span className={`receipt-value ${Number(entry.cash_taken_home) >= 0 ? 'green' : 'red'}`}>
              {taka(Number(entry.cash_taken_home))}
            </span>
          </div>

          {entry.notes && (
            <>
              <div className="receipt-divider dashed" />
              <div className="receipt-note">
                <span className="note-icon">📝</span>
                <span>{entry.notes}</span>
              </div>
            </>
          )}

          <div className="receipt-footer">
            <button className="btn secondary no-print" style={{ flex: 1 }} onClick={() => window.print()}>🖨 {t('Print')}</button>
            <a href="/entry" className="btn no-print" style={{ flex: 1, justifyContent: 'center' }}>✎ {t('Edit')}</a>
          </div>
        </div>
      )}
    </AppShell>
  );
}
