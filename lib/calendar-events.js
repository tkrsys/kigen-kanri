// カレンダー書き込みタイトル生成ロジック

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

/**
 * 前々月25日の日付を計算
 * @param {string} dateStr - 期限日 (YYYY-MM-DD)
 * @returns {string} 前々月25日 (YYYY-MM-DD)
 */
export function getPreNoticeDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  let year = d.getFullYear();
  let month = d.getMonth() - 1; // 0-indexed: -1 = 前々月
  if (month < 0) {
    month += 12;
    year -= 1;
  }
  return `${year}-${String(month + 1).padStart(2, '0')}-25`;
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
    let actionMonth = d.getMonth(); // 0-indexed: 前月
    if (actionMonth === 0) actionMonth = 12;
    return `【${config.label} 2ヶ月前】${userName} ${endLabel}(${actionMonth}月 ${config.preAction})`;
  } else {
    return `【${config.label}】${userName} ${config.dayAction}`;
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

    // 日付文字列の正規化（PostgreSQLのDATE型は YYYY-MM-DD）
    const normalized = typeof dateStr === 'string' ? dateStr.split('T')[0] : dateStr;

    const preDate = getPreNoticeDate(normalized);
    events.push({
      type,
      timing: 'pre',
      date: preDate,
      title: buildEventTitle(type, client.name, normalized, 'pre'),
    });

    events.push({
      type,
      timing: 'day',
      date: normalized,
      title: buildEventTitle(type, client.name, normalized, 'day'),
    });
  }

  return events;
}
