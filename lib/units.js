// Unit taxonomy for bazar items. Each key is a unit an item can be bought
// in; `base` is the unit it normalizes to for price comparison, and
// `factor` is how many base-units one of this unit equals — e.g. a
// "dozen" of eggs is 12 base "pc"s, a "250g" pack of spice is 0.25 base
// "kg"s. This lets the picker show a read-only unit price that's
// comparable across purchases even when the buying unit changes day to
// day (a dozen eggs one day, a case the next).
export const UNIT_DEFS = {
  pc:      { label: 'pc',        base: 'pc',     factor: 1 },
  dozen:   { label: 'dozen',     base: 'pc',     factor: 12 },
  hali:    { label: 'hali',      base: 'pc',     factor: 4 },
  case30:  { label: 'case (30)', base: 'pc',     factor: 30 },
  gm:      { label: 'gm',        base: 'kg',     factor: 0.001 },
  '100g':  { label: '100g',      base: 'kg',     factor: 0.1 },
  '250g':  { label: '250g',      base: 'kg',     factor: 0.25 },
  '500g':  { label: '500g',      base: 'kg',     factor: 0.5 },
  kg:      { label: 'kg',        base: 'kg',     factor: 1 },
  litre:   { label: 'litre',     base: 'litre',  factor: 1 },
  day:     { label: 'day',       base: 'day',    factor: 1 },
  trip:    { label: 'trip',      base: 'trip',   factor: 1 },
  pack:    { label: 'pack',      base: 'pack',   factor: 1 },
  roll:    { label: 'roll',      base: 'roll',   factor: 1 },
  person:  { label: 'person',    base: 'person', factor: 1 },
  month:   { label: 'month',     base: 'month',  factor: 1 },
};

export function unitLabel(unit) {
  return UNIT_DEFS[unit]?.label || unit || '';
}

// total ÷ (quantity expressed in the base unit) — null when it can't be
// computed (no quantity yet, or an unrecognized unit).
export function normalizedUnitPrice(quantity, unit, total) {
  const def = UNIT_DEFS[unit];
  const qty = Number(quantity) || 0;
  if (!def || qty <= 0) return null;
  const baseQty = qty * def.factor;
  if (baseQty <= 0) return null;
  return { value: (Number(total) || 0) / baseQty, baseUnit: def.base };
}

// Items whose catalog unit is "pc", "kg" or "250g" are stored in that unit no
// matter what unit the cashier picked: 1 dozen of eggs is saved as 12 pc,
// 400 gm of mushroom as 0.4 kg, 500g of green chili as 2 x 250g. That keeps
// quantities comparable (and summable) across days instead of a mix of
// dozen/hali/pc. Items kept in 100g / 500g pack units (spices, cleaning
// powders) are left exactly as entered. The line's money is untouched: unit
// price is re-derived from the total.
const STORE_IN = new Set(['pc', 'kg', '250g']);

export function convertToStorageUnit({ unit, quantity, total }, catalogUnit) {
  const qty = Number(quantity) || 0;
  const from = UNIT_DEFS[unit];
  const to = UNIT_DEFS[catalogUnit];
  if (!STORE_IN.has(catalogUnit) || !from || !to || unit === catalogUnit || from.base !== to.base || qty <= 0) {
    return { unit, quantity: qty, converted: false };
  }
  const newQty = Math.round(qty * (from.factor / to.factor) * 10000) / 10000;
  if (newQty <= 0) return { unit, quantity: qty, converted: false };
  return { unit: catalogUnit, quantity: newQty, unitPrice: Math.round(((Number(total) || 0) / newQty) * 1e6) / 1e6, converted: true };
}

// A big pack-unit with a big number is almost always the count typed into the
// wrong unit (16 "dozen" eggs meaning 16 pc). Returns the pc count it would be
// if that's what was meant, or null when the quantity looks plausible.
export function suspectedPieceCount(unit, quantity) {
  const qty = Number(quantity) || 0;
  if (unit === 'dozen' && qty >= 6) return qty;
  if (unit === 'hali' && qty >= 9) return qty;
  return null;
}
