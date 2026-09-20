'use client';

import { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import AppShell from '../AppShell';
import { useLang } from '../LangProvider';
import DatePicker from '../DatePicker';
import { cachedFetchJson, peekCache, prefetchJson, runWhenIdle } from '@/lib/clientCache';
import { todayStr, shiftDateStr } from '@/lib/dates';

const RANGES = [
  { key: '7d', label: '7 days' },
  { key: '14d', label: '14 days' },
  { key: '30d', label: '30 days' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
];

const VIEWS = [
  { key: 'category', label: 'By category' },
  { key: 'item', label: 'By item' },
  { key: 'day', label: 'By day' },
];

// Which bazar_items category rolls up into which top-level expense group.
// Colors are validated for categorical use (dataviz skill: CVD-separated,
// normal-vision floor cleared, >=3:1 contrast) — "Other" deliberately gets no
// saturated color at all, per the skill's guidance to fold a residual bucket
// into a neutral rather than spend a hue slot on it.
const COST_OF_PRODUCTS_CATEGORIES = new Set([
  'Meat & Egg', 'Vegetables', 'Herbs & Leaves', 'Raw Spices',
  'Processed Spices & Sauces', 'Cooking Essentials',
]);
const OVERHEAD_CATEGORIES = new Set(['Staff & Home', 'Shop Operations & Repairs']);
const GROUP_COLORS = { 'Cost of products': '#C1502E', Overhead: '#1F8C5A', Other: '#9C9080' };
function groupFor(category) {
  if (COST_OF_PRODUCTS_CATEGORIES.has(category)) return 'Cost of products';
  if (OVERHEAD_CATEGORIES.has(category)) return 'Overhead';
  return 'Other';
}

function apiUrl({ rangeMode, range, from, to }) {
  if (rangeMode === 'custom' && from && to) return `/api/expenses?from=${from}&to=${to}`;
  return `/api/expenses?range=${range}`;
}

export default function ExpensesPage() {
  const { t, taka, num, dateNice, dateShort } = useLang();
  const [rangeMode, setRangeMode] = useState('preset'); // 'preset' | 'custom'
  const [range, setRange] = useState('30d');
  const [customFrom, setCustomFrom] = useState(shiftDateStr(todayStr(), -29));
  const [customTo, setCustomTo] = useState(todayStr());
  const [view, setView] = useState('category');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [itemSearch, setItemSearch] = useState('');
  const [itemSort, setItemSort] = useState({ key: 'total', dir: 'desc' });
  const [daySort, setDaySort] = useState('desc');
  const [expandedDate, setExpandedDate] = useState(null);
  const [expandedItem, setExpandedItem] = useState(null);

  const url = apiUrl({ rangeMode, range, from: customFrom, to: customTo });
  const [data, setData] = useState(() => peekCache(url) ?? null);
  const [loading, setLoading] = useState(() => peekCache(url) === undefined);
  const requestRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestRef.current;
    const cached = peekCache(url);
    if (cached) { setData(cached); setLoading(false); } else setLoading(true);
    cachedFetchJson(url).then((fresh) => {
      if (requestRef.current !== requestId) return;
      setData(fresh);
      setLoading(false);
    }).catch(() => { if (requestRef.current === requestId) setLoading(false); });
  }, [url]);

  useEffect(() => {
    if (loading || rangeMode !== 'preset') return;
    runWhenIdle(() => {
      for (const r of RANGES) if (r.key !== range) prefetchJson(apiUrl({ rangeMode: 'preset', range: r.key }));
    });
  }, [range, rangeMode, loading]);

  // ---- Derived aggregates (all client-side — the line list is small) ----
  const lines = data?.lines || [];
  const daily = data?.daily || [];

  const totalRecorded = useMemo(() => daily.reduce((s, d) => s + d.bazarActualCost, 0), [daily]);
  const itemizedTotal = useMemo(() => lines.reduce((s, l) => s + l.lineTotal, 0), [lines]);
  const unitemizedGap = Math.round((totalRecorded - itemizedTotal) * 100) / 100;

  const byCategory = useMemo(() => {
    const map = new Map();
    for (const l of lines) {
      const cur = map.get(l.category) || { category: l.category, total: 0, count: 0 };
      cur.total += l.lineTotal; cur.count += 1;
      map.set(l.category, cur);
    }
    const rows = Array.from(map.values());
    if (unitemizedGap > 0.5) rows.push({ category: 'Unitemized', total: unitemizedGap, count: null });
    return rows.sort((a, b) => b.total - a.total);
  }, [lines, unitemizedGap]);

  const byGroup = useMemo(() => {
    const totals = { 'Cost of products': 0, Overhead: 0, Other: 0 };
    for (const r of byCategory) totals[groupFor(r.category)] += r.total;
    return Object.entries(totals)
      .map(([group, total]) => ({ group, total: Math.round(total * 100) / 100 }))
      .filter((r) => r.total > 0.5)
      .sort((a, b) => b.total - a.total);
  }, [byCategory]);

  const scopedLines = useMemo(
    () => (categoryFilter ? lines.filter((l) => l.category === categoryFilter) : lines),
    [lines, categoryFilter]
  );

  const byItem = useMemo(() => {
    const map = new Map();
    for (const l of scopedLines) {
      const key = l.category + '|' + l.name;
      let cur = map.get(key);
      if (!cur) { cur = { key, category: l.category, name: l.name, total: 0, count: 0, units: new Set(), qty: 0, qtyValid: true }; map.set(key, cur); }
      cur.total += l.lineTotal; cur.count += 1;
      if (l.unit) cur.units.add(l.unit); else cur.qtyValid = false;
      if (l.quantity != null) cur.qty += l.quantity; else cur.qtyValid = false;
    }
    let rows = Array.from(map.values()).map((r) => ({
      ...r,
      unitLabel: r.units.size === 1 && r.qtyValid ? Array.from(r.units)[0] : null,
      qtyLabel: r.units.size === 1 && r.qtyValid ? r.qty : null,
    }));
    if (itemSearch.trim()) {
      const term = itemSearch.trim().toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(term));
    }
    const dir = itemSort.dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      if (itemSort.key === 'name') return a.name.localeCompare(b.name) * dir;
      if (itemSort.key === 'category') return a.category.localeCompare(b.category) * dir;
      if (itemSort.key === 'count') return (a.count - b.count) * dir;
      return (a.total - b.total) * dir;
    });
    return rows;
  }, [scopedLines, itemSearch, itemSort]);

  const byDay = useMemo(() => {
    const lineMap = new Map();
    for (const l of scopedLines) {
      if (!lineMap.has(l.date)) lineMap.set(l.date, []);
      lineMap.get(l.date).push(l);
    }
    const dates = new Set([...daily.map((d) => d.date), ...lineMap.keys()]);
    let rows = Array.from(dates).map((date) => {
      const dayLines = (lineMap.get(date) || []).slice().sort((a, b) => b.lineTotal - a.lineTotal);
      const dayMeta = daily.find((d) => d.date === date);
      const itemized = dayLines.reduce((s, l) => s + l.lineTotal, 0);
      const recorded = dayMeta ? dayMeta.bazarActualCost : itemized;
      const groupTotals = { 'Cost of products': 0, Overhead: 0, Other: 0 };
      for (const l of dayLines) groupTotals[groupFor(l.category)] += l.lineTotal;
      const gap = Math.round((recorded - itemized) * 100) / 100;
      if (gap > 0.5) groupTotals.Other += gap; // unitemized gap folds into "Other" for the stacked bar
      return {
        date, lines: dayLines, itemized, recorded, groupTotals,
        gap,
        isOffDay: dayMeta?.isOffDay || false,
        totalSales: dayMeta?.totalSales ?? null,
      };
    });
    if (categoryFilter) rows = rows.filter((r) => r.lines.length > 0);
    rows.sort((a, b) => (daySort === 'desc' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
    return rows;
  }, [scopedLines, daily, categoryFilter, daySort]);

  function toggleItemSort(key) {
    setItemSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }));
  }

  function pickCategory(cat) {
    setCategoryFilter((c) => (c === cat ? null : cat));
    if (view === 'category') setView('item');
  }

  function pickRange(key) {
    setRangeMode('preset');
    setRange(key);
  }

  if (loading) return <AppShell><div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text2)' }}>{t('Loading…')}</div></AppShell>;

  return (
    <AppShell>
      {/* ---- Filters: one row, above everything they scope ---- */}
      <div className="toggle-row" style={{ marginBottom: 6, flexWrap: 'wrap' }}>
        {RANGES.map((r) => (
          <button key={r.key} className={rangeMode === 'preset' && range === r.key ? 'on' : ''} onClick={() => pickRange(r.key)} style={{ fontSize: 12, padding: '7px 10px' }}>
            {t(r.label)}
          </button>
        ))}
        <button className={rangeMode === 'custom' ? 'on' : ''} onClick={() => setRangeMode('custom')} style={{ fontSize: 12, padding: '7px 10px' }}>
          {t('Custom range')}
        </button>
      </div>
      {rangeMode === 'custom' && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>{t('From')}</label>
            <DatePicker value={customFrom} onChange={setCustomFrom} minDate="2026-08-01" />
          </div>
          <span style={{ color: 'var(--text3)', marginTop: 14 }}>→</span>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>{t('To')}</label>
            <DatePicker value={customTo} onChange={setCustomTo} minDate={customFrom} />
          </div>
        </div>
      )}

      {/* ---- KPIs ---- */}
      <div className="kpi-row" style={{ gridTemplateColumns: `repeat(${Math.max(byGroup.length, 1) + 1}, 1fr)` }}>
        <div className="kpi">
          <div className="kpi-label">{t('Total expense')}</div>
          <div className="kpi-value r">{taka(totalRecorded)}</div>
        </div>
        {byGroup.map((g) => (
          <div className="kpi" key={g.group}>
            <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <i style={{ width: 8, height: 8, borderRadius: 2, background: GROUP_COLORS[g.group], display: 'inline-block', flex: 'none' }} />
              {t(g.group)}
            </div>
            <div className="kpi-value" style={{ fontSize: 16 }}>{taka(g.total)}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
              {totalRecorded ? num(Math.round((g.total / totalRecorded) * 100)) : 0}%
            </div>
          </div>
        ))}
      </div>

      {/* ---- Part-to-whole: cost of products vs overhead vs other ---- */}
      {byGroup.length > 0 && (
        <div className="card">
          <div className="card-title">{t('Cost of products vs. overhead')} — {t(data?.range || '')}</div>
          <div style={{ display: 'flex', height: 26, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
            {byGroup.map((g) => (
              <div
                key={g.group}
                title={`${t(g.group)}: ${taka(g.total)} (${totalRecorded ? Math.round((g.total / totalRecorded) * 100) : 0}%)`}
                style={{
                  width: `${totalRecorded ? (g.total / totalRecorded) * 100 : 0}%`,
                  background: GROUP_COLORS[g.group], minWidth: 3,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {(g.total / totalRecorded) > 0.12 && (
                  <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {totalRecorded ? Math.round((g.total / totalRecorded) * 100) : 0}%
                  </span>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
            {byGroup.map((g) => (
              <div key={g.group} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <i style={{ width: 10, height: 10, borderRadius: 3, background: GROUP_COLORS[g.group], display: 'inline-block' }} />
                <span style={{ color: 'var(--text)' }}>{t(g.group)}</span>
                <span style={{ color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{taka(g.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="toggle-row">
        {VIEWS.map((v) => (
          <button key={v.key} className={view === v.key ? 'on' : ''} onClick={() => setView(v.key)}>
            {t(v.label)}
          </button>
        ))}
      </div>

      {view !== 'category' && (
        <div className="chip-select">
          <button type="button" className={!categoryFilter ? 'on' : ''} onClick={() => setCategoryFilter(null)}>
            {t('All categories')}
          </button>
          {byCategory.filter((c) => c.category !== 'Unitemized').map((c) => (
            <button key={c.category} type="button" className={categoryFilter === c.category ? 'on' : ''} onClick={() => setCategoryFilter(c.category)}>
              {t(c.category)}
            </button>
          ))}
        </div>
      )}

      {/* ---- By category ---- */}
      {view === 'category' && (
        <div className="card">
          <div className="card-title">{t('Expense by category')} — {t(data?.range || '')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {byCategory.map((r) => {
              const maxCat = Math.max(...byCategory.map((x) => x.total), 1);
              const isUnitemized = r.category === 'Unitemized';
              const barColor = isUnitemized ? 'var(--border2)' : GROUP_COLORS[groupFor(r.category)];
              const widthPct = Math.max(2, (r.total / maxCat) * 100);
              return (
                <div
                  key={r.category}
                  onClick={() => !isUnitemized && pickCategory(r.category)}
                  style={{ cursor: isUnitemized ? 'default' : 'pointer' }}
                  title={`${t(r.category)}: ${taka(r.total)}${r.count != null ? ` (${r.count} lines)` : ''}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: isUnitemized ? 'var(--text3)' : 'var(--text)', fontWeight: 600, fontStyle: isUnitemized ? 'italic' : 'normal' }}>
                      <i style={{ width: 8, height: 8, borderRadius: 2, background: barColor, display: 'inline-block', flex: 'none' }} />
                      {t(r.category)} {r.count != null && <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 11 }}>({num(r.count)})</span>}
                    </span>
                    <span style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{taka(r.total)}</span>
                  </div>
                  <div style={{ height: 20, maxHeight: 20, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${widthPct}%`, borderRadius: '4px 4px 4px 4px', background: barColor }} />
                  </div>
                </div>
              );
            })}
          </div>
          {byCategory.some((r) => r.category === 'Unitemized') && (
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 12, marginBottom: 0 }}>
              {t('"Unitemized" is expense from days saved with a single total instead of a bazar item list.')}
            </p>
          )}
          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8, marginBottom: 0 }}>
            {t('Tap a category to see its items. Dot color shows which group (cost of products / overhead / other) it belongs to.')}
          </p>
        </div>
      )}

      {/* ---- By item ---- */}
      {view === 'item' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 16px 0' }}>
            <input
              type="text"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder={t('Search items...')}
              style={{ width: '100%', marginBottom: 12 }}
            />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="denom-table" style={{ minWidth: 520 }}>
              <thead>
                <tr>
                  <th onClick={() => toggleItemSort('name')} style={{ cursor: 'pointer' }}>{t('Item')} {itemSort.key === 'name' ? (itemSort.dir === 'desc' ? '▼' : '▲') : ''}</th>
                  <th onClick={() => toggleItemSort('category')} style={{ cursor: 'pointer' }}>{t('Category')} {itemSort.key === 'category' ? (itemSort.dir === 'desc' ? '▼' : '▲') : ''}</th>
                  <th onClick={() => toggleItemSort('count')} style={{ cursor: 'pointer' }}>{t('Buys')} {itemSort.key === 'count' ? (itemSort.dir === 'desc' ? '▼' : '▲') : ''}</th>
                  <th onClick={() => toggleItemSort('total')} style={{ cursor: 'pointer' }}>{t('Total (৳)')} {itemSort.key === 'total' ? (itemSort.dir === 'desc' ? '▼' : '▲') : ''}</th>
                </tr>
              </thead>
              <tbody>
                {byItem.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text2)', padding: 20 }}>{t('No items match.')}</td></tr>
                )}
                {(() => {
                  const maxItemTotal = Math.max(...byItem.map((r) => r.total), 1);
                  return byItem.map((r) => (
                    <Fragment key={r.key}>
                      <tr onClick={() => setExpandedItem((e) => (e === r.key ? null : r.key))} style={{ cursor: 'pointer' }}>
                        <td style={{ fontWeight: 500 }}>{r.name}</td>
                        <td style={{ fontSize: 11.5, color: 'var(--text2)' }}>{t(r.category)}</td>
                        <td>{num(r.count)}{r.qtyLabel != null ? <span style={{ color: 'var(--text3)', fontSize: 11 }}> ({num(r.qtyLabel)} {r.unitLabel})</span> : null}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 40, height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden', flex: 'none' }}>
                              <div style={{ width: `${(r.total / maxItemTotal) * 100}%`, height: '100%', background: GROUP_COLORS[groupFor(r.category)], borderRadius: 3 }} />
                            </div>
                            <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>{taka(r.total)}</span>
                          </div>
                        </td>
                      </tr>
                      {expandedItem === r.key && (
                        <tr>
                          <td colSpan={4} style={{ background: 'var(--bg)', padding: '8px 12px' }}>
                            <table style={{ width: '100%', fontSize: 12 }}>
                              <tbody>
                                {scopedLines.filter((l) => l.category === r.category && l.name === r.name)
                                  .slice().sort((a, b) => b.date.localeCompare(a.date))
                                  .map((l, i) => (
                                    <tr key={i}>
                                      <td style={{ color: 'var(--text2)', padding: '3px 4px' }}>{dateNice(l.date)}</td>
                                      <td style={{ padding: '3px 4px' }}>{l.quantity != null ? `${num(l.quantity)} ${l.unit || ''}` : '—'}</td>
                                      <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{taka(l.lineTotal)}</td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- By day ---- */}
      {view === 'day' && (
        <>
          <div className="card">
            <div className="card-title">{t('Expense by day')} — {t(data?.range || '')}</div>
            <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
              {Object.keys(GROUP_COLORS).map((g) => (
                <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                  <i style={{ width: 9, height: 9, borderRadius: 2, background: GROUP_COLORS[g], display: 'inline-block' }} />
                  <span style={{ color: 'var(--text2)' }}>{t(g)}</span>
                </div>
              ))}
            </div>
            <div style={{ overflowX: 'auto' }}>
              {(() => {
                const chronological = byDay.slice().sort((a, b) => a.date.localeCompare(b.date));
                const maxDay = Math.max(...chronological.map((d) => d.recorded), 1);
                return (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 170, minWidth: chronological.length * 14 }}>
                    {chronological.map((d) => {
                      const barH = Math.max(3, (d.recorded / maxDay) * 140);
                      const tip = `${d.date}${d.isOffDay ? ' (off)' : ''} — ${Object.entries(d.groupTotals).filter(([, v]) => v > 0.5).map(([g, v]) => `${g}: ৳${Math.round(v)}`).join(', ') || 'no data'} — total ৳${Math.round(d.recorded)}`;
                      return (
                        <div
                          key={d.date}
                          title={tip}
                          onClick={() => { setExpandedDate((e) => (e === d.date ? null : d.date)); setDaySort('desc'); }}
                          style={{ flex: '1 0 8px', maxWidth: 26, display: 'flex', flexDirection: 'column-reverse', height: barH, cursor: 'pointer', borderRadius: '3px 3px 0 0', overflow: 'hidden', outline: expandedDate === d.date ? '2px solid var(--brand-green)' : 'none' }}
                        >
                          {Object.entries(d.groupTotals).filter(([, v]) => v > 0.5).map(([g, v]) => (
                            <div key={g} style={{ height: `${(v / (d.recorded || 1)) * 100}%`, background: GROUP_COLORS[g], width: '100%' }} />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10, marginBottom: 0 }}>{t('Tap a bar for that day\'s full item list.')}</p>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="denom-table" style={{ minWidth: 420 }}>
                <thead>
                  <tr>
                    <th onClick={() => setDaySort((d) => (d === 'desc' ? 'asc' : 'desc'))} style={{ cursor: 'pointer' }}>
                      {t('Date')} {daySort === 'desc' ? '▼' : '▲'}
                    </th>
                    <th>{t('Items')}</th>
                    <th>{t('Expense (৳)')}</th>
                  </tr>
                </thead>
                <tbody>
                  {byDay.map((d) => (
                    <Fragment key={d.date}>
                      <tr onClick={() => setExpandedDate((e) => (e === d.date ? null : d.date))} style={{ cursor: 'pointer' }}>
                        <td style={{ fontWeight: 500 }}>
                          {dateShort(d.date, { weekday: 'short' })}
                          {d.isOffDay && <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 6 }}>({t('off')})</span>}
                        </td>
                        <td>{num(d.lines.length)}</td>
                        <td style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>
                          {taka(d.recorded)}
                          {Math.abs(d.gap) > 0.5 && (
                            <div style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic' }}>
                              ({t('unitemized')} {taka(d.gap)})
                            </div>
                          )}
                        </td>
                      </tr>
                      {expandedDate === d.date && (
                        <tr>
                          <td colSpan={3} style={{ background: 'var(--bg)', padding: '8px 12px' }}>
                            {d.lines.length === 0 ? (
                              <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>{t('No itemized lines for this day.')}</p>
                            ) : (
                              <table style={{ width: '100%', fontSize: 12 }}>
                                <tbody>
                                  {d.lines.map((l, i) => (
                                    <tr key={i}>
                                      <td style={{ padding: '3px 4px' }}>{l.name}</td>
                                      <td style={{ padding: '3px 4px', fontSize: 11, color: 'var(--text2)' }}>{t(l.category)}</td>
                                      <td style={{ padding: '3px 4px' }}>{l.quantity != null ? `${num(l.quantity)} ${l.unit || ''}` : '—'}</td>
                                      <td style={{ padding: '3px 4px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{taka(l.lineTotal)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
