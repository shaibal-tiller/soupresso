'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '../AppShell';
import { computeCashSummary, denominationTotal, STANDARD_DENOMINATIONS } from '@/lib/cash-math';

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function formatDateNice(dateVal) {
  // dateVal may arrive as a Postgres DATE serialized to a full ISO timestamp
  // (e.g. "2026-09-03T00:00:00.000Z") — take just the date part and format it.
  const isoDatePart = String(dateVal).slice(0, 10);
  const d = new Date(isoDatePart + 'T00:00:00');
  if (isNaN(d)) return isoDatePart;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function emptyDenoms() {
  return Object.fromEntries(STANDARD_DENOMINATIONS.map((d) => [d, 0]));
}

export default function EntryPage() {
  const [date, setDate] = useState(todayStr());
  const [mode, setMode] = useState('denom'); // 'denom' | 'total'
  const [denoms, setDenoms] = useState(emptyDenoms());
  const [totalDirect, setTotalDirect] = useState('');
  const [openingBhangti, setOpeningBhangti] = useState(0);
  const [bazarAdvanceReceived, setBazarAdvanceReceived] = useState(0);
  const [bazarActualCost, setBazarActualCost] = useState(0);
  const [nextBazarAdvance, setNextBazarAdvance] = useState(0);
  const [nextBhangti, setNextBhangti] = useState(0);
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // {type:'ok'|'err', text}
  const [carryForwardNote, setCarryForwardNote] = useState(null);
  const [hadExistingEntry, setHadExistingEntry] = useState(false);

  const load = useCallback(async (d) => {
    setLoading(true);
    setMsg(null);
    setCarryForwardNote(null);
    try {
      const res = await fetch(`/api/entries?date=${d}`);
      const data = await res.json();
      if (data.entry) {
        const e = data.entry;
        setHadExistingEntry(true);
        if (e.denominations) {
          setMode('denom');
          setDenoms({ ...emptyDenoms(), ...e.denominations });
        } else {
          setMode('total');
          setTotalDirect(String(e.total_counted));
        }
        setOpeningBhangti(Number(e.opening_bhangti));
        setBazarAdvanceReceived(Number(e.bazar_advance_received));
        setBazarActualCost(Number(e.bazar_actual_cost));
        setNextBazarAdvance(Number(e.next_bazar_advance));
        setNextBhangti(Number(e.next_bhangti));
        setNotes(e.notes || '');
      } else {
        setHadExistingEntry(false);
        setMode('denom');
        setDenoms(emptyDenoms());
        setTotalDirect('');
        setBazarActualCost(0);
        setNextBazarAdvance(0);
        setNextBhangti(0);
        setNotes('');
        if (data.carryForward) {
          setOpeningBhangti(data.carryForward.openingBhangti);
          setBazarAdvanceReceived(data.carryForward.bazarAdvanceReceived);
          setCarryForwardNote(
            `Opening bhangti and bazar advance were carried forward from ${formatDateNice(data.carryForward.fromDate)}.`
          );
        } else {
          setOpeningBhangti(0);
          setBazarAdvanceReceived(0);
        }
      }
    } catch {
      setMsg({ type: 'err', text: 'Could not load this day. Check your connection.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  const totalCounted = mode === 'denom' ? denominationTotal(denoms) : Number(totalDirect) || 0;
  const summary = computeCashSummary({
    totalCounted,
    openingBhangti: Number(openingBhangti) || 0,
    bazarAdvanceReceived: Number(bazarAdvanceReceived) || 0,
    bazarActualCost: Number(bazarActualCost) || 0,
    nextBazarAdvance: Number(nextBazarAdvance) || 0,
    nextBhangti: Number(nextBhangti) || 0,
  });

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryDate: date,
          denominations: mode === 'denom' ? denoms : null,
          totalCounted,
          openingBhangti: Number(openingBhangti) || 0,
          bazarAdvanceReceived: Number(bazarAdvanceReceived) || 0,
          bazarActualCost: Number(bazarActualCost) || 0,
          nextBazarAdvance: Number(nextBazarAdvance) || 0,
          nextBhangti: Number(nextBhangti) || 0,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: 'err', text: data.error || 'Save failed.' });
      } else {
        setMsg({ type: 'ok', text: 'Saved.' });
        setHadExistingEntry(true);
      }
    } catch {
      setMsg({ type: 'err', text: 'Could not reach the server.' });
    } finally {
      setSaving(false);
    }
  }

  function shiftDate(days) {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().slice(0, 10));
  }

  return (
    <AppShell>
      <div className="day-nav">
        <button onClick={() => shiftDate(-1)}>‹</button>
        <div className="date-display">
          {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
        <button onClick={() => shiftDate(1)}>›</button>
      </div>

      {loading ? (
        <div className="card">Loading…</div>
      ) : (
        <>
          {hadExistingEntry && (
            <div className="status-msg ok">This day already has a saved entry — editing it.</div>
          )}
          {carryForwardNote && <div className="status-msg ok">{carryForwardNote}</div>}

          <div className="card">
            <div className="card-title">Step 1 — Count today's box</div>
            <div className="toggle-row">
              <button className={mode === 'denom' ? 'on' : ''} onClick={() => setMode('denom')}>By denomination</button>
              <button className={mode === 'total' ? 'on' : ''} onClick={() => setMode('total')}>Enter total</button>
            </div>

            {mode === 'denom' ? (
              <table className="denom-table">
                <thead><tr><th>Note</th><th>Count</th><th>Subtotal</th></tr></thead>
                <tbody>
                  {STANDARD_DENOMINATIONS.map((d) => (
                    <tr key={d}>
                      <td>৳{d}</td>
                      <td>
                        <input
                          type="number" min="0" value={denoms[d] || 0}
                          onChange={(e) => setDenoms({ ...denoms, [d]: Math.max(0, Number(e.target.value) || 0) })}
                        />
                      </td>
                      <td style={{ fontFamily: 'var(--mono)' }}>৳{(d * (denoms[d] || 0)).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="field">
                <label>Total amount counted (৳)</label>
                <input type="number" min="0" value={totalDirect} onChange={(e) => setTotalDirect(e.target.value)} placeholder="e.g. 10000" />
              </div>
            )}

            <div className="kpi" style={{ marginTop: 12 }}>
              <div className="kpi-label">Total counted in box</div>
              <div className="kpi-value">৳{totalCounted.toLocaleString()}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Step 2 — Today's total sales</div>
            <div className="field">
              <label>Opening bhangti (kept in the box yesterday for today)</label>
              <input type="number" min="0" value={openingBhangti} onChange={(e) => setOpeningBhangti(e.target.value)} />
            </div>
            <div className="kpi">
              <div className="kpi-label">Total sales (calculated)</div>
              <div className={`kpi-value ${summary.totalSales >= 0 ? 'g' : 'r'}`}>৳{summary.totalSales.toLocaleString()}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Step 3 — Settle yesterday's bazar advance</div>
            <div className="field">
              <label>Bazar advance received (for today's shopping)</label>
              <input type="number" min="0" value={bazarAdvanceReceived} onChange={(e) => setBazarAdvanceReceived(e.target.value)} />
            </div>
            <div className="field">
              <label>Actual bazar cost today</label>
              <input type="number" min="0" value={bazarActualCost} onChange={(e) => setBazarActualCost(e.target.value)} />
            </div>
            <div className="kpi">
              <div className="kpi-label">Variance</div>
              <div className={`kpi-value ${summary.bazarVariance > 0 ? 'r' : summary.bazarVariance < 0 ? 'g' : ''}`} style={{ fontSize: 15 }}>
                {summary.bazarVarianceLabel}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Step 4 — Set aside for tomorrow</div>
            <div className="field">
              <label>Bazar advance to give the chef for tomorrow</label>
              <input type="number" min="0" value={nextBazarAdvance} onChange={(e) => setNextBazarAdvance(e.target.value)} />
            </div>
            <div className="field">
              <label>Bhangti to keep in the box for tomorrow</label>
              <input type="number" min="0" value={nextBhangti} onChange={(e) => setNextBhangti(e.target.value)} />
            </div>
          </div>

          <div className="card">
            <div className="card-title">Result — cash taken home today</div>
            <div className="result-row"><span className="label">Total counted</span><span className="val">৳{totalCounted.toLocaleString()}</span></div>
            <div className="result-row"><span className="label">Bazar variance</span><span className="val">{summary.bazarVariance >= 0 ? '-' : '+'}৳{Math.abs(summary.bazarVariance).toLocaleString()}</span></div>
            <div className="result-row"><span className="label">Tomorrow's bazar advance</span><span className="val">-৳{Number(nextBazarAdvance || 0).toLocaleString()}</span></div>
            <div className="result-row"><span className="label">Tomorrow's bhangti</span><span className="val">-৳{Number(nextBhangti || 0).toLocaleString()}</span></div>
            <div className="result-row" style={{ fontWeight: 700 }}>
              <span className="label" style={{ color: 'var(--text)' }}>Cash taken home</span>
              <span className={`val ${summary.cashTakenHome >= 0 ? '' : ''}`} style={{ color: summary.cashTakenHome >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 16 }}>
                ৳{summary.cashTakenHome.toLocaleString()}
              </span>
            </div>

            {summary.isShort && (
              <div className="insight red" style={{ marginTop: 12 }}>
                <b>Box is short.</b> There isn't enough to cover today's bazar variance plus tomorrow's advance and bhangti. You'll need to add personal funds, or reduce tomorrow's estimates.
              </div>
            )}

            <div className="field" style={{ marginTop: 14 }}>
              <label>Notes (optional)</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth remembering about today" />
            </div>

            {msg && <div className={`status-msg ${msg.type}`}>{msg.text}</div>}
            <button className="btn block" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : hadExistingEntry ? 'Update this day' : 'Save this day'}
            </button>
          </div>
        </>
      )}
    </AppShell>
  );
}
