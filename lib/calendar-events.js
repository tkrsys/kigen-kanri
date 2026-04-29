// カレンダー書き込みタイトル生成ロジック
// 新仕様: 1期限につき3件（2ヶ月前・1ヶ月前・当月）

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

function getPreNoticeDateStr(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  let year = d.getFullYear();
  let month = d.getMonth() - 2;
  if (month < 0) { month += 12; year -= 1; }
  return `${year}-${String(month + 1).padStart(2, '0')}-25`;
}

function getMidNoticeDateStr(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  let year = d.getFullYear();
  let month = d.getMonth() - 1;
  if (month < 0) { month += 12; year -= 1; }
  return `${year}-${String(month + 1).padStart(2, '0')}-25`;
}

function getDayNoticeDateStr(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-25`;
}

function getActionMonth(dateStr, offset) {
  const d = new Date(dateStr + 'T00:00:00');
  let m = d.getMonth() + 1 + offset;
  if (m <= 0) m += 12;
  if (m > 12) m -= 12;
  return m;
}

/**
 * カレンダー予定タイトルを生成
 */
export function buildEventTitle(type, userName, dateStr, timing) {
  const config = EVENT_CONFIG[type];
  if (!config) throw new Error(`Unknown type: ${type}`);

  const d = new Date(dateStr + 'T00:00:00');
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const endLabel = `${mm}/${dd}`;

  if (timing === 'pre') {
    const actionMonth = getActionMonth(dateStr, -1);
    return `【${config.label} 2ヶ月前】${userName} ${endLabel}(${actionMonth}月 ${config.preAction})`;
  } else if (timing === 'mid') {
    const actionMonth = getActionMonth(dateStr, 0);
    return `【${config.label} 1ヶ月前】${userName} ${endLabel}(${actionMonth}月 ${config.midAction})`;
  } else {
    return `【${config.label}　　　　】${userName} ${endLabel}`;
  }
}

/**
 * 1人の利用者について生成すべき全カレンダーイベントを返す
 */
export function generateAllEvents(client) {
  const events = [];
  const types = ['nintei_end', 'long_end', 'short_end'];

  for (const type of types) {
    const dateStr = client[type];
    if (!dateStr) continue;

    const normalized = typeof dateStr === 'string' ? dateStr.split('T')[0] : dateStr;

    const preDate = getPreNoticeDateStr(normalized);
    events.push({
      type, timing: 'pre', date: preDate,
      title: buildEventTitle(type, client.name, normalized, 'pre'),
    });

    const midDate = getMidNoticeDateStr(normalized);
    events.push({
      type, timing: 'mid', date: midDate,
      title: buildEventTitle(type, client.name, normalized, 'mid'),
    });

    const dayDate = getDayNoticeDateStr(normalized);
    events.push({
      type, timing: 'day', date: dayDate,
      title: buildEventTitle(type, client.name, normalized, 'day'),
    });
  }

  return events;
}
