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
const MENU_URL = '/api/products';
const TRACKING_MODES = ['production', 'bowl_single', 'bowl_double'];

export default function SalesTallyPage() {
  const { t, taka, digits, dateDisplay } = useLang();
  const [tab, setTab] = useState('tally');
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [batchQty, setBatchQty] = useState({});
  const [bowlDraft, setBowlDraft] = useState({});
  const [leftoverDraft, setLeftoverDraft] = useState({});
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [msg, setMsg] = useState(null);

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

  const loadMenu = useCallback(async () => {
    const requestId = ++requestRef.current;
    const cached = peekCache(MENU_URL);
    if (cached) setMenuItems(cached.items || []);
    else setLoading(true);
    try {
      const json = await cachedFetchJson(MENU_URL);
      if (requestRef.current !== requestId) return;
      setMenuItems(json.items || []);
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'tally') loadTally(date);
    else loadMenu();
  }, [tab, date, loadTally, loadMenu]);

  useEffect(() => {
    if (tab !== 'tally' || loading) return;
    runWhenIdle(() => {
      prefetchJson(tallyUrl(shiftDateStr(date, -1)));
      prefetchJson(tallyUrl(shiftDateStr(date, 1)));
    });
  }, [tab, date, loading]);

  // Refetches the tally in place without ever flipping `loading` back to
  // true — a plain invalidateCache()+loadTally() would blank the card list
  // (and any input the chef is mid-typing into) between every save.
  const refreshTally = useCallback(async () => {
    invalidateCache(tallyUrl(date));
    const json = await cachedFetchJson(tallyUrl(date));
    setData(json);
  }, [date]);

  function bowlValue(item, field) {
    const draft = bowlDraft[item.id]?.[field];
    if (draft !== undefined) return draft;
    return field === 'single' ? item.singleCount : item.doubleCount;
  }

  function setBowlDraftField(itemId, field, value) {
    setBowlDraft((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));
  }

  function leftoverValue(item, field) {
    const draft = leftoverDraft[item.id]?.[field];
    if (draft !== undefined) return draft;
    return field === 'qty' ? item.leftoverQty : item.carriedForward;
  }

  function setLeftoverDraftField(itemId, field, value) {
    setLeftoverDraft((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));
  }

  async function addBatch(item) {
    const qty = batchQty[item.id];
    if (!qty || Number(qty) <= 0) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/sales-tally/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, itemId: item.id, quantity: qty }),
      });
      const body = await res.json();
      if (!res.ok) { setMsg({ type: 'err', text: body.error || t('Save failed.') }); return; }
      setBatchQty((prev) => ({ ...prev, [item.id]: '' }));
      await refreshTally();
    } catch {
      setMsg({ type: 'err', text: t('Save failed.') });
    } finally {
      setSaving(false);
    }
  }

  async function deleteBatch(entryId) {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/sales-tally/entries?id=${entryId}`, { method: 'DELETE' });
      if (!res.ok) { setMsg({ type: 'err', text: t('Save failed.') }); return; }
      await refreshTally();
    } catch {
      setMsg({ type: 'err', text: t('Save failed.') });
    } finally {
      setSaving(false);
    }
  }

  async function saveBowlCount(item) {
    const single = bowlValue(item, 'single');
    const double = item.trackingMode === 'bowl_double' ? bowlValue(item, 'double') : 0;
    if (single === item.singleCount && double === item.doubleCount) return; // nothing changed — skip the round-trip
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/sales-tally/bowl-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, itemId: item.id, singleCount: single, doubleCount: double }),
      });
      const body = await res.json();
      if (!res.ok) { setMsg({ type: 'err', text: body.error || t('Save failed.') }); return; }
      await refreshTally();
      setBowlDraft((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } catch {
      setMsg({ type: 'err', text: t('Save failed.') });
    } finally {
      setSaving(false);
    }
  }

  async function saveLeftover(item, overrides = {}) {
    const qty = overrides.qty !== undefined ? overrides.qty : leftoverValue(item, 'qty');
    const carried = overrides.carried !== undefined ? overrides.carried : leftoverValue(item, 'carried');
    if (qty === item.leftoverQty && carried === item.carriedForward) return; // nothing changed — skip the round-trip
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/sales-tally/leftover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, itemId: item.id, leftoverQty: qty, carriedForward: carried }),
      });
      const body = await res.json();
      if (!res.ok) { setMsg({ type: 'err', text: body.error || t('Save failed.') }); return; }
      await refreshTally();
      setLeftoverDraft((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } catch {
      setMsg({ type: 'err', text: t('Save failed.') });
    } finally {
      setSaving(false);
    }
  }

  async function addMenuItem() {
    if (!newName || !newPrice) return;
    setSaving(true);
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, price: Number(newPrice) }),
    });
    setNewName('');
    setNewPrice('');
    setSaving(false);
    invalidateCache(MENU_URL);
    loadMenu();
  }

  async function updatePrice(item, newPriceValue) {
    if (newPriceValue === '' || isNaN(Number(newPriceValue))) return;
    setSaving(true);
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: item.id, name: item.name, price: Number(newPriceValue),
        active: item.active, sortOrder: item.sort_order, trackingMode: item.tracking_mode,
      }),
    });
    setSaving(false);
    invalidateCache(MENU_URL);
    loadMenu();
  }

  async function toggleActive(item) {
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: item.id, name: item.name, price: item.price,
        active: !item.active, sortOrder: item.sort_order, trackingMode: item.tracking_mode,
      }),
    });
    invalidateCache(MENU_URL);
    loadMenu();
  }

  async function updateTrackingMode(item, trackingMode) {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id, name: item.name, price: item.price,
          active: item.active, sortOrder: item.sort_order, trackingMode,
        }),
      });
      const body = await res.json();
      if (!res.ok) { setMsg({ type: 'err', text: body.error || t('Save failed.') }); return; }
      invalidateCache(MENU_URL);
      await loadMenu();
    } catch {
      setMsg({ type: 'err', text: t('Save failed.') });
    } finally {
      setSaving(false);
    }
  }

  const statusClass = { good: 'green', warning: 'amber', danger: 'red' };
  const trackingLabel = {
    production: t('Production (batches)'),
    bowl_single: t('Bowl count'),
    bowl_double: t('Bowl count (single + double)'),
  };

  return (
    <AppShell>
      <div className="toggle-row">
        <button className={tab === 'tally' ? 'on' : ''} onClick={() => setTab('tally')}>{t("Today's tally")}</button>
        <button className={tab === 'menu' ? 'on' : ''} onClick={() => setTab('menu')}>{t('Manage menu')}</button>
      </div>

      {msg && <div className={`status-msg ${msg.type}`}>{msg.text}</div>}

      {tab === 'tally' ? (
        <>
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
                                <td>
                                  {digits(String(entry.quantity))}
                                  {entry.carriedOver && (
                                    <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>{t('carried from yesterday')}</div>
                                  )}
                                </td>
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

                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                        <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                          <label>{t('Leftover (not sold)')}</label>
                          <NumberInput
                            value={leftoverValue(item, 'qty')}
                            min={0}
                            onValueChange={(n) => setLeftoverDraftField(item.id, 'qty', n ?? 0)}
                            onBlur={() => saveLeftover(item)}
                          />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', paddingBottom: 11, flex: 1 }}>
                          <input
                            type="checkbox"
                            checked={!!leftoverValue(item, 'carried')}
                            disabled={saving}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setLeftoverDraftField(item.id, 'carried', checked);
                              saveLeftover(item, { carried: checked });
                            }}
                          />
                          {t('Bringing it back tomorrow?')}
                        </label>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                        <label>{item.trackingMode === 'bowl_double' ? t('Single') : t('Bowls sold')}</label>
                        <NumberInput
                          value={bowlValue(item, 'single')}
                          min={0}
                          onValueChange={(n) => setBowlDraftField(item.id, 'single', n ?? 0)}
                          onBlur={() => saveBowlCount(item)}
                        />
                      </div>
                      {item.trackingMode === 'bowl_double' && (
                        <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                          <label>{t('Double')}</label>
                          <NumberInput
                            value={bowlValue(item, 'double')}
                            min={0}
                            onValueChange={(n) => setBowlDraftField(item.id, 'double', n ?? 0)}
                            onBlur={() => saveBowlCount(item)}
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
        </>
      ) : (
        <div className="card">
          <div className="card-title">{t('Menu items')}</div>
          {loading ? (
            <p style={{ color: 'var(--text2)' }}>{t('Loading…')}</p>
          ) : (
            <>
              <table className="denom-table">
                <thead><tr><th>{t('Item')}</th><th>{t('Price (৳)')}</th><th>{t('Tracking')}</th><th>{t('Active')}</th></tr></thead>
                <tbody>
                  {menuItems.map((item) => (
                    <tr key={item.id} style={{ opacity: item.active ? 1 : 0.5 }}>
                      <td>{item.name}</td>
                      <td>
                        <NumberInput
                          value={item.price} min={0} className=""
                          style={{ width: 80 }}
                          onValueChange={() => {}}
                          onBlur={(n) => { if (n != null && n !== Number(item.price)) updatePrice(item, n); }}
                        />
                      </td>
                      <td>
                        <select
                          className="tracking-mode-select"
                          value={item.tracking_mode}
                          onChange={(e) => updateTrackingMode(item, e.target.value)}
                        >
                          {TRACKING_MODES.map((mode) => (
                            <option key={mode} value={mode}>{trackingLabel[mode]}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button className="btn secondary" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => toggleActive(item)}>
                          {item.active ? t('Hide') : t('Show')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8 }}>{t('Edit a price and click away from the field to save it.')}</p>
            </>
          )}

          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div className="card-title">{t('Add a new item')}</div>
            <div className="field">
              <label>{t('Name')}</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('e.g. Chicken Roll')} />
            </div>
            <div className="field">
              <label>{t('Price (৳)')}</label>
              <NumberInput value={newPrice} min={0} placeholder={t('e.g. 50')} onValueChange={(n) => setNewPrice(n == null ? '' : String(n))} />
            </div>
            <button className="btn block" onClick={addMenuItem} disabled={saving || !newName || !newPrice}>{t('Add item')}</button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
