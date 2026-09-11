'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '../AppShell';
import { useLang } from '../LangProvider';
import NumberInput from '../NumberInput';
import { todayStr } from '@/lib/dates';

const KNOWN_CATEGORIES = [
  'Food Cart', 'Chef Home Development', 'Gas', 'Convayance & Misc',
  'Food Taste & Raw Materials', 'Cookaries & Accessories', 'Others',
];

function emptyForm() {
  return { id: null, spentOn: todayStr(), category: '', description: '', amount: '', notes: '' };
}

export default function InvestmentsPage() {
  const { t, taka, dateNice } = useLang();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [form, setForm] = useState(emptyForm());
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/investments');
    const data = await res.json();
    setItems(data.items || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const seenCategories = Array.from(new Set(items.map((i) => i.category)));
  const categoryOptions = Array.from(new Set([...KNOWN_CATEGORIES, ...seenCategories]));

  const filtered = categoryFilter === 'ALL' ? items : items.filter((i) => i.category === categoryFilter);
  const grandTotal = filtered.reduce((sum, i) => sum + Number(i.amount), 0);

  const grouped = {};
  for (const item of filtered) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }

  function startNew() {
    setForm(emptyForm());
    setMsg(null);
    setShowForm(true);
  }

  function startEdit(item) {
    setForm({
      id: item.id,
      spentOn: String(item.spent_on).slice(0, 10),
      category: item.category,
      description: item.description,
      amount: String(Number(item.amount)),
      notes: item.notes || '',
    });
    setMsg(null);
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/investments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.id,
          spentOn: form.spentOn,
          category: form.category,
          description: form.description,
          amount: form.amount,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: 'err', text: data.error || t('Save failed.') });
      } else {
        setShowForm(false);
        load();
      }
    } catch {
      setMsg({ type: 'err', text: t('Could not reach the server.') });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="kpi-row" style={{ gridTemplateColumns: '1fr' }}>
        <div className="kpi">
          <div className="kpi-label">{t('Grand total')}</div>
          <div className="kpi-value">{taka(grandTotal)}</div>
        </div>
      </div>

      <div className="chip-select">
        <button type="button" className={categoryFilter === 'ALL' ? 'on' : ''} onClick={() => setCategoryFilter('ALL')}>
          {t('All categories')}
        </button>
        {categoryOptions.map((c) => (
          <button key={c} type="button" className={categoryFilter === c ? 'on' : ''} onClick={() => setCategoryFilter(c)}>
            {c}
          </button>
        ))}
      </div>

      <button className="btn block" onClick={startNew} style={{ marginBottom: 16 }}>{t('Add entry')}</button>

      {showForm && (
        <div className="card">
          <div className="card-title">{form.id ? t('Edit entry') : t('Add entry')}</div>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>{t('Date')}</label>
              <input type="date" value={form.spentOn} onChange={(e) => setForm({ ...form, spentOn: e.target.value })} required />
            </div>
            <div className="field">
              <label>{t('Category')}</label>
              <input
                list="investment-categories"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder={t('e.g. Food Cart, Gas, Others')}
                required
              />
              <datalist id="investment-categories">
                {categoryOptions.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="field">
              <label>{t('Description')}</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t('e.g. Gas cylinder')}
                required
              />
            </div>
            <div className="field">
              <label>{t('Amount (৳)')}</label>
              <NumberInput value={form.amount} min={0} onValueChange={(n) => setForm({ ...form, amount: n == null ? '' : String(n) })} />
            </div>
            <div className="field">
              <label>{t('Notes (optional)')}</label>
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            {msg && <div className={`status-msg ${msg.type}`}>{msg.text}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn secondary" onClick={() => setShowForm(false)}>{t('Cancel')}</button>
              <button type="submit" className="btn" disabled={saving}>
                {saving ? t('Saving…') : form.id ? t('Update') : t('Save')}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text2)' }}>{t('Loading…')}</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: 'var(--text2)', fontSize: 13 }}>{t('No investment entries yet.')}</p>
      ) : (
        Object.entries(grouped).map(([cat, rows]) => {
          const subtotal = rows.reduce((sum, r) => sum + Number(r.amount), 0);
          return (
            <div className="card" key={cat}>
              <div className="card-title">{cat}</div>
              <table className="denom-table">
                <thead>
                  <tr><th>{t('Date')}</th><th>{t('Description')}</th><th>{t('Amount (৳)')}</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} onClick={() => startEdit(r)} style={{ cursor: 'pointer' }}>
                      <td>{dateNice(r.spent_on)}</td>
                      <td>
                        {r.description}
                        {r.notes && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.notes}</div>}
                      </td>
                      <td style={{ fontFamily: 'var(--mono)' }}>{taka(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="step-result" style={{ marginTop: 8 }}>
                <span>{t('Total')}</span>
                <strong>{taka(subtotal)}</strong>
              </div>
            </div>
          );
        })
      )}
    </AppShell>
  );
}
