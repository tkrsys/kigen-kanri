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
