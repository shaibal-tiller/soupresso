'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AppShell from '../AppShell';
import { todayStr, shiftDateStr } from '@/lib/dates';
import { useLang } from '../LangProvider';
import NumberInput from '../NumberInput';
import { cachedFetchJson, peekCache, invalidateCache, prefetchJson, runWhenIdle } from '@/lib/clientCache';

function tallyUrl(d) {
  return `/api/sales-tally?date=${d}`;
}

export default function SalesTallyPage() {
  const { t, taka, digits, dateDisplay } = useLang();
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [batchQty, setBatchQty] = useState({});

  const requestRef = useRef(0);

  const loadTally = useCallback(async (d) => {
    const url = tallyUrl(d);
    const requestId = ++requestRef.current;
    const cached = peekCache(url);
    if (cached) setData(cached);
    else setLoading(true);
    try {
      const json = await cachedFetchJson(url);
      if (requestRef.current !== requestId) return;
      setData(json);
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => { loadTally(date); }, [date, loadTally]);

  useEffect(() => {
    if (loading) return;
    runWhenIdle(() => {
      prefetchJson(tallyUrl(shiftDateStr(date, -1)));
      prefetchJson(tallyUrl(shiftDateStr(date, 1)));
    });
  }, [date, loading]);

  async function addBatch(item) {
    const qty = batchQty[item.id];
    if (!qty || Number(qty) <= 0) return;
    setSaving(true);
    await fetch('/api/sales-tally/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, itemId: item.id, quantity: qty }),
    });
    setBatchQty((prev) => ({ ...prev, [item.id]: '' }));
    setSaving(false);
    invalidateCache(tallyUrl(date));
    loadTally(date);
  }

  async function deleteBatch(entryId) {
    setSaving(true);
    await fetch(`/api/sales-tally/entries?id=${entryId}`, { method: 'DELETE' });
    setSaving(false);
    invalidateCache(tallyUrl(date));
    loadTally(date);
  }

  async function saveBowlCount(item, singleCount, doubleCount) {
    setSaving(true);
    await fetch('/api/sales-tally/bowl-count', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, itemId: item.id, singleCount, doubleCount }),
    });
    setSaving(false);
    invalidateCache(tallyUrl(date));
    loadTally(date);
  }

  const statusClass = { good: 'green', warning: 'amber', danger: 'red' };

  return (
    <AppShell>
      <div className="day-nav">
        <button onClick={() => setDate(shiftDateStr(date, -1))}>‹</button>
        <div className="date-display">{dateDisplay(date)}</div>
        <button onClick={() => setDate(shiftDateStr(date, 1))}>›</button>
      </div>

      {loading || !data ? (
        <p style={{ color: 'var(--text2)' }}>{t('Loading…')}</p>
      ) : data.items.length === 0 ? (
        <p style={{ color: 'var(--text2)', fontSize: 13 }}>{t('No menu items yet — add some under "Manage menu".')}</p>
      ) : (
        <>
          {data.items.map((item) => (
            <div className="card" key={item.id}>
              <div className="card-title">{item.name}</div>

              {item.trackingMode === 'production' ? (
                <>
                  {item.entries.length > 0 && (
                    <table className="denom-table">
                      <thead><tr><th>{t('Batch')}</th><th></th></tr></thead>
                      <tbody>
                        {item.entries.map((entry) => (
                          <tr key={entry.id}>
                            <td>{digits(String(entry.quantity))}</td>
                            <td>
                              <button
                                className="btn secondary"
                                style={{ padding: '4px 9px', fontSize: 11 }}
                                aria-label={t('Remove')}
                                onClick={() => deleteBatch(entry.id)}
                                disabled={saving}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: item.entries.length > 0 ? 10 : 0 }}>
                    <NumberInput
                      value={batchQty[item.id] ?? ''}
                      min={0}
                      placeholder={t('Qty made')}
                      onValueChange={(n) => setBatchQty((prev) => ({ ...prev, [item.id]: n }))}
                    />
                    <button className="btn" onClick={() => addBatch(item)} disabled={saving}>{t('Add batch')}</button>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', gap: 12 }}>
                  <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                    <label>{item.trackingMode === 'bowl_double' ? t('Single') : t('Bowls sold')}</label>
                    <NumberInput
                      value={item.singleCount}
                      min={0}
                      onValueChange={() => {}}
                      onBlur={(n) => { if (n != null) saveBowlCount(item, n, item.doubleCount); }}
                    />
                  </div>
                  {item.trackingMode === 'bowl_double' && (
                    <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                      <label>{t('Double')}</label>
                      <NumberInput
                        value={item.doubleCount}
                        min={0}
                        onValueChange={() => {}}
                        onBlur={(n) => { if (n != null) saveBowlCount(item, item.singleCount, n); }}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="kpi-row" style={{ marginTop: 12 }}>
                <div className="kpi"><div className="kpi-label">{t('Qty sold')}</div><div className="kpi-value">{digits(String(item.quantitySold))}</div></div>
                <div className="kpi"><div className="kpi-label">{t('Value')}</div><div className="kpi-value">{taka(item.value)}</div></div>
              </div>
            </div>
          ))}

          <div className="card">
            <div className="card-title">{t('Reconciliation')}</div>
            <div className={`insight ${data.hasCashEntry ? statusClass[data.status] : 'amber'}`}>
              <div className="result-row"><span>{t('Computed total')}</span><b>{taka(data.computedTotal)}</b></div>
              {data.hasCashEntry ? (
                <>
                  <div className="result-row"><span>{t('Actual sales')}</span><b>{taka(data.actualSales)}</b></div>
                  <div className="result-row"><span>{t('Variance')}</span><b>{taka(data.variance)}</b></div>
                  {data.status === 'good' && <p style={{ margin: '8px 0 0' }}>{t('Looking good — well within range.')}</p>}
                  {data.status === 'warning' && <p style={{ margin: '8px 0 0' }}>{t('A bit off — worth checking when you can.')}</p>}
                  {data.status === 'danger' && <p style={{ margin: '8px 0 0' }}>{t('Off by a lot — please double check the counts.')}</p>}
                </>
              ) : (
                <p style={{ margin: 0 }}>{t('Cash entry not saved for this day yet.')}</p>
              )}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
