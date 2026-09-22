import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/tasks/:id -> the task plus its full comment/status history.
export async function GET(request, { params }) {
  const id = Number(params.id);
  try {
    const [taskRes, commentsRes] = await Promise.all([
      query(`SELECT * FROM tasks WHERE id = $1`, [id]),
      query(`SELECT * FROM task_comments WHERE task_id = $1 ORDER BY created_at ASC`, [id]),
    ]);
    if (!taskRes.rows.length) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    return NextResponse.json({ task: taskRes.rows[0], comments: commentsRes.rows });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/tasks/:id { status?, assignedTo?, title?, description?, dueDate?, comment? }
// Any provided field is updated; if `status` changes or a `comment` is given,
// a row is logged to task_comments so there's a visible history.
export async function PATCH(request, { params }) {
  const id = Number(params.id);
  try {
    const body = await request.json();
    const existingRes = await query(`SELECT * FROM tasks WHERE id = $1`, [id]);
    if (!existingRes.rows.length) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    const existing = existingRes.rows[0];

    const next = {
      title: body.title !== undefined ? body.title : existing.title,
      description: body.description !== undefined ? body.description : existing.description,
      assigned_to: body.assignedTo !== undefined ? body.assignedTo : existing.assigned_to,
      due_date: body.dueDate !== undefined ? body.dueDate : existing.due_date,
      status: body.status !== undefined ? body.status : existing.status,
    };
    if (!['pending', 'done', 'cancelled'].includes(next.status)) {
      return NextResponse.json({ error: 'status must be pending, done, or cancelled' }, { status: 400 });
    }

    const { rows } = await query(
      `UPDATE tasks SET title=$1, description=$2, assigned_to=$3, due_date=$4, status=$5, updated_at=now()
       WHERE id = $6 RETURNING *`,
      [next.title, next.description, next.assigned_to, next.due_date, next.status, id]
    );

    const statusChanged = next.status !== existing.status;
    if (statusChanged || body.comment) {
      const note = body.comment
        ? body.comment
        : `Status changed to "${next.status}"`;
      await query(
        `INSERT INTO task_comments (task_id, comment, status_at) VALUES ($1, $2, $3)`,
        [id, note, next.status]
      );
    }

    return NextResponse.json({ task: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/tasks/:id -> remove a task (and its comments, via cascade).
export async function DELETE(request, { params }) {
  const id = Number(params.id);
  try {
    await query(`DELETE FROM tasks WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
