'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '../AppShell';
import { todayStr, shiftDateStr } from '@/lib/dates';
import { useLang } from '../LangProvider';
import NumberInput from '../NumberInput';

export default function ProductsPage() {
  const { t, num, digits, dateDisplay } = useLang();
  const [tab, setTab] = useState('sales'); // 'sales' | 'menu'
  const [date, setDate] = useState(todayStr());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  // menu edit form
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');

  const loadSales = useCallback(async (d) => {
    setLoading(true);
    const res = await fetch(`/api/daily-sales?date=${d}`);
    const data = await res.json();
    setItems(data.items || []);
    setLoading(false);
  }, []);

  const loadMenu = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/products');
    const data = await res.json();
    setItems(data.items || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 'sales') loadSales(date);
    else loadMenu();
  }, [tab, date, loadSales, loadMenu]);

  async function saveSales() {
    setSaving(true);
    setMsg(null);
    const res = await fetch('/api/daily-sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        quantities: items.map((i) => ({ itemId: i.id, quantity: i.quantity })),
      }),
    });
    setSaving(false);
    setMsg(res.ok ? { type: 'ok', text: t('Saved.') } : { type: 'err', text: t('Save failed.') });
  }

  async function addMenuItem() {
    if (!newName || !newPrice) return;
    setSaving(true);
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, price: Number(newPrice) }),
    });
    setNewName('');
    setNewPrice('');
    setSaving(false);
    loadMenu();
  }

  async function updatePrice(item, newPrice) {
    if (newPrice === '' || isNaN(Number(newPrice))) return;
    setSaving(true);
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, name: item.name, price: Number(newPrice), active: item.active, sortOrder: item.sort_order }),
    });
    setSaving(false);
    loadMenu();
  }

  async function toggleActive(item) {
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, name: item.name, price: item.price, active: !item.active, sortOrder: item.sort_order }),
    });
    loadMenu();
  }

  const totalUnits = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const totalValue = items.reduce((s, i) => s + (Number(i.quantity) || 0) * Number(i.price), 0);

  return (
    <AppShell>
      <div className="toggle-row">
        <button className={tab === 'sales' ? 'on' : ''} onClick={() => setTab('sales')}>{t('Daily quantities')}</button>
        <button className={tab === 'menu' ? 'on' : ''} onClick={() => setTab('menu')}>{t('Manage menu')}</button>
      </div>

      {tab === 'sales' ? (
        <>
          <div className="day-nav">
            <button onClick={() => setDate(shiftDateStr(date, -1))}>‹</button>
            <div className="date-display">{dateDisplay(date)}</div>
            <button onClick={() => setDate(shiftDateStr(date, 1))}>›</button>
          </div>

          <div className="card">
            <div className="card-title">{t('How many sold today')}</div>
            {loading ? (
              <p style={{ color: 'var(--text2)' }}>{t('Loading…')}</p>
            ) : items.length === 0 ? (
              <p style={{ color: 'var(--text2)', fontSize: 13 }}>{t('No menu items yet — add some under "Manage menu".')}</p>
            ) : (
              <table className="denom-table">
                <thead><tr><th>{t('Item')}</th><th>{t('Qty')}</th><th>{t('Value')}</th></tr></thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id}>
                      <td>{item.name}<div style={{ fontSize: 11, color: 'var(--text3)' }}>{'৳'}{digits(String(Number(item.price)))}{t('/unit')}</div></td>
                      <td>
                        <NumberInput
                          value={item.quantity} min={0}
                          onValueChange={(n) => {
                            const next = [...items];
                            next[idx] = { ...item, quantity: Math.max(0, n ?? 0) };
                            setItems(next);
                          }}
                        />
                      </td>
                      <td style={{ fontFamily: 'var(--mono)' }}>৳{num(item.quantity * Number(item.price))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {items.length > 0 && (
              <>
                <div className="kpi-row" style={{ marginTop: 12 }}>
                  <div className="kpi"><div className="kpi-label">{t('Total units sold')}</div><div className="kpi-value">{num(totalUnits)}</div></div>
                  <div className="kpi"><div className="kpi-label">{t('Menu value')}</div><div className="kpi-value">৳{num(totalValue)}</div></div>
                </div>
                {msg && <div className={`status-msg ${msg.type}`}>{msg.text}</div>}
                <button className="btn block" onClick={saveSales} disabled={saving}>{saving ? t('Saving…') : t('Save quantities')}</button>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="card">
          <div className="card-title">{t('Menu items')}</div>
          {loading ? (
            <p style={{ color: 'var(--text2)' }}>{t('Loading…')}</p>
          ) : (
            <>
              <table className="denom-table">
                <thead><tr><th>{t('Item')}</th><th>{t('Price (৳)')}</th><th>{t('Active')}</th></tr></thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} style={{ opacity: item.active ? 1 : 0.5 }}>
                      <td>{item.name}</td>
                      <td>
                        <NumberInput
                          value={item.price} min={0} className=""
                          style={{ width: 80 }}
                          onValueChange={() => {}}
                          onBlur={(n) => { if (n != null && n !== Number(item.price)) updatePrice(item, n); }}
                        />
                      </td>
                      <td>
                        <button className="btn secondary" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => toggleActive(item)}>
                          {item.active ? t('Hide') : t('Show')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8 }}>{t('Edit a price and click away from the field to save it.')}</p>
            </>
          )}

          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div className="card-title">{t('Add a new item')}</div>
            <div className="field">
              <label>{t('Name')}</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('e.g. Chicken Roll')} />
            </div>
            <div className="field">
              <label>{t('Price (৳)')}</label>
              <NumberInput value={newPrice} min={0} placeholder={t('e.g. 50')} onValueChange={(n) => setNewPrice(n == null ? '' : String(n))} />
            </div>
            <button className="btn block" onClick={addMenuItem} disabled={saving || !newName || !newPrice}>{t('Add item')}</button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
