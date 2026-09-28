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
function tallyDraftKey(d) {
  return `soupresso-tally-draft:${d}`;
}
const MENU_URL = '/api/products';
const TRACKING_MODES = ['production', 'bowl_single', 'bowl_double'];

// Small +/-1 stepper wrapped around NumberInput — faster than typing for the
// small counts (bowl sales, leftovers) this page deals with most.
function Stepper({ value, onChange, min = 0, disabled }) {
  const current = value == null || value === '' ? 0 : Number(value);
  return (
    <div className="tally-stepper">
      <button type="button" onClick={() => onChange(Math.max(min, current - 1))} disabled={disabled || current <= min} aria-label="-1">−</button>
      <NumberInput value={value} min={min} disabled={disabled} onValueChange={(n) => onChange(n ?? 0)} />
      <button type="button" onClick={() => onChange(current + 1)} disabled={disabled} aria-label="+1">+</button>
    </div>
  );
}

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
  const [itemErrors, setItemErrors] = useState({});
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [msg, setMsg] = useState(null);

  const requestRef = useRef(0);
  const refreshTimerRef = useRef(null);

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

  // Restore any unsaved bowl-count/leftover draft left over from a crash or
  // accidental navigation the last time this date was open. Runs whenever
  // the selected date changes so each day keeps its own draft.
  useEffect(() => {
    if (tab !== 'tally') return;
    let restored = false;
    try {
      const raw = localStorage.getItem(tallyDraftKey(date));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.bowlDraft || parsed.leftoverDraft)) {
          setBowlDraft(parsed.bowlDraft || {});
          setLeftoverDraft(parsed.leftoverDraft || {});
          restored = true;
        }
      }
    } catch {}
    if (!restored) {
      setBowlDraft({});
      setLeftoverDraft({});
    } else {
      setMsg({ type: 'ok', text: t('Restored unsaved changes from earlier.') });
    }
    setItemErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, date]);

  // Debounced crash-recovery snapshot of unsaved drafts — mirrors the
  // pattern in app/entry/page.js. Never hits the network; local only.
  useEffect(() => {
    const hasDraft = Object.keys(bowlDraft).length > 0 || Object.keys(leftoverDraft).length > 0;
    const timer = setTimeout(() => {
      try {
        if (hasDraft) {
          localStorage.setItem(tallyDraftKey(date), JSON.stringify({ savedAt: Date.now(), bowlDraft, leftoverDraft }));
        } else {
          localStorage.removeItem(tallyDraftKey(date));
        }
      } catch {}
    }, 400);
    return () => clearTimeout(timer);
  }, [date, bowlDraft, leftoverDraft]);

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

  function isBowlDirty(item) {
    const draft = bowlDraft[item.id];
    if (!draft) return false;
    const single = draft.single !== undefined ? draft.single : item.singleCount;
    const double = item.trackingMode === 'bowl_double'
      ? (draft.double !== undefined ? draft.double : item.doubleCount)
      : 0;
    return single !== item.singleCount || double !== item.doubleCount;
  }

  function isLeftoverDirty(item) {
    const draft = leftoverDraft[item.id];
    if (!draft) return false;
    const qty = draft.qty !== undefined ? draft.qty : item.leftoverQty;
    const carried = draft.carried !== undefined ? draft.carried : item.carriedForward;
    return qty !== item.leftoverQty || carried !== item.carriedForward;
  }

  const dirtyItems = data ? data.items.filter((item) => isBowlDirty(item) || isLeftoverDirty(item)) : [];
  const dirtyCount = dirtyItems.length;

  // Warn on tab close/refresh while there's unsaved work, and flush the
  // latest edits to the crash-recovery draft first (localStorage writes are
  // synchronous, so this is safe inside beforeunload).
  useEffect(() => {
    if (dirtyCount === 0) return;
    function handleBeforeUnload(e) {
      flushDraftNow();
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirtyCount, bowlDraft, leftoverDraft, date]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) { clearTimeout(refreshTimerRef.current); refreshTimerRef.current = null; }
    };
  }, [date]);

  function flushDraftNow() {
    try {
      const hasDraft = Object.keys(bowlDraft).length > 0 || Object.keys(leftoverDraft).length > 0;
      if (hasDraft) {
        localStorage.setItem(tallyDraftKey(date), JSON.stringify({ savedAt: Date.now(), bowlDraft, leftoverDraft }));
      }
    } catch {}
  }

  // Coalesces refetches after batch add/delete — a few clicks in a row
  // (e.g. removing three mis-entered batches) collapse into one GET instead
  // of one per click.
  function scheduleRefresh() {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      refreshTally();
    }, 500);
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
      scheduleRefresh();
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
      scheduleRefresh();
    } catch {
      setMsg({ type: 'err', text: t('Save failed.') });
    } finally {
      setSaving(false);
    }
  }

  // Batches every changed bowl-count/leftover item into one round of
  // requests (fired together, not one-per-blur), then does exactly one
  // refetch — replacing what used to be a POST+GET pair per field.
  async function saveTally() {
    if (!data || dirtyCount === 0) return;
    setSaving(true);
    setMsg(null);
    if (refreshTimerRef.current) { clearTimeout(refreshTimerRef.current); refreshTimerRef.current = null; }

    const tasks = dirtyItems.map((item) => {
      if (item.trackingMode === 'production') {
        return {
          itemId: item.id,
          run: () => fetch('/api/sales-tally/leftover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date, itemId: item.id,
              leftoverQty: leftoverValue(item, 'qty'),
              carriedForward: leftoverValue(item, 'carried'),
            }),
          }),
        };
      }
      return {
        itemId: item.id,
        run: () => fetch('/api/sales-tally/bowl-count', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date, itemId: item.id,
            singleCount: bowlValue(item, 'single'),
            doubleCount: item.trackingMode === 'bowl_double' ? bowlValue(item, 'double') : 0,
          }),
        }),
      };
    });

    const settled = await Promise.allSettled(tasks.map((task) => task.run()));

    const succeededIds = new Set();
    const errors = {};
    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      const { itemId } = tasks[i];
      if (result.status === 'fulfilled' && result.value.ok) {
        succeededIds.add(itemId);
        continue;
      }
      let text = t('Save failed.');
      if (result.status === 'fulfilled') {
        try {
          const body = await result.value.json();
          if (body.error) text = body.error;
        } catch {}
      }
      errors[itemId] = text;
    }

    setBowlDraft((prev) => {
      const next = { ...prev };
      for (const id of succeededIds) delete next[id];
      return next;
    });
    setLeftoverDraft((prev) => {
      const next = { ...prev };
      for (const id of succeededIds) delete next[id];
      return next;
    });
    setItemErrors(errors);

    await refreshTally();

    setMsg(
      Object.keys(errors).length > 0
        ? { type: 'err', text: t('Some items failed to save — check the highlighted rows.') }
        : { type: 'ok', text: t('Saved!') }
    );
    setSaving(false);
  }

  function discardChanges() {
    setBowlDraft({});
    setLeftoverDraft({});
    setItemErrors({});
    setMsg(null);
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
            <button onClick={() => { flushDraftNow(); setDate(shiftDateStr(date, -1)); }}>‹</button>
            <div className="date-display">{dateDisplay(date)}</div>
            <button onClick={() => { flushDraftNow(); setDate(shiftDateStr(date, 1)); }}>›</button>
          </div>

          {loading || !data ? (
            <p style={{ color: 'var(--text2)' }}>{t('Loading…')}</p>
          ) : data.items.length === 0 ? (
            <p style={{ color: 'var(--text2)', fontSize: 13 }}>{t('No menu items yet — add some under "Manage menu".')}</p>
          ) : (
            <>
              <div className="tally-table-wrap">
                <table className="tally-table">
                  <thead>
                    <tr>
                      <th className="tally-sticky-col">{t('Item')}</th>
                      <th>{t('Batches')}</th>
                      <th>{t('Leftover')}</th>
                      <th title={t('Bringing it back tomorrow?')}>↺</th>
                      <th>{t('Sold')}</th>
                      <th>{t('Value')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => {
                      const dirty = isBowlDirty(item) || isLeftoverDirty(item);
                      const hasError = !!itemErrors[item.id];
                      const rowClass = [dirty ? 'dirty' : '', hasError ? 'row-error' : ''].filter(Boolean).join(' ');
                      return (
                        <tr key={item.id} className={rowClass || undefined}>
                          <td className="tally-item-cell tally-sticky-col">
                            {item.name}
                            {hasError && <div className="tally-item-error">{itemErrors[item.id]}</div>}
                          </td>

                          {item.trackingMode === 'production' ? (
                            <>
                              <td>
                                <div className="tally-batches">
                                  {item.entries.map((entry) => (
                                    <span className="tally-chip" key={entry.id}>
                                      {entry.carriedOver && <span title={t('carried from yesterday')}>↺</span>}
                                      {digits(String(entry.quantity))}
                                      <button
                                        type="button"
                                        onClick={() => deleteBatch(entry.id)}
                                        disabled={saving}
                                        aria-label={t('Remove')}
                                      >
                                        ✕
                                      </button>
                                    </span>
                                  ))}
                                  <span className="tally-add">
                                    <NumberInput
                                      value={batchQty[item.id] ?? ''}
                                      min={0}
                                      placeholder={t('Qty made')}
                                      onValueChange={(n) => setBatchQty((prev) => ({ ...prev, [item.id]: n }))}
                                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBatch(item); } }}
                                      disabled={saving}
                                    />
                                    <button type="button" onClick={() => addBatch(item)} disabled={saving} aria-label={t('Add batch')}>+</button>
                                  </span>
                                </div>
                              </td>
                              <td>
                                <Stepper
                                  value={leftoverValue(item, 'qty')}
                                  min={0}
                                  disabled={saving}
                                  onChange={(n) => setLeftoverDraftField(item.id, 'qty', n)}
                                />
                              </td>
                              <td>
                                <label className="tally-carry-wrap" title={t('Bringing it back tomorrow?')}>
                                  <input
                                    type="checkbox"
                                    className="tally-carry-check"
                                    checked={!!leftoverValue(item, 'carried')}
                                    disabled={saving}
                                    onChange={(e) => setLeftoverDraftField(item.id, 'carried', e.target.checked)}
                                  />
                                </label>
                              </td>
                            </>
                          ) : (
                            <>
                              <td>
                                <div className="tally-bowl-fields">
                                  <div className="tally-bowl-field">
                                    <span className="bowl-label">{item.trackingMode === 'bowl_double' ? t('Single') : t('Bowls sold')}</span>
                                    <Stepper
                                      value={bowlValue(item, 'single')}
                                      min={0}
                                      disabled={saving}
                                      onChange={(n) => setBowlDraftField(item.id, 'single', n)}
                                    />
                                  </div>
                                  {item.trackingMode === 'bowl_double' && (
                                    <div className="tally-bowl-field">
                                      <span className="bowl-label">{t('Double')}</span>
                                      <Stepper
                                        value={bowlValue(item, 'double')}
                                        min={0}
                                        disabled={saving}
                                        onChange={(n) => setBowlDraftField(item.id, 'double', n)}
                                      />
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td><span className="tally-dash">—</span></td>
                              <td><span className="tally-dash">—</span></td>
                            </>
                          )}

                          <td className="tally-sold">{digits(String(item.quantitySold))}</td>
                          <td className="tally-value">{taka(item.value)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

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

              {dirtyCount > 0 && <div className="tally-save-spacer" />}
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

      {tab === 'tally' && dirtyCount > 0 && (
        <div className="tally-save-bar">
          <div className="tally-save-bar-inner">
            <div className="tally-save-count">{digits(String(dirtyCount))} {t('changed')}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn secondary btn-small" onClick={discardChanges} disabled={saving}>{t('Discard')}</button>
              <button className="btn" onClick={saveTally} disabled={saving}>{saving ? t('Saving…') : t('Save tally')}</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
