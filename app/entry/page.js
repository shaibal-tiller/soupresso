'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AppShell from '../AppShell';
import { useLang } from '../LangProvider';
import NumberInput from '../NumberInput';
import { computeCashSummary, denominationTotal, STANDARD_DENOMINATIONS } from '@/lib/cash-math';
import { todayStr, shiftDateStr } from '@/lib/dates';

function emptyDenoms() {
  return Object.fromEntries(STANDARD_DENOMINATIONS.map((d) => [d, 0]));
}

const TOTAL_STEPS = 5;

const HISHAB_CLOSERS = [
  'Ashraful', 'Shagor', 'Shaibal', 'Sadman', 'Arman (Josh)', 'Arman Mahmud',
  'Himel', 'Hridoy', 'Zamil', 'Ezaz', 'Shakil', 'Limon', 'Nazmul Rabbi',
  'Supto', 'Chef (Sujit)',
];

export default function EntryPage() {
  const { t, taka, num, digits, dateNice, dateDisplay } = useLang();
  const [date, setDate] = useState(todayStr());
  const [editing, setEditing] = useState(false); // locked until user explicitly starts
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState('denom');
  const [denoms, setDenoms] = useState(emptyDenoms());
  const [totalDirect, setTotalDirect] = useState('');
  const [openingBhangti, setOpeningBhangti] = useState(0);
  const [bazarAdvanceReceived, setBazarAdvanceReceived] = useState(0);
  const [bazarActualCost, setBazarActualCost] = useState(0);
  const [bazarTakenFromBox, setBazarTakenFromBox] = useState(0);
  const [nextBazarAdvance, setNextBazarAdvance] = useState(0);
  const [nextBhangti, setNextBhangti] = useState(0);
  const [notes, setNotes] = useState('');
  const [closedBy, setClosedBy] = useState([]);
  const [isOffDay, setIsOffDay] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [carryForwardFrom, setCarryForwardFrom] = useState(null);
  const [hadExistingEntry, setHadExistingEntry] = useState(false);
  const [existingEntry, setExistingEntry] = useState(null); // raw entry for the summary card
  const [showConfirm, setShowConfirm] = useState(false);
  const dateRef = useRef(null);

  const load = useCallback(async (d) => {
    setLoading(true);
    setMsg(null);
    setCarryForwardFrom(null);
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
        setBazarTakenFromBox(Number(e.bazar_taken_from_box) || 0);
        setNextBazarAdvance(Number(e.next_bazar_advance));
        setNextBhangti(Number(e.next_bhangti));
        setNotes(e.notes || '');
        setClosedBy(e.closed_by || []);
      } else {
        setHadExistingEntry(false);
        setMode('denom');
        setDenoms(emptyDenoms());
        setTotalDirect('');
        setBazarActualCost(0);
        setBazarTakenFromBox(0);
        setNextBazarAdvance(0);
        setNextBhangti(0);
        setNotes('');
        setClosedBy([]);
        if (data.carryForward) {
          setOpeningBhangti(data.carryForward.openingBhangti);
          setBazarAdvanceReceived(data.carryForward.bazarAdvanceReceived);
          setCarryForwardFrom(data.carryForward.fromDate);
        } else {
          setOpeningBhangti(0);
          setBazarAdvanceReceived(0);
        }
      }
    } catch {
      setMsg({ type: 'err', text: t('Could not load this day.') });
    } finally {
      setLoading(false);
    }
    // t intentionally omitted from deps: including it would recreate load on every
    // language toggle and reset an in-progress wizard. Error toasts from load may
    // briefly show the pre-toggle language — an accepted tradeoff.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  const totalCounted = mode === 'denom' ? denominationTotal(denoms) : Number(totalDirect) || 0;

  // Tomorrow's bhangti, when counting by denomination: each note can be marked
  // in/out (default: marked for ৳20 and under, unmarked above) with an
  // independently editable count (default: today's counted quantity for that
  // note). Only entries the user has actually touched are stored here; the
  // rest fall back to the defaults live, so this stays in sync if today's
  // count changes before the user customizes anything.
  const [nextBhangtiQtyOverride, setNextBhangtiQtyOverride] = useState({});
  const [nextBhangtiMarkOverride, setNextBhangtiMarkOverride] = useState({});
  const bhangtiQtyFor = (d) => (nextBhangtiQtyOverride[d] !== undefined ? nextBhangtiQtyOverride[d] : (denoms[d] || 0));
  const bhangtiMarkedFor = (d) => (nextBhangtiMarkOverride[d] !== undefined ? nextBhangtiMarkOverride[d] : d <= 20);
  const toggleBhangtiMark = (d) => setNextBhangtiMarkOverride((prev) => ({ ...prev, [d]: !bhangtiMarkedFor(d) }));
  const setBhangtiQty = (d, n) => setNextBhangtiQtyOverride((prev) => ({ ...prev, [d]: Math.max(0, n ?? 0) }));
  const nextBhangtiFromDenoms = STANDARD_DENOMINATIONS.reduce(
    (sum, d) => sum + (bhangtiMarkedFor(d) ? d * bhangtiQtyFor(d) : 0),
    0
  );
  const effectiveNextBhangti = mode === 'denom' ? nextBhangtiFromDenoms : (Number(nextBhangti) || 0);

  const summary = computeCashSummary({
    totalCounted,
    openingBhangti: Number(openingBhangti) || 0,
    bazarAdvanceReceived: Number(bazarAdvanceReceived) || 0,
    bazarActualCost: Number(bazarActualCost) || 0,
    bazarTakenFromBox: Number(bazarTakenFromBox) || 0,
    nextBazarAdvance: Number(nextBazarAdvance) || 0,
    nextBhangti: effectiveNextBhangti,
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
          bazarTakenFromBox: isOffDay ? 0 : (Number(bazarTakenFromBox) || 0),
          nextBazarAdvance: isOffDay ? 0 : (Number(nextBazarAdvance) || 0),
          nextBhangti: isOffDay ? 0 : effectiveNextBhangti,
          notes: isOffDay ? (notes || 'Shop closed') : notes,
          closedBy: isOffDay ? [] : closedBy,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: 'err', text: data.error || t('Save failed.') });
      } else {
        setMsg({ type: 'ok', text: t('Saved successfully!') });
        setHadExistingEntry(true);
        setEditing(false);
        load(date); // reload to show the updated summary
      }
    } catch {
      setMsg({ type: 'err', text: t('Could not reach the server.') });
    } finally {
      setSaving(false);
    }
  }

  const stepLabels = ['Count box', 'Bazar', 'Sales', 'Tomorrow', 'Review'];

  return (
    <AppShell>
      <div className="wizard-shell">

        {/* Header: date nav with calendar picker */}
        <div className="wizard-header">
          <div className="day-nav" style={{ marginBottom: 6 }}>
            <button onClick={() => setDate(shiftDateStr(date, -1))}>‹</button>
            <button className="date-picker-btn" onClick={() => dateRef.current?.showPicker?.()}>
              <span className="cal-icon">📅</span>
              <span>{dateDisplay(date)}</span>
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
          <div className="wizard-body"><div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text2)' }}>{t('Loading…')}</div></div>

        ) : !editing ? (
          /* ============ LOCKED STATE: summary or empty ============ */
          <div className="wizard-body">
            {hadExistingEntry && existingEntry ? (
              existingEntry.is_off_day ? (
                /* Off day summary */
                <div className="card" style={{ textAlign: 'center', padding: '30px 20px' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🚫</div>
                  <h3 style={{ color: 'var(--text)', marginBottom: 4 }}>{t('Shop was closed')}</h3>
                  {existingEntry.notes && <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>{existingEntry.notes}</p>}
                  <button className="btn secondary" onClick={() => { setEditing(true); }} style={{ marginTop: 8 }}>
                    ✎ {t('Edit this day')}
                  </button>
                </div>
              ) : (
                /* Existing entry summary */
                <div className="card">
                  <div className="card-title">{t('Saved entry')}</div>
                  <div className="step-calc">
                    <div className="calc-row"><span>{t('Total sales')}</span><span className="g">{taka(existingEntry.total_sales)}</span></div>
                    <div className="calc-row"><span>{t('Expense (bazar)')}</span><span style={{ color: 'var(--red)' }}>{taka(existingEntry.bazar_actual_cost)}</span></div>
                    <div className="calc-row"><span>{t('Bazar advance (tomorrow)')}</span><span>{taka(existingEntry.next_bazar_advance)}</span></div>
                    <div className="calc-row"><span>{t('Bhangti in box')}</span><span>{taka(existingEntry.next_bhangti)}</span></div>
                    <div className={`calc-row result`}>
                      <span>{t('Cash taken home')}</span>
                      <span className={Number(existingEntry.cash_taken_home) >= 0 ? 'g' : 'r'}>{taka(existingEntry.cash_taken_home)}</span>
                    </div>
                  </div>
                  {existingEntry.notes && (
                    <div className="receipt-note" style={{ marginTop: 12 }}>
                      <span className="note-icon">📝</span>
                      <span>{existingEntry.notes}</span>
                    </div>
                  )}
                  <button className="btn secondary block" onClick={() => setEditing(true)} style={{ marginTop: 16 }}>
                    ✎ {t('Edit this entry')}
                  </button>
                </div>
              )
            ) : (
              /* No entry yet */
              <div className="card" style={{ textAlign: 'center', padding: '36px 20px' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
                <h3 style={{ color: 'var(--text)', marginBottom: 6 }}>{t('No entry yet')}</h3>
                <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
                  {dateDisplay(date)}
                </p>
                {carryForwardFrom && <div className="wizard-badge carry" style={{ marginBottom: 16 }}>{t('Carried forward from')} {dateNice(carryForwardFrom)}</div>}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button className="btn" onClick={() => { setEditing(true); setIsOffDay(false); }}>
                    ＋ {t('Start entry')}
                  </button>
                  <button className="btn secondary" onClick={() => { setEditing(true); setIsOffDay(true); }}>
                    🚫 {t('Mark off day')}
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
              <h3 style={{ color: 'var(--text)', marginBottom: 6 }}>{t('Shop closed')}</h3>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>{t('This day will be marked as an off day — no sales recorded.')}</p>
              <div className="field" style={{ textAlign: 'left' }}>
                <label>{t('Note (optional)')}</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('e.g. Holiday, rain, personal day')} />
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
                  <span className="dot-circle">{i < step ? '✓' : num(i + 1)}</span>
                  <span className="dot-label">{t(label)}</span>
                </button>
              ))}
            </div>

            {step === 0 && (
              <div className="card">
                <div className="card-title">{t("Count today's box")}</div>
                <div className="toggle-row" style={{ marginBottom: 10 }}>
                  <button className={mode === 'denom' ? 'on' : ''} onClick={() => setMode('denom')}>{t('By denomination')}</button>
                  <button className={mode === 'total' ? 'on' : ''} onClick={() => setMode('total')}>{t('Enter total')}</button>
                </div>
                {mode === 'denom' ? (
                  <div className="denom-grid">
                    {STANDARD_DENOMINATIONS.map((d) => (
                      <div key={d} className="denom-cell">
                        <span className="denom-note">{'৳'}{digits(String(d))}</span>
                        <NumberInput value={denoms[d] || ''} min={0}
                          onValueChange={(n) => setDenoms({ ...denoms, [d]: Math.max(0, n ?? 0) })} />
                        <span className="denom-sub">= {taka(d * (denoms[d] || 0))}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="field">
                    <label>{t('Total amount in box (৳)')}</label>
                    <NumberInput value={totalDirect} min={0} onValueChange={(n) => setTotalDirect(n == null ? '' : String(n))} placeholder={t('e.g. 10000')} autoFocus />
                  </div>
                )}
                <div className="step-result"><span>{t('Total counted')}</span><strong>{taka(totalCounted)}</strong></div>
              </div>
            )}

            {step === 2 && (
              <div className="card">
                <div className="card-title">{t("Today's total sales")}</div>
                <p className="step-hint">{t('How much bhangti (loose change) was already in the box from yesterday?')}</p>
                <div className="field">
                  <label>{t('Opening bhangti (৳)')}</label>
                  <NumberInput value={openingBhangti} min={0} onValueChange={(n) => setOpeningBhangti(n ?? '')} autoFocus />
                </div>
                <div className="step-calc">
                  <div className="calc-row"><span>{t('Total counted')}</span><span>{taka(totalCounted)}</span></div>
                  <div className="calc-row"><span>{t('− Opening bhangti')}</span><span>{taka(Number(openingBhangti) || 0)}</span></div>
                  <div className="calc-row result"><span>{t("Today's sales")}</span><span className={summary.totalSales >= 0 ? 'g' : 'r'}>{taka(summary.totalSales)}</span></div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="card">
                <div className="card-title">{t("Settle yesterday's bazar")}</div>
                <div className="field">
                  <label>{t("Bazar advance received (for today's shopping)")}</label>
                  <NumberInput value={bazarAdvanceReceived} min={0} onValueChange={(n) => setBazarAdvanceReceived(n ?? '')} autoFocus />
                </div>
                <div className="field">
                  <label>{t('Actual bazar cost today')}</label>
                  <NumberInput value={bazarActualCost} min={0} onValueChange={(n) => setBazarActualCost(n ?? '')} />
                </div>
                {summary.bazarVariance > 0 && (
                  <div className="field">
                    <label>{t('How much of that did the chef already take from the box?')}</label>
                    <NumberInput value={bazarTakenFromBox} min={0} onValueChange={(n) => setBazarTakenFromBox(n ?? '')} />
                    <p className="step-hint">{t("Leave at ৳0 if he paid it from his own pocket — you'll pay him back from the box at Review.")}</p>
                  </div>
                )}
                <div className={`step-result ${summary.bazarVariance > 0 ? 'warn' : summary.bazarVariance < 0 ? 'good' : ''}`}>
                  <span>
                    {summary.bazarVariance > 0
                      ? (summary.toReimburse > 0
                          ? `${t('Reimburse chef from box:')} ${taka(summary.toReimburse)}`
                          : t('Already settled — nothing more to pay'))
                      : summary.bazarVariance < 0
                      ? `${t('Chef returns:')} ${taka(Math.abs(summary.bazarVariance))}`
                      : t('Exact — no variance')}
                  </span>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="card">
                <div className="card-title">{t('Set aside for tomorrow')}</div>
                <div className="field">
                  <label>{t('Bazar advance to give chef now (৳)')}</label>
                  <NumberInput value={nextBazarAdvance} min={0} onValueChange={(n) => setNextBazarAdvance(n ?? '')} autoFocus />
                </div>
                <div className="field">
                  <label>{t('Bhangti to keep in the box (৳)')}</label>
                  {mode === 'denom' ? (
                    <>
                      <div className="denom-grid">
                        {STANDARD_DENOMINATIONS.map((d) => {
                          const marked = bhangtiMarkedFor(d);
                          const qty = bhangtiQtyFor(d);
                          return (
                            <div key={d} className={`denom-cell${marked ? '' : ' off'}`}>
                              <button
                                type="button"
                                className="denom-mark"
                                aria-pressed={marked}
                                onClick={() => toggleBhangtiMark(d)}
                              >
                                {marked ? '✓' : ''}
                              </button>
                              <span className="denom-note">{'৳'}{digits(String(d))}</span>
                              <NumberInput value={qty} min={0} disabled={!marked} onValueChange={(n) => setBhangtiQty(d, n)} />
                              <span className="denom-sub">= {taka(marked ? d * qty : 0)}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="step-result"><span>{t('Total')}</span><strong>{taka(nextBhangtiFromDenoms)}</strong></div>
                    </>
                  ) : (
                    <NumberInput value={nextBhangti} min={0} onValueChange={(n) => setNextBhangti(n ?? '')} />
                  )}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="card">
                <div className="card-title">{t('Review & save')}</div>
                <div className="step-calc">
                  <div className="calc-row"><span>{t('Total counted')}</span><span>{taka(totalCounted)}</span></div>
                  <div className="calc-row"><span>{t('Total sales')}</span><span className="g">{taka(summary.totalSales)}</span></div>
                  {summary.toReimburse > 0 && (
                    <div className="calc-row"><span>{t('Reimbursed to chef (from box)')}</span><span>{'−'}{taka(summary.toReimburse)}</span></div>
                  )}
                  <div className="calc-row"><span>{t("Tomorrow's bazar")}</span><span>{'−'}{taka(Number(nextBazarAdvance) || 0)}</span></div>
                  <div className="calc-row"><span>{t("Tomorrow's bhangti")}</span><span>{'−'}{taka(effectiveNextBhangti)}</span></div>
                  <div className={`calc-row result ${summary.isShort ? 'short' : ''}`}>
                    <span>{t('Cash taken home')}</span>
                    <span className={summary.cashTakenHome >= 0 ? 'g' : 'r'}>{taka(summary.cashTakenHome)}</span>
                  </div>
                </div>
                {summary.isShort && (
                  <div className="insight red" style={{ marginTop: 10 }}>
                    <b>{t('Box is short.')}</b> {t("Not enough to cover tomorrow's advance and bhangti.")}
                  </div>
                )}
                <div className="field" style={{ marginTop: 12 }}>
                  <label>{t("Who's closing today?")}</label>
                  <div className="chip-select">
                    {HISHAB_CLOSERS.map((name) => (
                      <button
                        key={name}
                        type="button"
                        className={closedBy.includes(name) ? 'on' : ''}
                        onClick={() => setClosedBy((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name])}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label>{t('Notes (optional)')}</label>
                  <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('Anything to remember')} />
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
                <button className="btn secondary" onClick={() => { setEditing(false); setIsOffDay(hadExistingEntry ? !!existingEntry?.is_off_day : false); }}>{t('Cancel')}</button>
                <button className="btn" style={{ background: 'var(--green)' }} onClick={() => setShowConfirm(true)} disabled={saving}>
                  {saving ? t('Saving…') : t('✓ Mark off day')}
                </button>
              </>
            ) : (
              <>
                <button className="btn secondary" onClick={() => step === 0 ? setEditing(false) : setStep(Math.max(0, step - 1))}>
                  {step === 0 ? t('✕ Cancel') : t('← Back')}
                </button>
                <span className="step-counter">{num(step + 1)} / {num(TOTAL_STEPS)}</span>
                {step < TOTAL_STEPS - 1 ? (
                  <button className="btn" onClick={() => setStep(step + 1)}>{t('Next →')}</button>
                ) : (
                  <button className="btn" style={{ background: 'var(--green)' }} onClick={() => setShowConfirm(true)} disabled={saving}>
                    {saving ? t('Saving…') : hadExistingEntry ? t('✓ Update') : t('✓ Save')}
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
              <h3>{isOffDay ? t('Mark as off day?') : hadExistingEntry ? t('Update this entry?') : t('Save this entry?')}</h3>
              <p>
                {isOffDay
                  ? dateDisplay(date)
                  : hadExistingEntry
                  ? <>{t('Previous version will be kept in the audit log.')} — {dateDisplay(date)}</>
                  : dateDisplay(date)
                }
              </p>
              {!isOffDay && (
                <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text2)' }}>{t('Total sales')}</span>
                    <strong style={{ color: 'var(--green)', fontFamily: 'var(--mono)' }}>{taka(summary.totalSales)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text2)' }}>{t('Cash taken home')}</span>
                    <strong style={{ color: summary.cashTakenHome >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--mono)' }}>{taka(summary.cashTakenHome)}</strong>
                  </div>
                </div>
              )}
              <div className="modal-actions">
                <button className="btn secondary" onClick={() => setShowConfirm(false)}>{t('Cancel')}</button>
                <button className="btn" style={{ background: 'var(--green)' }} onClick={() => { setShowConfirm(false); handleSave(); }} disabled={saving}>
                  {isOffDay ? t('Yes, mark off') : hadExistingEntry ? t('Yes, update') : t('Yes, save')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
