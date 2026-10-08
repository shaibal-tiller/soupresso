// Turns one relay notification (Message487 JSON: event_id, occurred_at, title, text, …) into a payment.
// Pure — no I/O. Only formats actually seen are recognised; anything else returns { ok: false, reason }
// so the caller can keep it as an unprocessed/failed notification instead of inventing financial data.
//   "TK 1.0 received as payment from 0175XXX2535 (Payment Source: bKash)"
const PAYMENT_RECEIVED = /^\s*TK\s+([\d,]+(?:\.\d+)?)\s+received as payment from\s+(\S+)\s+\(Payment Source:\s*([^)]+?)\s*\)/i;

const MERCHANT_APP = 'com.bKash.merchantapp';

const fail = (reason) => ({ ok: false, reason });

export function parseBkashNotification(notification) {
  if (!notification || typeof notification !== 'object') return fail('no notification');
  // The relay is meant to forward only the merchant app; never trust text from any other app.
  if (notification.source !== MERCHANT_APP) return fail('not from the bKash Merchant app');
  if (typeof notification.event_id !== 'string' || !notification.event_id) return fail('missing event_id');
  const when = new Date(notification.occurred_at);
  if (!notification.occurred_at || Number.isNaN(when.getTime())) return fail('missing or invalid occurred_at');

  const m = PAYMENT_RECEIVED.exec(String(notification.text ?? ''));
  if (!m) return fail('text is not a payment-received notification');
  const amount = Number(m[1].replace(/,/g, ''));
  if (!(amount > 0)) return fail('amount is not a positive number');
  const sender = m[2];
  const last4 = /(\d{4})$/.exec(sender);

  return {
    ok: true,
    type: 'PAYMENT_RECEIVED',
    eventId: notification.event_id,
    amount,
    sender,
    senderOperator: m[3],
    senderLast4: last4 ? last4[1] : null,
    occurredAt: when.toISOString(),
  };
}
