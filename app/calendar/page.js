'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import AppShell from '../AppShell';
import { useLang } from '../LangProvider';
import { todayStr, shiftDateStr, toDateStr } from '@/lib/dates';
import { cachedFetchJson, invalidateCache } from '@/lib/clientCache';

const MIN_DATE = '2026-08-01';
const MAX_DATE = shiftDateStr(todayStr(), 14);
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const HISHAB_CLOSERS = [
  'Ashraful', 'Shagor', 'Shaibal', 'Sadman', 'Arman (Josh)', 'Arman Mahmud',
  'Himel', 'Hridoy', 'Zamil', 'Ezaz', 'Shakil', 'Limon', 'Nazmul Rabbi',
  'Supto', 'Chef (Sujit)',
];

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }

export default function CalendarPage() {
  const { t, num, digits, dateNice } = useLang();
  const [viewYear, setViewYear] = useState(() => Number(todayStr().slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => Number(todayStr().slice(5, 7)) - 1);
  const [entries, setEntries] = useState({}); // date -> entry row
  const [tasksByDate, setTasksByDate] = useState({}); // date -> [tasks]
  const [roster, setRoster] = useState(null); // [{day_of_week, people}]
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showRoster, setShowRoster] = useState(false);
  const [rosterDraft, setRosterDraft] = useState(null);
  const [savingRoster, setSavingRoster] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  const monthStart = ymd(viewYear, viewMonth, 1);
  const monthEnd = ymd(viewYear, viewMonth, new Date(viewYear, viewMonth + 1, 0).getDate());
  const fetchFrom = monthStart < MIN_DATE ? MIN_DATE : monthStart;
  const fetchTo = monthEnd > MAX_DATE ? MAX_DATE : monthEnd;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [entriesData, tasksData, rosterData] = await Promise.all([
        cachedFetchJson(`/api/entries?from=${fetchFrom}&to=${fetchTo}`),
        cachedFetchJson(`/api/tasks?from=${fetchFrom}&to=${fetchTo}`),
        cachedFetchJson('/api/roster'),
      ]);
      const eMap = {};
      // entry_date/due_date come back as full ISO timestamps (the API
      // doesn't cast to text) — toDateStr on the raw STRING would naively
      // slice it, which is wrong (pg parses DATE as server-local midnight,
      // so the UTC-serialized string can land on the previous calendar
      // day). Passing a real Date object instead makes toDateStr resolve it
      // via the browser's local getters, which is the correct/documented
      // approach already used elsewhere in this app (see lib/dates.js).
      for (const e of entriesData.entries || []) eMap[toDateStr(new Date(e.entry_date))] = e;
      setEntries(eMap);
      const tMap = {};
      for (const task of tasksData.tasks || []) {
        if (!task.due_date) continue;
        const d = toDateStr(new Date(task.due_date));
        (tMap[d] = tMap[d] || []).push(task);
      }
      setTasksByDate(tMap);
      setRoster(rosterData.roster || []);
    } catch {
      // leave whatever was previously loaded
    } finally {
      setLoading(false);
    }
  }, [fetchFrom, fetchTo]);

  useEffect(() => { load(); }, [load]);

  const rosterFor = (dow) => roster?.find((r) => r.day_of_week === dow)?.people || [];

  const minY = Number(MIN_DATE.slice(0, 4)), minM = Number(MIN_DATE.slice(5, 7)) - 1;
  const maxY = Number(MAX_DATE.slice(0, 4)), maxM = Number(MAX_DATE.slice(5, 7)) - 1;
  const canGoPrev = viewYear > minY || (viewYear === minY && viewMonth > minM);
  const canGoNext = viewYear < maxY || (viewYear === maxY && viewMonth < maxM);

  function prevMonth() {
    if (!canGoPrev) return;
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); } else setViewMonth((m) => m - 1);
    setSelectedDate(null);
  }
  function nextMonth() {
    if (!canGoNext) return;
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); } else setViewMonth((m) => m + 1);
    setSelectedDate(null);
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

  function openRosterEditor() {
    setRosterDraft((roster || []).map((r) => ({ ...r, people: [...r.people] })));
    setShowRoster(true);
  }

  function toggleRosterPerson(dow, name) {
    setRosterDraft((prev) => prev.map((r) => {
      if (r.day_of_week !== dow) return r;
      const has = r.people.includes(name);
      return { ...r, people: has ? r.people.filter((n) => n !== name) : [...r.people, name] };
    }));
  }

  async function saveRoster() {
    setSavingRoster(true);
    try {
      await Promise.all(rosterDraft.map((r) =>
        fetch('/api/roster', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dayOfWeek: r.day_of_week, people: r.people }),
        })
      ));
      invalidateCache('/api/roster');
      setShowRoster(false);
      load();
    } finally {
      setSavingRoster(false);
    }
  }

  async function addQuickTask() {
    const title = quickTaskTitle.trim();
    if (!title || !selectedDate) return;
    setAddingTask(true);
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, dueDate: selectedDate }),
      });
      setQuickTaskTitle('');
      invalidateCache(`/api/tasks?from=${fetchFrom}&to=${fetchTo}`);
      load();
    } finally {
      setAddingTask(false);
    }
  }

  async function toggleTaskDone(task) {
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: task.status === 'done' ? 'pending' : 'done' }),
    });
    invalidateCache(`/api/tasks?from=${fetchFrom}&to=${fetchTo}`);
    load();
  }

  const selected = selectedDate ? {
    date: selectedDate,
    dow: new Date(selectedDate + 'T12:00:00').getDay(),
    entry: entries[selectedDate],
    tasks: tasksByDate[selectedDate] || [],
  } : null;

  return (
    <AppShell>
      <div className="card">
        <div className="date-calendar-header">
          <button type="button" onClick={prevMonth} disabled={!canGoPrev} aria-label="Previous month">‹</button>
          <span>{monthLabel}</span>
          <button type="button" onClick={nextMonth} disabled={!canGoNext} aria-label="Next month">›</button>
        </div>
        <div className="date-calendar-weekdays">
          {WEEKDAY_SHORT.map((w, i) => <span key={i}>{w}</span>)}
        </div>
        <div className="date-calendar-grid">
          {weeks.map((row, ri) => (
            <div key={ri} className="date-calendar-row">
              {row.map((day, di) => {
                if (day == null) return <span key={di} className="date-calendar-cell empty" />;
                const ds = ymd(viewYear, viewMonth, day);
                const disabled = ds < MIN_DATE || ds > MAX_DATE;
                const entry = entries[ds];
                const dow = new Date(viewYear, viewMonth, day).getDay();
                const rosterNames = rosterFor(dow);
                const dayTasks = tasksByDate[ds] || [];
                let cls = 'cal-cell';
                if (disabled) cls += ' disabled';
                else if (entry?.is_off_day) cls += ' cal-off';
                else if (entry) cls += ' cal-has-entry';
                if (ds === todayStr()) cls += ' cal-today';
                if (ds === selectedDate) cls += ' cal-selected';
                return (
                  <button key={di} type="button" className={cls} disabled={disabled} onClick={() => setSelectedDate(ds)}>
                    <span className="cal-daynum">{digits(String(day))}</span>
                    {entry?.is_off_day ? (
                      <span className="cal-tag cal-tag-off">{t('OFF')}</span>
                    ) : entry ? (
                      <span className="cal-tag cal-tag-actual">
                        {(entry.closed_by || []).slice(0, 2).join(', ') || t('closed')}
                      </span>
                    ) : rosterNames.length > 0 ? (
                      <span className="cal-tag cal-tag-roster">{rosterNames.slice(0, 2).join(', ')}</span>
                    ) : null}
                    {dayTasks.length > 0 && <span className="cal-task-dot" title={`${dayTasks.length} task(s)`} />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="cal-legend">
          <span><i className="date-calendar-dot cal-tag-actual" />{t('Actual closer (saved entry)')}</span>
          <span><i className="date-calendar-dot cal-tag-roster" />{t('Roster default')}</span>
          <span><i className="date-calendar-dot cal-tag-off" />{t('Off day')}</span>
        </div>
        <button type="button" className="btn secondary block" style={{ marginTop: 12 }} onClick={openRosterEditor}>
          {t('Manage weekly roster')}
        </button>
      </div>

      {selected && (
        <div className="card">
          <div className="card-title">{dateNice(selected.date)} — {t(WEEKDAY_NAMES[selected.dow])}</div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>{t('Roster default for this weekday')}</div>
            {rosterFor(selected.dow).length ? (
              <div className="chip-select" style={{ marginBottom: 0 }}>
                {rosterFor(selected.dow).map((n) => <span key={n} className="chip-select-static">{n}</span>)}
              </div>
            ) : <p style={{ fontSize: 13, color: 'var(--text3)' }}>{t('No default team set for this weekday yet.')}</p>}
          </div>

          {selected.entry ? (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>{t('Actual entry')}</div>
              {selected.entry.is_off_day ? (
                <p style={{ fontSize: 13 }}>{t('Shop was closed.')} {selected.entry.notes}</p>
              ) : (
                <p style={{ fontSize: 13 }}>{t('Closed by')}: {(selected.entry.closed_by || []).join(', ') || t('not recorded')}</p>
              )}
              <a className="btn secondary btn-small" href={`/entry?date=${selected.date}`}>{t('View / edit this day →')}</a>
            </div>
          ) : selected.date <= todayStr() ? (
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 13, color: 'var(--text3)' }}>{t('No saved entry for this day yet.')}</p>
              <a className="btn secondary btn-small" href={`/entry?date=${selected.date}`}>{t('Start entry →')}</a>
            </div>
          ) : null}

          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>{t('Tasks due this day')}</div>
            {selected.tasks.length === 0 && <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 8 }}>{t('None yet.')}</p>}
            {selected.tasks.map((task) => (
              <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <input type="checkbox" checked={task.status === 'done'} onChange={() => toggleTaskDone(task)} />
                <span style={{ flex: 1, fontSize: 13, textDecoration: task.status === 'done' ? 'line-through' : 'none', color: task.status === 'cancelled' ? 'var(--text3)' : 'var(--text)' }}>
                  {task.title}{task.assigned_to ? ` — ${task.assigned_to}` : ''}
                </span>
              </div>
            ))}
            <div className="bazar-custom-add" style={{ marginTop: 10, marginBottom: 0 }}>
              <input type="text" value={quickTaskTitle} onChange={(e) => setQuickTaskTitle(e.target.value)} placeholder={t('Add a task for this day...')} />
              <button type="button" className="btn secondary" onClick={addQuickTask} disabled={addingTask || !quickTaskTitle.trim()}>{t('Add')}</button>
            </div>
            <a className="btn secondary btn-small" href="/tasks" style={{ marginTop: 10, display: 'inline-block' }}>{t('Manage all tasks →')}</a>
          </div>
        </div>
      )}

      {showRoster && (
        <div className="modal-overlay" onClick={() => setShowRoster(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h3>{t('Weekly closing roster')}</h3>
            <p style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 14 }}>
              {t("Who's normally on for each day of the week — the calendar shows this as a default until a real entry is saved for that date.")}
            </p>
            <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
              {rosterDraft && WEEKDAY_NAMES.map((name, dow) => {
                const row = rosterDraft.find((r) => r.day_of_week === dow);
                return (
                  <div key={dow} style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>{t(name)}</label>
                    <div className="chip-select" style={{ marginBottom: 0 }}>
                      {HISHAB_CLOSERS.map((n) => (
                        <button
                          key={n} type="button"
                          className={row?.people.includes(n) ? 'on' : ''}
                          onClick={() => toggleRosterPerson(dow, n)}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setShowRoster(false)}>{t('Cancel')}</button>
              <button className="btn" style={{ background: 'var(--green)' }} onClick={saveRoster} disabled={savingRoster}>
                {savingRoster ? t('Saving…') : t('Save roster')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
