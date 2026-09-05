'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '../AppShell';

function todayStr() { return new Date().toISOString().slice(0, 10); }

export default function HistoryPage() {
  const [date, setDate] = useState(todayStr());
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async (d) => {
    setLoading(true); setNotFound(false);
    try {
      const res = await fetch(`/api/entries?date=${d}`);
      const data = await res.json();
      if (data.entry) { setEntry(data.entry); } else { setEntry(null); setNotFound(true); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  function shiftDate(days) {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().slice(0, 10));
  }

  const fmt = (n) => `৳${Math.abs(Number(n)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <AppShell>
      <div className="day-nav no-print">
        <button onClick={() => shiftDate(-1)}>‹</button>
        <div className="date-display">
          {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
        <button onClick={() => shiftDate(1)}>›</button>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text2)' }}>Loading…</div>
      ) : notFound ? (
        <div className="card" style={{ textAlign: 'center', padding: 30 }}>
          <p style={{ color: 'var(--text2)', marginBottom: 12 }}>No entry for this day.</p>
          <a href="/entry" className="btn" style={{ display: 'inline-flex' }}>Go to Daily Entry</a>
        </div>
      ) : (
        <div className="receipt-card">
          {/* Header with logo */}
          <div className="receipt-header">
            <img src="/logo.jpg" alt="Soupresso" className="receipt-logo" />
            <div>
              <div className="receipt-brand">Soupresso</div>
              <div className="receipt-subtitle">Daily Cash Receipt</div>
            </div>
          </div>

          <div className="receipt-date">
            {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>

          <div className="receipt-divider" />

          {/* Key numbers */}
          <div className="receipt-row highlight green">
            <span className="receipt-label">Total Sales</span>
            <span className="receipt-value">{fmt(entry.total_sales)}</span>
          </div>

          <div className="receipt-row highlight red">
            <span className="receipt-label">Expense (Bazar)</span>
            <span className="receipt-value">{fmt(entry.bazar_actual_cost)}</span>
          </div>

          <div className="receipt-divider dashed" />

          <div className="receipt-row">
            <span className="receipt-label">Next day bazar advance</span>
            <span className="receipt-value">{fmt(entry.next_bazar_advance)}</span>
          </div>

          <div className="receipt-row">
            <span className="receipt-label">Bhangti in box</span>
            <span className="receipt-value">{fmt(entry.next_bhangti)}</span>
          </div>

          <div className="receipt-divider" />

          <div className="receipt-row highlight big">
            <span className="receipt-label">Cash Taken Home</span>
            <span className={`receipt-value ${Number(entry.cash_taken_home) >= 0 ? 'green' : 'red'}`}>
              {Number(entry.cash_taken_home) < 0 ? '−' : ''}{fmt(entry.cash_taken_home)}
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
            <button className="btn secondary no-print" style={{ flex: 1 }} onClick={() => window.print()}>🖨 Print</button>
            <a href={`/entry`} className="btn no-print" style={{ flex: 1, justifyContent: 'center' }} onClick={() => {
              // Navigate to entry page — date state isn't shared, but the day-nav on entry lets them find it
            }}>✎ Edit this day</a>
          </div>
        </div>
      )}
    </AppShell>
  );
}
