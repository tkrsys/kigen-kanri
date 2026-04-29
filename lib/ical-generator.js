/**
 * iCalendar形式の文字列を生成
 * RFC 5545準拠の終日予定フィード
 * 
 * lib/calendar-events.js のロジックを内包（インポート問題回避）
 */

const EVENT_CONFIG = {
  nintei_end: {
    label: '認定期限',
    preAction: '認定調査 ｱｾｽﾒﾝﾄ',
    dayAction: '担当者会議＋計画書交付',
  },
  long_end: {
    label: '長期期限',
    preAction: 'ｱｾｽﾒﾝﾄ',
    dayAction: '担当者会議＋ﾌﾟﾗﾝ交付',
  },
  short_end: {
    label: '短期期限',
    preAction: 'ｱｾｽﾒﾝﾄ',
    dayAction: '意見照会＋ﾌﾟﾗﾝ交付',
  },
};

function getPreNoticeDateStr(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  let year = d.getFullYear();
  let month = d.getMonth() - 2;
  if (month < 0) {
    month += 12;
    year -= 1;
  }
  return `${year}-${String(month + 1).padStart(2, '0')}-25`;
}

function buildEventTitleInternal(type, userName, dateStr, timing) {
  const config = EVENT_CONFIG[type];
  if (!config) return '';

  const d = new Date(dateStr + 'T00:00:00');
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const endLabel = `${mm}/${dd}`;

  if (timing === 'pre') {
    let actionMonth = d.getMonth();
    if (actionMonth === 0) actionMonth = 12;
    return `【${config.label} 2ヶ月前】${userName} ${endLabel}(${actionMonth}月 ${config.preAction})`;
  } else {
    return `【${config.label}】${userName} ${config.dayAction}`;
  }
}

function generateAllEventsInternal(client) {
  const events = [];
  const types = ['nintei_end', 'long_end', 'short_end'];

  for (const type of types) {
    const dateStr = client[type];
    if (!dateStr) continue;

    const normalized = typeof dateStr === 'string' ? dateStr.split('T')[0] : String(dateStr);

    const preDate = getPreNoticeDateStr(normalized);
    events.push({
      type,
      timing: 'pre',
      date: preDate,
      title: buildEventTitleInternal(type, client.name, normalized, 'pre'),
    });

    events.push({
      type,
      timing: 'day',
      date: normalized,
      title: buildEventTitleInternal(type, client.name, normalized, 'day'),
    });
  }

  return events;
}

function escapeIcalText(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function formatIcalDate(dateStr) {
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

function generateStableUid(clientId, type, timing) {
  return `kigen-${clientId}-${type}-${timing}@tkrsys`;
}

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
    const events = generateAllEventsInternal(client);

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
