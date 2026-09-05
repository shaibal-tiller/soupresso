'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '../AppShell';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function HistoryPage() {
  const [date, setDate] = useState(todayStr());
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async (d) => {
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/entries?date=${d}`);
      const data = await res.json();
      if (data.entry) {
        setEntry(data.entry);
      } else {
        setEntry(null);
        setNotFound(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  function shiftDate(days) {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().slice(0, 10));
  }

  const fmt = (n) => `৳${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

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
        <div className="card">Loading…</div>
      ) : notFound ? (
        <div className="card">
          <p style={{ color: 'var(--text2)' }}>No entry saved for this day yet.</p>
          <a href="/entry" className="btn" style={{ marginTop: 12, display: 'inline-flex' }}>Go to Daily Entry</a>
        </div>
      ) : (
        <div className="card">
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div className="brand-name" style={{ fontSize: 19 }}>Soupresso</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Daily Cash Receipt</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>{new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
          </div>

          <table className="receipt-table">
            <tbody>
              <tr><td>Total counted in box</td><td>{fmt(entry.total_counted)}</td></tr>
              <tr><td>Opening bhangti</td><td>-{fmt(entry.opening_bhangti)}</td></tr>
              <tr style={{ fontWeight: 700 }}><td>Total sales</td><td>{fmt(entry.total_sales)}</td></tr>
              <tr><td style={{ paddingTop: 14 }}>Bazar advance received</td><td style={{ paddingTop: 14 }}>{fmt(entry.bazar_advance_received)}</td></tr>
              <tr><td>Actual bazar cost</td><td>{fmt(entry.bazar_actual_cost)}</td></tr>
              <tr><td>Bazar variance {Number(entry.bazar_variance) > 0 ? '(given to chef)' : Number(entry.bazar_variance) < 0 ? '(returned by chef)' : ''}</td><td>{fmt(Math.abs(entry.bazar_variance))}</td></tr>
              <tr><td style={{ paddingTop: 14 }}>Bazar advance for tomorrow</td><td style={{ paddingTop: 14 }}>-{fmt(entry.next_bazar_advance)}</td></tr>
              <tr><td>Bhangti kept for tomorrow</td><td>-{fmt(entry.next_bhangti)}</td></tr>
              <tr style={{ fontWeight: 700, fontSize: 15 }}><td style={{ paddingTop: 14 }}>Cash taken home</td><td style={{ paddingTop: 14, color: Number(entry.cash_taken_home) >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(entry.cash_taken_home)}</td></tr>
            </tbody>
          </table>

          {entry.notes && (
            <div className="insight amber" style={{ marginTop: 14 }}>
              <b>Note:</b> {entry.notes}
            </div>
          )}

          <button className="btn secondary block no-print" style={{ marginTop: 18 }} onClick={() => window.print()}>
            🖨 Print this receipt
          </button>
        </div>
      )}
    </AppShell>
  );
}
