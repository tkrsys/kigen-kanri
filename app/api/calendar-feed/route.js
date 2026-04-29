import { getDb } from '@/lib/db';
import { generateIcalFeed } from '@/lib/ical-generator';

/**
 * iCalendar フィード エンドポイント
 *
 * 使い方:
 *   全員: /api/calendar-feed?token=XXXXX
 *   ケアマネ別: /api/calendar-feed?token=XXXXX&manager=田中
 *   ケアマネ一覧: /api/calendar-feed?token=XXXXX&list=managers
 *
 * calendar_sync=trueのケアマネの利用者のみ出力されます。
 */

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token') || '';
    const validToken = process.env.CALENDAR_FEED_TOKEN || '';

    if (!validToken || token !== validToken) {
      return new Response('Unauthorized', { status: 401 });
    }

    const sql = getDb();

    // ケアマネ一覧を返すモード
    const list = url.searchParams.get('list');
    if (list === 'managers') {
      const managers = await sql`
        SELECT DISTINCT care_manager
        FROM clients
        WHERE care_manager IS NOT NULL
        ORDER BY care_manager
      `;
      return Response.json({ managers: managers.map(m => m.care_manager) });
    }

    const manager = url.searchParams.get('manager');

    let clients;
    if (manager) {
      // 指定ケアマネの利用者（calendar_syncチェックなし、指定したケアマネのみ）
      clients = await sql`
        SELECT
          c.id, c.name, c.care_manager,
          kd.nintei_end, kd.long_end, kd.short_end
        FROM clients c
        LEFT JOIN kigen_deadlines kd ON kd.client_id = c.id
        INNER JOIN care_managers cm ON cm.name = c.care_manager AND cm.hidden = false AND cm.calendar_sync = true
        WHERE c.care_manager = ${manager}
        ORDER BY c.name
      `;
    } else {
      // 全員（calendar_sync=trueのケアマネのみ）
      clients = await sql`
        SELECT
          c.id, c.name, c.care_manager,
          kd.nintei_end, kd.long_end, kd.short_end
        FROM clients c
        LEFT JOIN kigen_deadlines kd ON kd.client_id = c.id
        INNER JOIN care_managers cm ON cm.name = c.care_manager AND cm.hidden = false AND cm.calendar_sync = true
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
