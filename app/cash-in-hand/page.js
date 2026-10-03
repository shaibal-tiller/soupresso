'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import AppShell from '../AppShell';
import { useLang } from '../LangProvider';
import NumberInput from '../NumberInput';
import PeriodFilter from '../PeriodFilter';
import { initialPeriod, resolvePeriod, rollupLedger } from '@/lib/periods';
import { todayStr } from '@/lib/dates';
import { cachedFetchJson, peekCache, invalidateCache } from '@/lib/clientCache';

const LEDGER_URL = '/api/cash-in-hand';

export default function CashInHandPage() {
  const { t, taka, dateNice, dateShort, digits } = useLang();
  const [ledger, setLedger] = useState(() => peekCache(LEDGER_URL)?.ledger || []);
  const [settings, setSettings] = useState(() => peekCache(LEDGER_URL)?.settings || null);
  const [bakiOutstanding, setBakiOutstanding] = useState(() => peekCache(LEDGER_URL)?.bakiOutstanding || 0);
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
      setBakiOutstanding(data.bakiOutstanding || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Period filter + Daily / Weekly / Monthly view. The ledger is small, so the
  // full list is filtered client-side; the headline balance always uses the
  // latest row regardless of the selected period.
  const [period, setPeriod] = useState(() => initialPeriod(todayStr(), 'preset', '30d'));
  const [view, setView] = useState('daily');
  const range = resolvePeriod(period, todayStr());
  const inRange = useMemo(
    () => ledger.filter((r) => { const d = String(r.entry_date).slice(0, 10); return d >= range.from && d <= range.to; }),
    [ledger, range.from, range.to]
  );
  const rolled = useMemo(() => (view === 'daily' ? [] : rollupLedger(inRange, view === 'weekly' ? 'week' : 'month').reverse()), [inRange, view]);
  const summary = useMemo(() => {
    if (!inRange.length) return null;
    const first = inRange[0]; const last = inRange[inRange.length - 1];
    return {
      opening: Number(first.opening_balance), closing: Number(last.closing_balance), days: inRange.length,
      added: inRange.reduce((s2, r) => s2 + Number(r.day_delta), 0),
      adjusted: inRange.reduce((s2, r) => s2 + Number(r.adjustment_delta), 0),
    };
  }, [inRange]);
  function monthName(key) {
    return digits(new Date(key + '-15T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
  }

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
        {loading ? (
          <p style={{ color: 'var(--text2)' }}>{t('Loading…')}</p>
        ) : !started ? (
          <p style={{ color: 'var(--text2)', fontSize: 13 }}>{t('Not started yet — set a starting balance below.')}</p>
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
            {bakiOutstanding > 0 && (
              <div className="insight" style={{ marginTop: 12, textAlign: 'left' }}>
                <b>{t('Baki not yet received:')} {taka(bakiOutstanding)}</b>{' '}
                {t('This was sold (it is in sales) but no cash has come in, so it is not in the balance above. Sales − expense will look higher than the cash that exists by this amount until it is paid. Enter it as "Baki received" on the day it is paid.')}
              </div>
            )}
          </>
        ) : (
          <p style={{ color: 'var(--text2)', fontSize: 13 }}>{t('No entries in the tracked range yet.')}</p>
        )}
      </div>

      {loading ? null : !started ? (
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

          <PeriodFilter value={period} onChange={setPeriod} />

          <div className="toggle-row" style={{ marginBottom: 10 }}>
            <button className={view === 'daily' ? 'on' : ''} onClick={() => setView('daily')}>{t('Daily')}</button>
            <button className={view === 'weekly' ? 'on' : ''} onClick={() => setView('weekly')}>{t('Weekly')}</button>
            <button className={view === 'monthly' ? 'on' : ''} onClick={() => setView('monthly')}>{t('Monthly')}</button>
          </div>

          {summary && (
            <div className="card" style={{ padding: '12px 14px' }}>
              <div className="step-calc">
                <div className="calc-row"><span>{t('Opening')}</span><span>{taka(summary.opening)}</span></div>
                <div className="calc-row"><span>{t('Cash added (taken home)')}</span><span className={summary.added >= 0 ? 'g' : 'r'}>{summary.added >= 0 ? '+' : ''}{taka(summary.added)}</span></div>
                {summary.adjusted !== 0 && <div className="calc-row"><span>{t('Adjustments')}</span><span>{taka(summary.adjusted)}</span></div>}
                <div className="calc-row result"><span>{t('Closing')}</span><span>{taka(summary.closing)}</span></div>
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8 }}>
                {digits(String(summary.days))} {t('days')} · {t('avg per day')} {taka(summary.added / summary.days)}
              </p>
            </div>
          )}

          <div className="card">
            <div className="card-title">{view === 'daily' ? t('Ledger') : view === 'weekly' ? t('Weekly ledger') : t('Monthly ledger')}</div>
            {loading ? (
              <p style={{ color: 'var(--text2)' }}>{t('Loading…')}</p>
            ) : inRange.length === 0 ? (
              <p style={{ color: 'var(--text2)', fontSize: 13 }}>{t('No days tracked in this period.')}</p>
            ) : view !== 'daily' ? (
              <table className="denom-table">
                <thead>
                  <tr>
                    <th>{view === 'weekly' ? t('Week') : t('Month')}</th>
                    <th>{t('Opening')}</th>
                    <th>{t('Added')}</th>
                    <th>{t('Adj.')}</th>
                    <th>{t('Closing')}</th>
                    <th>{t('Days')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rolled.map((g) => (
                    <tr key={g.key}>
                      <td>{view === 'weekly' ? `${dateShort(g.from)} – ${dateShort(g.to)}` : monthName(g.key)}{g.pending ? ' *' : ''}</td>
                      <td style={{ fontFamily: 'var(--mono)' }}>{taka(g.opening)}</td>
                      <td style={{ fontFamily: 'var(--mono)', color: g.dayDelta >= 0 ? 'var(--green)' : 'var(--red)' }}>{g.dayDelta >= 0 ? '+' : ''}{taka(g.dayDelta)}</td>
                      <td style={{ fontFamily: 'var(--mono)' }}>{g.adjustment !== 0 ? taka(g.adjustment) : '—'}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>{taka(g.closing)}</td>
                      <td style={{ fontFamily: 'var(--mono)' }}>{digits(String(g.days))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                  {[...inRange].reverse().map((row) => (
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
            {view !== 'daily' && rolled.some((g) => g.pending) && (
              <p style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8 }}>* {t('includes a day that is still pending')}</p>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
