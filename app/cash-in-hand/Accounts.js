'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '../LangProvider';
import NumberInput from '../NumberInput';
import { todayStr } from '@/lib/dates';
import { cachedFetchJson, invalidateCache } from '@/lib/clientCache';
import { ACCOUNTS_START_DATE, transferEffect } from '@/lib/accounts';

const URL_ACCOUNTS = '/api/payment-accounts';
const KIND_ICON = { bkash: '📱', bank: '🏦', other: '💳' };

function AddForm({ ctx }) {
  const { t, defaultStart, busy, error, call, cancel } = ctx;
  const [f, setF] = useState({ name: '', kind: 'bkash', startingBalance: '', startingDate: defaultStart });
  return (
    <div className="card">
      <div className="card-title">{t('Add account')}</div>
      <div className="field"><label>{t('Name')}</label>
        <input type="text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t('e.g. bKash Merchant, City Bank')} /></div>
      <div className="field"><label>{t('Type')}</label>
        <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
          <option value="bkash">bKash</option><option value="bank">{t('Bank')}</option><option value="other">{t('Other')}</option>
        </select></div>
      <div className="field"><label>{t('Starting balance (৳)')}</label>
        <NumberInput value={f.startingBalance} onValueChange={(n) => setF({ ...f, startingBalance: n == null ? '' : String(n) })} placeholder="0" /></div>
      <div className="field"><label>{t('Starting date')}</label>
        <input type="date" value={f.startingDate} onChange={(e) => setF({ ...f, startingDate: e.target.value })} /></div>
      {error && <div className="status-msg err">{error}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn secondary" onClick={() => cancel()}>{t('Cancel')}</button>
        <button className="btn" disabled={busy || !f.name.trim()} onClick={() => call(URL_ACCOUNTS, 'POST', f)}>{busy ? t('Saving…') : t('Add account')}</button>
      </div>
    </div>
  );
}

function TransferForm({ ctx }) {
  const { t, taka, accounts, active, busy, error, call, cancel } = ctx;
  const [f, setF] = useState({ date: todayStr(), fromId: '', toId: active[0] ? String(active[0].id) : '', amount: '', charge: '', note: '' });
  const nameOf = (id) => (id === '' ? t('Cash') : accounts.find((a) => String(a.id) === id)?.name || '?');
  const amt = Number(f.amount) || 0; const fee = Number(f.charge) || 0;
  const eff = transferEffect({ amount: amt, charge: fee });
  const valid = amt > 0 && fee >= 0 && fee <= amt && f.fromId !== f.toId;
  const options = [{ id: '', name: t('Cash') }, ...active.map((a) => ({ id: String(a.id), name: a.name }))];
  return (
    <div className="card">
      <div className="card-title">{t('Transfer between accounts')}</div>
      <div className="field"><label>{t('Date')}</label>
        <input type="date" value={f.date} max={todayStr()} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
      <div className="field"><label>{t('From')}</label>
        <select value={f.fromId} onChange={(e) => setF({ ...f, fromId: e.target.value })}>{options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
      <div className="field"><label>{t('To')}</label>
        <select value={f.toId} onChange={(e) => setF({ ...f, toId: e.target.value })}>{options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
      <div className="field"><label>{t('Amount (৳)')}</label>
        <NumberInput value={f.amount} min={0} onValueChange={(n) => setF({ ...f, amount: n == null ? '' : String(n) })} /></div>
      <div className="field"><label>{t('Transaction charge (৳, optional)')}</label>
        <NumberInput value={f.charge} min={0} onValueChange={(n) => setF({ ...f, charge: n == null ? '' : String(n) })} placeholder="0" /></div>
      <div className="field"><label>{t('Note (optional)')}</label>
        <input type="text" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
      {amt > 0 && f.fromId !== f.toId && (
        <div className="insight green">
          {nameOf(f.fromId)} <b>−{taka(eff.out)}</b> → {nameOf(f.toId)} <b>+{taka(eff.in)}</b>
          {eff.charge > 0 && <> · {t('charge')} {taka(eff.charge)}</>}
        </div>
      )}
      {fee > amt && <div className="status-msg err">{t('The charge cannot be more than the amount.')}</div>}
      {f.fromId === f.toId && <div className="status-msg err">{t('Pick two different accounts.')}</div>}
      {error && <div className="status-msg err">{error}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn secondary" onClick={() => cancel()}>{t('Cancel')}</button>
        <button className="btn" disabled={busy || !valid} onClick={() => call(`${URL_ACCOUNTS}/transfers`, 'POST', {
          date: f.date, fromId: f.fromId === '' ? null : Number(f.fromId), toId: f.toId === '' ? null : Number(f.toId),
          amount: f.amount, charge: f.charge || 0, note: f.note,
        }, { cash: f.fromId === '' || f.toId === '' })}>{busy ? t('Saving…') : t('Transfer')}</button>
      </div>
    </div>
  );
}

function AdjustForm({ ctx, account }) {
  const { t, busy, error, call, cancel } = ctx;
  const [f, setF] = useState({ date: todayStr(), amount: '', note: '' });
  return (
    <div className="card">
      <div className="card-title">{t('Correct balance')} — {account.name}</div>
      <p className="step-hint">{t('Use this when the real balance differs from what the app shows (a bank fee, a missed entry). It is added to the balance, not hidden.')}</p>
      <div className="field"><label>{t('Date')}</label>
        <input type="date" value={f.date} max={todayStr()} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
      <div className="field"><label>{t('Amount (৳, can be negative)')}</label>
        <NumberInput value={f.amount} onValueChange={(n) => setF({ ...f, amount: n == null ? '' : String(n) })} placeholder={t('e.g. -50 or 200')} /></div>
      <div className="field"><label>{t('Note (required)')}</label>
        <input type="text" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder={t('e.g. bKash monthly fee')} /></div>
      {error && <div className="status-msg err">{error}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn secondary" onClick={() => cancel()}>{t('Cancel')}</button>
        <button className="btn" disabled={busy || !f.amount || !f.note.trim()} onClick={() => call(`${URL_ACCOUNTS}/adjustments`, 'POST', { accountId: account.id, ...f })}>
          {busy ? t('Saving…') : t('Add correction')}
        </button>
      </div>
    </div>
  );
}


function ReconcileForm({ ctx, account }) {
  const { t, taka, busy, error, call, cancel } = ctx;
  const [actual, setActual] = useState('');
  const [check, setCheck] = useState(null); // result of the compare step
  const [note, setNote] = useState('');
  const [checking, setChecking] = useState(false);
  const [err, setErr] = useState(null);

  async function compare() {
    setChecking(true); setErr(null);
    try {
      const res = await fetch(`${URL_ACCOUNTS}/reconcile`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: account.id, actualBalance: actual }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || t('Save failed.'));
      setCheck(out);
    } catch (e) { setErr(e.message); setCheck(null); }
    finally { setChecking(false); }
  }
  const diff = check?.difference ?? 0;
  const signed = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${taka(Math.abs(n))}`;
  return (
    <div className="card">
      <div className="card-title">{t('Reconcile')} — {account.name}</div>
      <p className="step-hint">{t('Type the balance bKash really shows now. The app compares it with its own number; nothing is changed until you confirm.')}</p>
      <div className="field"><label>{t('Actual bKash balance (৳)')}</label>
        <NumberInput value={actual} onValueChange={(n) => { setActual(n == null ? '' : String(n)); setCheck(null); }} /></div>
      <button className="btn secondary" disabled={checking || actual === ''} onClick={compare}>{checking ? t('Checking…') : t('Check')}</button>
      {check && (
        <div style={{ marginTop: 12 }}>
          <div className="step-result"><span>{t('Ledger balance')}</span><strong>{taka(check.ledger)}</strong></div>
          <div className="step-result"><span>{t('Actual bKash balance')}</span><strong>{taka(check.actual)}</strong></div>
          <div className={`insight ${diff === 0 ? 'green' : ''}`} style={{ marginTop: 8 }}>
            {diff === 0 ? <b>✓ {t('Reconciled')}</b> : <b>⚠ {t('Difference')}: {signed(diff)}</b>}
          </div>
          {check.startsRelay && (
            <p className="step-hint" style={{ marginTop: 8 }}>
              {t('Confirming starts counting bKash relay payments from today. Earlier relay payments stay recorded but are not counted, and the bKash amount typed in the daily entry from today no longer changes this balance.')}
            </p>
          )}
          {diff !== 0 && (
            <div className="field" style={{ marginTop: 8 }}><label>{t('Reason for the difference (required)')}</label>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('e.g. unrecorded cash-in')} /></div>
          )}
        </div>
      )}
      {(err || error) && <div className="status-msg err">{err || error}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <button className="btn secondary" onClick={() => cancel()}>{t('Cancel')}</button>
        {check && (check.startsRelay || diff !== 0) && (
          <button className="btn" disabled={busy || (diff !== 0 && !note.trim())}
            onClick={() => call(`${URL_ACCOUNTS}/reconcile`, 'POST', { accountId: account.id, actualBalance: actual, confirm: true, difference: diff, note })}>
            {busy ? t('Saving…') : diff !== 0 ? t('Add correction & confirm') : t('Confirm')}
          </button>
        )}
      </div>
    </div>
  );
}

// Does this activity row touch the account? (transfers touch both ends; cash is the null end)
function involves(m, accountId) {
  if (m.type === 'transfer') return m.fromId === accountId || m.toId === accountId;
  return m.accountId === accountId;
}

// The amount as it moved the viewed account: on an account's own tab a transfer out is negative and a transfer in is
// what arrived (amount − charge); on the All tab it is the plain amount.
function signedAmount(m, tab) {
  if (m.type === 'transfer' && typeof tab === 'number') return m.fromId === tab ? -m.amount : m.amount - m.charge;
  return m.amount;
}

// Cash in Hand's sibling accounts (bKash merchant, City Bank, …): balances, transfers between them and cash,
// corrections, and a feed of what moved. Cash stays the ledger below; moves that involve cash are applied to it
// by the API, so after one of those the page reloads the ledger (onCashChanged).
export default function Accounts({ cashBalance, onCashChanged, cashLedger }) {
  const { t, taka, dateNice } = useLang();
  const [data, setData] = useState(null);
  const [panel, setPanel] = useState(null); // null | 'add' | 'transfer' | { adjust: accountId } | { reconcile: accountId }
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [tab, setTab] = useState('cash'); // 'all' | 'cash' | account id

  const load = useCallback(async () => {
    try { setData(await cachedFetchJson(URL_ACCOUNTS)); } catch { setData({ accounts: [], movements: [] }); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const accounts = data?.accounts || [];
  const active = accounts.filter((a) => a.active);
  const total = (cashBalance ?? 0) + active.reduce((n, a) => n + a.balance, 0);
  const defaultStart = todayStr() < ACCOUNTS_START_DATE ? ACCOUNTS_START_DATE : todayStr();

  async function call(url, method, body, { cash = false } = {}) {
    setBusy(true); setError(null);
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || t('Save failed.'));
      invalidateCache(URL_ACCOUNTS);
      invalidateCache('/api/cash-in-hand');
      await load();
      if (cash) await onCashChanged?.();
      setPanel(null);
      return out;
    } catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  }

  // handed to the forms, which live outside this component so a re-render here never wipes what was typed
  const ctx = { t, taka, accounts, active, defaultStart, busy, error, call, cancel: () => setPanel(null) };
  const adjustAccount = panel && panel.adjust ? accounts.find((a) => a.id === panel.adjust) : null;
  const reconcileAccount = panel && panel.reconcile ? accounts.find((a) => a.id === panel.reconcile) : null;
  const moves = data?.movements || [];
  // A tab whose account got deactivated falls back to Cash.
  const tabAccount = typeof tab === 'number' ? active.find((a) => a.id === tab) : null;
  const curTab = typeof tab === 'number' && !tabAccount ? 'cash' : tab;
  const tabMoves = curTab === 'all' ? moves : tabAccount ? moves.filter((m) => involves(m, tabAccount.id)) : [];
  const shown = showAll ? tabMoves : tabMoves.slice(0, 8);

  async function removeMove(m) {
    if (!window.confirm(m.type === 'transfer' ? t('Delete this transfer? Balances (and Cash in Hand, if it was involved) go back.') : t('Delete this correction?'))) return;
    await call(`${URL_ACCOUNTS}/${m.type === 'transfer' ? 'transfers' : 'adjustments'}?id=${m.id}`, 'DELETE', null, { cash: m.type === 'transfer' });
  }

  return (
    <>
      <div className="card">
        <div className="card-title">{t('Money accounts')}</div>
        <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
          <div className="kpi"><div className="kpi-label">💵 {t('Cash')}</div><div className="kpi-value">{cashBalance == null ? '—' : taka(cashBalance)}</div></div>
          {accounts.map((a) => (
            <div className="kpi" key={a.id} style={{ opacity: a.active ? 1 : 0.55 }}>
              <div className="kpi-label">{KIND_ICON[a.kind] || '💳'} {a.name}{a.active ? '' : ` (${t('off')})`}</div>
              <div className="kpi-value">{taka(a.balance)}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <button type="button" className="btn secondary btn-small" onClick={() => call(URL_ACCOUNTS, 'PATCH', { id: a.id, active: !a.active })} disabled={busy}>
                  {a.active ? t('Deactivate') : t('Activate')}
                </button>
                <button type="button" className="btn secondary btn-small" onClick={() => { setError(null); setPanel({ adjust: a.id }); }}>{t('Correct')}</button>
                {a.kind === 'bkash' && a.active && (
                  <button type="button" className="btn btn-small" onClick={() => { setError(null); setPanel({ reconcile: a.id }); }}>{t('Reconcile')}</button>
                )}
              </div>
              {a.kind === 'bkash' && (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                  {a.relayFrom
                    ? <>{t('Relay payments count from')} {dateNice(a.relayFrom)}</>
                    : <>{t('Relay testing: payments are recorded but not counted yet')}</>}
                  {a.relayDayCount > 0 && <> · {t('today')}: {a.relayDayCount} · {taka(a.relayDayTotal)}</>}
                </div>
              )}
            </div>
          ))}
        </div>
        {accounts.length > 0 && (
          <div className="step-result" style={{ marginTop: 10 }}><span>{t('All together (cash + active accounts)')}</span><strong>{taka(total)}</strong></div>
        )}
        {data?.notReady && <p className="step-hint">{t('Accounts are not set up on the server yet.')}</p>}
        <p className="step-hint" style={{ marginTop: 8 }}>
          {t('From 6 Oct 2026 the daily entry asks how much of each day’s sales went into an active account. Deactivated accounts keep their balance and history but are not offered.')}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <button type="button" className="btn" style={{ flex: '1 1 140px' }} onClick={() => { setError(null); setPanel('transfer'); }} disabled={active.length === 0}>⇄ {t('Transfer')}</button>
          <button type="button" className="btn secondary" style={{ flex: '1 1 140px' }} onClick={() => { setError(null); setPanel('add'); }}>＋ {t('Add account')}</button>
        </div>
      </div>

      {panel === 'add' && <AddForm ctx={ctx} />}
      {panel === 'transfer' && <TransferForm ctx={ctx} />}
      {adjustAccount && <AdjustForm ctx={ctx} account={adjustAccount} />}
      {reconcileAccount && <ReconcileForm ctx={ctx} account={reconcileAccount} />}

      <div className="toggle-row" style={{ flexWrap: 'wrap', marginTop: 4 }}>
        <button type="button" className={curTab === 'all' ? 'on' : ''} onClick={() => { setTab('all'); setShowAll(false); }}>{t('All')}</button>
        <button type="button" className={curTab === 'cash' ? 'on' : ''} onClick={() => { setTab('cash'); setShowAll(false); }}>{t('Cash')}</button>
        {active.map((a) => (
          <button type="button" key={a.id} className={curTab === a.id ? 'on' : ''} onClick={() => { setTab(a.id); setShowAll(false); }}>
            {a.kind === 'bkash' ? 'bKash' : a.name}
          </button>
        ))}
      </div>

      {curTab === 'cash' ? cashLedger : (
        <div className="card">
          <div className="card-title">
            {curTab === 'all' ? t('All account activity') : `${tabAccount?.name || ''} — ${t('Account activity')}`}
          </div>
          {tabAccount && (
            <div className="step-result" style={{ marginBottom: 8 }}><span>{t('Balance')}</span><strong>{taka(tabAccount.balance)}</strong></div>
          )}
          {tabMoves.length === 0 ? (
            <p style={{ color: 'var(--text2)', fontSize: 13 }}>{t('No activity yet.')}</p>
          ) : (
            <table className="denom-table">
              <tbody>
                {shown.map((m, i) => {
                  const amt = signedAmount(m, curTab);
                  return (
                    <tr key={`${m.type}-${m.id ?? i}-${m.date}`}>
                      <td style={{ whiteSpace: 'nowrap' }}>{dateNice(m.date)}</td>
                      <td>
                        {m.type === 'sale' && <>{m.account} <span style={{ color: 'var(--text3)' }}>{t('sales')}</span></>}
                        {m.type === 'transfer' && <>{m.from} → {m.to}{m.charge > 0 && <span style={{ color: 'var(--text3)' }}> ({t('charge')} {taka(m.charge)})</span>}{m.note && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{m.note}</div>}</>}
                        {m.type === 'adjustment' && <>{m.account} <span style={{ color: 'var(--text3)' }}>{t('correction')}: {m.note}</span></>}
                        {m.type === 'relay' && (
                          <span style={{ opacity: m.state === 'not-counted' ? 0.6 : 1 }}>
                            {m.account} <span style={{ color: 'var(--text3)' }}>{t('received')} · {m.sender} ({m.operator}) · {m.time || t('time not recorded')}
                              {m.trxId ? ` · ${m.trxId}` : ''}{m.state === 'not-counted' ? ` · ${t('not counted yet')}` : ''}</span>
                            {m.state === 'in-entry' && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{t('included in that day’s entry')}</div>}
                          </span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', textAlign: 'right', color: amt < 0 ? 'var(--red)' : undefined }}>
                        {amt > 0 ? '+' : amt < 0 ? '−' : ''}{taka(Math.abs(amt))}
                      </td>
                      <td>{m.type !== 'sale' && m.type !== 'relay' && <button type="button" className="btn secondary btn-small" onClick={() => removeMove(m)} aria-label={t('Delete')}>✕</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {tabMoves.length > 8 && (
            <button type="button" className="btn secondary btn-small" style={{ marginTop: 8 }} onClick={() => setShowAll((v) => !v)}>
              {showAll ? t('Show less') : t('Show more')}
            </button>
          )}
        </div>
      )}
    </>
  );
}
