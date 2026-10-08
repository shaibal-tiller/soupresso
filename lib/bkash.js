// bKash relay → ledger rows. I/O around the pure parser in bkash-parser.js.
import { getPool } from './db.js';
import { parseBkashNotification } from './bkash-parser.js';

// Is this relay event already a transaction? (The unique index on event_id is the real guard; see createBkashTransaction.)
export async function isDuplicateTransaction(eventId) {
  const { rowCount } = await getPool().query(`SELECT 1 FROM bkash_transactions WHERE event_id = $1`, [eventId]);
  return rowCount > 0;
}

// Automatically captured payment (source = notification). Returns { created: false } when the event already exists.
export async function createBkashTransaction(parsed, notificationId) {
  const { rows } = await getPool().query(
    `INSERT INTO bkash_transactions (event_id, type, amount, occurred_at, sender, sender_operator, sender_last4, notification_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (event_id) DO NOTHING RETURNING id`,
    [parsed.eventId, parsed.type, parsed.amount, parsed.occurredAt, parsed.sender, parsed.senderOperator, parsed.senderLast4, notificationId]
  );
  return rows.length ? { created: true, id: rows[0].id } : { created: false };
}

// Parse a stored notification and record the outcome on it:
// parsed (new transaction) · ignored (duplicate event) · failed (unrecognised — nothing created).
export async function processBkashNotification(notificationId, payload) {
  const pool = getPool();
  const parsed = parseBkashNotification(payload);
  let status, error = null;
  if (!parsed.ok) {
    status = 'failed'; error = parsed.reason;
  } else if ((await createBkashTransaction(parsed, notificationId)).created) {
    status = 'parsed';
  } else {
    status = 'ignored'; error = 'duplicate event';
  }
  await pool.query(`UPDATE bkash_notifications SET parse_status = $2, parse_error = $3 WHERE id = $1`, [notificationId, status, error]);
  return status;
}
