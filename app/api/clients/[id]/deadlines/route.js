import { getDb } from '@/lib/db';

function checkPin(request) {
  const pin = request.headers.get('x-pin') || '';
  const validPin = process.env.APP_PIN || '';
  if (!validPin) return true;
  return pin === validPin;
}

// PUT: 期限データを登録・更新（UPSERT）
export async function PUT(request, { params }) {
  if (!checkPin(request)) {
    return Response.json({ error: '認証エラー' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { nintei_end, long_end, short_end } = body;

    const sql = getDb();

    // clients テーブルに存在するか確認
    const existing = await sql`SELECT id, name FROM clients WHERE id = ${id}`;
    if (existing.length === 0) {
      return Response.json({ error: '利用者が見つかりません' }, { status: 404 });
    }

    // UPSERT: あれば更新、なければ挿入
    await sql`
      INSERT INTO kigen_deadlines (client_id, nintei_end, long_end, short_end)
      VALUES (
        ${id},
        ${nintei_end || null},
        ${long_end || null},
        ${short_end || null}
      )
      ON CONFLICT (client_id) DO UPDATE SET
        nintei_end = EXCLUDED.nintei_end,
        long_end = EXCLUDED.long_end,
        short_end = EXCLUDED.short_end,
        updated_at = NOW()
    `;

    // 更新後のデータを返す
    const result = await sql`
      SELECT
        c.id,
        c.name,
        c.care_manager,
        kd.nintei_end,
        kd.long_end,
        kd.short_end,
        kd.updated_at AS deadline_updated_at
      FROM clients c
      LEFT JOIN kigen_deadlines kd ON kd.client_id = c.id
      WHERE c.id = ${id}
    `;

    return Response.json({ client: result[0] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: 期限データを削除
export async function DELETE(request, { params }) {
  if (!checkPin(request)) {
    return Response.json({ error: '認証エラー' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const sql = getDb();
    await sql`DELETE FROM kigen_deadlines WHERE client_id = ${id}`;
    await sql`DELETE FROM kigen_calendar_events WHERE client_id = ${id}`;
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
