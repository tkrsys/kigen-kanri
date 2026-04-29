import { generateAllEvents } from './calendar-events';

/**
 * iCalendar形式の文字列を生成
 * RFC 5545準拠の終日予定フィード
 */

function escapeIcalText(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function formatIcalDate(dateStr) {
  // YYYY-MM-DD → YYYYMMDD（終日予定用）
  return dateStr.replace(/-/g, '');
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * 安定したUIDを生成（同じ入力なら同じUID）
 * これによりGoogleカレンダーが更新時に既存イベントを認識できる
 */
function generateStableUid(clientId, type, timing) {
  return `kigen-${clientId}-${type}-${timing}@tkrsys`;
}

/**
 * 利用者リストからiCalendarフィードを生成
 * @param {Array} clients - 利用者データ配列
 * @param {string} calendarName - カレンダー名
 * @returns {string} iCalendar形式の文字列
 */
export function generateIcalFeed(clients, calendarName = '期限管理') {
  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//tkrsys//kigen-kanri//JA',
    `X-WR-CALNAME:${escapeIcalText(calendarName)}`,
    'X-WR-TIMEZONE:Asia/Tokyo',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const client of clients) {
    const events = generateAllEvents(client);

    for (const event of events) {
      const uid = generateStableUid(client.id, event.type, event.timing);
      const dtstart = formatIcalDate(event.date);
      const dtend = formatIcalDate(addDays(event.date, 1));

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
      lines.push(`DTEND;VALUE=DATE:${dtend}`);
      lines.push(`SUMMARY:${escapeIcalText(event.title)}`);
      lines.push('TRANSP:TRANSPARENT');
      lines.push('END:VEVENT');
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
