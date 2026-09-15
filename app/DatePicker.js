'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLang } from './LangProvider';
import { todayStr, shiftDateStr } from '@/lib/dates';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(year, month, day) { return `${year}-${pad(month + 1)}-${pad(day)}`; }

// A calendar popup replacing the native <input type="date"> — shows each
// day color-coded by whether it's a recorded on-day or off-day (fetched
// from /api/entries for whatever month is in view), and constrains
// selection to [minDate, tomorrow].
export default function DatePicker({ value, onChange, minDate = '2026-08-01' }) {
  const { t, digits, dateDisplay } = useLang();
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => Number(value.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => Number(value.slice(5, 7)) - 1); // 0-indexed
  const [monthEntries, setMonthEntries] = useState({}); // dateStr -> isOffDay

  const maxDate = shiftDateStr(todayStr(), 1);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const first = ymd(viewYear, viewMonth, 1);
    const last = ymd(viewYear, viewMonth, new Date(viewYear, viewMonth + 1, 0).getDate());
    fetch(`/api/entries?from=${first}&to=${last}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const map = {};
        for (const e of data.entries || []) {
          map[String(e.entry_date).slice(0, 10)] = !!e.is_off_day;
        }
        setMonthEntries(map);
      })
      .catch(() => { if (!cancelled) setMonthEntries({}); });
    return () => { cancelled = true; };
  }, [open, viewYear, viewMonth]);

  function openPicker() {
    setViewYear(Number(value.slice(0, 4)));
    setViewMonth(Number(value.slice(5, 7)) - 1);
    setOpen(true);
  }

  const minY = Number(minDate.slice(0, 4)), minM = Number(minDate.slice(5, 7)) - 1;
  const maxY = Number(maxDate.slice(0, 4)), maxM = Number(maxDate.slice(5, 7)) - 1;
  const canGoPrev = viewYear > minY || (viewYear === minY && viewMonth > minM);
  const canGoNext = viewYear < maxY || (viewYear === maxY && viewMonth < maxM);

  function prevMonth() {
    if (!canGoPrev) return;
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); } else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (!canGoNext) return;
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); } else setViewMonth((m) => m + 1);
  }

  const monthLabel = digits(new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));

  const weeks = useMemo(() => {
    const startOffset = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [viewYear, viewMonth]);

  function selectDay(day) {
    const ds = ymd(viewYear, viewMonth, day);
    if (ds < minDate || ds > maxDate) return;
    onChange(ds);
    setOpen(false);
  }

  return (
    <>
      <button type="button" className="date-picker-btn" onClick={openPicker}>
        <span className="cal-icon">📅</span>
        <span>{dateDisplay(value)}</span>
      </button>
      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-card date-calendar-modal" onClick={(e) => e.stopPropagation()}>
            <div className="date-calendar-header">
              <button type="button" onClick={prevMonth} disabled={!canGoPrev} aria-label="Previous month">‹</button>
              <span>{monthLabel}</span>
              <button type="button" onClick={nextMonth} disabled={!canGoNext} aria-label="Next month">›</button>
            </div>
            <div className="date-calendar-weekdays">
              {WEEKDAY_LABELS.map((w, i) => <span key={i}>{w}</span>)}
            </div>
            <div className="date-calendar-grid">
              {weeks.map((row, ri) => (
                <div key={ri} className="date-calendar-row">
                  {row.map((day, di) => {
                    if (day == null) return <span key={di} className="date-calendar-cell empty" />;
                    const ds = ymd(viewYear, viewMonth, day);
                    const disabled = ds < minDate || ds > maxDate;
                    const hasEntry = Object.prototype.hasOwnProperty.call(monthEntries, ds);
                    const isOff = monthEntries[ds];
                    let cls = 'date-calendar-cell';
                    if (disabled) cls += ' disabled';
                    else if (hasEntry) cls += isOff ? ' off-day' : ' on-day';
                    if (ds === value) cls += ' selected';
                    if (ds === todayStr()) cls += ' today';
                    return (
                      <button key={di} type="button" className={cls} disabled={disabled} onClick={() => selectDay(day)}>
                        {digits(String(day))}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="date-calendar-legend">
              <span><i className="date-calendar-dot on-day" />{t('On day')}</span>
              <span><i className="date-calendar-dot off-day" />{t('Off day')}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
