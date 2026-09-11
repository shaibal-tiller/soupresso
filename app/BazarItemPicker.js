'use client';

import { useState, useMemo } from 'react';
import NumberInput from './NumberInput';
import { useLang } from './LangProvider';

// A tappable, category-filtered card grid for building one day's bazar list —
// used both for tomorrow's planned shopping and for correcting today's
// actual purchases. Fully controlled: the parent owns `lines` and
// `adjustment`; this component only renders the picker UI and calls back.
export default function BazarItemPicker({ catalog, lines, onLinesChange, adjustment, onAdjustmentChange }) {
  const { t, taka } = useLang();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [customName, setCustomName] = useState('');

  const categories = useMemo(() => {
    const seen = new Set(catalog.map((c) => c.category));
    return Array.from(seen);
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    const term = search.trim().toLowerCase();
    return catalog.filter((c) => {
      if (categoryFilter !== 'ALL' && c.category !== categoryFilter) return false;
      if (term && !c.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [catalog, categoryFilter, search]);

  const addedItemIds = new Set(lines.filter((l) => l.itemId != null).map((l) => l.itemId));

  function addItem(item) {
    if (addedItemIds.has(item.id)) return;
    onLinesChange([
      ...lines,
      { key: `item-${item.id}`, itemId: item.id, name: item.name, unit: item.unit, icon: item.icon, quantity: '', unitPrice: '' },
    ]);
  }

  function addCustom() {
    const name = customName.trim();
    if (!name) return;
    onLinesChange([
      ...lines,
      { key: `custom-${Date.now()}-${Math.round(Math.random() * 1e6)}`, itemId: null, name, unit: null, icon: '🛒', quantity: '', unitPrice: '' },
    ]);
    setCustomName('');
  }

  function updateLine(key, field, value) {
    onLinesChange(lines.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  }

  function removeLine(key) {
    onLinesChange(lines.filter((l) => l.key !== key));
  }

  const itemsTotal = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const grandTotal = itemsTotal + (Number(adjustment) || 0);

  return (
    <div className="bazar-picker">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('Search items...')}
        style={{ marginBottom: 8 }}
      />
      <div className="chip-select">
        <button type="button" className={categoryFilter === 'ALL' ? 'on' : ''} onClick={() => setCategoryFilter('ALL')}>
          {t('All')}
        </button>
        {categories.map((c) => (
          <button key={c} type="button" className={categoryFilter === c ? 'on' : ''} onClick={() => setCategoryFilter(c)}>
            {c}
          </button>
        ))}
      </div>

      <div className="bazar-item-grid">
        {filteredCatalog.map((item) => {
          const added = addedItemIds.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              className={`bazar-item-card${added ? ' added' : ''}`}
              onClick={() => addItem(item)}
              disabled={added}
            >
              <span className="bazar-item-icon">{item.icon || '🛒'}</span>
              <span className="bazar-item-name">{item.name}</span>
              <span className="bazar-item-unit">{item.unit}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder={t('Add another item...')}
          style={{ flex: 1 }}
        />
        <button type="button" className="btn secondary" onClick={addCustom}>{t('Add')}</button>
      </div>

      {lines.length > 0 && (
        <div className="bazar-basket">
          {lines.map((line) => (
            <div key={line.key} className="bazar-basket-row">
              <div className="bazar-basket-name">
                <span>{line.icon || '🛒'}</span> {line.name}
                {line.unit && <span className="bazar-basket-unit"> ({line.unit})</span>}
              </div>
              <NumberInput
                value={line.quantity}
                min={0}
                placeholder={t('Qty')}
                onValueChange={(n) => updateLine(line.key, 'quantity', n == null ? '' : String(n))}
              />
              <NumberInput
                value={line.unitPrice}
                min={0}
                placeholder={t('Price')}
                onValueChange={(n) => updateLine(line.key, 'unitPrice', n == null ? '' : String(n))}
              />
              <span className="bazar-basket-total">{taka((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0))}</span>
              <button type="button" className="bazar-basket-remove" onClick={() => removeLine(line.key)} aria-label={t('Remove')}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="step-calc" style={{ marginBottom: 10 }}>
        <div className="calc-row"><span>{t('Items total')}</span><span>{taka(itemsTotal)}</span></div>
      </div>
      <div className="field">
        <label>{t('Adjustment (+/-)')}</label>
        <NumberInput value={adjustment} onValueChange={(n) => onAdjustmentChange(n ?? 0)} />
      </div>
      <div className="step-result"><span>{t('Total')}</span><strong>{taka(grandTotal)}</strong></div>
    </div>
  );
}
