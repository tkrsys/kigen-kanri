import { getDb } from '@/lib/db';

function checkPin(request) {
  const pin = request.headers.get('x-pin') || '';
  const validPin = process.env.APP_PIN || '';
  if (!validPin) return true;
  return pin === validPin;
}

// GET: ケアマネ一覧（careplan-delivery の care_managers を参照）
export async function GET(request) {
  if (!checkPin(request)) {
    return Response.json({ error: '認証エラー' }, { status: 401 });
  }

  try {
    const sql = getDb();
    const managers = await sql`
      SELECT id, name
      FROM care_managers
      WHERE hidden = false
      ORDER BY name
    `;
    return Response.json({ managers });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
