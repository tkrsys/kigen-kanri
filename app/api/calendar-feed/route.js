import { getDb } from '@/lib/db';
import { generateIcalFeed } from '@/lib/ical-generator';

/**
 * iCalendar フィード エンドポイント
 *
 * 使い方:
 *   全員: /api/calendar-feed?token=XXXXX
 *   ケアマネ別: /api/calendar-feed?token=XXXXX&manager=田中
 *
 * Googleカレンダーの「URLで追加」にこのURLを登録すると、
 * 数時間ごとに自動で予定が同期されます。
 *
 * 環境変数:
 *   CALENDAR_FEED_TOKEN — フィードアクセス用トークン（必須）
 */

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token') || '';
    const validToken = process.env.CALENDAR_FEED_TOKEN || '';

    if (!validToken || token !== validToken) {
      return new Response('Unauthorized', { status: 401 });
    }

    const manager = url.searchParams.get('manager');
    const sql = getDb();

    let clients;
    if (manager) {
      clients = await sql`
        SELECT
          c.id,
          c.name,
          c.care_manager,
          kd.nintei_end,
          kd.long_end,
          kd.short_end
        FROM clients c
        LEFT JOIN kigen_deadlines kd ON kd.client_id = c.id
        WHERE c.care_manager = ${manager}
        ORDER BY c.name
      `;
    } else {
      clients = await sql`
        SELECT
          c.id,
          c.name,
          c.care_manager,
          kd.nintei_end,
          kd.long_end,
          kd.short_end
        FROM clients c
        LEFT JOIN kigen_deadlines kd ON kd.client_id = c.id
        ORDER BY c.name
      `;
    }

    // 期限が1つ以上設定されている利用者のみ
    const clientsWithDeadlines = clients.filter(
      c => c.nintei_end || c.long_end || c.short_end
    );

    const calendarName = manager
      ? `期限管理（${manager}）`
      : '期限管理（全員）';

    const ical = generateIcalFeed(clientsWithDeadlines, calendarName);

    return new Response(ical, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="kigen-kanri.ics"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('calendar-feed error:', error);
    return new Response('Internal Server Error: ' + error.message, { status: 500 });
  }
}
