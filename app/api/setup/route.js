import { getDb } from '@/lib/db';

function verifyAdmin(request) {
  const pin = request.headers.get('x-admin-pin') || '';
  const adminPin = process.env.ADMIN_PIN || '';
  if (!adminPin) return true;
  return pin === adminPin;
}

export async function POST(request) {
  try {
    if (!verifyAdmin(request)) {
      return Response.json({ success: false, error: '管理者権限が必要です' }, { status: 403 });
    }
    const sql = getDb();

    // kigen_deadlines テーブル（clients.id を参照）
    await sql`CREATE TABLE IF NOT EXISTS kigen_deadlines (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      nintei_end DATE,
      long_end DATE,
      short_end DATE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(client_id)
    )`;

    // カレンダーイベント管理テーブル
    await sql`CREATE TABLE IF NOT EXISTS kigen_calendar_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      timing TEXT NOT NULL,
      google_event_id TEXT NOT NULL,
      target_date DATE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    await sql`CREATE INDEX IF NOT EXISTS idx_kigen_deadlines_client ON kigen_deadlines(client_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_kigen_calendar_client ON kigen_calendar_events(client_id)`;

    return Response.json({ success: true, message: 'kigen-kanri テーブルを作成しました' });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const sql = getDb();
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    return Response.json({ ok: true, tables: tables.map(t => t.table_name) });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
