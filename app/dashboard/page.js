'use client';

import { useState, useEffect } from 'react';
import AppShell from '../AppShell';

const RANGES = [
  { key: '7d', label: '7 days' },
  { key: '14d', label: '14 days' },
  { key: '30d', label: '30 days' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
];

const VIEWS = [
  { key: 'daily', label: 'Day' },
  { key: 'weekly', label: 'Week' },
  { key: 'monthly', label: 'Month' },
];

export default function DashboardPage() {
  const [range, setRange] = useState('month');
  const [view, setView] = useState('daily');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard?range=${range}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [range]);

  const fmt = (n) => `৳${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  if (loading) return <AppShell><div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text2)' }}>Loading…</div></AppShell>;

  const s = data?.summary || {};
  const chartData = view === 'weekly' ? data?.weekly : view === 'monthly' ? data?.monthly : data?.daily;
  const maxSale = chartData?.length ? Math.max(...chartData.map((r) => Number(r.total_sales)), 1) : 1;

  function chartLabel(row) {
    if (view === 'weekly') {
      const d = new Date(row.week_start);
      return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    if (view === 'monthly') return row.month;
    const d = new Date(row.entry_date);
    return d.getDate();
  }

  function chartTooltip(row) {
    const sales = fmt(row.total_sales);
    if (view === 'weekly') return `Week of ${new Date(row.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${sales} (${row.days_count}d)`;
    if (view === 'monthly') return `${row.month}: ${sales} (${row.days_count}d)`;
    return `${row.entry_date}: ${sales}`;
  }

  return (
    <AppShell>
      {/* Range filter pills */}
      <div className="toggle-row" style={{ marginBottom: 6 }}>
        {RANGES.map((r) => (
          <button key={r.key} className={range === r.key ? 'on' : ''} onClick={() => setRange(r.key)} style={{ fontSize: 12, padding: '7px 10px' }}>
            {r.label}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="kpi-row">
        <div className="kpi"><div className="kpi-label">Total sales</div><div className="kpi-value">{fmt(s.totalSales)}</div></div>
        <div className="kpi"><div className="kpi-label">Avg daily</div><div className="kpi-value">{fmt(s.avgDailySales)}</div></div>
        <div className="kpi"><div className="kpi-label">Total expense</div><div className="kpi-value r">{fmt(s.totalExpense)}</div></div>
        <div className="kpi"><div className="kpi-label">Taken home</div><div className={`kpi-value ${Number(s.totalTakeHome) >= 0 ? 'g' : 'r'}`}>{fmt(s.totalTakeHome)}</div></div>
        <div className="kpi"><div className="kpi-label">Days recorded</div><div className="kpi-value">{s.daysRecorded || 0}</div></div>
        <div className="kpi">
          <div className="kpi-label">Best day</div>
          <div className="kpi-value g" style={{ fontSize: 16 }}>
            {s.bestDay ? fmt(s.bestDay.total_sales) : '—'}
          </div>
          {s.bestDay && <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{new Date(s.bestDay.entry_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>}
        </div>
      </div>

      {/* Most recent day */}
      {data?.mostRecent && (
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>Last recorded</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {new Date(data.mostRecent.entry_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--display)', color: 'var(--brand-green)' }}>{fmt(data.mostRecent.total_sales)}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>sales</div>
          </div>
        </div>
      )}

      {/* Chart with view toggle */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="card-title" style={{ margin: 0 }}>Sales — {data?.range}</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {VIEWS.map((v) => (
              <button key={v.key}
                onClick={() => setView(v.key)}
                style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border2)',
                  background: view === v.key ? 'var(--brand-green)' : 'var(--bg)',
                  color: view === v.key ? '#fff' : 'var(--text3)', fontWeight: 600, cursor: 'pointer',
                }}>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {chartData?.length ? (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: view === 'daily' ? 3 : 6, height: 160 }}>
            {chartData.map((r, i) => {
              const val = Number(r.total_sales);
              const barH = Math.max(4, (val / maxSale) * 130);
              return (
                <div key={i} style={{ flex: 1, textAlign: 'center', minWidth: 0 }} title={chartTooltip(r)}>
                  <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {fmt(val)}
                  </div>
                  <div style={{ height: barH, background: 'var(--brand-green)', borderRadius: '4px 4px 0 0', margin: '0 auto', maxWidth: view === 'daily' ? 20 : 40 }} />
                  <div style={{ fontSize: view === 'daily' ? 9 : 10, color: 'var(--text3)', marginTop: 3, fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {chartLabel(r)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color: 'var(--text2)', fontSize: 13, textAlign: 'center', padding: 20 }}>No data for this range yet.</p>
        )}
      </div>

      {/* Weekly / Monthly summary table */}
      {(view === 'weekly' || view === 'monthly') && chartData?.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="receipt-table" style={{ fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ fontWeight: 700, color: 'var(--text2)', fontSize: 10, textTransform: 'uppercase' }}>{view === 'weekly' ? 'Week' : 'Month'}</td>
                <td style={{ fontWeight: 700, color: 'var(--text2)', fontSize: 10, textTransform: 'uppercase' }}>Days</td>
                <td style={{ fontWeight: 700, color: 'var(--text2)', fontSize: 10, textTransform: 'uppercase' }}>Sales</td>
                <td style={{ fontWeight: 700, color: 'var(--text2)', fontSize: 10, textTransform: 'uppercase' }}>Expense</td>
                <td style={{ fontWeight: 700, color: 'var(--text2)', fontSize: 10, textTransform: 'uppercase' }}>Net</td>
              </tr>
            </thead>
            <tbody>
              {chartData.map((r, i) => {
                const label = view === 'weekly' ? new Date(r.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : r.month;
                const net = Number(r.total_take_home || r.total_sales) - Number(r.total_expense || 0);
                return (
                  <tr key={i}>
                    <td style={{ color: 'var(--text)', fontWeight: 500, fontFamily: 'var(--sans)' }}>{label}</td>
                    <td>{r.days_count}</td>
                    <td style={{ color: 'var(--brand-green)' }}>{fmt(r.total_sales)}</td>
                    <td style={{ color: 'var(--red)' }}>{fmt(r.total_expense)}</td>
                    <td style={{ color: Number(r.total_take_home) >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(r.total_take_home)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
