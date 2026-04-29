import { getDb } from '@/lib/db';

function checkPin(request) {
  const pin = request.headers.get('x-pin') || '';
  const validPin = process.env.APP_PIN || '';
  if (!validPin) return true;
  return pin === validPin;
}

// GET: ケアマネ一覧（calendar_sync含む）
export async function GET(request) {
  if (!checkPin(request)) {
    return Response.json({ error: '認証エラー' }, { status: 401 });
  }

  try {
    const sql = getDb();
    const managers = await sql`
      SELECT id, name, COALESCE(calendar_sync, false) AS calendar_sync
      FROM care_managers
      WHERE hidden = false
      ORDER BY name
    `;
    return Response.json({ managers });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// PUT: ケアマネのcalendar_sync設定を更新
export async function PUT(request) {
  if (!checkPin(request)) {
    return Response.json({ error: '認証エラー' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { manager_name, calendar_sync } = body;

    if (!manager_name || typeof calendar_sync !== 'boolean') {
      return Response.json({ error: 'manager_nameとcalendar_sync(boolean)が必要です' }, { status: 400 });
    }

    const sql = getDb();
    await sql`
      UPDATE care_managers
      SET calendar_sync = ${calendar_sync}
      WHERE name = ${manager_name}
    `;

    return Response.json({ ok: true, manager_name, calendar_sync });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
