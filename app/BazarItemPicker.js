'use client';

import { useState, useMemo } from 'react';
import NumberInput from './NumberInput';
import { useLang } from './LangProvider';
import { unitLabel, normalizedUnitPrice } from '@/lib/units';

function itemLabel(lang, name, nameBn) {
  return lang === 'bn' && nameBn ? nameBn : name;
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

const CATEGORY_ICONS = {
  'Meat & Egg': '🍗',
  'Vegetables': '🥬',
  'Herbs & Leaves': '🌿',
  'Raw Spices': '🌶️',
  'Processed Spices & Sauces': '🍶',
  'Cooking Essentials': '🛢️',
  'Serving & Seating': '🍽️',
  'Packaging': '📦',
  'Staff & Home': '🧑‍🍳',
  'Shop Operations & Repairs': '🔧',
  'Cleaning Supplies': '🧽',
  'Other': '🗂️',
};

// Which units an item can be bought in, and whether it's unit-priced at
// all — falls back to the catalog's single `unit` (as its only option)
// when a catalog item has no `unit_options` of its own.
function unitOptionsFor(item) {
  if (Array.isArray(item.unit_options) && item.unit_options.length > 0) return item.unit_options;
  return item.unit ? [item.unit] : [];
}

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
  const [showFrequent, setShowFrequent] = useState(false);
  // Optimistic local overlay for is_frequent — the parent page loads
  // `catalog` once and shares it across both the actual/planned pickers on
  // the same page, so this component patches the server directly and keeps
  // its own view in sync rather than threading a callback prop through both
  // instances; a full page reload always reflects the server truth anyway.
  const [frequentOverride, setFrequentOverride] = useState({});
  const isFrequent = (item) => frequentOverride[item.id] ?? !!item.is_frequent;

  const categories = useMemo(() => Array.from(new Set(catalog.map((c) => c.category))), [catalog]);
  const frequentItems = useMemo(() => catalog.filter((c) => isFrequent(c)), [catalog, frequentOverride]);

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

  async function toggleFrequent(item, e) {
    e.stopPropagation();
    const next = !isFrequent(item);
    setFrequentOverride((prev) => ({ ...prev, [item.id]: next }));
    try {
      await fetch('/api/bazar-items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, isFrequent: next }),
      });
    } catch {
      setFrequentOverride((prev) => ({ ...prev, [item.id]: !next })); // revert on failure
    }
  }

  function addItem(item) {
    if (addedItemIds.has(item.id)) return;
    const unitBased = item.unit_based !== false;
    const options = unitOptionsFor(item);
    // Default to whatever unit was actually bought most recently (if it's
    // still a valid option for this item) instead of a possibly-stale
    // catalog default — e.g. Coriander defaults to 250g if that's what's
    // really been bought lately, not the catalog's static 100g.
    const defaultUnit = item.recent_unit && options.includes(item.recent_unit) ? item.recent_unit : item.unit;
    onLinesChange([
      {
        key: `item-${item.id}`,
        itemId: item.id,
        name: item.name,
        nameBn: item.name_bn || null,
        unit: defaultUnit,
        unitOptions: options,
        unitBased,
        icon: item.icon,
        quantity: unitBased ? '' : '1',
        unitPrice: item.recent_price != null ? String(Number(item.recent_price)) : '',
      },
      ...lines,
    ]);
  }

  function addCustomNamed(name) {
    onLinesChange([
      { key: `custom-${Date.now()}-${Math.round(Math.random() * 1e6)}`, itemId: null, name, nameBn: null, unit: null, unitOptions: [], unitBased: true, icon: '🛒', quantity: '', unitPrice: '' },
      ...lines,
    ]);
  }

  // The single search/add box: typing filters the catalog (shown below as
  // tappable rows, same as before); the Add button next to it acts on
  // whatever's typed — an exact catalog match is added like tapping its
  // row, otherwise it's added as a new one-off item. Previously this was
  // two separate inputs (search vs. "add another item"), so clicking Add
  // after searching silently added stale text from the other box instead
  // of the item just searched for.
  function handleAddClick() {
    const term = search.trim();
    if (!term) return;
    const exact = catalog.find(
      (c) => c.name.toLowerCase() === term.toLowerCase() || (c.name_bn && c.name_bn === term)
    );
    if (exact) {
      if (!addedItemIds.has(exact.id)) addItem(exact);
    } else {
      addCustomNamed(term);
    }
    setSearch('');
  }

  // Quantity and unit price are the two stored fields; the basket shows
  // Quantity and Total as the two things the user directly edits, and
  // unit price is derived to keep qty × price == total:
  //  - editing Quantity keeps the current Total fixed and recomputes price
  //  - editing Total keeps the current Quantity fixed and recomputes price
  //
  // The derived unit price is kept at full precision (not rounded to 2dp)
  // here — the Total field redisplays as round2(qty × unitPrice), and
  // rounding unitPrice first would make that redisplay drift from what was
  // just typed (e.g. qty=12, typed "150" -> price round2(150/12)=12.5 is
  // fine, but qty=12, typed "1" -> round2(1/12)=0.08 redisplays as 0.96,
  // which NumberInput then reads back as an external change and overwrites
  // the field mid-keystroke). Postgres rounds unit_price to 2dp on save
  // regardless, so no precision is lost where it matters.
  function updateQuantity(line, n) {
    const qtyRaw = n == null ? '' : n;
    const newQty = Number(qtyRaw) || 0;
    const prevTotal = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
    onLinesChange(lines.map((l) => (l.key === line.key
      ? { ...l, quantity: qtyRaw === '' ? '' : String(qtyRaw), unitPrice: newQty > 0 && prevTotal > 0 ? String(prevTotal / newQty) : l.unitPrice }
      : l)));
  }

  function updateTotal(line, n) {
    const total = n == null ? 0 : n;
    const qty = Number(line.quantity) || 0;
    if (qty > 0) {
      onLinesChange(lines.map((l) => (l.key === line.key ? { ...l, unitPrice: String(total / qty) } : l)));
    } else {
      // No quantity yet — default to 1 so the total stays meaningful.
      onLinesChange(lines.map((l) => (l.key === line.key ? { ...l, quantity: '1', unitPrice: String(total) } : l)));
    }
  }

  // Lump-sum items (unitBased === false) skip quantity/unit entirely — the
  // single Amount field IS the total, with quantity pinned to 1 so the
  // shared lineTotal() math (qty × price) still holds.
  function updateAmount(line, n) {
    const amount = n == null ? '' : n;
    onLinesChange(lines.map((l) => (l.key === line.key ? { ...l, quantity: '1', unitPrice: amount === '' ? '' : String(amount) } : l)));
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
      <div className="bazar-custom-add">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); if (e.target.value.trim()) setShowFrequent(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddClick(); } }}
          placeholder={t('Search or add an item...')}
        />
        <button type="button" className="btn secondary" onClick={handleAddClick} disabled={!search.trim()}>{t('Add')}</button>
      </div>
      <div className="bazar-picker-toolbar">
        <button
          type="button"
          className={`btn secondary bazar-browse-btn bazar-frequent-btn${showFrequent ? ' on' : ''}`}
          onClick={() => { setShowFrequent((v) => !v); setSearch(''); }}
        >
          ⭐ {t('Frequent')}
        </button>
        <button type="button" className="btn secondary bazar-browse-btn" onClick={openBrowse}>
          {t('Browse categories')}
        </button>
      </div>

      {search.trim() ? (
        <div className="bazar-search-results">
          {searchResults.length === 0 ? (
            <p className="bazar-search-empty">{t('No items match — tap Add to add it as a new item.')}</p>
          ) : (
            searchResults.map((item) => {
              const added = addedItemIds.has(item.id);
              return (
                <div key={item.id} className="bazar-search-row-wrap">
                  <button
                    type="button"
                    className="bazar-search-row"
                    disabled={added}
                    onClick={() => { addItem(item); setSearch(''); }}
                  >
                    <span className="bazar-search-icon">{item.icon || '🛒'}</span>
                    <span className="bazar-search-name">{itemLabel(lang, item.name, item.name_bn)}</span>
                    <span className="bazar-search-unit">{item.unit_based === false ? '' : unitLabel(item.unit)}</span>
                  </button>
                  <button type="button" className={`bazar-item-star${isFrequent(item) ? ' on' : ''}`} onClick={(e) => toggleFrequent(item, e)} aria-label={t('Toggle frequent')}>
                    {isFrequent(item) ? '★' : '☆'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      ) : showFrequent && (
        <div className="bazar-search-results">
          {frequentItems.length === 0 ? (
            <p className="bazar-search-empty">{t('No frequent items marked yet — tap the star on any item to add it here.')}</p>
          ) : (
            frequentItems.map((item) => {
              const added = addedItemIds.has(item.id);
              return (
                <div key={item.id} className="bazar-search-row-wrap">
                  <button
                    type="button"
                    className="bazar-search-row"
                    disabled={added}
                    onClick={() => addItem(item)}
                  >
                    <span className="bazar-search-icon">{item.icon || '🛒'}</span>
                    <span className="bazar-search-name">{itemLabel(lang, item.name, item.name_bn)}</span>
                    <span className="bazar-search-unit">{item.unit_based === false ? '' : unitLabel(item.unit)}</span>
                  </button>
                  <button type="button" className="bazar-item-star on" onClick={(e) => toggleFrequent(item, e)} aria-label={t('Toggle frequent')}>★</button>
                </div>
              );
            })
          )}
        </div>
      )}

      {lines.length > 0 && (
        <div className="bazar-basket">
          {lines.map((line) => {
            const unitOptions = line.unitOptions && line.unitOptions.length > 0 ? line.unitOptions : (line.unit ? [line.unit] : []);
            const lineTotalVal = round2((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0));
            const norm = line.unitBased ? normalizedUnitPrice(line.quantity, line.unit, lineTotalVal) : null;
            return (
              <div key={line.key} className="bazar-basket-row">
                <div className="bazar-basket-icon">{line.icon || '🛒'}</div>
                <div className="bazar-basket-main">
                  <div className="bazar-basket-name">
                    {itemLabel(lang, line.name, line.nameBn)}
                    {line.unitBased && unitOptions.length > 1 ? (
                      <select
                        className="bazar-basket-unit-select"
                        value={line.unit || unitOptions[0]}
                        onChange={(e) => updateUnit(line, e.target.value)}
                      >
                        {unitOptions.map((u) => <option key={u} value={u}>{unitLabel(u)}</option>)}
                      </select>
                    ) : (
                      line.unitBased && line.unit && <span className="bazar-basket-unit">({unitLabel(line.unit)})</span>
                    )}
                  </div>
                  {line.unitBased ? (
                    <>
                      <div className="bazar-basket-inputs">
                        <NumberInput
                          className="bazar-basket-qty"
                          value={line.quantity}
                          min={0}
                          placeholder={t('Qty')}
                          onValueChange={(n) => updateQuantity(line, n)}
                        />
                        <span className="bazar-basket-sign">→</span>
                        <NumberInput
                          className="bazar-basket-total-input"
                          value={String(lineTotalVal)}
                          min={0}
                          placeholder={t('Total')}
                          onValueChange={(n) => updateTotal(line, n)}
                        />
                      </div>
                      {norm && (
                        <div className="bazar-basket-unitprice">
                          {'≈ '}{taka(norm.value)}/{unitLabel(norm.baseUnit)}
                        </div>
                      )}
                      {line.name === 'Auto Fare' && lineTotalVal > 50 && (
                        <div className="bazar-basket-hint">
                          {t("Over the usual ৳50 daily fare — if this is a separate trip (e.g. a bazar run), consider adding it as its own \"Extra Travel / Bazar Trip\" item instead.")}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="bazar-basket-inputs">
                      <NumberInput
                        className="bazar-basket-total-input"
                        value={line.unitPrice}
                        min={0}
                        placeholder={t('Amount')}
                        onValueChange={(n) => updateAmount(line, n)}
                      />
                    </div>
                  )}
                </div>
                <button type="button" className="bazar-basket-remove" onClick={() => removeLine(line.key)} aria-label={t('Remove')}>
                  ✕
                </button>
              </div>
            );
          })}
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
                      <div key={item.id} className="bazar-item-card-wrap">
                        <button
                          type="button"
                          className={`bazar-item-card${added ? ' added' : ''}`}
                          onClick={() => addItem(item)}
                          disabled={added}
                        >
                          <span className="bazar-item-icon">{item.icon || '🛒'}</span>
                          <span className="bazar-item-name">{itemLabel(lang, item.name, item.name_bn)}</span>
                          <span className="bazar-item-unit">{item.unit_based === false ? '' : unitLabel(item.unit)}</span>
                        </button>
                        <button type="button" className={`bazar-item-star${isFrequent(item) ? ' on' : ''}`} onClick={(e) => toggleFrequent(item, e)} aria-label={t('Toggle frequent')}>
                          {isFrequent(item) ? '★' : '☆'}
                        </button>
                      </div>
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
