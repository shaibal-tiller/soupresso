'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '../AppShell';
import { useLang } from '../LangProvider';
import NumberInput from '../NumberInput';
import { todayStr } from '@/lib/dates';
import { cachedFetchJson, peekCache, invalidateCache } from '@/lib/clientCache';

const LEDGER_URL = '/api/cash-in-hand';

export default function CashInHandPage() {
  const { t, taka, dateNice } = useLang();
  const [ledger, setLedger] = useState(() => peekCache(LEDGER_URL)?.ledger || []);
  const [settings, setSettings] = useState(() => peekCache(LEDGER_URL)?.settings || null);
  const [loading, setLoading] = useState(() => peekCache(LEDGER_URL) === undefined);

  const [startDate, setStartDate] = useState(todayStr());
  const [startAmount, setStartAmount] = useState('');
  const [startNote, setStartNote] = useState('');
  const [savingStart, setSavingStart] = useState(false);
  const [startError, setStartError] = useState(null);

  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustDate, setAdjustDate] = useState(todayStr());
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [savingAdjust, setSavingAdjust] = useState(false);
  const [adjustError, setAdjustError] = useState(null);

  const load = useCallback(async () => {
    const cached = peekCache(LEDGER_URL);
    if (!cached) setLoading(true);
    try {
      const data = await cachedFetchJson(LEDGER_URL);
      setLedger(data.ledger || []);
      setSettings(data.settings || null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const latest = ledger.length ? ledger[ledger.length - 1] : null;
  const started = !!settings?.starting_date;

  async function handleSetStarting(e) {
    e.preventDefault();
    setStartError(null);
    setSavingStart(true);
    try {
      const res = await fetch('/api/cash-in-hand/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startingDate: startDate, startingBalance: startAmount, note: startNote.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('Save failed.'));
      invalidateCache(LEDGER_URL);
      await load();
    } catch (err) {
      setStartError(err.message);
    } finally {
      setSavingStart(false);
    }
  }

  async function handleAddAdjustment(e) {
    e.preventDefault();
    setAdjustError(null);
    setSavingAdjust(true);
    try {
      const res = await fetch('/api/cash-in-hand/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryDate: adjustDate, amount: adjustAmount, note: adjustNote.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('Save failed.'));
      setShowAdjust(false);
      setAdjustAmount('');
      setAdjustNote('');
      invalidateCache(LEDGER_URL);
      await load();
    } catch (err) {
      setAdjustError(err.message);
    } finally {
      setSavingAdjust(false);
    }
  }

  return (
    <AppShell>
      <div className="card" style={{ textAlign: 'center' }}>
        <div className="card-title">{t('Cash in Hand')}</div>
        {!started ? (
          <p style={{ color: 'var(--text2)', fontSize: 13 }}>{t('Not started yet — set a starting balance below.')}</p>
        ) : loading ? (
          <p style={{ color: 'var(--text2)' }}>{t('Loading…')}</p>
        ) : latest ? (
          <>
            <div style={{ fontSize: 34, fontWeight: 800, fontFamily: 'var(--display)', color: Number(latest.closing_balance) >= 0 ? 'var(--brand-green)' : 'var(--red)' }}>
              {taka(latest.closing_balance)}
            </div>
            {latest.status === 'pending' && (
              <p style={{ fontSize: 12, color: 'var(--amber)', marginTop: 4 }}>
                {t('Pending — this locks once tomorrow\'s entry is saved, or after 24h.')}
              </p>
            )}
            <p style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{t('as of')} {dateNice(latest.entry_date)}</p>
          </>
        ) : (
          <p style={{ color: 'var(--text2)', fontSize: 13 }}>{t('No entries in the tracked range yet.')}</p>
        )}
      </div>

      {!started ? (
        <div className="card">
          <div className="card-title">{t('Set starting balance')}</div>
          <p style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 14 }}>
            {t('This is a one-time setup — once set, corrections go through a reconciliation adjustment, not a silent overwrite. Pick a date whose ending cash position you trust.')}
          </p>
          <form onSubmit={handleSetStarting}>
            <div className="field">
              <label>{t('Starting date')}</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} max={todayStr()} required />
            </div>
            <div className="field">
              <label>{t('Starting balance (৳)')}</label>
              <NumberInput value={startAmount} onValueChange={(n) => setStartAmount(n == null ? '' : String(n))} placeholder={t('e.g. 18000')} />
            </div>
            <div className="field">
              <label>{t('Note (optional)')}</label>
              <input type="text" value={startNote} onChange={(e) => setStartNote(e.target.value)} placeholder={t('e.g. counted cash on hand at close')} />
            </div>
            {startError && <div className="status-msg err">{startError}</div>}
            <button type="submit" className="btn block" disabled={savingStart || startAmount === ''}>
              {savingStart ? t('Saving…') : t('Set starting balance')}
            </button>
          </form>
        </div>
      ) : (
        <>
          <button type="button" className="btn secondary block" style={{ marginBottom: 16 }} onClick={() => setShowAdjust((v) => !v)}>
            {showAdjust ? t('Cancel') : t('+ Add reconciliation adjustment')}
          </button>

          {showAdjust && (
            <div className="card">
              <div className="card-title">{t('Reconciliation adjustment')}</div>
              <p style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 14 }}>
                {t('Corrects the running balance from the chosen date forward. Never edits a day\'s own recorded numbers — every adjustment needs an explanation.')}
              </p>
              <form onSubmit={handleAddAdjustment}>
                <div className="field">
                  <label>{t('Date')}</label>
                  <input type="date" value={adjustDate} onChange={(e) => setAdjustDate(e.target.value)} max={todayStr()} required />
                </div>
                <div className="field">
                  <label>{t('Amount (৳, can be negative)')}</label>
                  <NumberInput value={adjustAmount} onValueChange={(n) => setAdjustAmount(n == null ? '' : String(n))} placeholder={t('e.g. -200 or 500')} />
                </div>
                <div className="field">
                  <label>{t('Note (required)')}</label>
                  <input type="text" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder={t('e.g. corrected a miscount from Sep 10')} required />
                </div>
                {adjustError && <div className="status-msg err">{adjustError}</div>}
                <button type="submit" className="btn block" disabled={savingAdjust || adjustAmount === '' || !adjustNote.trim()}>
                  {savingAdjust ? t('Saving…') : t('Add adjustment')}
                </button>
              </form>
            </div>
          )}

          <div className="card">
            <div className="card-title">{t('Ledger')}</div>
            {loading ? (
              <p style={{ color: 'var(--text2)' }}>{t('Loading…')}</p>
            ) : ledger.length === 0 ? (
              <p style={{ color: 'var(--text2)', fontSize: 13 }}>{t('No days tracked yet.')}</p>
            ) : (
              <table className="denom-table">
                <thead>
                  <tr>
                    <th>{t('Date')}</th>
                    <th>{t('Opening')}</th>
                    <th>{t('Day')}</th>
                    <th>{t('Adj.')}</th>
                    <th>{t('Closing')}</th>
                    <th>{t('Status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...ledger].reverse().map((row) => (
                    <tr key={row.entry_date}>
                      <td>{dateNice(row.entry_date)}</td>
                      <td style={{ fontFamily: 'var(--mono)' }}>{taka(row.opening_balance)}</td>
                      <td style={{ fontFamily: 'var(--mono)', color: Number(row.day_delta) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {Number(row.day_delta) >= 0 ? '+' : ''}{taka(row.day_delta)}
                      </td>
                      <td style={{ fontFamily: 'var(--mono)' }}>{Number(row.adjustment_delta) !== 0 ? taka(row.adjustment_delta) : '—'}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>{taka(row.closing_balance)}</td>
                      <td>
                        <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: row.status === 'confirmed' ? 'var(--brand-green)' : 'var(--amber)' }}>
                          {t(row.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
