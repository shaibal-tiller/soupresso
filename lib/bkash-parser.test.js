import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBkashNotification } from './bkash-parser.js';

// Shape forwarded by the Message487 relay (a real notification, 2026-10-08).
const real = {
  event_id: 'd6e03140-7b92-4e37-a69c-246794dbc3b7',
  occurred_at: '2026-10-08T06:45:21.402Z',
  source: 'com.bKash.merchantapp',
  title: 'Payment Received',
  text: 'TK 1.0 received as payment from 0175XXX2535 (Payment Source: bKash)',
};

test('parses the real payment notification', () => {
  assert.deepEqual(parseBkashNotification(real), {
    ok: true,
    type: 'PAYMENT_RECEIVED',
    eventId: 'd6e03140-7b92-4e37-a69c-246794dbc3b7',
    amount: 1,
    sender: '0175XXX2535',
    senderOperator: 'bKash',
    senderLast4: '2535',
    occurredAt: '2026-10-08T06:45:21.402Z',
  });
});

test('amounts with thousands separators and decimals', () => {
  const r = parseBkashNotification({ ...real, text: 'TK 12,345.50 received as payment from 01912XX6789 (Payment Source: Nagad)' });
  assert.equal(r.ok, true);
  assert.equal(r.amount, 12345.5);
  assert.equal(r.senderOperator, 'Nagad');
  assert.equal(r.senderLast4, '6789');
});

test('anything that is not a payment-received text fails, never guesses', () => {
  for (const text of ['Cash Out TK 500 to 01XXXXXXXXX', 'Get 10% cashback today!', '', undefined]) {
    const r = parseBkashNotification({ ...real, text });
    assert.equal(r.ok, false);
    assert.ok(r.reason);
  }
});

test('missing event_id or a bad timestamp fails', () => {
  assert.equal(parseBkashNotification({ ...real, event_id: undefined }).ok, false);
  assert.equal(parseBkashNotification({ ...real, occurred_at: 'not a date' }).ok, false);
  assert.equal(parseBkashNotification(null).ok, false);
});

test('zero or unreadable amounts fail', () => {
  assert.equal(parseBkashNotification({ ...real, text: 'TK 0 received as payment from 0175XXX2535 (Payment Source: bKash)' }).ok, false);
});
