/**
 * iCalendar形式の文字列を生成
 * RFC 5545準拠の終日予定フィード
 *
 * 仕様:
 *   1期限につき2件のイベント（2ヶ月前・1ヶ月前）
 *   重複排除: 認定=長期=短期→認定のみ、長期=短期→長期のみ
 */

const EVENT_CONFIG = {
  nintei_end: {
    label: '認定期限',
    preAction: '認定調査 ｱｾｽﾒﾝﾄ',
    midAction: '担当者会議＋ﾌﾟﾗﾝ交付',
  },
  long_end: {
    label: '長期期限',
    preAction: 'ｱｾｽﾒﾝﾄ',
    midAction: '担当者会議＋ﾌﾟﾗﾝ交付',
  },
  short_end: {
    label: '短期期限',
    preAction: 'ｱｾｽﾒﾝﾄ',
    midAction: 'ﾌﾟﾗﾝ交付',
  },
};

function normalizeDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof val === 'string') return val.split('T')[0];
  const s = String(val);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.split('T')[0];
  return null;
}

/** 前々月25日 */
function getDate2MonthsBefore(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  let year = d.getFullYear();
  let month = d.getMonth() - 2;
  if (month < 0) { month += 12; year -= 1; }
  return `${year}-${String(month + 1).padStart(2, '0')}-25`;
}

/** 前月25日 */
function getDate1MonthBefore(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  let year = d.getFullYear();
  let month = d.getMonth() - 1;
  if (month < 0) { month += 12; year -= 1; }
  return `${year}-${String(month + 1).padStart(2, '0')}-25`;
}

function getEndLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getActionMonth(dateStr, offset) {
  const d = new Date(dateStr + 'T00:00:00');
  let m = d.getMonth() + 1 + offset;
  if (m <= 0) m += 12;
  if (m > 12) m -= 12;
  return m;
}

/**
 * 1利用者の全イベントを生成（重複排除済み）
 * 2ヶ月前・1ヶ月前の2件のみ（当月は不要）
 */
function generateAllEventsInternal(client) {
  const nintei = normalizeDate(client.nintei_end);
  const long = normalizeDate(client.long_end);
  const short = normalizeDate(client.short_end);

  const typesToOutput = [];
  if (nintei) typesToOutput.push('nintei_end');
  if (long) {
    if (!(nintei && nintei === long)) {
      typesToOutput.push('long_end');
    }
  }
  if (short) {
    if (!(nintei && nintei === short) && !(long && long === short)) {
      typesToOutput.push('short_end');
    }
  }

  const events = [];

  for (const type of typesToOutput) {
    const dateStr = normalizeDate(client[type]);
    if (!dateStr) continue;
    const config = EVENT_CONFIG[type];
    const endLabel = getEndLabel(dateStr);
    const name = client.name;

    // 2ヶ月前 (pre)
    const preDate = getDate2MonthsBefore(dateStr);
    const preMonth = getActionMonth(dateStr, -1);
    events.push({
      type, timing: 'pre', date: preDate,
      title: `【${config.label} 2ヶ月前】${name} ${endLabel}(${preMonth}月 ${config.preAction})`,
    });

    // 1ヶ月前 (mid)
    const midDate = getDate1MonthBefore(dateStr);
    const midMonth = getActionMonth(dateStr, 0);
    events.push({
      type, timing: 'mid', date: midDate,
      title: `【${config.label} 1ヶ月前】${name} ${endLabel}(${midMonth}月 ${config.midAction})`,
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
