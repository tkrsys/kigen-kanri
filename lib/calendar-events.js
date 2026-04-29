// カレンダー書き込みタイトル生成ロジック

/**
 * 期限種類ごとの設定
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

/**
 * 前々月25日の日付を計算
 * @param {string} dateStr - 期限日 (YYYY-MM-DD)
 * @returns {string} 前々月25日 (YYYY-MM-DD)
 */
export function getPreNoticeDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  // 2ヶ月前の25日
  let year = d.getFullYear();
  let month = d.getMonth() - 1; // 0-indexed なので -1 = 前々月
  if (month < 0) {
    month += 12;
    year -= 1;
  }
  return `${year}-${String(month + 1).padStart(2, '0')}-25`;
}

/**
 * カレンダー予定タイトルを生成
 * @param {string} type - 'nintei_end' | 'long_end' | 'short_end'
 * @param {string} userName - 利用者名
 * @param {string} dateStr - 期限日 (YYYY-MM-DD)
 * @param {'pre' | 'day'} timing - 'pre'=前々月25日, 'day'=当日
 * @returns {string} カレンダー予定タイトル
 */
export function buildEventTitle(type, userName, dateStr, timing) {
  const config = EVENT_CONFIG[type];
  if (!config) throw new Error(`Unknown type: ${type}`);

  const d = new Date(dateStr + 'T00:00:00');
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const endLabel = `${mm}/${dd}`;

  if (timing === 'pre') {
    // 前々月25日のタイトル
    // 期限月の前月 = アセスメント実施月
    let actionMonth = d.getMonth(); // 0-indexed: 前月
    if (actionMonth === 0) actionMonth = 12;
    return `【${config.label} 2ヶ月前】${userName} ${endLabel}(${actionMonth}月 ${config.preAction})`;
  } else {
    // 当日のタイトル
    return `【${config.label}】${userName} ${config.dayAction}`;
  }
}

/**
 * 1人の利用者について生成すべき全カレンダーイベントを返す
 * @param {object} user - { name, nintei_end, long_end, short_end }
 * @returns {Array<{type, timing, date, title}>}
 */
export function generateAllEvents(user) {
  const events = [];
  const types = ['nintei_end', 'long_end', 'short_end'];

  for (const type of types) {
    const dateStr = user[type];
    if (!dateStr) continue;

    // 前々月25日
    const preDate = getPreNoticeDate(dateStr);
    events.push({
      type,
      timing: 'pre',
      date: preDate,
      title: buildEventTitle(type, user.name, dateStr, 'pre'),
    });

    // 当日
    events.push({
      type,
      timing: 'day',
      date: dateStr,
      title: buildEventTitle(type, user.name, dateStr, 'day'),
    });
  }

  return events;
}
