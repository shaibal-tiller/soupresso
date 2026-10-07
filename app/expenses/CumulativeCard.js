'use client';

import { memo, useMemo, useState } from 'react';
import { useLang } from '../LangProvider';
import { useChartTip } from '../ChartTooltip';
import { unitLabel } from '@/lib/units';
import { GROUP_COLORS } from '@/lib/expense-groups';
import { cumulativeSeries, cumulativeBreakdown } from '@/lib/expense-cumulative';

const SALES_COLOR = '#1F8C5A';
const EXPENSE_COLOR = '#D14343';
const W = 560; const H = 220; const PAD = { l: 46, r: 14, t: 14, b: 26 };

// 1.2k / 45k / 1.1M style labels for the chart axis
function short(n) {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (a >= 10_000) return `${Math.round(n / 1000)}k`;
  if (a >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(n));
}

// Hover (mouse) / tap (touch) chart of cumulative sales vs expense. Re-renders only itself on hover.
const CumChart = memo(function CumChart({ series }) {
  const { t, taka, digits, dateShort } = useLang();
  const { bind, view } = useChartTip();
  const days = series.days;
  const n = days.length;
  if (n === 0) return null; // nothing to draw (a day before the first record)
  const maxY = Math.max(1, ...days.map((d) => Math.max(d.cumSales, d.cumExpense)));
  const plotW = W - PAD.l - PAD.r; const plotH = H - PAD.t - PAD.b;
  const x = (i) => PAD.l + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v) => PAD.t + plotH - (v / maxY) * plotH;
  const line = (key) => days.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ');
  const area = `${line('cumSales')} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const ticks = [0, 0.5, 1].map((f) => f * maxY);
  const labelEvery = Math.max(1, Math.ceil(n / 5));
  const last = days[n - 1];

  return (
    <div className="cum-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('Cumulative sales and expense')}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="cum-grid" />
            <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" className="cum-axis">{digits(short(v))}</text>
          </g>
        ))}
        <path d={area} fill={SALES_COLOR} opacity="0.1" />
        <path d={line('cumSales')} fill="none" stroke={SALES_COLOR} strokeWidth="2.2" strokeLinejoin="round" />
        <path d={line('cumExpense')} fill="none" stroke={EXPENSE_COLOR} strokeWidth="2.2" strokeLinejoin="round" />
        {days.map((d, i) => (i % labelEvery === 0 || i === n - 1) && (
          <text key={d.date} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="cum-axis">{digits(String(Number(d.date.slice(8))))}</text>
        ))}
        <circle cx={x(n - 1)} cy={y(last.cumSales)} r="4" fill={SALES_COLOR} />
        <circle cx={x(n - 1)} cy={y(last.cumExpense)} r="4" fill={EXPENSE_COLOR} />
        {days.map((d, i) => (
          <rect key={d.date} x={x(i) - plotW / Math.max(n, 1) / 2} y={PAD.t} width={plotW / Math.max(n, 1)} height={plotH} className="cum-hit"
            {...bind({
              title: dateShort(d.date, { weekday: 'short' }),
              rows: [
                { label: t('Sales so far'), value: taka(d.cumSales), color: SALES_COLOR },
                { label: t('Expense so far'), value: taka(d.cumExpense), color: EXPENSE_COLOR },
                { label: t('Net'), value: taka(d.cumSales - d.cumExpense) },
              ],
            })} />
        ))}
      </svg>
      <div className="cum-legend"><span><i style={{ background: SALES_COLOR }} />{t('Sales')}</span><span><i style={{ background: EXPENSE_COLOR }} />{t('Expense')}</span></div>
      {view}
    </div>
  );
});

// The second gallery card: running totals up to the viewed day (this month, or all time), a chart, and the
// item-by-item expense breakdown (biggest first).
export default function CumulativeCard({ data, date, firstDate, mode, onMode, slideClass }) {
  const { t, taka, digits, dateShort } = useLang();
  const [showAll, setShowAll] = useState(false);
  // sub-categories (default) or the plain item ranking; remembered between visits
  const [detail, setDetail] = useState(() => { try { return localStorage.getItem('soupresso_gallery_cum_detail') === 'item' ? 'item' : 'category'; } catch { return 'category'; } });
  const pickDetail = (d) => { setDetail(d); try { localStorage.setItem('soupresso_gallery_cum_detail', d); } catch { /* ignore */ } };
  const daily = data.daily || []; const lines = data.lines || [];

  const series = useMemo(() => cumulativeSeries(daily, mode, date, firstDate), [daily, mode, date, firstDate]);
  const breakdown = useMemo(() => cumulativeBreakdown(daily, lines, mode, date, firstDate), [daily, lines, mode, date, firstDate]);
  const { totals } = series;
  const top = showAll ? breakdown.items : breakdown.items.slice(0, 10);
  const maxItem = breakdown.items.length ? Math.max(...breakdown.items.map((i) => i.total), 1) : 1;
  const monthName = digits(new Date(`${date.slice(0, 7)}-15T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));

  const qty = (i) => {
    if (i.qty == null || !i.unit) return null;
    const u = unitLabel(i.unit);
    return `${digits(String(i.qty))}${/^\d/.test(u) ? ' × ' : ' '}${u}`;
  };

  return (
    <div className={`gallery-card ${slideClass || ''}`}>
      <div className="gallery-date" style={{ marginBottom: 8 }}>{t('Running total')}</div>
      <div className="toggle-row" style={{ marginBottom: 6 }}>
        <button className={mode === 'month' ? 'on' : ''} onClick={() => onMode('month')} style={{ fontSize: 12, padding: '6px 10px' }}>{t('This month')}</button>
        <button className={mode === 'all' ? 'on' : ''} onClick={() => onMode('all')} style={{ fontSize: 12, padding: '6px 10px' }}>{t('All time')}</button>
      </div>
      <p className="cum-sub">
        {series.days.length === 0
          ? `${mode === 'month' ? monthName : t('All time')} · ${dateShort(date)}`
          : `${mode === 'month' ? monthName : t('All time')} · ${dateShort(series.from)} → ${dateShort(date)} · ${digits(String(series.days.length))} ${t('days')}`}
      </p>

      <div className="kpi-row" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 12 }}>
        <div className="kpi"><div className="kpi-label">{t('Sales')}</div><div className="kpi-value g">{taka(totals.sales)}</div></div>
        <div className="kpi"><div className="kpi-label">{t('Expense')}</div><div className="kpi-value r">{taka(totals.expense)}</div></div>
        <div className="kpi"><div className="kpi-label">{t('Net')}</div><div className={`kpi-value ${totals.net >= 0 ? 'g' : 'r'}`}>{taka(totals.net)}</div></div>
        <div className="kpi"><div className="kpi-label">{t('% of sales')}</div><div className="kpi-value">{totals.expensePct != null ? `${digits(String(Math.round(totals.expensePct * 100)))}%` : '—'}</div></div>
      </div>

      {series.days.length === 0 ? (
        <p className="gallery-note" style={{ margin: '12px 0' }}>
          {t('No records yet on this day — your records start on')} {firstDate ? dateShort(firstDate) : '—'}.
        </p>
      ) : (
        <CumChart series={series} />
      )}

      {/* Main categories: Cost of Goods / Operational / Overhead and their share of all expense */}
      <div className="gallery-group-head" style={{ marginTop: 16 }}>
        <span>{t('Main categories')}</span>
        <b>{taka(breakdown.total)}</b>
      </div>
      <div style={{ display: 'flex', height: 12, borderRadius: 5, overflow: 'hidden', gap: 2, margin: '10px 0 6px' }}>
        {breakdown.byType.map((g) => <div key={g.group} style={{ width: `${Math.max(g.share * 100, 0)}%`, background: GROUP_COLORS[g.group] }} title={`${t(g.group)}: ${taka(g.total)}`} />)}
      </div>
      {breakdown.byType.map((g) => (
        <div key={g.group} className="cum-type">
          <span><i style={{ background: GROUP_COLORS[g.group] }} />{t(g.group)}</span>
          <span className="cum-type-pct">{digits(String(Math.round(g.share * 100)))}%</span>
          <b>{taka(g.total)}</b>
        </div>
      ))}

      <div className="toggle-row" style={{ margin: '16px 0 4px' }}>
        <button className={detail === 'category' ? 'on' : ''} onClick={() => pickDetail('category')} style={{ fontSize: 12, padding: '6px 10px' }}>{t('By sub-category')}</button>
        <button className={detail === 'item' ? 'on' : ''} onClick={() => pickDetail('item')} style={{ fontSize: 12, padding: '6px 10px' }}>{t('By item')}</button>
      </div>

      {breakdown.items.length === 0 ? (
        <p className="gallery-note" style={{ margin: '10px 0' }}>{t('No expense recorded in this period.')}</p>
      ) : detail === 'category' ? (
        breakdown.byType.map((g) => (
          <div key={g.group} className="gallery-group">
            <div className="gallery-group-head">
              <span><i style={{ background: GROUP_COLORS[g.group] }} />{t(g.group)} <small>{digits(String(Math.round(g.share * 100)))}%</small></span>
              <b>{taka(g.total)}</b>
            </div>
            {g.categories.map((c, idx) => (
              <div key={c.category ?? '__u'} className="cum-item">
                <div className="cum-item-top">
                  <span className="cum-item-name"><em>{idx + 1}</em>{c.unitemized ? <i>{t('Unitemized (saved as one total)')}</i> : t(c.category)}</span>
                  <span className="cum-item-amt">{taka(c.total)} <small>{digits(String(Math.round(c.share * 100)))}%</small></span>
                </div>
                <div className="cum-bar"><div style={{ width: `${Math.max(c.shareOfType * 100, 1.5)}%`, background: GROUP_COLORS[g.group] }} /></div>
              </div>
            ))}
          </div>
        ))
      ) : (
        <>
          {top.map((i, idx) => (
            <div key={i.key} className="cum-item">
              <div className="cum-item-top">
                <span className="cum-item-name"><em>{idx + 1}</em>{i.unitemized ? <i>{t('Unitemized (saved as one total)')}</i> : i.name}{qty(i) && <small>{qty(i)}</small>}</span>
                <span className="cum-item-amt">{taka(i.total)} <small>{digits(String(Math.round(i.share * 100)))}%</small></span>
              </div>
              <div className="cum-bar"><div style={{ width: `${Math.max((i.total / maxItem) * 100, 1.5)}%`, background: GROUP_COLORS[i.group] }} /></div>
            </div>
          ))}
          {breakdown.items.length > 10 && (
            <button type="button" className="btn secondary btn-small" style={{ marginTop: 10 }} onClick={() => setShowAll((v) => !v)}>
              {showAll ? t('Show top 10') : `${t('Show all')} ${digits(String(breakdown.items.length))}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
