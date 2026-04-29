'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';

const STATUS_CONFIG = {
  expired:  { label: '期限切れ', color: '#c0392b', bg: '#fdf0ee' },
  warning:  { label: '30日以内', color: '#d35400', bg: '#fef5ee' },
  caution:  { label: '要注意', color: '#8b6914', bg: '#fdf8ee' },
  safe:     { label: '余裕あり', color: '#27766a', bg: '#e8f5f0' },
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
  const today = new Date(); today.setHours(0,0,0,0);
  const normalized = typeof dateStr === 'string' ? dateStr.split('T')[0] : dateStr;
  const target = new Date(normalized + 'T00:00:00');
  return Math.floor((target - today) / (1000*60*60*24));
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
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
}
function toInputDate(dateStr) { if (!dateStr) return ''; return typeof dateStr === 'string' ? dateStr.split('T')[0] : ''; }
function normalizeClientDate(dateStr) { if (!dateStr) return null; return typeof dateStr === 'string' ? dateStr.split('T')[0] : dateStr; }
function getNoticeDateStr(dateStr, monthsBack) {
  const d = new Date(dateStr + 'T00:00:00'); let year = d.getFullYear(); let month = d.getMonth() - monthsBack;
  if (month < 0) { month += 12; year -= 1; }
  return `${year}-${String(month+1).padStart(2,'0')}-25`;
}
function getActionMonth(dateStr, offset) {
  const d = new Date(dateStr + 'T00:00:00'); let m = d.getMonth()+1+offset;
  if (m <= 0) m += 12; if (m > 12) m -= 12; return m;
}
function buildCalendarTitles(typeKey, userName, dateStr) {
  if (!dateStr) return null;
  const normalized = typeof dateStr === 'string' ? dateStr.split('T')[0] : dateStr;
  const config = CAL_CONFIG[typeKey]; const d = new Date(normalized + 'T00:00:00');
  const mm = d.getMonth()+1; const dd = d.getDate(); const endLabel = `${mm}/${dd}`;
  const preDate = getNoticeDateStr(normalized,2); const preDateObj = new Date(preDate+'T00:00:00');
  const preDateLabel = `${preDateObj.getMonth()+1}/${preDateObj.getDate()}`; const preMonth = getActionMonth(normalized,-1);
  const midDate = getNoticeDateStr(normalized,1); const midDateObj = new Date(midDate+'T00:00:00');
  const midDateLabel = `${midDateObj.getMonth()+1}/${midDateObj.getDate()}`; const midMonth = getActionMonth(normalized,0);
  const dayDate = getNoticeDateStr(normalized,0); const dayDateObj = new Date(dayDate+'T00:00:00');
  const dayDateLabel = `${dayDateObj.getMonth()+1}/${dayDateObj.getDate()}`;
  return {
    pre: { date: preDateLabel, title: `【${config.label} 2ヶ月前】${userName} ${endLabel}(${preMonth}月 ${config.preAction})` },
    mid: { date: midDateLabel, title: `【${config.label} 1ヶ月前】${userName} ${endLabel}(${midMonth}月 ${config.midAction})` },
    day: { date: dayDateLabel, title: `【${config.label}　　　　】${userName} ${endLabel}` },
  };
}
function getWorstStatus(client) {
  const priority = { expired:0, warning:1, caution:2, safe:3 }; let worst = null;
  for (const dt of DEADLINE_TYPES) { const days = getDaysUntil(client[dt.key]); const s = getStatus(days);
    if (s === null) continue; if (worst === null || priority[s] < priority[worst]) worst = s; } return worst;
}
function getClientStatuses(client) {
  const statuses = new Set();
  for (const dt of DEADLINE_TYPES) { const s = getStatus(getDaysUntil(client[dt.key])); if (s !== null) statuses.add(s); }
  return statuses;
}
function hasAnyDeadline(client) { return DEADLINE_TYPES.some(dt => client[dt.key]); }
function clientMatchesFilter(client, filter) {
  if (filter === 'unset') return !hasAnyDeadline(client);
  const statuses = getClientStatuses(client); if (statuses.size === 0) return false;
  if (filter === 'attention') return statuses.has('expired') || statuses.has('warning') || statuses.has('caution');
  return statuses.has(filter);
}
function getVisibleCalendarKeys(client) {
  const nintei = normalizeClientDate(client.nintei_end); const long = normalizeClientDate(client.long_end); const short = normalizeClientDate(client.short_end);
  const keys = []; if (nintei) keys.push('nintei_end');
  if (long && !(nintei && nintei === long)) keys.push('long_end');
  if (short && !(nintei && nintei === short) && !(long && long === short)) keys.push('short_end');
  return keys;
}

const T = {
  bg: '#f5f3ee',
  card: { background:'#fff', border:'1px solid #d8d8d0', borderRadius:8, padding:'16px 20px', marginBottom:12, boxShadow:'0 1px 3px rgba(0,0,0,.06)' },
  accent: '#2d5a7b', text: '#1a1a2e', sub: '#4a4a5a', muted: '#8888a0', border: '#d8d8d0',
  barStyle: { display:'inline-block', width:3, height:16, background:'#2d5a7b', borderRadius:2 },
  secTitle: { fontSize:14, fontWeight:600, color:'#2d5a7b', display:'flex', alignItems:'center', gap:8, marginBottom:12 },
  btnPrimary: { padding:'8px 18px', background:'#2d5a7b', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:500, cursor:'pointer' },
  btnSecondary: { padding:'8px 18px', background:'#fff', color:'#4a4a5a', border:'1px solid #d8d8d0', borderRadius:6, fontSize:13, fontWeight:500, cursor:'pointer' },
  btnGear: { padding:'6px 10px', background:'transparent', color:'#8888a0', border:'1px solid #d8d8d0', borderRadius:6, cursor:'pointer', display:'flex', alignItems:'center' },
};

const GearIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8888a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;

function DaysBadge({ days }) {
  if (days === null) return <span style={{ fontSize:11, color:T.muted, padding:'2px 8px', borderRadius:4, background:'#eceae3' }}>未設定</span>;
  const status = getStatus(days); const c = STATUS_CONFIG[status];
  return <span style={{ fontSize:11, fontWeight:600, color:c.color, background:c.bg, padding:'2px 8px', borderRadius:4 }}>
    {status === 'expired' ? `${Math.abs(days)}日超過` : `あと${days}日`}</span>;
}
function DeadlineSummaryInline({ days, label }) {
  if (days === null) return <span style={{ fontSize:12, color:T.muted }}>{label}:未設定</span>;
  const status = getStatus(days); const c = STATUS_CONFIG[status];
  return <span style={{ fontSize:12, color:c.color, fontWeight:600 }}>{label}:{status === 'expired' ? `${Math.abs(days)}日超過` : `あと${days}日`}</span>;
}
function CalendarPreview({ typeKey, userName, dateStr }) {
  const titles = buildCalendarTitles(typeKey, userName, dateStr); if (!titles) return null;
  return (
    <div style={{ marginTop:6, padding:'8px 12px', background:'#fafaf8', borderRadius:6, border:'1px solid #d8d8d0' }}>
      <p style={{ margin:0, fontSize:10, fontWeight:600, color:T.accent, marginBottom:4 }}>📅 登録情報</p>
      <div style={{ fontSize:11, color:T.sub, lineHeight:1.6 }}>
        {[titles.pre, titles.mid, titles.day].map((t,i) => (
          <div key={i} style={{ display:'flex', gap:6, alignItems:'flex-start', marginTop:i?3:0 }}>
            <span style={{ flexShrink:0, fontSize:10, padding:'1px 6px', borderRadius:4, background:'#eceae3', color:T.sub, fontWeight:600 }}>{t.date}</span>
            <span style={{ wordBreak:'break-all' }}>{t.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function SettingsModal({ manager, calSyncMap, onToggle, onClose }) {
  const isSynced = !!calSyncMap[manager];
  return (
    <div style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, fontFamily:"'Noto Sans JP', sans-serif" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width:'100%', maxWidth:400, backgroundColor:'#fff', borderRadius:12, padding:'28px 24px', boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, paddingBottom:12, borderBottom:'2px solid #2d5a7b' }}>
          <h2 style={{ margin:0, fontSize:16, fontWeight:600, color:T.text }}>設定</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:18, color:T.muted, cursor:'pointer' }}>✕</button>
        </div>
        <div style={T.secTitle}><span style={T.barStyle}></span>Googleカレンダー同期</div>
        <p style={{ margin:'0 0 16px', fontSize:12, color:T.muted, lineHeight:1.5 }}>
          ☑にすると、担当利用者の期限予定がGoogleカレンダーに自動同期されます。</p>
        <label style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:8, cursor:'pointer',
          background: isSynced ? '#e8f5f0' : '#fafaf8', border:`1px solid ${isSynced ? '#27766a' : '#d8d8d0'}` }}>
          <input type="checkbox" checked={isSynced} onChange={() => onToggle(manager)}
            style={{ accentColor:'#2d5a7b', width:16, height:16, flexShrink:0 }} />
          <span style={{ fontSize:14, fontWeight:500, color:T.text }}>{manager}</span>
          <span style={{ fontSize:11, color:isSynced?'#27766a':T.muted, marginLeft:'auto' }}>{isSynced?'同期ON':'同期OFF'}</span>
        </label>
      </div>
    </div>
  );
}
function PinScreen({ onAuth }) {
  const [pin, setPin] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async () => { setLoading(true); setError('');
    try { const res = await fetch('/api/clients', { headers: { 'x-pin': pin } });
      if (res.ok) { localStorage.setItem('kigen-pin', pin); onAuth(pin); } else setError('PINが正しくありません');
    } catch { setError('接続エラー'); } setLoading(false); };
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:T.bg, fontFamily:"'Noto Sans JP', sans-serif" }}>
      <div style={{ background:'#fff', padding:40, borderRadius:12, boxShadow:'0 4px 20px rgba(0,0,0,0.1)', textAlign:'center', maxWidth:360, width:'100%' }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🔒</div>
        <h2 style={{ fontSize:18, fontWeight:600, marginBottom:8 }}>期限管理システム</h2>
        <p style={{ fontSize:13, color:T.muted, marginBottom:24 }}>パスワードを入力してアクセス</p>
        <div style={{ position:'relative', marginBottom:16, height:48 }}>
          <input type="password" inputMode="numeric" maxLength={6} value={pin}
            onChange={e => { setPin(e.target.value.replace(/\D/g,'')); setError(''); }}
            onKeyDown={e => e.key==='Enter' && submit()} placeholder="パスワード" autoFocus
            style={{ textAlign:'center', fontSize:16, width:'100%', height:48, lineHeight:'48px', boxSizing:'border-box', letterSpacing:8 }} />
        </div>
        {error && <p style={{ color:'#c0392b', fontSize:13, marginBottom:12 }}>{error}</p>}
        <button onClick={submit} disabled={loading || !pin}
          style={{ width:'100%', padding:10, background:'#2d5a7b', color:'#fff', border:'none', borderRadius:6, fontSize:14, fontWeight:500, opacity:loading||!pin?0.5:1 }}>
          {loading ? '確認中...' : 'ログイン'}</button>
      </div>
    </div>
  );
}
function DeadlineForm({ client, onSave, onClose, pin, showCalendar }) {
  const [form, setForm] = useState({ nintei_end:toInputDate(client.nintei_end), long_end:toInputDate(client.long_end), short_end:toInputDate(client.short_end) });
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const visibleCalKeys = useMemo(() => {
    const n=form.nintei_end||null, l=form.long_end||null, s=form.short_end||null, keys=[];
    if(n) keys.push('nintei_end'); if(l&&!(n&&n===l)) keys.push('long_end'); if(s&&!(n&&n===s)&&!(l&&l===s)) keys.push('short_end'); return keys;
  }, [form]);
  const handleSave = async () => { setSaving(true); setError('');
    try { const res = await fetch(`/api/clients/${client.id}/deadlines`, { method:'PUT', headers:{'Content-Type':'application/json','x-pin':pin}, body:JSON.stringify(form) });
      if (res.ok) { const data = await res.json(); onSave(data.client); } else { const data = await res.json(); setError(data.error||'保存に失敗しました'); }
    } catch { setError('接続エラー'); } setSaving(false); };
  return (
    <div style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, fontFamily:"'Noto Sans JP', sans-serif" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width:'100%', maxWidth:440, backgroundColor:'#fff', borderRadius:12, padding:'28px 24px', boxShadow:'0 4px 20px rgba(0,0,0,0.1)', maxHeight:'85vh', overflow:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, paddingBottom:12, borderBottom:'2px solid #2d5a7b' }}>
          <div>
            <h2 style={{ margin:0, fontSize:16, fontWeight:600, color:T.text }}>期限設定</h2>
            <p style={{ margin:'4px 0 0', fontSize:13, color:T.muted }}>{client.name}{client.care_manager ? ` ・ 担当: ${client.care_manager}` : ''}</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:18, color:T.muted, cursor:'pointer' }}>✕</button>
        </div>
        {DEADLINE_TYPES.map(dt => (
          <div key={dt.key} style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:12, fontWeight:500, color:T.sub, marginBottom:6 }}>{dt.label}</label>
            <input type="date" value={form[dt.key]} onChange={e => setForm({...form, [dt.key]:e.target.value})}
              style={{ width:'100%', padding:10, fontSize:14, border:'1px solid #d8d8d0', borderRadius:6, outline:'none', boxSizing:'border-box', color:T.text }} />
            {showCalendar && form[dt.key] && visibleCalKeys.includes(dt.key) && <CalendarPreview typeKey={dt.key} userName={client.name} dateStr={form[dt.key]} />}
          </div>
        ))}
        {error && <p style={{ color:'#c0392b', fontSize:13, margin:'8px 0' }}>{error}</p>}
        <div style={{ display:'flex', gap:10, marginTop:20 }}>
          <button onClick={onClose} style={{...T.btnSecondary, flex:1, padding:'10px 0'}}>キャンセル</button>
          <button onClick={handleSave} disabled={saving} style={{...T.btnPrimary, flex:1, padding:'10px 0', opacity:saving?0.5:1}}>{saving?'保存中...':'保存'}</button>
        </div>
      </div>
    </div>
  );
}

export default function KigenKanri() {
  const [pin, setPin] = useState(null); const [clients, setClients] = useState([]); const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('attention'); const [expandedClient, setExpandedClient] = useState(null);
  const [editClient, setEditClient] = useState(null); const [managerFilter, setManagerFilter] = useState('all');
  const [calSyncMap, setCalSyncMap] = useState({}); const [settingsManager, setSettingsManager] = useState(null);

  useEffect(() => { const saved = localStorage.getItem('kigen-pin'); if (saved) setPin(saved); else setLoading(false);
    const savedMgr = localStorage.getItem('kigen-manager-filter'); if (savedMgr) setManagerFilter(savedMgr); }, []);
  const handleManagerFilterChange = (val) => { setManagerFilter(val); localStorage.setItem('kigen-manager-filter', val); };

  const fetchClients = useCallback(async (p) => { setLoading(true);
    try { const res = await fetch('/api/clients', { headers:{'x-pin':p} });
      if (res.ok) { const data = await res.json(); setClients(data.clients||[]); const syncMap = {};
        (data.clients||[]).forEach(c => { if(c.care_manager) syncMap[c.care_manager] = !!c.calendar_sync; }); setCalSyncMap(syncMap); }
      else if (res.status===401) { localStorage.removeItem('kigen-pin'); setPin(null); }
    } catch(e) { console.error(e); } setLoading(false); }, []);
  useEffect(() => { if(pin) fetchClients(pin); }, [pin, fetchClients]);

  const handleCalSyncToggle = async (name) => { const newVal = !calSyncMap[name]; setCalSyncMap(prev => ({...prev,[name]:newVal}));
    try { await fetch('/api/care-managers', { method:'PUT', headers:{'Content-Type':'application/json','x-pin':pin}, body:JSON.stringify({manager_name:name,calendar_sync:newVal}) }); } catch(e) { console.error(e); } };

  const managers = useMemo(() => { const set = new Set(clients.map(c=>c.care_manager).filter(Boolean)); return Array.from(set).sort(); }, [clients]);
  const filteredClients = useMemo(() => { let list = clients; if(managerFilter!=='all') list = list.filter(c=>c.care_manager===managerFilter); return list; }, [clients,managerFilter]);
  const summary = useMemo(() => { const counts = {expired:0,warning:0,caution:0,safe:0,attention:0,unset:0};
    filteredClients.forEach(client => { if(!hasAnyDeadline(client)){counts.unset++;return;} const statuses=getClientStatuses(client);
      if(statuses.has('expired'))counts.expired++; if(statuses.has('warning'))counts.warning++; if(statuses.has('caution'))counts.caution++;
      if(statuses.has('safe'))counts.safe++; if(statuses.has('expired')||statuses.has('warning')||statuses.has('caution'))counts.attention++; }); return counts; }, [filteredClients]);
  const filteredSortedClients = useMemo(() => { const priority={expired:0,warning:1,caution:2,safe:3};
    let list = filteredClients.map(c=>({...c,worstStatus:getWorstStatus(c)})); list = list.filter(c=>clientMatchesFilter(c,activeFilter));
    list.sort((a,b)=>{ const ap=a.worstStatus===null?99:(priority[a.worstStatus]??5); const bp=b.worstStatus===null?99:(priority[b.worstStatus]??5); return ap-bp; }); return list; }, [filteredClients,activeFilter]);

  const handleSave = (updatedClient) => { setClients(prev=>prev.map(c=>c.id===updatedClient.id?{...updatedClient,calendar_sync:c.calendar_sync}:c)); setEditClient(null); };
  const handleLogout = () => { localStorage.removeItem('kigen-pin'); setPin(null); setClients([]); };
  const handleOpenSettings = () => { if(managerFilter!=='all') setSettingsManager(managerFilter); else if(managers.length===1) setSettingsManager(managers[0]); else setSettingsManager(null); };

  if (!pin) return <PinScreen onAuth={p => setPin(p)} />;
  if (loading) return <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', background:T.bg, fontFamily:"'Noto Sans JP', sans-serif", color:T.muted }}>読み込み中...</div>;

  const FILTER_ITEMS = [
    { key:'safe', label:'余裕あり', color:STATUS_CONFIG.safe.color, count:summary.safe },
    { key:'attention', label:'要注意', count:summary.attention, color:'#8b6914' },
    { key:'warning', label:'30日以内', color:STATUS_CONFIG.warning.color, count:summary.warning },
    { key:'expired', label:'期限切れ', color:STATUS_CONFIG.expired.color, count:summary.expired },
    { key:'unset', label:'未登録', color:T.muted, count:summary.unset },
  ];

  return (
    <div style={{ fontFamily:"'Noto Sans JP', sans-serif", background:T.bg, minHeight:'100vh', color:T.text }}>
      <div style={{ maxWidth:880, margin:'0 auto', padding:'24px 16px 100px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, paddingBottom:16, borderBottom:'2px solid #2d5a7b' }}>
          <div>
            <h1 style={{ margin:0, fontSize:20, fontWeight:600 }}>期限管理</h1>
            <p style={{ margin:'4px 0 0', fontSize:12, color:T.muted }}>
              {new Date().getFullYear()}年{new Date().getMonth()+1}月{new Date().getDate()}日 現在・{clients.length}名
            </p>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button onClick={handleOpenSettings} style={T.btnGear} title="設定"><GearIcon /></button>
            <button onClick={handleLogout} style={T.btnSecondary}>ログアウト</button>
          </div>
        </div>

        {managers.length > 1 && (
          <div style={{ marginBottom:16 }}>
            <select value={managerFilter} onChange={e => handleManagerFilterChange(e.target.value)}
              style={{ width:'100%', padding:'8px 12px', fontSize:13, borderRadius:6, border:'1px solid #d8d8d0', background:'#fff', color:T.text, outline:'none' }}>
              <option value="all">全ケアマネ</option>
              {managers.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        )}

        <div style={{ display:'flex', gap:6, marginBottom:16, overflowX:'auto', paddingBottom:4 }}>
          {FILTER_ITEMS.map(item => (
            <button key={item.key} onClick={() => setActiveFilter(item.key)} style={{
              flexShrink:0, padding:'6px 14px', borderRadius:6, fontSize:12, fontWeight:500, cursor:'pointer',
              background: activeFilter===item.key ? item.color : '#fff',
              color: activeFilter===item.key ? '#fff' : item.color,
              border: `1px solid ${activeFilter===item.key ? item.color : '#d8d8d0'}`,
            }}>{item.label} ({item.count})</button>
          ))}
        </div>

        {(summary.expired > 0 || summary.warning > 0) && (
          <div style={{ ...T.card, padding:'12px 16px', marginBottom:16, background:'#fdf0ee', border:'1px solid #e8c8c8', display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:22 }}>⚠️</span>
            <div>
              <p style={{ margin:0, fontSize:13, fontWeight:600, color:'#c0392b' }}>要対応: {summary.expired + summary.warning}名</p>
              <p style={{ margin:'2px 0 0', fontSize:11, color:'#8b6914' }}>期限切れ {summary.expired}名 ・ 30日以内 {summary.warning}名</p>
            </div>
          </div>
        )}

        <div style={{ borderTop:'1px solid #d8d8d0', paddingTop:12, marginBottom:8, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600, color:T.accent }}>利用者一覧</span>
          <span style={{ fontSize:12, color:T.muted, background:'#eceae3', padding:'2px 10px', borderRadius:10, fontWeight:500 }}>{filteredSortedClients.length}名</span>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        {filteredSortedClients.map(client => {
          const deadlines = DEADLINE_TYPES.map(dt => ({...dt, date:client[dt.key], days:getDaysUntil(client[dt.key]), status:getStatus(getDaysUntil(client[dt.key]))}));
          const worstInfo = client.worstStatus ? STATUS_CONFIG[client.worstStatus] : { color:T.muted, bg:'#eceae3', label:'未設定' };
          const isExpanded = expandedClient === client.id;
          const showCalendar = !!calSyncMap[client.care_manager];
          const visibleCalKeys = getVisibleCalendarKeys(client);
          return (
            <div key={client.id} style={{ background:'#fff', border:'1px solid #d8d8d0', borderRadius:6, borderLeft:`4px solid ${worstInfo.color}`, overflow:'hidden', boxShadow:'0 1px 2px rgba(0,0,0,.04)' }}>
              <div onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                style={{ padding:'8px 16px', cursor:'pointer', display:'flex', alignItems:'center' }}>
                <span style={{ fontSize:14, fontWeight:600, minWidth:100, flexShrink:0 }}>{client.name}</span>
                <span style={{ fontSize:10, fontWeight:600, color:worstInfo.color, background:worstInfo.bg, padding:'2px 8px', borderRadius:4, flexShrink:0, marginRight:10 }}>{worstInfo.label}</span>
                {client.care_manager && <span style={{ fontSize:12, color:T.muted, flexShrink:0, marginRight:16 }}>担当:{client.care_manager}</span>}
                <span style={{ display:'flex', gap:12, alignItems:'center', flex:1, justifyContent:'flex-end', marginRight:8 }}>
                  {DEADLINE_TYPES.map(dt => <DeadlineSummaryInline key={dt.key} days={getDaysUntil(client[dt.key])} label={dt.short} />)}
                </span>
                <span style={{ fontSize:13, color:T.muted, flexShrink:0, transform:isExpanded?'rotate(180deg)':'rotate(0deg)', transition:'transform 0.2s' }}>▼</span>
              </div>
              {isExpanded && (
                <div style={{ padding:'0 16px 14px', borderTop:'1px solid #eceae3' }}>
                  {deadlines.map(dl => (
                    <div key={dl.key} style={{ padding:'10px 0', borderBottom:'1px solid #f0efe8' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div>
                          <span style={{ fontSize:12, fontWeight:600, color:T.sub }}>{dl.label}</span>
                          <span style={{ fontSize:11, color:T.muted, marginLeft:8 }}>{formatDate(dl.date)}</span>
                        </div>
                        <DaysBadge days={dl.days} />
                      </div>
                      {showCalendar && visibleCalKeys.includes(dl.key) && <CalendarPreview typeKey={dl.key} userName={client.name} dateStr={dl.date} />}
                    </div>
                  ))}
                  <button onClick={() => setEditClient(client)} style={{ width:'100%', padding:10, marginTop:10, ...T.btnSecondary, fontSize:13 }}>期限を編集</button>
                </div>
              )}
            </div>
          );
        })}
        </div>
        {filteredSortedClients.length === 0 && (
          <div style={{ textAlign:'center', padding:40, color:T.muted }}><div style={{ fontSize:40, marginBottom:12 }}>📋</div><p>該当する利用者はいません</p></div>
        )}
        <div style={{ fontSize:11, color:T.muted, textAlign:'center', padding:20 }}>Copyright &copy; 2026 tkrsys All rights reserved.</div>
      </div>

      {editClient && <DeadlineForm client={editClient} pin={pin} onSave={handleSave} onClose={() => setEditClient(null)} showCalendar={!!calSyncMap[editClient.care_manager]} />}
      {settingsManager && <SettingsModal manager={settingsManager} calSyncMap={calSyncMap} onToggle={handleCalSyncToggle} onClose={() => setSettingsManager(null)} />}
    </div>
  );
}
