'use client';

import { useState, useEffect } from 'react';
import AppShell from '../AppShell';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const fmt = (n) => `৳${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  if (loading) {
    return (
      <AppShell>
        <div className="card">Loading…</div>
      </AppShell>
    );
  }

  const maxSale = data?.last14?.length ? Math.max(...data.last14.map((r) => Number(r.total_sales)), 1) : 1;

  return (
    <AppShell>
      <div className="card">
        <div className="card-title">Most recent recorded day</div>
        {data?.mostRecent ? (
          <>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>
              {new Date(data.mostRecent.entry_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <div className="kpi-row">
              <div className="kpi"><div className="kpi-label">Total sales</div><div className="kpi-value">{fmt(data.mostRecent.total_sales)}</div></div>
              <div className="kpi"><div className="kpi-label">Cash taken home</div><div className={`kpi-value ${Number(data.mostRecent.cash_taken_home) >= 0 ? 'g' : 'r'}`}>{fmt(data.mostRecent.cash_taken_home)}</div></div>
            </div>
          </>
        ) : (
          <p style={{ color: 'var(--text2)', fontSize: 13 }}>No entries recorded yet.</p>
        )}
      </div>

      <div className="card">
        <div className="card-title">This month so far</div>
        <div className="kpi-row">
          <div className="kpi"><div className="kpi-label">Total sales</div><div className="kpi-value">{fmt(data?.month?.totalSales)}</div></div>
          <div className="kpi"><div className="kpi-label">Avg daily sales</div><div className="kpi-value">{fmt(data?.month?.avgDailySales)}</div></div>
          <div className="kpi"><div className="kpi-label">Days recorded</div><div className="kpi-value">{data?.month?.daysRecorded || 0}</div></div>
          <div className="kpi"><div className="kpi-label">Total taken home</div><div className="kpi-value">{fmt(data?.month?.totalTakeHome)}</div></div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Last 14 days — sales</div>
        {data?.last14?.length ? (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 140 }}>
            {data.last14.map((r) => (
              <div key={r.entry_date} style={{ flex: 1, textAlign: 'center' }}>
                <div
                  title={`${r.entry_date}: ৳${Number(r.total_sales).toLocaleString()}`}
                  style={{
                    height: `${Math.max(4, (Number(r.total_sales) / maxSale) * 110)}px`,
                    background: 'var(--brand-green)',
                    borderRadius: '4px 4px 0 0',
                  }}
                />
                <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 4 }}>
                  {new Date(r.entry_date).getDate()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text2)', fontSize: 13 }}>Not enough data yet.</p>
        )}
      </div>
    </AppShell>
  );
}
