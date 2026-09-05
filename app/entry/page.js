'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '../AppShell';
import { computeCashSummary, denominationTotal, STANDARD_DENOMINATIONS } from '@/lib/cash-math';

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function formatDateNice(dateVal) {
  const isoDatePart = String(dateVal).slice(0, 10);
  const d = new Date(isoDatePart + 'T00:00:00');
  if (isNaN(d)) return isoDatePart;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function emptyDenoms() {
  return Object.fromEntries(STANDARD_DENOMINATIONS.map((d) => [d, 0]));
}

const TOTAL_STEPS = 5;

export default function EntryPage() {
  const [date, setDate] = useState(todayStr());
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState('denom');
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
  const [msg, setMsg] = useState(null);
  const [carryForwardNote, setCarryForwardNote] = useState(null);
  const [hadExistingEntry, setHadExistingEntry] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const load = useCallback(async (d) => {
    setLoading(true);
    setMsg(null);
    setCarryForwardNote(null);
    setStep(0);
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
            `Carried forward from ${formatDateNice(data.carryForward.fromDate)}`
          );
        } else {
          setOpeningBhangti(0);
          setBazarAdvanceReceived(0);
        }
      }
    } catch {
      setMsg({ type: 'err', text: 'Could not load this day.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(date); }, [date, load]);

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
        setMsg({ type: 'ok', text: 'Saved successfully!' });
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

  const stepLabels = ['Count box', 'Sales', 'Bazar', 'Tomorrow', 'Review'];

  return (
    <AppShell>
      <div className="wizard-shell">

        {/* ---- Header: date nav + step indicator ---- */}
        <div className="wizard-header">
          <div className="day-nav" style={{ marginBottom: 8 }}>
            <button onClick={() => shiftDate(-1)}>‹</button>
            <div className="date-display">
              {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
            <button onClick={() => shiftDate(1)}>›</button>
          </div>

          {hadExistingEntry && <div className="wizard-badge edit">Editing saved entry</div>}
          {carryForwardNote && !hadExistingEntry && <div className="wizard-badge carry">{carryForwardNote}</div>}

          <div className="step-dots">
            {stepLabels.map((label, i) => (
              <button key={i} className={`step-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`} onClick={() => setStep(i)}>
                <span className="dot-circle">{i < step ? '✓' : i + 1}</span>
                <span className="dot-label">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ---- Step content ---- */}
        {loading ? (
          <div className="wizard-body"><div className="card">Loading…</div></div>
        ) : (
          <div className="wizard-body">

            {/* STEP 0: Count the box */}
            {step === 0 && (
              <div className="card">
                <div className="card-title">Count today's box</div>
                <div className="toggle-row" style={{ marginBottom: 10 }}>
                  <button className={mode === 'denom' ? 'on' : ''} onClick={() => setMode('denom')}>By denomination</button>
                  <button className={mode === 'total' ? 'on' : ''} onClick={() => setMode('total')}>Enter total</button>
                </div>

                {mode === 'denom' ? (
                  <div className="denom-grid">
                    {STANDARD_DENOMINATIONS.map((d) => (
                      <div key={d} className="denom-cell">
                        <span className="denom-note">৳{d}</span>
                        <input
                          type="number" min="0" inputMode="numeric"
                          value={denoms[d] || 0}
                          onChange={(e) => setDenoms({ ...denoms, [d]: Math.max(0, Number(e.target.value) || 0) })}
                        />
                        <span className="denom-sub">= ৳{(d * (denoms[d] || 0)).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="field">
                    <label>Total amount in box (৳)</label>
                    <input type="number" min="0" inputMode="numeric" value={totalDirect} onChange={(e) => setTotalDirect(e.target.value)} placeholder="e.g. 10000" autoFocus />
                  </div>
                )}

                <div className="step-result">
                  <span>Total counted</span>
                  <strong>৳{totalCounted.toLocaleString()}</strong>
                </div>
              </div>
            )}

            {/* STEP 1: Today's sales */}
            {step === 1 && (
              <div className="card">
                <div className="card-title">Today's total sales</div>
                <p className="step-hint">How much bhangti (loose change) was already in the box from yesterday?</p>
                <div className="field">
                  <label>Opening bhangti (৳)</label>
                  <input type="number" min="0" inputMode="numeric" value={openingBhangti} onChange={(e) => setOpeningBhangti(e.target.value)} autoFocus />
                </div>
                <div className="step-calc">
                  <div className="calc-row"><span>Total counted</span><span>৳{totalCounted.toLocaleString()}</span></div>
                  <div className="calc-row"><span>− Opening bhangti</span><span>৳{Number(openingBhangti || 0).toLocaleString()}</span></div>
                  <div className="calc-row result"><span>Today's sales</span><span className={summary.totalSales >= 0 ? 'g' : 'r'}>৳{summary.totalSales.toLocaleString()}</span></div>
                </div>
              </div>
            )}

            {/* STEP 2: Bazar settlement */}
            {step === 2 && (
              <div className="card">
                <div className="card-title">Settle yesterday's bazar</div>
                <div className="field">
                  <label>Bazar advance received (for today's shopping)</label>
                  <input type="number" min="0" inputMode="numeric" value={bazarAdvanceReceived} onChange={(e) => setBazarAdvanceReceived(e.target.value)} autoFocus />
                </div>
                <div className="field">
                  <label>Actual bazar cost today</label>
                  <input type="number" min="0" inputMode="numeric" value={bazarActualCost} onChange={(e) => setBazarActualCost(e.target.value)} />
                </div>
                <div className={`step-result ${summary.bazarVariance > 0 ? 'warn' : summary.bazarVariance < 0 ? 'good' : ''}`}>
                  <span>{summary.bazarVarianceLabel}</span>
                </div>
              </div>
            )}

            {/* STEP 3: Set aside for tomorrow */}
            {step === 3 && (
              <div className="card">
                <div className="card-title">Set aside for tomorrow</div>
                <div className="field">
                  <label>Bazar advance to give chef now (৳)</label>
                  <input type="number" min="0" inputMode="numeric" value={nextBazarAdvance} onChange={(e) => setNextBazarAdvance(e.target.value)} autoFocus />
                </div>
                <div className="field">
                  <label>Bhangti to keep in the box (৳)</label>
                  <input type="number" min="0" inputMode="numeric" value={nextBhangti} onChange={(e) => setNextBhangti(e.target.value)} />
                </div>
              </div>
            )}

            {/* STEP 4: Review & save */}
            {step === 4 && (
              <div className="card">
                <div className="card-title">Review & save</div>
                <div className="step-calc">
                  <div className="calc-row"><span>Total counted</span><span>৳{totalCounted.toLocaleString()}</span></div>
                  <div className="calc-row"><span>Total sales</span><span className="g">৳{summary.totalSales.toLocaleString()}</span></div>
                  <div className="calc-row"><span>Bazar variance</span><span>{summary.bazarVariance >= 0 ? '−' : '+'}৳{Math.abs(summary.bazarVariance).toLocaleString()}</span></div>
                  <div className="calc-row"><span>Tomorrow's bazar</span><span>−৳{Number(nextBazarAdvance || 0).toLocaleString()}</span></div>
                  <div className="calc-row"><span>Tomorrow's bhangti</span><span>−৳{Number(nextBhangti || 0).toLocaleString()}</span></div>
                  <div className={`calc-row result ${summary.isShort ? 'short' : ''}`}>
                    <span>Cash taken home</span>
                    <span className={summary.cashTakenHome >= 0 ? 'g' : 'r'}>৳{summary.cashTakenHome.toLocaleString()}</span>
                  </div>
                </div>

                {summary.isShort && (
                  <div className="insight red" style={{ marginTop: 10 }}>
                    <b>Box is short.</b> Not enough to cover tomorrow's advance and bhangti. Go back and adjust.
                  </div>
                )}

                <div className="field" style={{ marginTop: 12 }}>
                  <label>Notes (optional)</label>
                  <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to remember" />
                </div>

                {msg && <div className={`status-msg ${msg.type}`}>{msg.text}</div>}
              </div>
            )}

          </div>
        )}

        {/* ---- Footer: back / next / save ---- */}
        {!loading && (
          <div className="wizard-footer">
            <button className="btn secondary" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
              ← Back
            </button>

            <span className="step-counter">{step + 1} / {TOTAL_STEPS}</span>

            {step < TOTAL_STEPS - 1 ? (
              <button className="btn" onClick={() => setStep(step + 1)}>
                Next →
              </button>
            ) : (
              <button className="btn" style={{ background: 'var(--green)' }} onClick={() => setShowConfirm(true)} disabled={saving}>
                {saving ? 'Saving…' : hadExistingEntry ? '✓ Update' : '✓ Save'}
              </button>
            )}
          </div>
        )}

        {/* Confirmation modal */}
        {showConfirm && (
          <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <h3>{hadExistingEntry ? 'Update this entry?' : 'Save this entry?'}</h3>
              <p>
                {hadExistingEntry
                  ? `You're about to overwrite the saved data for ${new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}. The previous version will be kept in the audit log.`
                  : `Save the cash entry for ${new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}?`
                }
              </p>
              <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text2)' }}>Total sales</span>
                  <strong style={{ color: 'var(--green)', fontFamily: 'var(--mono)' }}>৳{summary.totalSales.toLocaleString()}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text2)' }}>Cash taken home</span>
                  <strong style={{ color: summary.cashTakenHome >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--mono)' }}>৳{summary.cashTakenHome.toLocaleString()}</strong>
                </div>
              </div>
              <div className="modal-actions">
                <button className="btn secondary" onClick={() => setShowConfirm(false)}>Cancel</button>
                <button className="btn" style={{ background: 'var(--green)' }} onClick={() => { setShowConfirm(false); handleSave(); }} disabled={saving}>
                  {hadExistingEntry ? 'Yes, update' : 'Yes, save'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
