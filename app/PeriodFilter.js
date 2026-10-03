'use client';

import { useLang } from './LangProvider';
import DatePicker from './DatePicker';
import { todayStr } from '@/lib/dates';
import { PRESETS, DATA_START, stepPeriod, canStepForward, resolvePeriod } from '@/lib/periods';

// The same period filter as the Expenses page (7 / 14 / 30 days, This month,
// All time, Custom range) plus Week and Month steppers (‹ ›) so any earlier
// week or month can be walked back to. Controlled: parent owns `value` (see
// lib/periods.js) and gets the resolved {from, to} via resolvePeriod().
export default function PeriodFilter({ value, onChange, showWeek = true, showMonth = true }) {
  const { t, digits, dateShort } = useLang();
  const today = todayStr();
  const range = resolvePeriod(value, today);
  const pill = { fontSize: 12, padding: '7px 10px' };

  function monthLabel(anchor) {
    const d = new Date(anchor.slice(0, 7) + '-15T12:00:00');
    return digits(d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div className="toggle-row" style={{ marginBottom: 6, flexWrap: 'wrap' }}>
        {PRESETS.map((p) => (
          <button key={p.key} className={value.mode === 'preset' && value.preset === p.key ? 'on' : ''}
            onClick={() => onChange({ ...value, mode: 'preset', preset: p.key })} style={pill}>
            {t(p.label)}
          </button>
        ))}
        <button className={value.mode === 'custom' ? 'on' : ''}
          onClick={() => onChange({ ...value, mode: 'custom', from: range.from, to: range.to })} style={pill}>
          {t('Custom range')}
        </button>
        {showWeek && (
          <button className={value.mode === 'week' ? 'on' : ''}
            onClick={() => onChange({ ...value, mode: 'week', anchor: range.to > today ? today : range.to })} style={pill}>
            {t('Week')}
          </button>
        )}
        {showMonth && (
          <button className={value.mode === 'month' ? 'on' : ''}
            onClick={() => onChange({ ...value, mode: 'month', anchor: range.to > today ? today : range.to })} style={pill}>
            📅 {t('Month')}
          </button>
        )}
      </div>

      {(value.mode === 'week' || value.mode === 'month') && (
        <div className="day-nav">
          <button onClick={() => onChange(stepPeriod(value, -1, today))} aria-label={t('Previous')}>‹</button>
          <span style={{ flex: 1, textAlign: 'center', fontWeight: 600, fontSize: 14 }}>
            {value.mode === 'week' ? `${dateShort(range.from)} – ${dateShort(range.to)}` : monthLabel(value.anchor)}
          </span>
          <button onClick={() => onChange(stepPeriod(value, 1, today))} disabled={!canStepForward(value, today)} aria-label={t('Next')}>›</button>
        </div>
      )}

      {value.mode === 'custom' && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: 0, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>{t('From')}</label>
            <DatePicker value={value.from} onChange={(d) => onChange({ ...value, from: d })} minDate={DATA_START} />
          </div>
          <span style={{ color: 'var(--text3)', marginTop: 14 }}>→</span>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>{t('To')}</label>
            <DatePicker value={value.to} onChange={(d) => onChange({ ...value, to: d })} minDate={value.from} />
          </div>
        </div>
      )}
    </div>
  );
}
