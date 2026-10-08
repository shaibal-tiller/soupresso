// Reads everything the account balance math needs (accounts, sales, transfers, corrections, bKash relay payments).
// Shared by the payment-accounts API routes; the math itself is in accounts.js.
export const D = (col) => `to_char(${col}, 'YYYY-MM-DD')`;
const DHAKA_DAY = `to_char(occurred_at AT TIME ZONE 'Asia/Dhaka', 'YYYY-MM-DD')`;

export async function loadAll(client) {
  const [accounts, sales, transfers, adjustments, relay] = await Promise.all([
    client.query(`SELECT id, name, kind, starting_balance::float AS starting_balance, ${D('starting_date')} AS starting_date, ${D('relay_from')} AS relay_from, active, sort_order
                    FROM payment_accounts ORDER BY sort_order ASC, id ASC`),
    client.query(`SELECT account_id, ${D('entry_date')} AS entry_date, amount::float AS amount FROM account_sales`),
    client.query(`SELECT id, from_account_id, to_account_id, ${D('transfer_date')} AS transfer_date, amount::float AS amount, charge::float AS charge, note, created_at FROM account_transfers`),
    client.query(`SELECT id, account_id, ${D('adj_date')} AS adj_date, amount::float AS amount, note, created_at FROM account_adjustments`),
    client.query(`SELECT id, ${DHAKA_DAY} AS date, to_char(occurred_at AT TIME ZONE 'Asia/Dhaka', 'HH12:MI AM') AS time, occurred_at,
                         amount::float AS amount, sender, sender_operator, source, trx_id, balance_after::float AS balance_after, time_known FROM bkash_transactions`),
  ]);
  return { accounts: accounts.rows, data: { sales: sales.rows, transfers: transfers.rows, adjustments: adjustments.rows, relay: relay.rows } };
}
