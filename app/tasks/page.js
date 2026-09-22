'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '../AppShell';
import { useLang } from '../LangProvider';
import DatePicker from '../DatePicker';
import { todayStr, toDateStr } from '@/lib/dates';
import { cachedFetchJson, invalidateCache } from '@/lib/clientCache';

const HISHAB_CLOSERS = [
  'Ashraful', 'Shagor', 'Shaibal', 'Sadman', 'Arman (Josh)', 'Arman Mahmud',
  'Himel', 'Hridoy', 'Zamil', 'Ezaz', 'Shakil', 'Limon', 'Nazmul Rabbi',
  'Supto', 'Chef (Sujit)',
];

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'done', label: 'Done' },
  { key: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLORS = { pending: 'var(--amber)', done: 'var(--green)', cancelled: 'var(--text3)' };

function emptyForm() {
  return { title: '', description: '', assignedTo: '', dueDate: '', useDueDate: false };
}

export default function TasksPage() {
  const { t, dateNice } = useLang();
  const [filter, setFilter] = useState('pending');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [commentsByTask, setCommentsByTask] = useState({});
  const [commentDraft, setCommentDraft] = useState('');
  const [pendingAction, setPendingAction] = useState(null); // { taskId, status } awaiting an optional comment

  const url = filter === 'all' ? '/api/tasks' : `/api/tasks?status=${filter}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await cachedFetchJson(url);
      setTasks(data.tasks || []);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { load(); }, [load]);

  function invalidateAll() {
    for (const f of FILTERS) invalidateCache(f.key === 'all' ? '/api/tasks' : `/api/tasks?status=${f.key}`);
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          assignedTo: form.assignedTo || null,
          dueDate: form.useDueDate && form.dueDate ? form.dueDate : null,
        }),
      });
      invalidateAll();
      setForm(emptyForm());
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function loadComments(taskId) {
    const data = await cachedFetchJson(`/api/tasks/${taskId}`);
    setCommentsByTask((prev) => ({ ...prev, [taskId]: data.comments || [] }));
  }

  function toggleExpand(taskId) {
    setExpandedId((id) => (id === taskId ? null : taskId));
    setPendingAction(null);
    setCommentDraft('');
    if (expandedId !== taskId && !commentsByTask[taskId]) loadComments(taskId);
  }

  function startStatusChange(taskId, status) {
    setPendingAction({ taskId, status });
    setCommentDraft('');
  }

  async function confirmStatusChange() {
    if (!pendingAction) return;
    const { taskId, status } = pendingAction;
    setSaving(true);
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, comment: commentDraft.trim() || undefined }),
      });
      invalidateAll();
      invalidateCache(`/api/tasks/${taskId}`);
      setPendingAction(null);
      setCommentDraft('');
      await load();
      await loadComments(taskId);
    } finally {
      setSaving(false);
    }
  }

  async function addPlainComment(taskId) {
    if (!commentDraft.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: commentDraft.trim() }),
      });
      invalidateCache(`/api/tasks/${taskId}`);
      setCommentDraft('');
      await loadComments(taskId);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="toggle-row">
        {FILTERS.map((f) => (
          <button key={f.key} className={filter === f.key ? 'on' : ''} onClick={() => setFilter(f.key)}>
            {t(f.label)}
          </button>
        ))}
      </div>

      <button className="btn block" onClick={() => setShowForm((v) => !v)} style={{ marginBottom: 16 }}>
        {showForm ? t('Cancel') : t('+ Add task')}
      </button>

      {showForm && (
        <div className="card">
          <div className="card-title">{t('New task')}</div>
          <form onSubmit={handleAdd}>
            <div className="field">
              <label>{t('Title')}</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t('e.g. Fix the burner')} required autoFocus />
            </div>
            <div className="field">
              <label>{t('Description (optional)')}</label>
              <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t('Details')} />
            </div>
            <div className="field">
              <label>{t('Assign to (optional)')}</label>
              <div className="chip-select" style={{ marginBottom: 0 }}>
                <button type="button" className={!form.assignedTo ? 'on' : ''} onClick={() => setForm({ ...form, assignedTo: '' })}>{t('Unassigned')}</button>
                {HISHAB_CLOSERS.map((n) => (
                  <button key={n} type="button" className={form.assignedTo === n ? 'on' : ''} onClick={() => setForm({ ...form, assignedTo: n })}>{n}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none' }}>
                <input type="checkbox" checked={form.useDueDate} onChange={(e) => setForm({ ...form, useDueDate: e.target.checked, dueDate: e.target.checked ? (form.dueDate || todayStr()) : '' })} style={{ width: 'auto' }} />
                {t('Set a due date')}
              </label>
              {form.useDueDate && (
                <div style={{ marginTop: 8 }}>
                  <DatePicker value={form.dueDate || todayStr()} onChange={(d) => setForm({ ...form, dueDate: d })} minDate="2026-08-01" />
                </div>
              )}
            </div>
            <button type="submit" className="btn block" disabled={saving || !form.title.trim()}>
              {saving ? t('Saving…') : t('Add task')}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text2)' }}>{t('Loading…')}</p>
      ) : tasks.length === 0 ? (
        <p style={{ color: 'var(--text2)', fontSize: 13 }}>{t('No tasks here.')}</p>
      ) : (
        tasks.map((task) => {
          const expanded = expandedId === task.id;
          return (
            <div className="card" key={task.id} style={{ cursor: 'pointer' }}>
              <div onClick={() => toggleExpand(task.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                    {task.assigned_to && <span>{task.assigned_to}</span>}
                    {task.due_date && <span>{task.assigned_to ? ' · ' : ''}{t('Due')} {dateNice(toDateStr(new Date(task.due_date)))}</span>}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLORS[task.status], textTransform: 'uppercase', flexShrink: 0 }}>
                  {t(task.status)}
                </span>
              </div>

              {expanded && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
                  {task.description && <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>{task.description}</p>}

                  <div className="btn-row" style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
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
                    <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 10, marginBottom: 12 }}>
                      <label style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                        {t('Optional comment for this change')}
                      </label>
                      <input type="text" value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} placeholder={t('e.g. reason, notes...')} style={{ marginBottom: 8 }} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn secondary btn-small" onClick={() => setPendingAction(null)}>{t('Cancel')}</button>
                        <button className="btn btn-small" onClick={confirmStatusChange} disabled={saving}>{t('Confirm')}</button>
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
                      <button type="button" className="btn secondary" onClick={() => addPlainComment(task.id)} disabled={saving || !commentDraft.trim()}>{t('Add')}</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </AppShell>
  );
}
