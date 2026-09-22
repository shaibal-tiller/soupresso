import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/tasks?status=pending|done|cancelled&from=YYYY-MM-DD&to=YYYY-MM-DD
// All params optional — no params returns every task, newest first.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const clauses = [];
  const params = [];
  if (status) { params.push(status); clauses.push(`status = $${params.length}`); }
  if (from) { params.push(from); clauses.push(`due_date >= $${params.length}`); }
  if (to) { params.push(to); clauses.push(`due_date <= $${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  try {
    const { rows } = await query(
      `SELECT * FROM tasks ${where} ORDER BY
         CASE status WHEN 'pending' THEN 0 WHEN 'done' THEN 1 ELSE 2 END,
         due_date ASC NULLS LAST, created_at DESC`,
      params
    );
    return NextResponse.json({ tasks: rows });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/tasks { title, description?, assignedTo?, dueDate? } -> create.
export async function POST(request) {
  try {
    const body = await request.json();
    const title = (body.title || '').trim();
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

    const { rows } = await query(
      `INSERT INTO tasks (title, description, assigned_to, due_date)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [title, body.description || null, body.assignedTo || null, body.dueDate || null]
    );
    return NextResponse.json({ task: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
