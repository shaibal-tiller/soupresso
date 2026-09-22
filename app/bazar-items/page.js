'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AppShell from '../AppShell';
import { useLang } from '../LangProvider';
import { cachedFetchJson, invalidateCache } from '@/lib/clientCache';

const ITEMS_URL = '/api/bazar-items?all=1';

// A fixed, curated set to pick from — keeps the catalog's icons consistent
// instead of free-typed emoji drifting over time.
const ICON_GROUPS = [
  { label: 'Produce', icons: ['🧅', '🥔', '🍅', '🥕', '🫑', '🥬', '🥦', '🌽', '🧄', '🫚', '🥒', '🍋', '🌶️', '🍆', '🥭', '🍌'] },
  { label: 'Meat & egg', icons: ['🍗', '🍖', '🥩', '🐟', '🍤', '🥚', '🐔'] },
  { label: 'Spices & sauces', icons: ['🧂', '🌿', '🍃', '🧴', '🫙', '🍯'] },
  { label: 'Grains & dairy', icons: ['🌾', '🍚', '🥛', '🧈', '🧀', '🍞'] },
  { label: 'Packaging', icons: ['📦', '🛍️', '🥡', '🥤', '🧻', '🧾', '🛢️'] },
  { label: 'Tools & shop', icons: ['🔧', '🔥', '🧯', '🪔', '🧹', '🧽', '🧼', '🪣', '🚿'] },
  { label: 'People & money', icons: ['👤', '👥', '💰', '💵', '🧑‍🍳', '🚗', '🏠'] },
  { label: 'Other', icons: ['🍲', '🥣', '🍽️', '❓', '⭐', '📌'] },
];

function fieldKey(id, field) { return `${id}:${field}`; }

export default function BazarItemsPage() {
  const { t } = useLang();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [iconPickerFor, setIconPickerFor] = useState(null); // item id or null
  const [savingIds, setSavingIds] = useState({}); // id -> true while a save is in flight

  // Tracks the last value we actually saved for each item/field, so onBlur
  // only fires a PATCH when something real changed.
  const savedRef = useRef({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await cachedFetchJson(ITEMS_URL);
      const rows = data.items || [];
      setItems(rows);
      const snap = {};
      for (const it of rows) {
        snap[fieldKey(it.id, 'name')] = it.name || '';
        snap[fieldKey(it.id, 'name_bn')] = it.name_bn || '';
        snap[fieldKey(it.id, 'unit')] = it.unit || '';
      }
      savedRef.current = snap;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
      invalidateCache(ITEMS_URL);
      invalidateCache('/api/bazar-items');
    } finally {
      setSavingIds((s) => { const n = { ...s }; delete n[id]; return n; });
    }
  }

  async function pickIcon(id, icon) {
    setSavingIds((s) => ({ ...s, [id]: true }));
    try {
      await fetch('/api/bazar-items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, icon }),
      });
      updateLocal(id, 'icon', icon);
      invalidateCache(ITEMS_URL);
      invalidateCache('/api/bazar-items');
    } finally {
      setSavingIds((s) => { const n = { ...s }; delete n[id]; return n; });
      setIconPickerFor(null);
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? items.filter((it) => (it.name || '').toLowerCase().includes(q) || (it.name_bn || '').includes(q))
    : items;

  const byCategory = [];
  const catIndex = {};
  for (const it of filtered) {
    const cat = it.category || 'Other';
    if (!(cat in catIndex)) { catIndex[cat] = byCategory.length; byCategory.push({ category: cat, items: [] }); }
    byCategory[catIndex[cat]].items.push(it);
  }

  return (
    <AppShell>
      <div className="card">
        <div className="card-title">{t('Bazar item catalog')}</div>
        <p style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 14 }}>
          {t('Edit name, unit and icon here — actual prices are set per purchase in the bazar step, so the price shown is just the most recent one paid.')}
        </p>
        <div className="field" style={{ marginBottom: 16 }}>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search items...')} />
        </div>

        {loading ? (
          <p style={{ color: 'var(--text2)' }}>{t('Loading…')}</p>
        ) : byCategory.length === 0 ? (
          <p style={{ color: 'var(--text2)', fontSize: 13 }}>{t('No items match.')}</p>
        ) : (
          byCategory.map((group) => (
            <div key={group.category} style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8, letterSpacing: 0.3 }}>
                {group.category} <span style={{ fontWeight: 400 }}>({group.items.length})</span>
              </div>
              {group.items.map((it) => (
                <div
                  key={it.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                    borderBottom: '1px solid var(--border)', opacity: it.active ? 1 : 0.5,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setIconPickerFor(it.id)}
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

                  <div style={{ flex: '0 1 90px', minWidth: 70 }}>
                    <input
                      type="text"
                      value={it.unit || ''}
                      onChange={(e) => updateLocal(it.id, 'unit', e.target.value)}
                      onBlur={(e) => saveField(it.id, 'unit', 'unit', e.target.value.trim())}
                      placeholder={t('Unit')}
                    />
                  </div>

                  <div style={{ flex: '0 0 76px', textAlign: 'right', fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                    {it.recent_price != null ? `৳${Number(it.recent_price)}` : '—'}
                  </div>

                  {savingIds[it.id] && <span style={{ fontSize: 10.5, color: 'var(--text3)', flexShrink: 0 }}>{t('Saving…')}</span>}
                </div>
              ))}
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
    </AppShell>
  );
}
