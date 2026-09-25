'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AppShell from '../AppShell';
import { useLang } from '../LangProvider';
import { cachedFetchJson, invalidateCache } from '@/lib/clientCache';

const ITEMS_URL = '/api/bazar-items?all=1';
const CATEGORIES_URL = '/api/bazar-categories';
const RECURRING_URL = '/api/bazar-recurring-items';

// A fixed, curated set to pick from — keeps the catalog's icons consistent
// instead of free-typed emoji drifting over time. Shared between item icons
// and category icons.
const ICON_GROUPS = [
  { label: 'Produce', icons: ['🧅', '🥔', '🍅', '🥕', '🫑', '🥬', '🥦', '🌽', '🧄', '🫚', '🥒', '🍋', '🌶️', '🍆', '🥭', '🍌'] },
  { label: 'Meat & egg', icons: ['🍗', '🍖', '🥩', '🐟', '🍤', '🥚', '🐔'] },
  { label: 'Spices & sauces', icons: ['🧂', '🌿', '🍃', '🧴', '🫙', '🍯'] },
  { label: 'Grains & dairy', icons: ['🌾', '🍚', '🥛', '🧈', '🧀', '🍞'] },
  { label: 'Packaging', icons: ['📦', '🛍️', '🥡', '🥤', '🧻', '🧾', '🛢️'] },
  { label: 'Tools & shop', icons: ['🔧', '🔥', '🧯', '🪔', '🧹', '🧽', '🧼', '🪣', '🚿'] },
  { label: 'People & money', icons: ['👤', '👥', '💰', '💵', '🧑‍🍳', '🚗', '🏠'] },
  { label: 'Other', icons: ['🍲', '🥣', '🍽️', '❓', '⭐', '📌', '🗂️'] },
];

function fieldKey(id, field) { return `${id}:${field}`; }
function emptyDraft() { return { category: '', name: '', name_bn: '', unit: '', icon: '🛒', isFrequent: false }; }

export default function BazarItemsPage() {
  const { t } = useLang();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recurringIds, setRecurringIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const [iconPickerFor, setIconPickerFor] = useState(null); // { type: 'item'|'category', id } or null
  const [savingIds, setSavingIds] = useState({}); // id -> true while a save is in flight

  const [showAddItem, setShowAddItem] = useState(false);
  const [addStep, setAddStep] = useState('category'); // 'category' | 'details'
  const [addDraft, setAddDraft] = useState(emptyDraft());
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addError, setAddError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [showManageCategories, setShowManageCategories] = useState(false);
  const [manageNewCategory, setManageNewCategory] = useState('');
  const [categoryError, setCategoryError] = useState(null);

  // Tracks the last value we actually saved for each item/field, so onBlur
  // only fires a PATCH when something real changed.
  const savedRef = useRef({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsData, catData, recurringData] = await Promise.all([
        cachedFetchJson(ITEMS_URL),
        cachedFetchJson(CATEGORIES_URL),
        cachedFetchJson(RECURRING_URL),
      ]);
      const rows = itemsData.items || [];
      setItems(rows);
      const snap = {};
      for (const it of rows) {
        snap[fieldKey(it.id, 'name')] = it.name || '';
        snap[fieldKey(it.id, 'name_bn')] = it.name_bn || '';
        snap[fieldKey(it.id, 'unit')] = it.unit || '';
      }
      savedRef.current = snap;
      setCategories(catData.categories || []);
      setRecurringIds(new Set((recurringData.items || []).map((r) => r.item_id)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function invalidateAll() {
    invalidateCache(ITEMS_URL);
    invalidateCache('/api/bazar-items');
    invalidateCache(CATEGORIES_URL);
    invalidateCache(RECURRING_URL);
  }

  function updateLocal(id, field, value) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
  }

  async function saveField(id, apiField, field, value) {
    const key = fieldKey(id, field);
    if (savedRef.current[key] === value) return; // unchanged, skip the write
    setSavingIds((s) => ({ ...s, [id]: true }));
    try {
      await fetch('/api/bazar-items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [apiField]: value }),
      });
      savedRef.current[key] = value;
      invalidateAll();
    } finally {
      setSavingIds((s) => { const n = { ...s }; delete n[id]; return n; });
    }
  }

  async function toggleFrequent(it) {
    setSavingIds((s) => ({ ...s, [it.id]: true }));
    try {
      await fetch('/api/bazar-items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: it.id, isFrequent: !it.is_frequent }),
      });
      updateLocal(it.id, 'is_frequent', !it.is_frequent);
      invalidateAll();
    } finally {
      setSavingIds((s) => { const n = { ...s }; delete n[it.id]; return n; });
    }
  }

  async function toggleActive(it) {
    setSavingIds((s) => ({ ...s, [it.id]: true }));
    try {
      await fetch('/api/bazar-items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: it.id, active: !it.active }),
      });
      updateLocal(it.id, 'active', !it.active);
      invalidateAll();
    } finally {
      setSavingIds((s) => { const n = { ...s }; delete n[it.id]; return n; });
    }
  }

  async function toggleRecurring(it) {
    const nextActive = !recurringIds.has(it.id);
    setRecurringIds((prev) => {
      const next = new Set(prev);
      if (nextActive) next.add(it.id); else next.delete(it.id);
      return next;
    });
    try {
      await fetch('/api/bazar-recurring-items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: it.id, active: nextActive }),
      });
      invalidateCache(RECURRING_URL);
    } catch {
      setRecurringIds((prev) => {
        const next = new Set(prev);
        if (nextActive) next.delete(it.id); else next.add(it.id);
        return next;
      });
    }
  }

  async function pickIcon(target, icon) {
    if (target.type === 'item') {
      setSavingIds((s) => ({ ...s, [target.id]: true }));
      try {
        await fetch('/api/bazar-items', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: target.id, icon }),
        });
        updateLocal(target.id, 'icon', icon);
        invalidateAll();
      } finally {
        setSavingIds((s) => { const n = { ...s }; delete n[target.id]; return n; });
      }
    } else if (target.type === 'category') {
      setCategories((prev) => prev.map((c) => (c.id === target.id ? { ...c, icon } : c)));
      await fetch('/api/bazar-categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: target.id, icon }),
      });
      invalidateCache(CATEGORIES_URL);
    } else {
      // Picking an icon for the in-progress "add item" draft — no API call yet.
      setAddDraft((d) => ({ ...d, icon }));
    }
    setIconPickerFor(null);
  }

  function openAddItem() {
    setAddDraft(emptyDraft());
    setAddStep('category');
    setAddError(null);
    setNewCategoryName('');
    setShowAddItem(true);
  }

  async function createCategoryInline(name) {
    const res = await fetch('/api/bazar-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create category');
    invalidateCache(CATEGORIES_URL);
    setCategories((prev) => [...prev, { ...data.category, item_count: 0 }]);
    return data.category;
  }

  async function handleNewCategoryForAdd() {
    const name = newCategoryName.trim();
    if (!name) return;
    setAddError(null);
    try {
      await createCategoryInline(name);
      setAddDraft((d) => ({ ...d, category: name }));
      setNewCategoryName('');
      setAddStep('details');
    } catch (err) {
      setAddError(err.message);
    }
  }

  async function saveNewItem() {
    setAddError(null);
    if (!addDraft.name.trim() || !addDraft.unit.trim()) {
      setAddError(t('Name and unit are required.'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/bazar-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: addDraft.category,
          name: addDraft.name.trim(),
          nameBn: addDraft.name_bn.trim() || null,
          unit: addDraft.unit.trim(),
          icon: addDraft.icon,
          isFrequent: addDraft.isFrequent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add item');
      invalidateAll();
      setShowAddItem(false);
      await load();
      setActiveCategory(addDraft.category);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function renameCategory(cat, name) {
    if (!name.trim() || name.trim() === cat.name) return;
    setCategoryError(null);
    try {
      const res = await fetch('/api/bazar-categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cat.id, name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rename category');
      invalidateAll();
      await load();
      if (activeCategory === cat.name) setActiveCategory(name.trim());
    } catch (err) {
      setCategoryError(err.message);
    }
  }

  async function deleteCategory(cat) {
    setCategoryError(null);
    try {
      const res = await fetch(`/api/bazar-categories?id=${cat.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove category');
      invalidateCache(CATEGORIES_URL);
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
    } catch (err) {
      setCategoryError(err.message);
    }
  }

  async function addCategoryFromManage() {
    const name = manageNewCategory.trim();
    if (!name) return;
    setCategoryError(null);
    try {
      await createCategoryInline(name);
      setManageNewCategory('');
    } catch (err) {
      setCategoryError(err.message);
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? items.filter((it) => (it.name || '').toLowerCase().includes(q) || (it.name_bn || '').includes(q))
    : activeCategory
    ? items.filter((it) => (it.category || 'Other') === activeCategory)
    : [];

  const byCategory = [];
  const catIndex = {};
  for (const it of filtered) {
    const cat = it.category || 'Other';
    if (!(cat in catIndex)) { catIndex[cat] = byCategory.length; byCategory.push({ category: cat, items: [] }); }
    byCategory[catIndex[cat]].items.push(it);
  }

  function renderItemRow(it) {
    return (
      <div
        key={it.id}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
          borderBottom: '1px solid var(--border)', opacity: it.active ? 1 : 0.5,
        }}
      >
        <button
          type="button"
          onClick={() => setIconPickerFor({ type: 'item', id: it.id })}
          title={t('Change icon')}
          style={{
            width: 38, height: 38, flexShrink: 0, fontSize: 19, borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer',
          }}
        >
          {it.icon || '❓'}
        </button>

        <div style={{ flex: '1 1 140px', minWidth: 100 }}>
          <input
            type="text"
            value={it.name || ''}
            onChange={(e) => updateLocal(it.id, 'name', e.target.value)}
            onBlur={(e) => saveField(it.id, 'name', 'name', e.target.value.trim())}
            placeholder={t('Name (en)')}
            style={{ marginBottom: 4 }}
          />
          <input
            type="text"
            value={it.name_bn || ''}
            onChange={(e) => updateLocal(it.id, 'name_bn', e.target.value)}
            onBlur={(e) => saveField(it.id, 'name_bn', 'name_bn', e.target.value.trim())}
            placeholder={t('Name (bn)')}
          />
        </div>

        <div style={{ flex: '0 1 80px', minWidth: 64 }}>
          <input
            type="text"
            value={it.unit || ''}
            onChange={(e) => updateLocal(it.id, 'unit', e.target.value)}
            onBlur={(e) => saveField(it.id, 'unit', 'unit', e.target.value.trim())}
            placeholder={t('Unit')}
          />
        </div>

        <div style={{ flex: '0 0 70px', textAlign: 'right', fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
          {it.recent_price != null ? `৳${Number(it.recent_price)}` : '—'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => toggleFrequent(it)}
            title={t('Toggle frequent')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: it.is_frequent ? 'var(--brand-gold)' : 'var(--text3)', lineHeight: 1, padding: 0 }}
          >
            {it.is_frequent ? '★' : '☆'}
          </button>
          <button
            type="button"
            onClick={() => toggleRecurring(it)}
            title={t("In tomorrow's default list")}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: recurringIds.has(it.id) ? 1 : 0.3, lineHeight: 1, padding: 0 }}
          >
            🔁
          </button>
        </div>

        <button
          type="button"
          onClick={() => toggleActive(it)}
          title={it.active ? t('Deactivate item') : t('Reactivate item')}
          style={{
            flexShrink: 0, fontSize: 10.5, fontWeight: 700, padding: '5px 8px', borderRadius: 6, cursor: 'pointer',
            border: '1px solid var(--border2)', background: it.active ? 'var(--bg2)' : 'var(--red)',
            color: it.active ? 'var(--text3)' : '#fff',
          }}
        >
          {it.active ? '✕' : t('Restore')}
        </button>

        {savingIds[it.id] && <span style={{ fontSize: 10.5, color: 'var(--text3)', flexShrink: 0 }}>{t('Saving…')}</span>}
      </div>
    );
  }

  const activeCatMeta = categories.find((c) => c.name === activeCategory);

  // Categories arrive pre-sorted by group_name (nulls last) from the API, so
  // a single pass preserves group order and keeps each group's cards together.
  const groupedCategories = [];
  for (const c of categories) {
    const key = c.group_name || null;
    const last = groupedCategories[groupedCategories.length - 1];
    if (last && last[0] === key) last[1].push(c);
    else groupedCategories.push([key, [c]]);
  }

  return (
    <AppShell>
      <div className="card">
        <div className="card-title">{t('Bazar item catalog')}</div>
        <p style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 14 }}>
          {t('Edit name, unit and icon here — actual prices are set per purchase in the bazar step, so the price shown is just the most recent one paid.')}
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <button type="button" className="btn" style={{ flex: '1 1 140px' }} onClick={openAddItem}>＋ {t('Add item')}</button>
          <button type="button" className="btn secondary" style={{ flex: '1 1 140px' }} onClick={() => { setCategoryError(null); setShowManageCategories(true); }}>
            {t('Manage categories')}
          </button>
        </div>

        <div className="field" style={{ marginBottom: 16 }}>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); if (e.target.value.trim()) setActiveCategory(null); }}
            placeholder={t('Search items...')}
          />
        </div>

        {loading ? (
          <p style={{ color: 'var(--text2)' }}>{t('Loading…')}</p>
        ) : q ? (
          byCategory.length === 0 ? (
            <p style={{ color: 'var(--text2)', fontSize: 13 }}>{t('No items match.')}</p>
          ) : (
            byCategory.map((group) => (
              <div key={group.category} style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8, letterSpacing: 0.3 }}>
                  {group.category} <span style={{ fontWeight: 400 }}>({group.items.length})</span>
                </div>
                {group.items.map(renderItemRow)}
              </div>
            ))
          )
        ) : activeCategory ? (
          <div>
            <button type="button" className="btn secondary btn-small" style={{ marginBottom: 12 }} onClick={() => setActiveCategory(null)}>
              ← {t('Categories')}
            </button>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8, letterSpacing: 0.3 }}>
              {activeCatMeta?.icon} {activeCategory} <span style={{ fontWeight: 400 }}>({byCategory[0]?.items.length || 0})</span>
            </div>
            {byCategory[0]?.items.length ? byCategory[0].items.map(renderItemRow) : (
              <p style={{ color: 'var(--text2)', fontSize: 13 }}>{t('No items in this category yet.')}</p>
            )}
          </div>
        ) : (
          groupedCategories.map(([groupName, cats]) => (
            <div key={groupName || '__ungrouped'} style={{ marginBottom: 18 }}>
              {groupName && (
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8, letterSpacing: 0.3 }}>
                  {t(groupName)}
                </div>
              )}
              <div className="bazar-item-grid">
                {cats.map((c) => (
                  <button key={c.id} type="button" className="bazar-item-card bazar-category-card" onClick={() => setActiveCategory(c.name)}>
                    <span className="bazar-item-icon">{c.icon || '🗂️'}</span>
                    <span className="bazar-item-name">{t(c.name)}</span>
                    <span className="bazar-item-unit">{c.item_count}</span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {iconPickerFor != null && (
        <div className="modal-overlay" onClick={() => setIconPickerFor(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3>{t('Choose an icon')}</h3>
            <div style={{ maxHeight: '55vh', overflowY: 'auto', marginTop: 10 }}>
              {ICON_GROUPS.map((g) => (
                <div key={g.label} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>{t(g.label)}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {g.icons.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => pickIcon(iconPickerFor, icon)}
                        style={{
                          width: 40, height: 40, fontSize: 20, borderRadius: 8,
                          border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer',
                        }}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setIconPickerFor(null)}>{t('Cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {showAddItem && (
        <div className="modal-overlay" onClick={() => setShowAddItem(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3>{addStep === 'category' ? t('Add item — pick a category') : t('Add item — details')}</h3>

            {addStep === 'category' ? (
              <>
                <div className="bazar-item-grid" style={{ marginTop: 10, marginBottom: 14, maxHeight: '40vh', overflowY: 'auto' }}>
                  {categories.map((c) => (
                    <button
                      key={c.id} type="button" className="bazar-item-card bazar-category-card"
                      onClick={() => { setAddDraft((d) => ({ ...d, category: c.name })); setAddStep('details'); }}
                    >
                      <span className="bazar-item-icon">{c.icon || '🗂️'}</span>
                      <span className="bazar-item-name">{t(c.name)}</span>
                    </button>
                  ))}
                </div>
                <div className="bazar-custom-add">
                  <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder={t('New category name...')} />
                  <button type="button" className="btn secondary" onClick={handleNewCategoryForAdd} disabled={!newCategoryName.trim()}>{t('Create')}</button>
                </div>
                {addError && <p style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 8 }}>{addError}</p>}
                <div className="modal-actions" style={{ marginTop: 14 }}>
                  <button className="btn secondary" onClick={() => setShowAddItem(false)}>{t('Cancel')}</button>
                </div>
              </>
            ) : (
              <>
                <button type="button" className="btn secondary btn-small" style={{ marginBottom: 12 }} onClick={() => setAddStep('category')}>
                  ← {t('Category')}: {addDraft.category}
                </button>
                <div className="field">
                  <label>{t('Name (en)')}</label>
                  <input type="text" value={addDraft.name} onChange={(e) => setAddDraft((d) => ({ ...d, name: e.target.value }))} autoFocus />
                </div>
                <div className="field">
                  <label>{t('Name (bn)')}</label>
                  <input type="text" value={addDraft.name_bn} onChange={(e) => setAddDraft((d) => ({ ...d, name_bn: e.target.value }))} />
                </div>
                <div className="field">
                  <label>{t('Unit')}</label>
                  <input type="text" value={addDraft.unit} onChange={(e) => setAddDraft((d) => ({ ...d, unit: e.target.value }))} placeholder={t('e.g. kg, pc, litre')} />
                </div>
                <div className="field">
                  <label>{t('Icon')}</label>
                  <button type="button" onClick={() => setIconPickerFor({ type: 'draft' })} style={{ width: 44, height: 44, fontSize: 20, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer' }}>
                    {addDraft.icon}
                  </button>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 14, cursor: 'pointer' }}>
                  <input type="checkbox" checked={addDraft.isFrequent} onChange={(e) => setAddDraft((d) => ({ ...d, isFrequent: e.target.checked }))} style={{ width: 'auto' }} />
                  {t('Mark as frequent')}
                </label>
                {addError && <p style={{ color: 'var(--red)', fontSize: 12.5, marginBottom: 10 }}>{addError}</p>}
                <div className="modal-actions">
                  <button className="btn secondary" onClick={() => setShowAddItem(false)}>{t('Cancel')}</button>
                  <button className="btn" style={{ background: 'var(--green)' }} onClick={saveNewItem} disabled={saving}>
                    {saving ? t('Saving…') : t('Add item')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showManageCategories && (
        <div className="modal-overlay" onClick={() => setShowManageCategories(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h3>{t('Manage categories')}</h3>
            <div style={{ maxHeight: '50vh', overflowY: 'auto', marginTop: 10 }}>
              {categories.map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setIconPickerFor({ type: 'category', id: c.id })}
                    style={{ width: 34, height: 34, flexShrink: 0, fontSize: 16, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer' }}
                  >
                    {c.icon || '🗂️'}
                  </button>
                  <input
                    type="text"
                    defaultValue={c.name}
                    onBlur={(e) => renameCategory(c, e.target.value)}
                    style={{ flex: 1, minWidth: 80 }}
                  />
                  <span style={{ fontSize: 11.5, color: 'var(--text3)', flexShrink: 0 }}>{c.item_count}</span>
                  <button
                    type="button"
                    onClick={() => deleteCategory(c)}
                    disabled={c.item_count > 0}
                    title={c.item_count > 0 ? t('Move or remove its items first') : t('Remove category')}
                    style={{
                      flexShrink: 0, fontSize: 10.5, fontWeight: 700, padding: '5px 8px', borderRadius: 6, cursor: c.item_count > 0 ? 'default' : 'pointer',
                      border: '1px solid var(--border2)', background: 'var(--bg2)', color: c.item_count > 0 ? 'var(--text3)' : 'var(--red)',
                      opacity: c.item_count > 0 ? 0.5 : 1,
                    }}
                  >
                    {t('Remove')}
                  </button>
                </div>
              ))}
            </div>
            <div className="bazar-custom-add" style={{ marginTop: 14 }}>
              <input type="text" value={manageNewCategory} onChange={(e) => setManageNewCategory(e.target.value)} placeholder={t('New category name...')} />
              <button type="button" className="btn secondary" onClick={addCategoryFromManage} disabled={!manageNewCategory.trim()}>{t('Add')}</button>
            </div>
            {categoryError && <p style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 8 }}>{categoryError}</p>}
            <div className="modal-actions" style={{ marginTop: 14 }}>
              <button className="btn secondary" onClick={() => setShowManageCategories(false)}>{t('Done')}</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
