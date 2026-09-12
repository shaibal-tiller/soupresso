'use client';

import { useState, useMemo } from 'react';
import NumberInput from './NumberInput';
import { useLang } from './LangProvider';

function itemLabel(lang, name, nameBn) {
  return lang === 'bn' && nameBn ? nameBn : name;
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

const CATEGORY_ICONS = {
  'Meat & Egg': '🍗',
  'Vegetables': '🥬',
  'Raw Spices': '🌶️',
  'Processed Spices & Sauces': '🍶',
  'Cooking Essentials': '🛢️',
  'Packaging': '📦',
  'Staff & Home': '🧑‍🍳',
  'Other': '🗂️',
};

// A small, precise set of alternate units for the handful of items that are
// genuinely bought either way — everything else uses its catalog default
// unit as fixed text, not a free-text field.
const UNIT_OPTIONS = {
  'Mushroom': ['kg', 'gm'],
  'Cooking Oil': ['litre', '1L pack', '2L pack', '5L pack'],
};

// A tappable, category-filtered card picker for building one day's bazar
// list — used both for tomorrow's planned shopping and for correcting
// today's actual purchases. Fully controlled: the parent owns `lines` and
// `adjustment`; this component only renders the picker UI and calls back.
// Category browsing lives in a popup so the step itself stays short — only
// the search box and the basket are always on the page.
//
// `totalEntryMode`: when true, the bottom field asks for the final total
// amount to give/pay instead of an adjustment delta, and the adjustment is
// derived backwards (total − itemsTotal) — used for Tomorrow's bazar
// advance, where the user knows the amount they're handing over, not the
// difference from the item list.
export default function BazarItemPicker({ catalog, lines, onLinesChange, adjustment, onAdjustmentChange, totalEntryMode = false }) {
  const { t, lang, taka } = useLang();
  const [search, setSearch] = useState('');
  const [showBrowse, setShowBrowse] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const [customName, setCustomName] = useState('');

  const categories = useMemo(() => Array.from(new Set(catalog.map((c) => c.category))), [catalog]);

  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return catalog
      .filter((c) => c.name.toLowerCase().includes(term) || (c.name_bn && c.name_bn.includes(search.trim())))
      .slice(0, 8);
  }, [catalog, search]);

  const itemsInActiveCategory = useMemo(
    () => (activeCategory ? catalog.filter((c) => c.category === activeCategory) : []),
    [catalog, activeCategory]
  );

  const addedItemIds = new Set(lines.filter((l) => l.itemId != null).map((l) => l.itemId));

  function addItem(item) {
    if (addedItemIds.has(item.id)) return;
    onLinesChange([
      ...lines,
      {
        key: `item-${item.id}`,
        itemId: item.id,
        name: item.name,
        nameBn: item.name_bn || null,
        unit: item.unit,
        icon: item.icon,
        quantity: '',
        unitPrice: item.recent_price != null ? String(Number(item.recent_price)) : '',
      },
    ]);
  }

  function addCustom() {
    const name = customName.trim();
    if (!name) return;
    onLinesChange([
      ...lines,
      { key: `custom-${Date.now()}-${Math.round(Math.random() * 1e6)}`, itemId: null, name, nameBn: null, unit: null, icon: '🛒', quantity: '', unitPrice: '' },
    ]);
    setCustomName('');
  }

  function updateLine(key, field, value) {
    onLinesChange(lines.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  }

  // Quantity and unit price are the two stored fields; total is a derived
  // convenience the user can also type directly — whichever of unit price
  // or total wasn't just edited gets recomputed so qty × price always
  // equals the shown total.
  function updateQuantity(line, n) {
    const qty = n == null ? '' : n;
    onLinesChange(lines.map((l) => (l.key === line.key ? { ...l, quantity: qty === '' ? '' : String(qty) } : l)));
  }

  function updateUnitPrice(line, n) {
    const unitPrice = n == null ? '' : n;
    onLinesChange(lines.map((l) => (l.key === line.key ? { ...l, unitPrice: unitPrice === '' ? '' : String(unitPrice) } : l)));
  }

  function updateTotal(line, n) {
    const total = n == null ? 0 : n;
    const qty = Number(line.quantity) || 0;
    if (qty > 0) {
      onLinesChange(lines.map((l) => (l.key === line.key ? { ...l, unitPrice: String(round2(total / qty)) } : l)));
    } else {
      // No quantity yet — default to 1 so unit price stays meaningful.
      onLinesChange(lines.map((l) => (l.key === line.key ? { ...l, quantity: '1', unitPrice: String(round2(total)) } : l)));
    }
  }

  function updateUnit(line, unit) {
    onLinesChange(lines.map((l) => (l.key === line.key ? { ...l, unit } : l)));
  }

  function removeLine(key) {
    onLinesChange(lines.filter((l) => l.key !== key));
  }

  function openBrowse() {
    setActiveCategory(null);
    setShowBrowse(true);
  }

  const itemsTotal = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const grandTotal = itemsTotal + (Number(adjustment) || 0);

  function handleGrandTotalChange(n) {
    const total = n == null ? 0 : n;
    onAdjustmentChange(round2(total - itemsTotal));
  }

  return (
    <div className="bazar-picker">
      <div className="bazar-picker-toolbar">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('Search items...')}
        />
        <button type="button" className="btn secondary bazar-browse-btn" onClick={openBrowse}>
          {t('Browse categories')}
        </button>
      </div>

      {search.trim() && (
        <div className="bazar-search-results">
          {searchResults.length === 0 ? (
            <p className="bazar-search-empty">{t('No items match your search.')}</p>
          ) : (
            searchResults.map((item) => {
              const added = addedItemIds.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className="bazar-search-row"
                  disabled={added}
                  onClick={() => { addItem(item); setSearch(''); }}
                >
                  <span className="bazar-search-icon">{item.icon || '🛒'}</span>
                  <span className="bazar-search-name">{itemLabel(lang, item.name, item.name_bn)}</span>
                  <span className="bazar-search-unit">{item.unit}</span>
                </button>
              );
            })
          )}
        </div>
      )}

      <div className="bazar-custom-add">
        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder={t('Add another item...')}
        />
        <button type="button" className="btn secondary" onClick={addCustom}>{t('Add')}</button>
      </div>

      {lines.length > 0 && (
        <div className="bazar-basket">
          {lines.map((line) => (
            <div key={line.key} className="bazar-basket-row">
              <div className="bazar-basket-icon">{line.icon || '🛒'}</div>
              <div className="bazar-basket-main">
                <div className="bazar-basket-name">
                  {itemLabel(lang, line.name, line.nameBn)}
                  {UNIT_OPTIONS[line.name] ? (
                    <select
                      className="bazar-basket-unit-select"
                      value={line.unit || UNIT_OPTIONS[line.name][0]}
                      onChange={(e) => updateUnit(line, e.target.value)}
                    >
                      {UNIT_OPTIONS[line.name].map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  ) : (
                    line.unit && <span className="bazar-basket-unit">({line.unit})</span>
                  )}
                </div>
                <div className="bazar-basket-inputs">
                  <NumberInput
                    className="bazar-basket-qty"
                    value={line.quantity}
                    min={0}
                    placeholder={t('Qty')}
                    onValueChange={(n) => updateQuantity(line, n)}
                  />
                  <span className="bazar-basket-sign">×</span>
                  <NumberInput
                    className="bazar-basket-price"
                    value={line.unitPrice}
                    min={0}
                    placeholder={t('Price')}
                    onValueChange={(n) => updateUnitPrice(line, n)}
                  />
                  <span className="bazar-basket-sign">=</span>
                  <NumberInput
                    className="bazar-basket-total-input"
                    value={String(round2((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)))}
                    min={0}
                    placeholder={t('Total')}
                    onValueChange={(n) => updateTotal(line, n)}
                  />
                </div>
              </div>
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
      {totalEntryMode ? (
        <div className="field">
          <label>{t('Total advance given (৳)')}</label>
          <NumberInput value={String(round2(grandTotal))} min={0} onValueChange={handleGrandTotalChange} />
        </div>
      ) : (
        <>
          <div className="field">
            <label>{t('Adjustment (+/-)')}</label>
            <NumberInput value={adjustment} onValueChange={(n) => onAdjustmentChange(n ?? 0)} />
          </div>
          <div className="step-result"><span>{t('Total')}</span><strong>{taka(grandTotal)}</strong></div>
        </>
      )}

      {showBrowse && (
        <div className="modal-overlay" onClick={() => setShowBrowse(false)}>
          <div className="modal-card bazar-browse-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bazar-browse-header">
              <h3>{activeCategory ? t(activeCategory) : t('Categories')}</h3>
              <button type="button" className="bazar-browse-close" onClick={() => setShowBrowse(false)} aria-label={t('Close')}>✕</button>
            </div>
            {activeCategory ? (
              <>
                <button type="button" className="bazar-browse-back" onClick={() => setActiveCategory(null)}>
                  ← {t('Categories')}
                </button>
                <div className="bazar-item-grid bazar-item-grid-modal">
                  {itemsInActiveCategory.map((item) => {
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
                        <span className="bazar-item-name">{itemLabel(lang, item.name, item.name_bn)}</span>
                        <span className="bazar-item-unit">{item.unit}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="bazar-item-grid bazar-item-grid-modal">
                {categories.map((c) => (
                  <button key={c} type="button" className="bazar-item-card bazar-category-card" onClick={() => setActiveCategory(c)}>
                    <span className="bazar-item-icon">{CATEGORY_ICONS[c] || '🗂️'}</span>
                    <span className="bazar-item-name">{t(c)}</span>
                    <span className="bazar-item-unit">{catalog.filter((i) => i.category === c).length}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
