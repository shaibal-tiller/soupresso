'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import AppShell from '../AppShell';
import { useLang } from '../LangProvider';
import DatePicker from '../DatePicker';
import { todayStr, shiftDateStr, toDateStr, startOfWeekStr } from '@/lib/dates';
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

const TASK_FILTERS = [
  { key: 'pending', label: 'Pending' },
  { key: 'all', label: 'All' },
  { key: 'done', label: 'Done' },
  { key: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLORS = { pending: 'var(--amber)', done: 'var(--green)', cancelled: 'var(--text3)' };

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function emptyTaskForm() { return { title: '', description: '', assignees: [], dueDate: '', useDueDate: false }; }

export default function CalendarPage() {
  const { t, digits, dateNice } = useLang();
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week' | 'day'
  const [viewYear, setViewYear] = useState(() => Number(todayStr().slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => Number(todayStr().slice(5, 7)) - 1);
  const [entries, setEntries] = useState({}); // date -> entry row
  const [tasksByDate, setTasksByDate] = useState({}); // date -> [tasks]
  const [roster, setRoster] = useState(null); // [{day_of_week, people}]
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => todayStr());
  const [showRoster, setShowRoster] = useState(false);
  const [rosterDraft, setRosterDraft] = useState(null);
  const [savingRoster, setSavingRoster] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  // Task detail/expand state — shared between the day panel's task list and
  // the all-tasks list below, so only one task is expanded at a time.
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [commentsByTask, setCommentsByTask] = useState({});
  const [commentDraft, setCommentDraft] = useState('');
  const [pendingAction, setPendingAction] = useState(null); // { taskId, status }
  const [savingTask, setSavingTask] = useState(false);
  const [removeConfirmId, setRemoveConfirmId] = useState(null);
  const [rescheduleTaskId, setRescheduleTaskId] = useState(null);
  const [assignEditor, setAssignEditor] = useState(null); // { taskId, draft: [names] }
  const [addingNoteOpen, setAddingNoteOpen] = useState(false);

  // All-tasks list (status-filtered, not bound to the visible month).
  const [taskFilter, setTaskFilter] = useState('pending');
  const [allTasks, setAllTasks] = useState([]);
  const [allTasksLoading, setAllTasksLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskForm, setTaskForm] = useState(emptyTaskForm());

  const monthStart = ymd(viewYear, viewMonth, 1);
  const monthEnd = ymd(viewYear, viewMonth, new Date(viewYear, viewMonth + 1, 0).getDate());
  const fetchFrom = monthStart < MIN_DATE ? MIN_DATE : monthStart;
  const fetchTo = monthEnd > MAX_DATE ? MAX_DATE : monthEnd;
  const tasksRangeUrl = `/api/tasks?from=${fetchFrom}&to=${fetchTo}`;
  const tasksFilterUrl = taskFilter === 'all' ? '/api/tasks' : `/api/tasks?status=${taskFilter}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [entriesData, tasksData, rosterData] = await Promise.all([
        cachedFetchJson(`/api/entries?from=${fetchFrom}&to=${fetchTo}`),
        cachedFetchJson(tasksRangeUrl),
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
  }, [fetchFrom, fetchTo, tasksRangeUrl]);

  useEffect(() => { load(); }, [load]);

  const loadAllTasks = useCallback(async () => {
    setAllTasksLoading(true);
    try {
      const data = await cachedFetchJson(tasksFilterUrl);
      setAllTasks(data.tasks || []);
    } finally {
      setAllTasksLoading(false);
    }
  }, [tasksFilterUrl]);

  useEffect(() => { loadAllTasks(); }, [loadAllTasks]);

  function invalidateAllTaskCaches(taskId) {
    invalidateCache(tasksRangeUrl);
    for (const f of TASK_FILTERS) invalidateCache(f.key === 'all' ? '/api/tasks' : `/api/tasks?status=${f.key}`);
    if (taskId) invalidateCache(`/api/tasks/${taskId}`);
  }

  async function refreshAfterTaskChange(taskId) {
    invalidateAllTaskCaches(taskId);
    await Promise.all([load(), loadAllTasks()]);
    if (taskId) await loadComments(taskId);
  }

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

  // Week/day nav shifts the selected date itself (instead of clearing it,
  // like month nav does) and keeps viewYear/viewMonth in sync so switching
  // back to Month view lands on the right page.
  const periodAnchor = selectedDate || todayStr();
  function jumpTo(ds) {
    setSelectedDate(ds);
    setViewYear(Number(ds.slice(0, 4)));
    setViewMonth(Number(ds.slice(5, 7)) - 1);
  }
  const periodStep = viewMode === 'week' ? 7 : 1;
  const canGoPrevPeriod = shiftDateStr(periodAnchor, -periodStep) >= MIN_DATE;
  const canGoNextPeriod = shiftDateStr(periodAnchor, periodStep) <= MAX_DATE;
  function prevPeriod() {
    if (viewMode === 'month') return prevMonth();
    if (!canGoPrevPeriod) return;
    jumpTo(shiftDateStr(periodAnchor, -periodStep));
  }
  function nextPeriod() {
    if (viewMode === 'month') return nextMonth();
    if (!canGoNextPeriod) return;
    jumpTo(shiftDateStr(periodAnchor, periodStep));
  }

  const monthLabel = digits(new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
  const weekStart = startOfWeekStr(periodAnchor);
  const weekEnd = shiftDateStr(weekStart, 6);
  const weekLabel = `${digits(new Date(weekStart + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))} – ${digits(new Date(weekEnd + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))}`;
  const dayLabel = `${t(WEEKDAY_NAMES[new Date(periodAnchor + 'T12:00:00').getDay()])}, ${dateNice(periodAnchor)}`;
  const periodLabel = viewMode === 'month' ? monthLabel : viewMode === 'week' ? weekLabel : dayLabel;

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
      await refreshAfterTaskChange();
    } finally {
      setAddingTask(false);
    }
  }

  async function handleAddTask(e) {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    setSavingTask(true);
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskForm.title.trim(),
          description: taskForm.description.trim() || null,
          assignees: taskForm.assignees,
          dueDate: taskForm.useDueDate && taskForm.dueDate ? taskForm.dueDate : null,
        }),
      });
      setTaskForm(emptyTaskForm());
      setShowAddTask(false);
      await refreshAfterTaskChange();
    } finally {
      setSavingTask(false);
    }
  }

  async function loadComments(taskId) {
    const data = await cachedFetchJson(`/api/tasks/${taskId}`);
    setCommentsByTask((prev) => ({ ...prev, [taskId]: data.comments || [] }));
  }

  function toggleExpand(taskId) {
    setExpandedTaskId((id) => (id === taskId ? null : taskId));
    setPendingAction(null);
    setCommentDraft('');
    if (expandedTaskId !== taskId && !commentsByTask[taskId]) loadComments(taskId);
  }

  function startStatusChange(taskId, status) {
    setPendingAction({ taskId, status });
    setCommentDraft('');
  }

  async function confirmStatusChange() {
    if (!pendingAction) return;
    const { taskId, status } = pendingAction;
    setSavingTask(true);
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, comment: commentDraft.trim() || undefined }),
      });
      setPendingAction(null);
      setCommentDraft('');
      await refreshAfterTaskChange(taskId);
    } finally {
      setSavingTask(false);
    }
  }

  async function toggleTaskDone(task) {
    setSavingTask(true);
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: task.status === 'done' ? 'pending' : 'done' }),
      });
      await refreshAfterTaskChange(task.id);
    } finally {
      setSavingTask(false);
    }
  }

  async function addPlainComment(taskId) {
    if (!commentDraft.trim()) return;
    setSavingTask(true);
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: commentDraft.trim() }),
      });
      setCommentDraft('');
      await refreshAfterTaskChange(taskId);
    } finally {
      setSavingTask(false);
    }
  }

  async function removeTask(taskId) {
    setSavingTask(true);
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      setRemoveConfirmId(null);
      if (expandedTaskId === taskId) setExpandedTaskId(null);
      invalidateAllTaskCaches(taskId);
      await Promise.all([load(), loadAllTasks()]);
    } finally {
      setSavingTask(false);
    }
  }

  async function rescheduleTask(taskId, newDate) {
    setSavingTask(true);
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate: newDate }),
      });
      setRescheduleTaskId(null);
      await refreshAfterTaskChange(taskId);
    } finally {
      setSavingTask(false);
    }
  }

  function openAssignEditor(task) {
    setAssignEditor({ taskId: task.id, draft: [...(task.assignees || [])] });
  }

  function toggleAssignDraft(name) {
    setAssignEditor((prev) => {
      if (!prev) return prev;
      const has = prev.draft.includes(name);
      return { ...prev, draft: has ? prev.draft.filter((n) => n !== name) : [...prev.draft, name] };
    });
  }

  async function saveAssignEditor() {
    if (!assignEditor) return;
    setSavingTask(true);
    try {
      await fetch(`/api/tasks/${assignEditor.taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignees: assignEditor.draft }),
      });
      const taskId = assignEditor.taskId;
      setAssignEditor(null);
      await refreshAfterTaskChange(taskId);
    } finally {
      setSavingTask(false);
    }
  }

  const selected = selectedDate ? {
    date: selectedDate,
    dow: new Date(selectedDate + 'T12:00:00').getDay(),
    entry: entries[selectedDate],
    tasks: tasksByDate[selectedDate] || [],
  } : null;

  // Shared row renderer: a task's summary line, and — when expanded — its
  // description, status controls and full comment history. Used both by the
  // selected day's "Tasks due this day" list and the all-tasks list below.
  function renderTaskItem(task) {
    const expanded = expandedTaskId === task.id;
    return (
      <div key={task.id} style={{ borderBottom: '1px solid var(--border)' }}>
        <div
          onClick={() => toggleExpand(task.id)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', cursor: 'pointer' }}
        >
          <input
            type="checkbox"
            checked={task.status === 'done'}
            onChange={(e) => { e.stopPropagation(); toggleTaskDone(task); }}
            onClick={(e) => e.stopPropagation()}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 13, textDecoration: task.status === 'done' ? 'line-through' : 'none', color: task.status === 'cancelled' ? 'var(--text3)' : 'var(--text)' }}>
              {task.title}
            </span>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
              {task.assignees?.length > 0 && <span>{task.assignees.join(', ')}</span>}
              {task.due_date && <span>{task.assignees?.length ? ' · ' : ''}{dateNice(toDateStr(new Date(task.due_date)))}</span>}
            </div>
          </div>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: STATUS_COLORS[task.status], textTransform: 'uppercase', flexShrink: 0 }}>
            {t(task.status)}
          </span>
        </div>

        {expanded && (
          <div style={{ paddingBottom: 12 }} onClick={(e) => e.stopPropagation()}>
            {task.description && <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>{task.description}</p>}

            <div className="btn-row" style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              {task.status !== 'pending' && (
                <button className="btn secondary btn-small" onClick={() => startStatusChange(task.id, 'pending')}>{t('Reopen')}</button>
              )}
              {task.status !== 'done' && (
                <button className="btn btn-small" style={{ background: 'var(--green)' }} onClick={() => startStatusChange(task.id, 'done')}>{t('✓ Mark done')}</button>
              )}
              {task.status !== 'cancelled' && (
                <button className="btn secondary btn-small" onClick={() => startStatusChange(task.id, 'cancelled')}>{t('✕ Cancel')}</button>
              )}
            </div>

            {pendingAction?.taskId === task.id && (
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  {t('Optional comment for this change')}
                </label>
                <input type="text" value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} placeholder={t('e.g. reason, notes...')} style={{ marginBottom: 8 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn secondary btn-small" onClick={() => setPendingAction(null)}>{t('Cancel')}</button>
                  <button className="btn btn-small" onClick={confirmStatusChange} disabled={savingTask}>{t('Confirm')}</button>
                </div>
              </div>
            )}

            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>{t('History')}</div>
            {(commentsByTask[task.id] || []).length === 0 ? (
              <p style={{ fontSize: 12.5, color: 'var(--text3)' }}>{t('No comments yet.')}</p>
            ) : (
              commentsByTask[task.id].map((c) => (
                <div key={c.id} style={{ fontSize: 12.5, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text)' }}>{c.comment}</span>
                  <div style={{ color: 'var(--text3)', fontSize: 10.5, marginTop: 2 }}>{dateNice(c.created_at)}</div>
                </div>
              ))
            )}
            {!pendingAction && (
              <div className="bazar-custom-add" style={{ marginTop: 10, marginBottom: 0 }}>
                <input type="text" value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} placeholder={t('Add a comment...')} />
                <button type="button" className="btn secondary" onClick={() => addPlainComment(task.id)} disabled={savingTask || !commentDraft.trim()}>{t('Add')}</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Compact "sticky note" card for a single day's tasks — quick actions
  // (done/reschedule/assign/remove) live on the card face; tapping the
  // title expands it in place for the description + full comment history
  // (shares state/handlers with renderTaskItem's expand behavior above).
  function renderStickyNote(task) {
    const expanded = expandedTaskId === task.id;
    const confirmingRemove = removeConfirmId === task.id;
    const reschedule = rescheduleTaskId === task.id;
    const assignees = task.assignees || [];
    const cls = `sticky-note${task.status === 'done' ? ' done' : ''}${task.status === 'cancelled' ? ' cancelled' : ''}${expanded ? ' open' : ''}`;

    if (confirmingRemove) {
      return (
        <div key={task.id} className={cls}>
          <div className="sticky-note-confirm">
            <span>{t('Remove this task?')}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="btn btn-small" style={{ background: 'var(--red)' }} onClick={() => removeTask(task.id)} disabled={savingTask}>{t('Remove')}</button>
              <button type="button" className="btn secondary btn-small" onClick={() => setRemoveConfirmId(null)}>{t('Cancel')}</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={task.id} className={cls}>
        <span className="sticky-note-pin" />
        <button type="button" className="sticky-note-remove" onClick={() => setRemoveConfirmId(task.id)} aria-label={t('Remove')}>✕</button>

        <div className="sticky-note-title" onClick={() => toggleExpand(task.id)}>{task.title}</div>
        <div className="sticky-note-meta">
          <span>{assignees.length ? assignees.join(', ') : t('Unassigned')}</span>
          {task.due_date && <span>📅 {dateNice(toDateStr(new Date(task.due_date)))}</span>}
        </div>

        {expanded && (
          <div className="sticky-note-body" onClick={(e) => e.stopPropagation()}>
            {task.description && <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0 }}>{task.description}</p>}

            {reschedule && (
              <input
                type="date"
                defaultValue={task.due_date ? toDateStr(new Date(task.due_date)) : ''}
                autoFocus
                onChange={(e) => { if (e.target.value) rescheduleTask(task.id, e.target.value); }}
                onBlur={() => setRescheduleTaskId(null)}
              />
            )}

            {pendingAction?.taskId === task.id && (
              <div style={{ background: 'rgba(255,255,255,.5)', borderRadius: 8, padding: 8 }}>
                <input type="text" value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} placeholder={t('Optional comment for this change')} style={{ marginBottom: 6, fontSize: 12 }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="btn secondary btn-small" onClick={() => setPendingAction(null)}>{t('Cancel')}</button>
                  <button type="button" className="btn btn-small" onClick={confirmStatusChange} disabled={savingTask}>{t('Confirm')}</button>
                </div>
              </div>
            )}

            <div style={{ fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase' }}>{t('History')}</div>
            {(commentsByTask[task.id] || []).length === 0 ? (
              <p style={{ fontSize: 11.5, color: 'var(--text3)', margin: 0 }}>{t('No comments yet.')}</p>
            ) : (
              commentsByTask[task.id].map((c) => (
                <div key={c.id} style={{ fontSize: 11.5, borderBottom: '1px solid rgba(43,33,24,.12)', paddingBottom: 4 }}>
                  <div>{c.comment}</div>
                  <div style={{ color: 'var(--text3)', fontSize: 10 }}>{dateNice(c.created_at)}</div>
                </div>
              ))
            )}
            <div className="bazar-custom-add" style={{ marginTop: 0, marginBottom: 0 }}>
              <input type="text" value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} placeholder={t('Add a comment...')} />
              <button type="button" className="btn secondary btn-small" onClick={() => addPlainComment(task.id)} disabled={savingTask || !commentDraft.trim()}>{t('Add')}</button>
            </div>
          </div>
        )}

        <div className="sticky-note-actions">
          <label className="sticky-note-check">
            <input type="checkbox" checked={task.status === 'done'} onChange={() => toggleTaskDone(task)} />
            {t('Done')}
          </label>
          <button type="button" onClick={() => setRescheduleTaskId(reschedule ? null : task.id)}>📅 {t('Reschedule')}</button>
          <button type="button" onClick={() => openAssignEditor(task)}>👤 {t('Assign')}</button>
          {task.status !== 'cancelled' && task.status !== 'done' && (
            <button type="button" onClick={() => startStatusChange(task.id, 'cancelled')}>✕ {t('Cancel task')}</button>
          )}
        </div>
      </div>
    );
  }

  function renderDayCell(ds, dayNum, key) {
    const disabled = ds < MIN_DATE || ds > MAX_DATE;
    const entry = entries[ds];
    const dow = new Date(ds + 'T12:00:00').getDay();
    const rosterNames = rosterFor(dow);
    const dayTasks = tasksByDate[ds] || [];
    let cls = 'cal-cell';
    if (disabled) cls += ' disabled';
    else if (entry?.is_off_day) cls += ' cal-off';
    else if (entry) cls += ' cal-has-entry';
    if (ds === todayStr()) cls += ' cal-today';
    if (ds === selectedDate) cls += ' cal-selected';
    return (
      <button key={key} type="button" className={cls} disabled={disabled} onClick={() => jumpTo(ds)}>
        <span className="cal-daynum">{digits(String(dayNum))}</span>
        {entry?.is_off_day ? (
          <span className="cal-tag cal-tag-off">{t('OFF')}</span>
        ) : entry ? (
          <span className="cal-tag cal-tag-actual">
            {(entry.closed_by || []).slice(0, 2).join(', ') || t('closed')}
          </span>
        ) : rosterNames.length > 0 ? (
          <span className="cal-tag cal-tag-roster">{rosterNames.slice(0, 2).join(', ')}</span>
        ) : null}
        {dayTasks.length > 0 && (
          <span className="cal-task-count" title={`${dayTasks.length} task(s)`}>{digits(String(dayTasks.length))}</span>
        )}
      </button>
    );
  }

  return (
    <AppShell>
      <div className="card">
        <div className="toggle-row" style={{ marginBottom: 10 }}>
          {[['month', 'Month'], ['week', 'Week'], ['day', 'Day']].map(([key, label]) => (
            <button key={key} type="button" className={viewMode === key ? 'on' : ''} onClick={() => setViewMode(key)}>
              {t(label)}
            </button>
          ))}
        </div>
        <div className="date-calendar-header">
          <button type="button" onClick={prevPeriod} disabled={viewMode === 'month' ? !canGoPrev : !canGoPrevPeriod} aria-label="Previous">‹</button>
          <span>{periodLabel}</span>
          <button type="button" onClick={nextPeriod} disabled={viewMode === 'month' ? !canGoNext : !canGoNextPeriod} aria-label="Next">›</button>
        </div>
        {viewMode !== 'day' && (
          <div className="date-calendar-weekdays">
            {WEEKDAY_SHORT.map((w, i) => <span key={i}>{w}</span>)}
          </div>
        )}
        <div className="date-calendar-grid">
          {viewMode === 'month' && weeks.map((row, ri) => (
            <div key={ri} className="date-calendar-row">
              {row.map((day, di) => {
                if (day == null) return <span key={di} className="date-calendar-cell empty" />;
                return renderDayCell(ymd(viewYear, viewMonth, day), day, di);
              })}
            </div>
          ))}
          {viewMode === 'week' && (
            <div className="date-calendar-row">
              {Array.from({ length: 7 }, (_, i) => {
                const ds = shiftDateStr(weekStart, i);
                return renderDayCell(ds, Number(ds.slice(8, 10)), i);
              })}
            </div>
          )}
          {viewMode === 'day' && (
            <div className="date-calendar-row date-calendar-row-day">
              {renderDayCell(periodAnchor, Number(periodAnchor.slice(8, 10)), 0)}
            </div>
          )}
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
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 8 }}>{t('Tasks due this day')}</div>
            <div className="sticky-notes">
              {selected.tasks.map(renderStickyNote)}
              <div className={`sticky-note sticky-note-add${addingNoteOpen ? ' open' : ''}`} onClick={() => !addingNoteOpen && setAddingNoteOpen(true)}>
                {addingNoteOpen ? (
                  <div onClick={(e) => e.stopPropagation()} className="sticky-note-add-form">
                    <input
                      type="text" autoFocus value={quickTaskTitle}
                      onChange={(e) => setQuickTaskTitle(e.target.value)}
                      placeholder={t('New task...')}
                      onKeyDown={(e) => { if (e.key === 'Enter') addQuickTask(); }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="btn btn-small" onClick={async () => { await addQuickTask(); setAddingNoteOpen(false); }} disabled={addingTask || !quickTaskTitle.trim()}>{t('Add')}</button>
                      <button type="button" className="btn secondary btn-small" onClick={() => { setAddingNoteOpen(false); setQuickTaskTitle(''); }}>{t('Cancel')}</button>
                    </div>
                  </div>
                ) : (
                  <span className="sticky-note-add-label">＋ {t('New task')}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">{t('All tasks')}</div>
        <div className="toggle-row">
          {TASK_FILTERS.map((f) => (
            <button key={f.key} className={taskFilter === f.key ? 'on' : ''} onClick={() => setTaskFilter(f.key)}>
              {t(f.label)}
            </button>
          ))}
        </div>

        <button className="btn block" onClick={() => setShowAddTask((v) => !v)} style={{ marginBottom: 16 }}>
          {showAddTask ? t('Cancel') : t('+ Add task')}
        </button>

        {showAddTask && (
          <form onSubmit={handleAddTask} style={{ marginBottom: 16 }}>
            <div className="field">
              <label>{t('Title')}</label>
              <input type="text" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder={t('e.g. Fix the burner')} required autoFocus />
            </div>
            <div className="field">
              <label>{t('Description (optional)')}</label>
              <input type="text" value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} placeholder={t('Details')} />
            </div>
            <div className="field">
              <label>{t('Assign to (optional, multiple allowed)')}</label>
              <div className="chip-select" style={{ marginBottom: 0 }}>
                {HISHAB_CLOSERS.map((n) => (
                  <button
                    key={n} type="button"
                    className={taskForm.assignees.includes(n) ? 'on' : ''}
                    onClick={() => setTaskForm((f) => ({
                      ...f,
                      assignees: f.assignees.includes(n) ? f.assignees.filter((x) => x !== n) : [...f.assignees, n],
                    }))}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none' }}>
                <input type="checkbox" checked={taskForm.useDueDate} onChange={(e) => setTaskForm({ ...taskForm, useDueDate: e.target.checked, dueDate: e.target.checked ? (taskForm.dueDate || todayStr()) : '' })} style={{ width: 'auto' }} />
                {t('Set a due date')}
              </label>
              {taskForm.useDueDate && (
                <div style={{ marginTop: 8 }}>
                  <DatePicker value={taskForm.dueDate || todayStr()} onChange={(d) => setTaskForm({ ...taskForm, dueDate: d })} minDate={MIN_DATE} />
                </div>
              )}
            </div>
            <button type="submit" className="btn block" disabled={savingTask || !taskForm.title.trim()}>
              {savingTask ? t('Saving…') : t('Add task')}
            </button>
          </form>
        )}

        {allTasksLoading ? (
          <p style={{ color: 'var(--text2)' }}>{t('Loading…')}</p>
        ) : allTasks.length === 0 ? (
          <p style={{ color: 'var(--text2)', fontSize: 13 }}>{t('No tasks here.')}</p>
        ) : (
          allTasks.map(renderTaskItem)
        )}
      </div>

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

      {assignEditor && (
        <div className="modal-overlay" onClick={() => setAssignEditor(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3>{t('Assign people')}</h3>
            <div className="chip-select" style={{ marginTop: 10, marginBottom: 0 }}>
              {HISHAB_CLOSERS.map((n) => (
                <button key={n} type="button" className={assignEditor.draft.includes(n) ? 'on' : ''} onClick={() => toggleAssignDraft(n)}>
                  {n}
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setAssignEditor(null)}>{t('Cancel')}</button>
              <button className="btn" style={{ background: 'var(--green)' }} onClick={saveAssignEditor} disabled={savingTask}>
                {savingTask ? t('Saving…') : t('Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
