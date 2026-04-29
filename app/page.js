'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';

const STATUS_CONFIG = {
  expired:  { label: '期限切れ', color: '#DC2626', bg: '#FEF2F2' },
  warning:  { label: '30日以内', color: '#EA580C', bg: '#FFF7ED' },
  caution:  { label: '要注意', color: '#CA8A04', bg: '#FEFCE8' },
  safe:     { label: '余裕あり', color: '#16A34A', bg: '#F0FDF4' },
};

const DEADLINE_TYPES = [
  { key: 'nintei_end', label: '認定期限', short: '認定' },
  { key: 'long_end',  label: '長期期限', short: '長期' },
  { key: 'short_end', label: '短期期限', short: '短期' },
];

const CAL_CONFIG = {
  nintei_end: { label: '認定期限', preAction: '認定調査 ｱｾｽﾒﾝﾄ', midAction: '担当者会議＋ﾌﾟﾗﾝ交付' },
  long_end:   { label: '長期期限', preAction: 'ｱｾｽﾒﾝﾄ', midAction: '担当者会議＋ﾌﾟﾗﾝ交付' },
  short_end:  { label: '短期期限', preAction: 'ｱｾｽﾒﾝﾄ', midAction: 'ﾌﾟﾗﾝ交付' },
};

function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const normalized = typeof dateStr === 'string' ? dateStr.split('T')[0] : dateStr;
  const target = new Date(normalized + 'T00:00:00');
  return Math.floor((target - today) / (1000 * 60 * 60 * 24));
}

function getStatus(days) {
  if (days === null) return null;
  if (days < 0) return 'expired';
  if (days <= 30) return 'warning';
  if (days <= 75) return 'caution';
  return 'safe';
}

function formatDate(dateStr) {
  if (!dateStr) return '未設定';
  const normalized = typeof dateStr === 'string' ? dateStr.split('T')[0] : dateStr;
  const d = new Date(normalized + 'T00:00:00');
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function toInputDate(dateStr) {
  if (!dateStr) return '';
  return typeof dateStr === 'string' ? dateStr.split('T')[0] : '';
}

function normalizeClientDate(dateStr) {
  if (!dateStr) return null;
  return typeof dateStr === 'string' ? dateStr.split('T')[0] : dateStr;
}

function getNoticeDateStr(dateStr, monthsBack) {
  const d = new Date(dateStr + 'T00:00:00');
  let year = d.getFullYear();
  let month = d.getMonth() - monthsBack;
  if (month < 0) { month += 12; year -= 1; }
  return `${year}-${String(month + 1).padStart(2, '0')}-25`;
}

function getActionMonth(dateStr, offset) {
  const d = new Date(dateStr + 'T00:00:00');
  let m = d.getMonth() + 1 + offset;
  if (m <= 0) m += 12;
  if (m > 12) m -= 12;
  return m;
}

function buildCalendarTitles(typeKey, userName, dateStr) {
  if (!dateStr) return null;
  const normalized = typeof dateStr === 'string' ? dateStr.split('T')[0] : dateStr;
  const config = CAL_CONFIG[typeKey];
  const d = new Date(normalized + 'T00:00:00');
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const endLabel = `${mm}/${dd}`;
  const preDate = getNoticeDateStr(normalized, 2);
  const preDateObj = new Date(preDate + 'T00:00:00');
  const preDateLabel = `${preDateObj.getMonth() + 1}/${preDateObj.getDate()}`;
  const preMonth = getActionMonth(normalized, -1);
  const midDate = getNoticeDateStr(normalized, 1);
  const midDateObj = new Date(midDate + 'T00:00:00');
  const midDateLabel = `${midDateObj.getMonth() + 1}/${midDateObj.getDate()}`;
  const midMonth = getActionMonth(normalized, 0);
  const dayDate = getNoticeDateStr(normalized, 0);
  const dayDateObj = new Date(dayDate + 'T00:00:00');
  const dayDateLabel = `${dayDateObj.getMonth() + 1}/${dayDateObj.getDate()}`;
  return {
    pre: { date: preDateLabel, title: `【${config.label} 2ヶ月前】${userName} ${endLabel}(${preMonth}月 ${config.preAction})` },
    mid: { date: midDateLabel, title: `【${config.label} 1ヶ月前】${userName} ${endLabel}(${midMonth}月 ${config.midAction})` },
    day: { date: dayDateLabel, title: `【${config.label}　　　　】${userName} ${endLabel}` },
  };
}

function getWorstStatus(client) {
  const priority = { expired: 0, warning: 1, caution: 2, safe: 3 };
  let worst = null;
  for (const dt of DEADLINE_TYPES) {
    const days = getDaysUntil(client[dt.key]);
    const s = getStatus(days);
    if (s === null) continue;
    if (worst === null || priority[s] < priority[worst]) worst = s;
  }
  return worst;
}

/** 利用者が持つ全ステータスをセットで返す */
function getClientStatuses(client) {
  const statuses = new Set();
  for (const dt of DEADLINE_TYPES) {
    const days = getDaysUntil(client[dt.key]);
    const s = getStatus(days);
    if (s !== null) statuses.add(s);
  }
  return statuses;
}

/** 利用者がフィルタに該当するか（期限のどれか1つでも該当すればtrue） */
function clientMatchesFilter(client, filter) {
  const statuses = getClientStatuses(client);
  if (statuses.size === 0) return false;
  if (filter === 'attention') {
    return statuses.has('expired') || statuses.has('warning') || statuses.has('caution');
  }
  return statuses.has(filter);
}

function getVisibleCalendarKeys(client) {
  const nintei = normalizeClientDate(client.nintei_end);
  const long = normalizeClientDate(client.long_end);
  const short = normalizeClientDate(client.short_end);
  const keys = [];
  if (nintei) keys.push('nintei_end');
  if (long && !(nintei && nintei === long)) keys.push('long_end');
  if (short && !(nintei && nintei === short) && !(long && long === short)) keys.push('short_end');
  return keys;
}

function DaysBadge({ days }) {
  if (days === null) return (
    <span style={{ fontSize: '12px', color: '#94A3B8', padding: '2px 10px',
      borderRadius: '20px', background: '#F1F5F9', whiteSpace: 'nowrap' }}>未設定</span>
  );
  const status = getStatus(days);
  const c = STATUS_CONFIG[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
      color: c.color, backgroundColor: c.bg, border: `1px solid ${c.color}22`,
      whiteSpace: 'nowrap' }}>
      {status === 'expired' ? `${Math.abs(days)}日超過` : `あと${days}日`}
    </span>
  );
}

function DeadlineSummaryLine({ days, label }) {
  if (days === null) return (
    <span style={{ fontSize: '11px', color: '#94A3B8' }}>{label}:未設定</span>
  );
  const status = getStatus(days);
  const c = STATUS_CONFIG[status];
  return (
    <span style={{ fontSize: '11px', color: c.color, fontWeight: 600 }}>
      {label}:{status === 'expired' ? `${Math.abs(days)}日超過` : `あと${days}日`}
    </span>
  );
}

function CalendarPreview({ typeKey, userName, dateStr }) {
  const titles = buildCalendarTitles(typeKey, userName, dateStr);
  if (!titles) return null;
  return (
    <div style={{ marginTop: '6px', padding: '8px 10px', background: '#FFFBEB',
      borderRadius: '8px', border: '1px solid #FDE68A' }}>
      <p style={{ margin: 0, fontSize: '10px', fontWeight: 600, color: '#92400E', marginBottom: '4px' }}>
        📅 登録情報
      </p>
      <div style={{ fontSize: '11px', color: '#78350F', lineHeight: 1.6 }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0, fontSize: '10px', padding: '1px 6px',
            borderRadius: '4px', background: '#FEF3C7', color: '#92400E', fontWeight: 600 }}>{titles.pre.date}</span>
          <span style={{ wordBreak: 'break-all' }}>{titles.pre.title}</span>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', marginTop: '3px' }}>
          <span style={{ flexShrink: 0, fontSize: '10px', padding: '1px 6px',
            borderRadius: '4px', background: '#FEF3C7', color: '#92400E', fontWeight: 600 }}>{titles.mid.date}</span>
          <span style={{ wordBreak: 'break-all' }}>{titles.mid.title}</span>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', marginTop: '3px' }}>
          <span style={{ flexShrink: 0, fontSize: '10px', padding: '1px 6px',
            borderRadius: '4px', background: '#FEF3C7', color: '#92400E', fontWeight: 600 }}>{titles.day.date}</span>
          <span style={{ wordBreak: 'break-all' }}>{titles.day.title}</span>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ manager, calSyncMap, onToggle, onClose }) {
  const isSynced = !!calSyncMap[manager];
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100,
      fontFamily: "'Noto Sans JP', sans-serif" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: '480px', backgroundColor: '#fff',
        borderRadius: '20px 20px 0 0', padding: '24px 20px 32px', maxHeight: '85vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1E293B' }}>設定</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94A3B8', cursor: 'pointer', padding: '8px' }}>✕</button>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <p style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: '#334155' }}>Googleカレンダー同期</p>
          <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#64748B', lineHeight: 1.5 }}>
            ☑にすると、担当利用者の期限予定がGoogleカレンダーに自動同期されます。
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px',
            padding: '14px 16px', borderRadius: '10px', cursor: 'pointer',
            background: isSynced ? '#EFF6FF' : '#F8FAFC',
            border: `1.5px solid ${isSynced ? '#93C5FD' : '#E2E8F0'}`,
            transition: 'all 0.15s' }}>
            <input type="checkbox" checked={isSynced} onChange={() => onToggle(manager)}
              style={{ accentColor: '#3B82F6', width: '18px', height: '18px', flexShrink: 0 }} />
            <div>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B' }}>{manager}</span>
              <span style={{ fontSize: '11px', color: isSynced ? '#2563EB' : '#94A3B8', marginLeft: '8px' }}>
                {isSynced ? '同期ON' : '同期OFF'}
              </span>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}

function PinScreen({ onAuth }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/clients', { headers: { 'x-pin': pin } });
      if (res.ok) { localStorage.setItem('kigen-pin', pin); onAuth(pin); }
      else setError('PINが正しくありません');
    } catch { setError('接続エラー'); }
    setLoading(false);
  };
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh', fontFamily: "'Noto Sans JP', sans-serif", padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '320px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1E3A5F', margin: '0 0 8px' }}>期限管理</h1>
        <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 24px' }}>PINコードを入力してください</p>
        <input type="password" inputMode="numeric" maxLength={6} value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="PIN" autoFocus
          style={{ width: '100%', padding: '14px', fontSize: '20px', textAlign: 'center',
            border: '2px solid #E2E8F0', borderRadius: '12px', outline: 'none',
            boxSizing: 'border-box', letterSpacing: '8px' }} />
        {error && <p style={{ color: '#DC2626', fontSize: '13px', margin: '8px 0' }}>{error}</p>}
        <button onClick={handleSubmit} disabled={loading || !pin}
          style={{ width: '100%', padding: '14px', fontSize: '15px', fontWeight: 600,
            background: 'linear-gradient(135deg, #1E3A5F, #2D5A87)', color: '#fff',
            border: 'none', borderRadius: '12px', cursor: 'pointer', marginTop: '16px',
            opacity: loading || !pin ? 0.5 : 1 }}>
          {loading ? '確認中...' : 'ログイン'}
        </button>
      </div>
    </div>
  );
}

function DeadlineForm({ client, onSave, onClose, pin, showCalendar }) {
  const [form, setForm] = useState({
    nintei_end: toInputDate(client.nintei_end),
    long_end: toInputDate(client.long_end),
    short_end: toInputDate(client.short_end),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const visibleCalKeys = useMemo(() => {
    const nintei = form.nintei_end || null;
    const long = form.long_end || null;
    const short = form.short_end || null;
    const keys = [];
    if (nintei) keys.push('nintei_end');
    if (long && !(nintei && nintei === long)) keys.push('long_end');
    if (short && !(nintei && nintei === short) && !(long && long === short)) keys.push('short_end');
    return keys;
  }, [form]);
  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/clients/${client.id}/deadlines`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-pin': pin },
        body: JSON.stringify(form),
      });
      if (res.ok) { const data = await res.json(); onSave(data.client); }
      else { const data = await res.json(); setError(data.error || '保存に失敗しました'); }
    } catch { setError('接続エラー'); }
    setSaving(false);
  };
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100,
      fontFamily: "'Noto Sans JP', sans-serif" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: '480px', backgroundColor: '#fff',
        borderRadius: '20px 20px 0 0', padding: '24px 20px 32px', maxHeight: '85vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1E293B' }}>期限設定</h2>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#64748B' }}>{client.name}</p>
            {client.care_manager && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94A3B8' }}>担当: {client.care_manager}</p>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94A3B8', cursor: 'pointer', padding: '8px' }}>✕</button>
        </div>
        {DEADLINE_TYPES.map(dt => (
          <div key={dt.key} style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>{dt.label}</label>
            <input type="date" value={form[dt.key]}
              onChange={e => setForm({ ...form, [dt.key]: e.target.value })}
              style={{ width: '100%', padding: '12px', fontSize: '15px', border: '1.5px solid #E2E8F0', borderRadius: '10px', outline: 'none', boxSizing: 'border-box', color: '#1E293B' }} />
            {showCalendar && form[dt.key] && visibleCalKeys.includes(dt.key) && <CalendarPreview typeKey={dt.key} userName={client.name} dateStr={form[dt.key]} />}
          </div>
        ))}
        {error && <p style={{ color: '#DC2626', fontSize: '13px', margin: '8px 0' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '14px', fontSize: '14px', fontWeight: 600, background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '12px', cursor: 'pointer' }}>キャンセル</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '14px', fontSize: '14px', fontWeight: 600, background: 'linear-gradient(135deg, #1E3A5F, #2D5A87)', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KigenKanri() {
  const [pin, setPin] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('attention');
  const [expandedClient, setExpandedClient] = useState(null);
  const [editClient, setEditClient] = useState(null);
  const [managerFilter, setManagerFilter] = useState('all');
  const [calSyncMap, setCalSyncMap] = useState({});
  const [settingsManager, setSettingsManager] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('kigen-pin');
    if (saved) setPin(saved); else setLoading(false);
  }, []);

  const fetchClients = useCallback(async (p) => {
    setLoading(true);
    try {
      const res = await fetch('/api/clients', { headers: { 'x-pin': p } });
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
        const syncMap = {};
        (data.clients || []).forEach(c => {
          if (c.care_manager) syncMap[c.care_manager] = !!c.calendar_sync;
        });
        setCalSyncMap(syncMap);
      }
      else if (res.status === 401) { localStorage.removeItem('kigen-pin'); setPin(null); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { if (pin) fetchClients(pin); }, [pin, fetchClients]);

  const handleCalSyncToggle = async (managerName) => {
    const newVal = !calSyncMap[managerName];
    setCalSyncMap(prev => ({ ...prev, [managerName]: newVal }));
    try {
      await fetch('/api/care-managers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-pin': pin },
        body: JSON.stringify({ manager_name: managerName, calendar_sync: newVal }),
      });
    } catch (e) { console.error(e); }
  };

  const managers = useMemo(() => {
    const set = new Set(clients.map(c => c.care_manager).filter(Boolean));
    return Array.from(set).sort();
  }, [clients]);

  const filteredClients = useMemo(() => {
    let list = clients;
    if (managerFilter !== 'all') list = list.filter(c => c.care_manager === managerFilter);
    return list;
  }, [clients, managerFilter]);

  // 利用者単位でカウント（期限のどれか1つでも該当すればカウント）
  const summary = useMemo(() => {
    const counts = { expired: 0, warning: 0, caution: 0, safe: 0, attention: 0 };
    filteredClients.forEach(client => {
      const statuses = getClientStatuses(client);
      if (statuses.has('expired')) counts.expired++;
      if (statuses.has('warning')) counts.warning++;
      if (statuses.has('caution')) counts.caution++;
      if (statuses.has('safe')) counts.safe++;
      if (statuses.has('expired') || statuses.has('warning') || statuses.has('caution')) counts.attention++;
    });
    return counts;
  }, [filteredClients]);

  const filteredSortedClients = useMemo(() => {
    const priority = { expired: 0, warning: 1, caution: 2, safe: 3 };
    let list = filteredClients.map(client => ({ ...client, worstStatus: getWorstStatus(client) }));
    list = list.filter(c => clientMatchesFilter(c, activeFilter));
    list.sort((a, b) => {
      const ap = a.worstStatus === null ? 99 : (priority[a.worstStatus] ?? 5);
      const bp = b.worstStatus === null ? 99 : (priority[b.worstStatus] ?? 5);
      return ap - bp;
    });
    return list;
  }, [filteredClients, activeFilter]);

  const handleSave = (updatedClient) => {
    setClients(prev => prev.map(c => c.id === updatedClient.id ? { ...updatedClient, calendar_sync: c.calendar_sync } : c));
    setEditClient(null);
  };

  const handleLogout = () => { localStorage.removeItem('kigen-pin'); setPin(null); setClients([]); };

  const handleOpenSettings = () => {
    if (managerFilter !== 'all') {
      setSettingsManager(managerFilter);
    } else if (managers.length === 1) {
      setSettingsManager(managers[0]);
    } else {
      setSettingsManager(null);
    }
  };

  if (!pin) return <PinScreen onAuth={p => setPin(p)} />;
  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh', fontFamily: "'Noto Sans JP', sans-serif", color: '#64748B' }}>読み込み中...</div>
  );

  const FILTER_ITEMS = [
    { key: 'safe', label: '余裕あり', color: STATUS_CONFIG.safe.color, count: summary.safe },
    { key: 'attention', label: '要注意', count: summary.attention, color: '#B45309' },
    { key: 'warning', label: '30日以内', color: STATUS_CONFIG.warning.color, count: summary.warning },
    { key: 'expired', label: '期限切れ', color: STATUS_CONFIG.expired.color, count: summary.expired },
  ];

  return (
    <div style={{ fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif",
      maxWidth: '480px', margin: '0 auto', backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#1E293B' }}>

      <div style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #2D5A87 100%)', padding: '20px 16px 16px', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, letterSpacing: '0.5px' }}>期限管理</h1>
            <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.8 }}>
              {new Date().getFullYear()}年{new Date().getMonth() + 1}月{new Date().getDate()}日 現在・{clients.length}名
            </p>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={handleOpenSettings} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: '16px', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer' }}
              title="設定">⚙</button>
            <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: '12px', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}>ログアウト</button>
          </div>
        </div>
        {managers.length > 1 && (
          <div style={{ marginTop: '12px' }}>
            <select value={managerFilter} onChange={e => setManagerFilter(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', outline: 'none', appearance: 'auto' }}>
              <option value="all" style={{ color: '#1E293B' }}>全ケアマネ</option>
              {managers.map(m => <option key={m} value={m} style={{ color: '#1E293B' }}>{m}</option>)}
            </select>
          </div>
        )}
      </div>

      <div style={{ padding: '12px 16px 8px', display: 'flex', gap: '6px', overflowX: 'auto' }}>
        {FILTER_ITEMS.map(item => (
          <button key={item.key} onClick={() => setActiveFilter(item.key)} style={{
            flexShrink: 0, padding: '8px 14px', borderRadius: '10px', border: 'none',
            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            background: activeFilter === item.key ? (item.color || '#1E3A5F') : '#fff',
            color: activeFilter === item.key ? '#fff' : (item.color || '#64748B'),
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}>{item.label} ({item.count})</button>
        ))}
      </div>

      {(summary.expired > 0 || summary.warning > 0) && (
        <div style={{ margin: '8px 16px', padding: '12px 16px', borderRadius: '12px',
          background: 'linear-gradient(135deg, #FEF2F2, #FFF7ED)',
          border: '1px solid #FECACA', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>⚠️</span>
          <div>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#DC2626' }}>要対応: {summary.expired + summary.warning}名</p>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#92400E' }}>期限切れ {summary.expired}名 ・ 30日以内 {summary.warning}名</p>
          </div>
        </div>
      )}

      <div style={{ padding: '4px 16px 100px' }}>
        <p style={{ fontSize: '11px', color: '#94A3B8', margin: '8px 0', fontWeight: 500 }}>
          {filteredSortedClients.length}名 — 緊急度順
        </p>
        {filteredSortedClients.map(client => {
          const deadlines = DEADLINE_TYPES.map(dt => ({
            ...dt, date: client[dt.key],
            days: getDaysUntil(client[dt.key]),
            status: getStatus(getDaysUntil(client[dt.key])),
          }));
          const worstInfo = client.worstStatus ? STATUS_CONFIG[client.worstStatus] : { color: '#94A3B8', bg: '#F1F5F9', label: '未設定' };
          const isExpanded = expandedClient === client.id;
          const showCalendar = !!calSyncMap[client.care_manager];
          const visibleCalKeys = getVisibleCalendarKeys(client);

          return (
            <div key={client.id} style={{ background: '#fff', borderRadius: '12px',
              marginBottom: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              borderLeft: `4px solid ${worstInfo.color}`, overflow: 'hidden' }}>
              <div onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700 }}>{client.name}</span>
                    <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px',
                      background: worstInfo.bg, color: worstInfo.color, fontWeight: 600,
                      border: `1px solid ${worstInfo.color}22` }}>{worstInfo.label}</span>
                    {client.care_manager && <span style={{ fontSize: '11px', color: '#94A3B8' }}>担当: {client.care_manager}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {DEADLINE_TYPES.map(dt => (
                      <DeadlineSummaryLine key={dt.key} days={getDaysUntil(client[dt.key])} label={dt.short} />
                    ))}
                  </div>
                </div>
                <span style={{ fontSize: '16px', color: '#94A3B8', flexShrink: 0, marginLeft: '8px',
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
              </div>
              {isExpanded && (
                <div style={{ padding: '0 16px 14px', borderTop: '1px solid #F1F5F9' }}>
                  {deadlines.map(dl => (
                    <div key={dl.key} style={{ padding: '10px 0', borderBottom: '1px solid #F8FAFC' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>{dl.label}</span>
                          <span style={{ fontSize: '11px', color: '#94A3B8', marginLeft: '8px' }}>{formatDate(dl.date)}</span>
                        </div>
                        <DaysBadge days={dl.days} />
                      </div>
                      {showCalendar && visibleCalKeys.includes(dl.key) && <CalendarPreview typeKey={dl.key} userName={client.name} dateStr={dl.date} />}
                    </div>
                  ))}
                  <button onClick={() => setEditClient(client)}
                    style={{ width: '100%', padding: '10px', marginTop: '10px', fontSize: '13px',
                      fontWeight: 600, background: '#F1F5F9', color: '#475569', border: 'none',
                      borderRadius: '10px', cursor: 'pointer' }}>期限を編集</button>
                </div>
              )}
            </div>
          );
        })}
        {filteredSortedClients.length === 0 && (
          <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: '14px', marginTop: '40px' }}>該当する利用者はいません</p>
        )}
      </div>

      {editClient && <DeadlineForm client={editClient} pin={pin} onSave={handleSave} onClose={() => setEditClient(null)} showCalendar={!!calSyncMap[editClient.care_manager]} />}
      {settingsManager && <SettingsModal manager={settingsManager} calSyncMap={calSyncMap} onToggle={handleCalSyncToggle} onClose={() => setSettingsManager(null)} />}
    </div>
  );
}
