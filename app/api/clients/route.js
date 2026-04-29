import { getDb } from '@/lib/db';

function checkPin(request) {
  const pin = request.headers.get('x-pin') || '';
  const validPin = process.env.APP_PIN || '';
  if (!validPin) return true;
  return pin === validPin;
}

// GET: 利用者一覧（careplan-delivery の clients + care_managers + kigen_deadlines）
export async function GET(request) {
  if (!checkPin(request)) {
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
        kd.updated_at AS deadline_updated_at
      FROM clients c
      LEFT JOIN kigen_deadlines kd ON kd.client_id = c.id
      ORDER BY c.name
    `;

    return Response.json({ clients });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
