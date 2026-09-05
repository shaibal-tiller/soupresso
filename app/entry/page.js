'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AppShell from '../AppShell';
import { computeCashSummary, denominationTotal, STANDARD_DENOMINATIONS } from '@/lib/cash-math';
import { todayStr, shiftDateStr, formatDateDisplay, formatDateNice } from '@/lib/dates';

function emptyDenoms() {
  return Object.fromEntries(STANDARD_DENOMINATIONS.map((d) => [d, 0]));
}

const TOTAL_STEPS = 5;

export default function EntryPage() {
  const [date, setDate] = useState(todayStr());
  const [editing, setEditing] = useState(false); // locked until user explicitly starts
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
  const [existingEntry, setExistingEntry] = useState(null); // raw entry for the summary card
  const [showConfirm, setShowConfirm] = useState(false);
  const dateRef = useRef(null);

  const load = useCallback(async (d) => {
    setLoading(true);
    setMsg(null);
    setCarryForwardNote(null);
    setStep(0);
    setIsOffDay(false);
    setEditing(false);
    setExistingEntry(null);
    try {
      const res = await fetch(`/api/entries?date=${d}`);
      const data = await res.json();
      if (data.entry) {
        const e = data.entry;
        setHadExistingEntry(true);
        setExistingEntry(e);
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
        setEditing(false);
        load(date); // reload to show the updated summary
      }
    } catch {
      setMsg({ type: 'err', text: 'Could not reach the server.' });
    } finally {
      setSaving(false);
    }
  }

  const stepLabels = ['Count box', 'Sales', 'Bazar', 'Tomorrow', 'Review'];
  const fmt = (n) => `৳${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <AppShell>
      <div className="wizard-shell">

        {/* Header: date nav with calendar picker */}
        <div className="wizard-header">
          <div className="day-nav" style={{ marginBottom: 6 }}>
            <button onClick={() => setDate(shiftDateStr(date, -1))}>‹</button>
            <button className="date-picker-btn" onClick={() => dateRef.current?.showPicker?.()}>
              <span className="cal-icon">📅</span>
              <span>{formatDateDisplay(date)}</span>
              <input
                ref={dateRef}
                type="date" value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="date-hidden-input"
              />
            </button>
            <button onClick={() => setDate(shiftDateStr(date, 1))}>›</button>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="wizard-body"><div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text2)' }}>Loading…</div></div>

        ) : !editing ? (
          /* ============ LOCKED STATE: summary or empty ============ */
          <div className="wizard-body">
            {hadExistingEntry && existingEntry ? (
              existingEntry.is_off_day ? (
                /* Off day summary */
                <div className="card" style={{ textAlign: 'center', padding: '30px 20px' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🚫</div>
                  <h3 style={{ color: 'var(--text)', marginBottom: 4 }}>Shop was closed</h3>
                  {existingEntry.notes && <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>{existingEntry.notes}</p>}
                  <button className="btn secondary" onClick={() => { setEditing(true); }} style={{ marginTop: 8 }}>
                    ✎ Edit this day
                  </button>
                </div>
              ) : (
                /* Existing entry summary */
                <div className="card">
                  <div className="card-title">Saved entry</div>
                  <div className="step-calc">
                    <div className="calc-row"><span>Total sales</span><span className="g">{fmt(existingEntry.total_sales)}</span></div>
                    <div className="calc-row"><span>Expense (bazar)</span><span style={{ color: 'var(--red)' }}>{fmt(existingEntry.bazar_actual_cost)}</span></div>
                    <div className="calc-row"><span>Bazar advance (tomorrow)</span><span>{fmt(existingEntry.next_bazar_advance)}</span></div>
                    <div className="calc-row"><span>Bhangti in box</span><span>{fmt(existingEntry.next_bhangti)}</span></div>
                    <div className={`calc-row result`}>
                      <span>Cash taken home</span>
                      <span className={Number(existingEntry.cash_taken_home) >= 0 ? 'g' : 'r'}>{fmt(existingEntry.cash_taken_home)}</span>
                    </div>
                  </div>
                  {existingEntry.notes && (
                    <div className="receipt-note" style={{ marginTop: 12 }}>
                      <span className="note-icon">📝</span>
                      <span>{existingEntry.notes}</span>
                    </div>
                  )}
                  <button className="btn secondary block" onClick={() => setEditing(true)} style={{ marginTop: 16 }}>
                    ✎ Edit this entry
                  </button>
                </div>
              )
            ) : (
              /* No entry yet */
              <div className="card" style={{ textAlign: 'center', padding: '36px 20px' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
                <h3 style={{ color: 'var(--text)', marginBottom: 6 }}>No entry yet</h3>
                <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
                  {formatDateDisplay(date)}
                </p>
                {carryForwardNote && <div className="wizard-badge carry" style={{ marginBottom: 16 }}>{carryForwardNote}</div>}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button className="btn" onClick={() => { setEditing(true); setIsOffDay(false); }}>
                    ＋ Start entry
                  </button>
                  <button className="btn secondary" onClick={() => { setEditing(true); setIsOffDay(true); }}>
                    🚫 Mark off day
                  </button>
                </div>
              </div>
            )}
            {msg && <div className={`status-msg ${msg.type}`} style={{ marginTop: 10 }}>{msg.text}</div>}
          </div>

        ) : isOffDay ? (
          /* ============ EDITING: off day ============ */
          <div className="wizard-body">
            <div className="card" style={{ textAlign: 'center', padding: '30px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🚫</div>
              <h3 style={{ color: 'var(--text)', marginBottom: 6 }}>Shop closed</h3>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>This day will be marked as an off day — no sales recorded.</p>
              <div className="field" style={{ textAlign: 'left' }}>
                <label>Note (optional)</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Holiday, rain, personal day" />
              </div>
              {msg && <div className={`status-msg ${msg.type}`}>{msg.text}</div>}
            </div>
          </div>

        ) : (
          /* ============ EDITING: wizard steps ============ */
          <div className="wizard-body">

            {/* Step dots — only shown in editing mode */}
            <div className="step-dots" style={{ marginBottom: 8 }}>
              {stepLabels.map((label, i) => (
                <button key={i} className={`step-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`} onClick={() => setStep(i)}>
                  <span className="dot-circle">{i < step ? '✓' : i + 1}</span>
                  <span className="dot-label">{label}</span>
                </button>
              ))}
            </div>

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
                    <b>Box is short.</b> Not enough to cover tomorrow's advance and bhangti.
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

        {/* Footer — only when editing */}
        {!loading && editing && (
          <div className="wizard-footer">
            {isOffDay ? (
              <>
                <button className="btn secondary" onClick={() => { setEditing(false); setIsOffDay(hadExistingEntry ? !!existingEntry?.is_off_day : false); }}>Cancel</button>
                <button className="btn" style={{ background: 'var(--green)' }} onClick={() => setShowConfirm(true)} disabled={saving}>
                  {saving ? 'Saving…' : '✓ Mark off day'}
                </button>
              </>
            ) : (
              <>
                <button className="btn secondary" onClick={() => step === 0 ? setEditing(false) : setStep(Math.max(0, step - 1))}>
                  {step === 0 ? '✕ Cancel' : '← Back'}
                </button>
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
                  ? `Overwrite the saved data for ${formatDateDisplay(date)}? Previous version will be kept in the audit log.`
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
