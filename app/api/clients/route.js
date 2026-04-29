import { getDb } from '@/lib/db';

function checkPin(request) {
  const pin = request.headers.get('x-pin') || '';
  const accessPin = process.env.ACCESS_PIN || process.env.APP_PIN || '';
  const adminPin = process.env.ADMIN_PIN || '';
  if (!accessPin && !adminPin) return { valid: true, role: 'user' };
  if (adminPin && pin === adminPin) return { valid: true, role: 'admin' };
  if (pin === accessPin) return { valid: true, role: 'user' };
  return { valid: false, role: null };
}

// GET: 利用者一覧（careplan-delivery の clients + care_managers + kigen_deadlines）
export async function GET(request) {
  const auth = checkPin(request);
  if (!auth.valid) {
    return Response.json({ error: '認証エラー' }, { status: 401 });
  }

  try {
    const sql = getDb();
    const clients = await sql`
      SELECT
        c.id,
        c.name,
        c.care_manager,
        kd.nintei_end,
        kd.long_end,
        kd.short_end,
        kd.updated_at AS deadline_updated_at,
        COALESCE(cm.calendar_sync, false) AS calendar_sync
      FROM clients c
      LEFT JOIN kigen_deadlines kd ON kd.client_id = c.id
      LEFT JOIN care_managers cm ON cm.name = c.care_manager AND cm.hidden = false
      ORDER BY c.name
    `;

    return Response.json({ clients, role: auth.role });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// POST: 利用者登録（clients テーブル + kigen_deadlines テーブル）
export async function POST(request) {
  const auth = checkPin(request);
  if (!auth.valid) {
    return Response.json({ error: '認証エラー' }, { status: 401 });
  }

  try {
    const sql = getDb();
    const { name, care_manager, nintei_end, long_end, short_end } = await request.json();

    if (!name || !name.trim()) {
      return Response.json({ error: '利用者名は必須です' }, { status: 400 });
    }
    if (!care_manager || !care_manager.trim()) {
      return Response.json({ error: '担当ケアマネジャーは必須です' }, { status: 400 });
    }

    // clients テーブルに登録
    const r = await sql`
      INSERT INTO clients (name, care_manager)
      VALUES (${name.trim()}, ${care_manager.trim()})
      RETURNING *
    `;
    const newClient = r[0];

    // 期限が1つでも入力されていれば kigen_deadlines にも登録
    if (nintei_end || long_end || short_end) {
      await sql`
        INSERT INTO kigen_deadlines (client_id, nintei_end, long_end, short_end)
        VALUES (
          ${newClient.id},
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
    }

    // 登録後のデータを返す（JOIN付き）
    const result = await sql`
      SELECT
        c.id,
        c.name,
        c.care_manager,
        kd.nintei_end,
        kd.long_end,
        kd.short_end,
        kd.updated_at AS deadline_updated_at,
        COALESCE(cm.calendar_sync, false) AS calendar_sync
      FROM clients c
      LEFT JOIN kigen_deadlines kd ON kd.client_id = c.id
      LEFT JOIN care_managers cm ON cm.name = c.care_manager AND cm.hidden = false
      WHERE c.id = ${newClient.id}
    `;

    return Response.json({ client: result[0] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
