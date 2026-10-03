'use client';

import { useState, useEffect } from 'react';
import { useLang } from '../LangProvider';
import PeriodFilter from '../PeriodFilter';
import { todayStr } from '@/lib/dates';
import { initialPeriod, resolvePeriod } from '@/lib/periods';
import { cachedFetchJson, peekCache } from '@/lib/clientCache';

const url = (r) => `/api/sales-tally/summary?from=${r.from}&to=${r.to}`;

// Weekly / monthly (or any range) view of the Sales Tally: what sold per item,
// and how the tally's computed sales compare with the actual cash sales day by day.
// Tapping a day opens it on the Today's tally tab.
export default function TallyHistory({ onOpenDay }) {
  const { t, taka, digits, dateNice, dateShort } = useLang();
  const [period, setPeriod] = useState(() => ({ ...initialPeriod(todayStr()), mode: 'week' }));
  const range = resolvePeriod(period, todayStr());
  const [data, setData] = useState(() => peekCache(url(range)) ?? null);
  const [loading, setLoading] = useState(() => peekCache(url(range)) === undefined);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const u = url(range);
    const cached = peekCache(u);
    if (cached) { setData(cached); setLoading(false); } else { setLoading(true); }
    setError(false);
    cachedFetchJson(u)
      .then((d) => { if (alive) { setData(d); setLoading(false); } })
      .catch(() => { if (alive) { setError(true); setLoading(false); } });
    return () => { alive = false; };
  }, [range.from, range.to]);

  const totals = data?.totals;
  const pct = totals && totals.comparedActual ? Math.abs(totals.variance) / totals.comparedActual : 0;
  const tone = pct <= 0.02 ? 'green' : pct <= 0.05 ? 'amber' : 'red';
  const dayColor = { good: 'var(--green)', warning: 'var(--amber)', danger: 'var(--red)' };
  const soldItems = (data?.items || []).filter((i) => i.quantity > 0).sort((a, b) => b.value - a.value);
  const untallied = (data?.days || []).filter((d) => !d.hasTally && d.actual != null).length;

  return (
    <>
      <PeriodFilter value={period} onChange={setPeriod} />

      {loading && !data ? (
        <p style={{ color: 'var(--text2)' }}>{t('Loading…')}</p>
      ) : error ? (
        <p style={{ color: 'var(--red)', fontSize: 13 }}>{t('Could not load this period.')}</p>
      ) : !data || data.days.length === 0 ? (
        <p style={{ color: 'var(--text2)', fontSize: 13 }}>{t('Nothing tallied in this period.')}</p>
      ) : (
        <div style={{ opacity: loading ? 0.6 : 1 }}>
          <div className="kpi-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="kpi"><div className="kpi-label">{t('Tally total')}</div><div className="kpi-value">{taka(totals.computed)}</div></div>
            <div className="kpi"><div className="kpi-label">{t('Cash sales')}</div><div className="kpi-value">{taka(totals.comparedActual)}</div></div>
            <div className="kpi">
              <div className="kpi-label">{t('Difference')}</div>
              <div className={`kpi-value ${tone === 'green' ? 'g' : tone === 'amber' ? 'a' : 'r'}`}>{totals.variance > 0 ? '+' : ''}{taka(totals.variance)}</div>
            </div>
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--text3)', margin: '-4px 0 12px' }}>
            {t('Tally vs cash is compared on')} {digits(String(totals.daysCompared))} {t('days that have both.')}
            {untallied > 0 && <> {digits(String(untallied))} {t('days have cash sales but no tally yet.')}</>}
          </p>

          <div className="card">
            <div className="card-title">{t('Sold')} — {dateShort(range.from)} – {dateShort(range.to)}</div>
            <table className="denom-table">
              <thead><tr><th>{t('Item')}</th><th>{t('Sold')}</th><th>{t('Value')}</th></tr></thead>
              <tbody>
                {soldItems.map((i) => (
                  <tr key={i.id}>
                    <td>{i.name}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{digits(String(i.quantity))}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{taka(i.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="step-result" style={{ marginTop: 8 }}><span>{t('Total')}</span><strong>{taka(totals.computed)}</strong></div>
          </div>

          <div className="card">
            <div className="card-title">{t('By day')}</div>
            <table className="denom-table">
              <thead><tr><th>{t('Date')}</th><th>{t('Tally')}</th><th>{t('Cash')}</th><th>{t('Diff')}</th></tr></thead>
              <tbody>
                {[...data.days].reverse().map((d) => (
                  <tr key={d.date} onClick={() => onOpenDay(d.date)} style={{ cursor: 'pointer' }}>
                    <td>{dateNice(d.date)}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{d.hasTally ? taka(d.computed) : '—'}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{d.actual != null ? taka(d.actual) : '—'}</td>
                    <td style={{ fontFamily: 'var(--mono)', color: d.status ? dayColor[d.status] : 'var(--text3)' }}>
                      {d.variance == null ? '—' : `${d.variance > 0 ? '+' : ''}${taka(d.variance)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8 }}>{t('Tap a day to open its tally.')}</p>
          </div>
        </div>
      )}
    </>
  );
}
