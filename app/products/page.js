'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '../AppShell';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function ProductsPage() {
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
    setMsg(res.ok ? { type: 'ok', text: 'Saved.' } : { type: 'err', text: 'Save failed.' });
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
        <button className={tab === 'sales' ? 'on' : ''} onClick={() => setTab('sales')}>Daily quantities</button>
        <button className={tab === 'menu' ? 'on' : ''} onClick={() => setTab('menu')}>Manage menu</button>
      </div>

      {tab === 'sales' ? (
        <>
          <div className="day-nav">
            <button onClick={() => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toISOString().slice(0, 10)); }}>‹</button>
            <div className="date-display">{new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
            <button onClick={() => { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d.toISOString().slice(0, 10)); }}>›</button>
          </div>

          <div className="card">
            <div className="card-title">How many sold today</div>
            {loading ? (
              <p style={{ color: 'var(--text2)' }}>Loading…</p>
            ) : items.length === 0 ? (
              <p style={{ color: 'var(--text2)', fontSize: 13 }}>No menu items yet — add some under "Manage menu".</p>
            ) : (
              <table className="denom-table">
                <thead><tr><th>Item</th><th>Qty</th><th>Value</th></tr></thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id}>
                      <td>{item.name}<div style={{ fontSize: 11, color: 'var(--text3)' }}>৳{Number(item.price)}/unit</div></td>
                      <td>
                        <input
                          type="number" min="0" value={item.quantity}
                          onChange={(e) => {
                            const next = [...items];
                            next[idx] = { ...item, quantity: Math.max(0, Number(e.target.value) || 0) };
                            setItems(next);
                          }}
                        />
                      </td>
                      <td style={{ fontFamily: 'var(--mono)' }}>৳{(item.quantity * Number(item.price)).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {items.length > 0 && (
              <>
                <div className="kpi-row" style={{ marginTop: 12 }}>
                  <div className="kpi"><div className="kpi-label">Total units sold</div><div className="kpi-value">{totalUnits}</div></div>
                  <div className="kpi"><div className="kpi-label">Menu value</div><div className="kpi-value">৳{totalValue.toLocaleString()}</div></div>
                </div>
                {msg && <div className={`status-msg ${msg.type}`}>{msg.text}</div>}
                <button className="btn block" onClick={saveSales} disabled={saving}>{saving ? 'Saving…' : 'Save quantities'}</button>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="card">
          <div className="card-title">Menu items</div>
          {loading ? (
            <p style={{ color: 'var(--text2)' }}>Loading…</p>
          ) : (
            <>
              <table className="denom-table">
                <thead><tr><th>Item</th><th>Price (৳)</th><th>Active</th></tr></thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} style={{ opacity: item.active ? 1 : 0.5 }}>
                      <td>{item.name}</td>
                      <td>
                        <input
                          type="number" min="0" defaultValue={item.price}
                          style={{ width: 80 }}
                          onBlur={(e) => { if (Number(e.target.value) !== Number(item.price)) updatePrice(item, e.target.value); }}
                        />
                      </td>
                      <td>
                        <button className="btn secondary" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => toggleActive(item)}>
                          {item.active ? 'Hide' : 'Show'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8 }}>Edit a price and click away from the field to save it.</p>
            </>
          )}

          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div className="card-title">Add a new item</div>
            <div className="field">
              <label>Name</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Chicken Roll" />
            </div>
            <div className="field">
              <label>Price (৳)</label>
              <input type="number" min="0" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="e.g. 50" />
            </div>
            <button className="btn block" onClick={addMenuItem} disabled={saving || !newName || !newPrice}>Add item</button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
