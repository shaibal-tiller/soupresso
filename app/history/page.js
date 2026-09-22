'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AppShell from '../AppShell';
import { useLang } from '../LangProvider';
import DatePicker from '../DatePicker';
import { todayStr, shiftDateStr, startOfWeekStr, endOfWeekStr, startOfMonthStr, endOfMonthStr } from '@/lib/dates';
import { cachedFetchJson, peekCache, prefetchJson, runWhenIdle } from '@/lib/clientCache';

function entryUrl(d) {
  return `/api/entries?date=${d}`;
}

export default function HistoryPage() {
  const { t, taka, dateLong, dateNice } = useLang();
  const [date, setDate] = useState(todayStr());
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const receiptRef = useRef(null);

  const [showReport, setShowReport] = useState(false);
  const [reportRange, setReportRange] = useState('month');
  const [reportFrom, setReportFrom] = useState(() => startOfMonthStr(todayStr()));
  const [reportTo, setReportTo] = useState(() => endOfMonthStr(todayStr()));
  const [reportDownloading, setReportDownloading] = useState(false);
  const [reportError, setReportError] = useState(null);

  const requestRef = useRef(0);

  const load = useCallback(async (d) => {
    const url = entryUrl(d);
    const requestId = ++requestRef.current;
    const cached = peekCache(url);
    if (cached) {
      // Instant paint from cache while we quietly confirm it's still current.
      if (cached.entry) { setEntry(cached.entry); setNotFound(false); } else { setEntry(null); setNotFound(true); }
    } else {
      setLoading(true);
    }
    try {
      const data = await cachedFetchJson(url);
      if (requestRef.current !== requestId) return; // a newer date was picked meanwhile
      if (data.entry) { setEntry(data.entry); setNotFound(false); } else { setEntry(null); setNotFound(true); }
    } catch {
      if (requestRef.current !== requestId) return;
      setEntry(null); setNotFound(true);
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  // Idle-prefetch neighboring days so ‹ / › feel instant after the first visit.
  useEffect(() => {
    if (loading) return;
    runWhenIdle(() => {
      prefetchJson(entryUrl(shiftDateStr(date, -1)));
      prefetchJson(entryUrl(shiftDateStr(date, 1)));
    });
  }, [date, loading]);

  async function handleDownload() {
    if (!receiptRef.current) return;
    setDownloading(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: '#FBF6EC',
        scale: 2,
        ignoreElements: (el) => el.classList?.contains('no-print'),
      });
      const weekday = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
      const filename = `Soupresso-hishab-${weekday}-${date}.png`;
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    } finally {
      setDownloading(false);
    }
  }

  function openReportModal() {
    setReportError(null);
    selectRange('month');
    setShowReport(true);
  }

  function selectRange(range) {
    setReportRange(range);
    if (range === 'week') {
      setReportFrom(startOfWeekStr(date));
      setReportTo(endOfWeekStr(date));
    } else if (range === 'month') {
      setReportFrom(startOfMonthStr(date));
      setReportTo(endOfMonthStr(date));
    }
  }

  async function handleReportDownload() {
    setReportDownloading(true);
    setReportError(null);
    try {
      const res = await fetch(`/api/reports/excel?from=${reportFrom}&to=${reportTo}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('Failed to generate report.'));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Soupresso-Sales-Report_${reportFrom}_to_${reportTo}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowReport(false);
    } catch (e) {
      setReportError(e.message || t('Failed to generate report.'));
    } finally {
      setReportDownloading(false);
    }
  }

  return (
    <AppShell>
      <div className="day-nav no-print">
        <button onClick={() => setDate(shiftDateStr(date, -1))}>‹</button>
        <DatePicker value={date} onChange={setDate} />
        <button onClick={() => setDate(shiftDateStr(date, 1))}>›</button>
      </div>

      <button type="button" className="btn secondary block no-print" style={{ marginBottom: 14 }} onClick={openReportModal}>
        ⬇ {t('Download Sales Report (Excel)')}
      </button>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text2)' }}>{t('Loading…')}</div>
      ) : notFound ? (
        <div className="card" style={{ textAlign: 'center', padding: 30 }}>
          <p style={{ color: 'var(--text2)', marginBottom: 12 }}>{t('No entry for this day yet.')}</p>
          <a href="/entry" className="btn" style={{ display: 'inline-flex' }}>{t('Go to Daily Entry')}</a>
        </div>
      ) : entry.is_off_day ? (
        <div className="receipt-card" ref={receiptRef}>
          <div className="receipt-header">
            <img src="/logo.jpg" alt="Soupresso" className="receipt-logo" />
            <div>
              <div className="receipt-brand">Soupresso</div>
              <div className="receipt-subtitle">{t('Daily Cash Receipt')}</div>
            </div>
          </div>
          <div className="receipt-date">{dateLong(date)}</div>
          <div className="receipt-divider" />
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🚫</div>
            <h3 style={{ color: 'var(--text)', marginBottom: 4 }}>{t('Shop Closed')}</h3>
            {entry.notes && <p style={{ fontSize: 13, color: 'var(--text2)' }}>{entry.notes}</p>}
          </div>
          <div className="receipt-footer">
            <button className="btn secondary no-print" style={{ flex: 1 }} onClick={handleDownload} disabled={downloading}>
              {downloading ? t('Preparing…') : `⬇ ${t('Download')}`}
            </button>
            <a href={`/entry?date=${date}`} className="btn no-print" style={{ flex: 1, justifyContent: 'center' }}>✎ {t('Edit')}</a>
          </div>
        </div>
      ) : (
        <div className="receipt-card" ref={receiptRef}>
          <div className="receipt-header">
            <img src="/logo.jpg" alt="Soupresso" className="receipt-logo" />
            <div>
              <div className="receipt-brand">Soupresso</div>
              <div className="receipt-subtitle">{t('Daily Cash Receipt')}</div>
            </div>
          </div>
          <div className="receipt-date">{dateLong(date)}</div>
          <div className="receipt-divider" />

          <div className="receipt-row highlight green">
            <span className="receipt-label">{t('Total Sales')}</span>
            <span className="receipt-value">{taka(entry.total_sales)}</span>
          </div>
          <div className="receipt-row highlight red">
            <span className="receipt-label">{t('Expense (Bazar)')}</span>
            <span className="receipt-value">{taka(entry.bazar_actual_cost)}</span>
          </div>

          <div className="receipt-divider dashed" />

          <div className="receipt-row">
            <span className="receipt-label">{t('Next day bazar advance')}</span>
            <span className="receipt-value">{taka(entry.next_bazar_advance)}</span>
          </div>
          <div className="receipt-row">
            <span className="receipt-label">{t('Bhangti in box')}</span>
            <span className="receipt-value">{taka(entry.next_bhangti)}</span>
          </div>

          <div className="receipt-divider" />

          <div className="receipt-row highlight big">
            <span className="receipt-label">{t('Cash Taken Home')}</span>
            <span className={`receipt-value ${Number(entry.cash_taken_home) >= 0 ? 'green' : 'red'}`}>
              {taka(Number(entry.cash_taken_home))}
            </span>
          </div>

          {entry.notes && (
            <>
              <div className="receipt-divider dashed" />
              <div className="receipt-note">
                <span className="note-icon">📝</span>
                <span>{entry.notes}</span>
              </div>
            </>
          )}

          {entry.closed_by && entry.closed_by.length > 0 && (
            <>
              <div className="receipt-divider dashed" />
              <div className="receipt-closers">
                <div className="receipt-closers-label">{t("Closed by")}</div>
                <div className="receipt-closers-grid">
                  {entry.closed_by.map((name) => (
                    <span key={name} className="receipt-closers-name">{name}</span>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="receipt-footer">
            <button className="btn secondary no-print" style={{ flex: 1 }} onClick={handleDownload} disabled={downloading}>
              {downloading ? t('Preparing…') : `⬇ ${t('Download')}`}
            </button>
            <a href={`/entry?date=${date}`} className="btn no-print" style={{ flex: 1, justifyContent: 'center' }}>✎ {t('Edit')}</a>
          </div>
        </div>
      )}

      {showReport && (
        <div className="modal-overlay no-print" onClick={() => setShowReport(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{t('Download Sales Report')}</h3>
            <div className="toggle-row" style={{ marginBottom: 14 }}>
              <button className={reportRange === 'week' ? 'on' : ''} onClick={() => selectRange('week')}>{t('This Week')}</button>
              <button className={reportRange === 'month' ? 'on' : ''} onClick={() => selectRange('month')}>{t('This Month')}</button>
              <button className={reportRange === 'custom' ? 'on' : ''} onClick={() => setReportRange('custom')}>{t('Custom')}</button>
            </div>
            {reportRange === 'custom' && (
              <div style={{ display: 'flex', gap: 14, marginBottom: 14, justifyContent: 'center' }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{t('From')}</label>
                  <DatePicker value={reportFrom} onChange={setReportFrom} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{t('To')}</label>
                  <DatePicker value={reportTo} onChange={setReportTo} />
                </div>
              </div>
            )}
            <p style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 16 }}>
              {dateNice(reportFrom)} – {dateNice(reportTo)}
            </p>
            {reportError && <div className="status-msg err" style={{ marginBottom: 12 }}>{reportError}</div>}
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setShowReport(false)}>{t('Cancel')}</button>
              <button className="btn" onClick={handleReportDownload} disabled={reportDownloading || reportFrom > reportTo}>
                {reportDownloading ? t('Preparing…') : `⬇ ${t('Download Excel')}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
