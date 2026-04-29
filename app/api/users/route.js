import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// PIN認証チェック
function checkPin(request) {
  const pin = request.headers.get('x-pin');
  const validPin = process.env.APP_PIN;
  if (!validPin) return true; // PIN未設定時はスキップ(開発用)
  return pin === validPin;
}

// GET: 利用者一覧取得
export async function GET(request) {
  if (!checkPin(request)) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  try {
    const db = getDb();
    const users = db.prepare(`
      SELECT id, name, nintei_end, long_end, short_end,
             calendar_synced_at, created_at, updated_at
      FROM users
      ORDER BY name
    `).all();

    return NextResponse.json({ users });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: 利用者新規登録
export async function POST(request) {
  if (!checkPin(request)) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, nintei_end, long_end, short_end } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: '利用者名は必須です' }, { status: 400 });
    }

    const db = getDb();
    const result = db.prepare(`
      INSERT INTO users (name, nintei_end, long_end, short_end)
      VALUES (?, ?, ?, ?)
    `).run(name.trim(), nintei_end || null, long_end || null, short_end || null);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
