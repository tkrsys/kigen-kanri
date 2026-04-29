import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

function checkPin(request) {
  const pin = request.headers.get('x-pin');
  const validPin = process.env.APP_PIN;
  if (!validPin) return true;
  return pin === validPin;
}

// GET: 利用者詳細取得
export async function GET(request, { params }) {
  if (!checkPin(request)) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);

    if (!user) {
      return NextResponse.json({ error: '利用者が見つかりません' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: 利用者情報更新
export async function PUT(request, { params }) {
  if (!checkPin(request)) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, nintei_end, long_end, short_end } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: '利用者名は必須です' }, { status: 400 });
    }

    const db = getDb();
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: '利用者が見つかりません' }, { status: 404 });
    }

    db.prepare(`
      UPDATE users
      SET name = ?, nintei_end = ?, long_end = ?, short_end = ?,
          updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(name.trim(), nintei_end || null, long_end || null, short_end || null, id);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: 利用者削除
export async function DELETE(request, { params }) {
  if (!checkPin(request)) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const db = getDb();
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: '利用者が見つかりません' }, { status: 404 });
    }

    // カレンダーイベントも連鎖削除される（FK ON DELETE CASCADE）
    db.prepare('DELETE FROM users WHERE id = ?').run(id);

    return NextResponse.json({ ok: true, deleted: existing.name });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
