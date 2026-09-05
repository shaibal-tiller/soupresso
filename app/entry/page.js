'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '../AppShell';
import { computeCashSummary, denominationTotal, STANDARD_DENOMINATIONS } from '@/lib/cash-math';
import { todayStr, shiftDateStr, formatDateDisplay, formatDateNice } from '@/lib/dates';

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
  const [isOffDay, setIsOffDay] = useState(false);

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
    setIsOffDay(false);
    try {
      const res = await fetch(`/api/entries?date=${d}`);
      const data = await res.json();
      if (data.entry) {
        const e = data.entry;
        setHadExistingEntry(true);
        setIsOffDay(!!e.is_off_day);
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
          setCarryForwardNote(`Carried forward from ${formatDateNice(data.carryForward.fromDate)}`);
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
          isOffDay,
          denominations: isOffDay ? null : (mode === 'denom' ? denoms : null),
          totalCounted: isOffDay ? 0 : totalCounted,
          openingBhangti: isOffDay ? 0 : (Number(openingBhangti) || 0),
          bazarAdvanceReceived: isOffDay ? 0 : (Number(bazarAdvanceReceived) || 0),
          bazarActualCost: isOffDay ? 0 : (Number(bazarActualCost) || 0),
          nextBazarAdvance: isOffDay ? 0 : (Number(nextBazarAdvance) || 0),
          nextBhangti: isOffDay ? 0 : (Number(nextBhangti) || 0),
          notes: isOffDay ? (notes || 'Shop closed') : notes,
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

  const stepLabels = ['Count box', 'Sales', 'Bazar', 'Tomorrow', 'Review'];

  return (
    <AppShell>
      <div className="wizard-shell">

        {/* Header: date nav with picker + off-day toggle */}
        <div className="wizard-header">
          <div className="day-nav" style={{ marginBottom: 6 }}>
            <button onClick={() => setDate(shiftDateStr(date, -1))}>‹</button>
            <label className="date-display" style={{ cursor: 'pointer', position: 'relative' }}>
              {formatDateDisplay(date)}
              <input
                type="date" value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }}
              />
            </label>
            <button onClick={() => setDate(shiftDateStr(date, 1))}>›</button>
          </div>

          {hadExistingEntry && !isOffDay && <div className="wizard-badge edit">Editing saved entry</div>}
          {carryForwardNote && !hadExistingEntry && <div className="wizard-badge carry">{carryForwardNote}</div>}

          {/* Off-day toggle */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
            <button
              className={`btn ${isOffDay ? 'danger' : 'secondary'}`}
              style={{ padding: '6px 16px', fontSize: 12.5 }}
              onClick={() => setIsOffDay(!isOffDay)}
            >
              {isOffDay ? '🚫 Shop Off — tap to undo' : 'Mark as off day'}
            </button>
          </div>

          {!isOffDay && (
            <div className="step-dots">
              {stepLabels.map((label, i) => (
                <button key={i} className={`step-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`} onClick={() => setStep(i)}>
                  <span className="dot-circle">{i < step ? '✓' : i + 1}</span>
                  <span className="dot-label">{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        {loading ? (
          <div className="wizard-body"><div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text2)' }}>Loading…</div></div>
        ) : isOffDay ? (
          <div className="wizard-body">
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🚫</div>
              <h3 style={{ color: 'var(--text)', marginBottom: 6 }}>Shop closed</h3>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>This day will be marked as an off day — no sales recorded.</p>
              <div className="field">
                <label>Note (optional)</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Holiday, rain, personal day" />
              </div>
              {msg && <div className={`status-msg ${msg.type}`}>{msg.text}</div>}
            </div>
          </div>
        ) : (
          <div className="wizard-body">

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
                        <input type="number" min="0" inputMode="numeric" value={denoms[d] || 0}
                          onChange={(e) => setDenoms({ ...denoms, [d]: Math.max(0, Number(e.target.value) || 0) })} />
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
                <div className="step-result"><span>Total counted</span><strong>৳{totalCounted.toLocaleString()}</strong></div>
              </div>
            )}

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

        {/* Footer */}
        {!loading && (
          <div className="wizard-footer">
            {isOffDay ? (
              <>
                <div />
                <button className="btn" style={{ background: 'var(--green)' }} onClick={() => setShowConfirm(true)} disabled={saving}>
                  {saving ? 'Saving…' : hadExistingEntry ? '✓ Update' : '✓ Mark off day'}
                </button>
              </>
            ) : (
              <>
                <button className="btn secondary" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>← Back</button>
                <span className="step-counter">{step + 1} / {TOTAL_STEPS}</span>
                {step < TOTAL_STEPS - 1 ? (
                  <button className="btn" onClick={() => setStep(step + 1)}>Next →</button>
                ) : (
                  <button className="btn" style={{ background: 'var(--green)' }} onClick={() => setShowConfirm(true)} disabled={saving}>
                    {saving ? 'Saving…' : hadExistingEntry ? '✓ Update' : '✓ Save'}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Confirmation modal */}
        {showConfirm && (
          <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <h3>{isOffDay ? 'Mark as off day?' : hadExistingEntry ? 'Update this entry?' : 'Save this entry?'}</h3>
              <p>
                {isOffDay
                  ? `Mark ${formatDateDisplay(date)} as a shop off day.`
                  : hadExistingEntry
                  ? `You're about to overwrite the saved data for ${formatDateDisplay(date)}. The previous version will be kept in the audit log.`
                  : `Save the cash entry for ${formatDateDisplay(date)}?`
                }
              </p>
              {!isOffDay && (
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
              )}
              <div className="modal-actions">
                <button className="btn secondary" onClick={() => setShowConfirm(false)}>Cancel</button>
                <button className="btn" style={{ background: 'var(--green)' }} onClick={() => { setShowConfirm(false); handleSave(); }} disabled={saving}>
                  {isOffDay ? 'Yes, mark off' : hadExistingEntry ? 'Yes, update' : 'Yes, save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
