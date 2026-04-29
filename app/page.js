'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

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

function getDaysUntil(dateStr) { if (!dateStr) return null; const today = new Date(); today.setHours(0,0,0,0); const n = typeof dateStr==='string'?dateStr.split('T')[0]:dateStr; return Math.floor((new Date(n+'T00:00:00')-today)/(1000*60*60*24)); }
function getStatus(days) { if(days===null)return null; if(days<0)return'expired'; if(days<=30)return'warning'; if(days<=75)return'caution'; return'safe'; }
function formatDate(dateStr) { if(!dateStr)return'未設定'; const n=typeof dateStr==='string'?dateStr.split('T')[0]:dateStr; const d=new Date(n+'T00:00:00'); return`${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`; }
function toInputDate(dateStr) { if(!dateStr)return''; return typeof dateStr==='string'?dateStr.split('T')[0]:''; }
function normalizeClientDate(dateStr) { if(!dateStr)return null; return typeof dateStr==='string'?dateStr.split('T')[0]:dateStr; }
function getNoticeDateStr(dateStr,mb) { const d=new Date(dateStr+'T00:00:00'); let y=d.getFullYear(),m=d.getMonth()-mb; if(m<0){m+=12;y-=1;} return`${y}-${String(m+1).padStart(2,'0')}-25`; }
function getActionMonth(dateStr,offset) { const d=new Date(dateStr+'T00:00:00'); let m=d.getMonth()+1+offset; if(m<=0)m+=12; if(m>12)m-=12; return m; }
function buildCalendarTitles(typeKey,userName,dateStr) { if(!dateStr)return null; const n=typeof dateStr==='string'?dateStr.split('T')[0]:dateStr; const config=CAL_CONFIG[typeKey]; const d=new Date(n+'T00:00:00'); const endLabel=`${d.getMonth()+1}/${d.getDate()}`; const pre=getNoticeDateStr(n,2),mid=getNoticeDateStr(n,1),day=getNoticeDateStr(n,0); const pD=new Date(pre+'T00:00:00'),mD=new Date(mid+'T00:00:00'),dD=new Date(day+'T00:00:00'); return { pre:{date:`${pD.getMonth()+1}/${pD.getDate()}`,title:`【${config.label} 2ヶ月前】${userName} ${endLabel}(${getActionMonth(n,-1)}月 ${config.preAction})`}, mid:{date:`${mD.getMonth()+1}/${mD.getDate()}`,title:`【${config.label} 1ヶ月前】${userName} ${endLabel}(${getActionMonth(n,0)}月 ${config.midAction})`}, day:{date:`${dD.getMonth()+1}/${dD.getDate()}`,title:`【${config.label}　　　　】${userName} ${endLabel}`} }; }
function getWorstStatus(client) { const p={expired:0,warning:1,caution:2,safe:3}; let w=null; for(const dt of DEADLINE_TYPES){const s=getStatus(getDaysUntil(client[dt.key]));if(s===null)continue;if(w===null||p[s]<p[w])w=s;} return w; }
function getClientStatuses(client) { const s=new Set(); for(const dt of DEADLINE_TYPES){const st=getStatus(getDaysUntil(client[dt.key]));if(st!==null)s.add(st);} return s; }
function hasAnyDeadline(client) { return DEADLINE_TYPES.some(dt=>client[dt.key]); }
function clientMatchesFilter(client,filter) { if(filter==='unset')return!hasAnyDeadline(client); const s=getClientStatuses(client);if(s.size===0)return false; if(filter==='attention')return s.has('expired')||s.has('warning')||s.has('caution'); return s.has(filter); }
function getVisibleCalendarKeys(client) { const n=normalizeClientDate(client.nintei_end),l=normalizeClientDate(client.long_end),s=normalizeClientDate(client.short_end); const k=[]; if(n)k.push('nintei_end'); if(l&&!(n&&n===l))k.push('long_end'); if(s&&!(n&&n===s)&&!(l&&l===s))k.push('short_end'); return k; }

const T = { bg:'#f5f3ee', accent:'#2d5a7b', text:'#1a1a2e', sub:'#4a4a5a', muted:'#8888a0', border:'#d8d8d0',
  card:{background:'#fff',border:'1px solid #d8d8d0',borderRadius:8,padding:'16px 20px',marginBottom:12,boxShadow:'0 1px 3px rgba(0,0,0,.06)'},
  barStyle:{display:'inline-block',width:3,height:16,background:'#2d5a7b',borderRadius:2},
  secTitle:{fontSize:14,fontWeight:600,color:'#2d5a7b',display:'flex',alignItems:'center',gap:8,marginBottom:12},
  btnPrimary:{padding:'8px 18px',background:'#2d5a7b',color:'#fff',border:'none',borderRadius:6,fontSize:13,fontWeight:500,cursor:'pointer'},
  btnSecondary:{padding:'8px 18px',background:'#fff',color:'#4a4a5a',border:'1px solid #d8d8d0',borderRadius:6,fontSize:13,fontWeight:500,cursor:'pointer'},
  btnBack:{padding:'6px 16px',background:'#fff',color:'#2d5a7b',border:'1px solid #d8d8d0',borderRadius:6,fontSize:13,fontWeight:500,cursor:'pointer'},
  btnGear:{padding:'6px 10px',background:'transparent',color:'#8888a0',border:'1px solid #d8d8d0',borderRadius:6,cursor:'pointer',display:'flex',alignItems:'center'},
};
const GearIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8888a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
const EyeIcon = ({show}) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8888a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{show?<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>:<><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>}</svg>;

function DaysBadge({days}){if(days===null)return<span style={{fontSize:11,color:T.muted,padding:'2px 8px',borderRadius:4,background:'#eceae3'}}>未設定</span>;const s=getStatus(days),c=STATUS_CONFIG[s];return<span style={{fontSize:11,fontWeight:600,color:c.color,background:c.bg,padding:'2px 8px',borderRadius:4}}>{s==='expired'?`${Math.abs(days)}日超過`:`あと${days}日`}</span>;}
function DeadlineSummaryInline({days,label}){if(days===null)return<span style={{fontSize:12,color:T.muted}}>{label}:未設定</span>;const s=getStatus(days),c=STATUS_CONFIG[s];return<span style={{fontSize:12,color:c.color,fontWeight:600}}>{label}:{s==='expired'?`${Math.abs(days)}日超過`:`あと${days}日`}</span>;}
function CalendarPreview({typeKey,userName,dateStr}){const titles=buildCalendarTitles(typeKey,userName,dateStr);if(!titles)return null;return(<div style={{marginTop:6,padding:'8px 12px',background:'#fafaf8',borderRadius:6,border:'1px solid #d8d8d0'}}><p style={{margin:0,fontSize:10,fontWeight:600,color:T.accent,marginBottom:4}}>📅 登録情報</p><div style={{fontSize:11,color:T.sub,lineHeight:1.6}}>{[titles.pre,titles.mid,titles.day].map((t,i)=>(<div key={i} style={{display:'flex',gap:6,alignItems:'flex-start',marginTop:i?3:0}}><span style={{flexShrink:0,fontSize:10,padding:'1px 6px',borderRadius:4,background:'#eceae3',color:T.sub,fontWeight:600}}>{t.date}</span><span style={{wordBreak:'break-all'}}>{t.title}</span></div>))}</div></div>);}

function PinScreen({onAuth}){
  const[pin,setPin]=useState('');const[error,setError]=useState('');const[loading,setLoading]=useState(false);const[showPin,setShowPin]=useState(false);
  const submit=async()=>{if(!pin.trim()){setError('パスワードを入力してください');return;}setLoading(true);setError('');try{const res=await fetch('/api/clients',{headers:{'x-pin':pin}});if(res.ok){localStorage.setItem('kigen-pin',pin);onAuth(pin);}else setError('パスワードが正しくありません');}catch{setError('接続エラー');}setLoading(false);};
  return(<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:T.bg,fontFamily:"'Noto Sans JP', sans-serif"}}><div style={{background:'#fff',padding:40,borderRadius:12,boxShadow:'0 4px 20px rgba(0,0,0,0.1)',textAlign:'center',maxWidth:360,width:'100%'}}><div style={{fontSize:40,marginBottom:12}}>🔒</div><h2 style={{fontSize:18,fontWeight:600,marginBottom:8}}>期限管理システム</h2><p style={{fontSize:13,color:T.muted,marginBottom:24}}>パスワードを入力してアクセス</p><div style={{position:'relative',marginBottom:16,height:48}}><input type={showPin?'text':'password'} value={pin} onChange={e=>{setPin(e.target.value);setError('');}} onKeyDown={e=>e.key==='Enter'&&submit()} placeholder="パスワード" autoFocus style={{textAlign:'center',fontSize:16,width:'100%',height:48,lineHeight:'48px',boxSizing:'border-box',padding:'0 40px 0 0'}}/><button type="button" onMouseDown={()=>setShowPin(true)} onMouseUp={()=>setShowPin(false)} onMouseLeave={()=>setShowPin(false)} onTouchStart={()=>setShowPin(true)} onTouchEnd={()=>setShowPin(false)} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',padding:4,display:'flex',alignItems:'center'}}><EyeIcon show={showPin}/></button></div>{error&&<p style={{color:'#c0392b',fontSize:13,marginBottom:12}}>{error}</p>}<button onClick={submit} disabled={loading} style={{width:'100%',padding:10,background:'#2d5a7b',color:'#fff',border:'none',borderRadius:6,fontSize:14,fontWeight:500,opacity:loading?0.5:1}}>{loading?'認証中...':'ログイン'}</button></div></div>);}

function DeadlineForm({client,onSave,onClose,pin,showCalendar}){
  const[form,setForm]=useState({nintei_end:toInputDate(client.nintei_end),long_end:toInputDate(client.long_end),short_end:toInputDate(client.short_end)});
  const[saving,setSaving]=useState(false);const[error,setError]=useState('');
  const visibleCalKeys=useMemo(()=>{const n=form.nintei_end||null,l=form.long_end||null,s=form.short_end||null,k=[];if(n)k.push('nintei_end');if(l&&!(n&&n===l))k.push('long_end');if(s&&!(n&&n===s)&&!(l&&l===s))k.push('short_end');return k;},[form]);
  const handleSave=async()=>{setSaving(true);setError('');try{const res=await fetch(`/api/clients/${client.id}/deadlines`,{method:'PUT',headers:{'Content-Type':'application/json','x-pin':pin},body:JSON.stringify(form)});if(res.ok){const data=await res.json();onSave(data.client);}else{const data=await res.json();setError(data.error||'保存に失敗しました');}}catch{setError('接続エラー');}setSaving(false);};
  return(<div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,fontFamily:"'Noto Sans JP', sans-serif"}} onClick={e=>e.target===e.currentTarget&&onClose()}><div style={{width:'100%',maxWidth:440,backgroundColor:'#fff',borderRadius:12,padding:'28px 24px',boxShadow:'0 4px 20px rgba(0,0,0,0.1)',maxHeight:'85vh',overflow:'auto'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,paddingBottom:12,borderBottom:'2px solid #2d5a7b'}}><div><h2 style={{margin:0,fontSize:16,fontWeight:600,color:T.text}}>期限設定</h2><p style={{margin:'4px 0 0',fontSize:13,color:T.muted}}>{client.name}{client.care_manager?` ・ 担当: ${client.care_manager}`:''}</p></div><button onClick={onClose} style={{background:'none',border:'none',fontSize:18,color:T.muted,cursor:'pointer'}}>✕</button></div>
    {DEADLINE_TYPES.map(dt=>(<div key={dt.key} style={{marginBottom:16}}><label style={{display:'block',fontSize:12,fontWeight:500,color:T.sub,marginBottom:6}}>{dt.label}</label><input type="date" value={form[dt.key]} onChange={e=>setForm({...form,[dt.key]:e.target.value})} style={{width:'100%',padding:10,fontSize:14,border:'1px solid #d8d8d0',borderRadius:6,outline:'none',boxSizing:'border-box',color:T.text}}/>{showCalendar&&form[dt.key]&&visibleCalKeys.includes(dt.key)&&<CalendarPreview typeKey={dt.key} userName={client.name} dateStr={form[dt.key]}/>}</div>))}
    {error&&<p style={{color:'#c0392b',fontSize:13,margin:'8px 0'}}>{error}</p>}<div style={{display:'flex',gap:10,marginTop:20}}><button onClick={onClose} style={{...T.btnSecondary,flex:1,padding:'10px 0'}}>キャンセル</button><button onClick={handleSave} disabled={saving} style={{...T.btnPrimary,flex:1,padding:'10px 0',opacity:saving?0.5:1}}>{saving?'保存中...':'保存'}</button></div></div></div>);}

export default function KigenKanri(){
  const[pin,setPin]=useState(null);const[clients,setClients]=useState([]);const[loading,setLoading]=useState(true);
  const[activeFilter,setActiveFilter]=useState('attention');const[expandedClient,setExpandedClient]=useState(null);
  const[editClient,setEditClient]=useState(null);const[managerFilter,setManagerFilter]=useState('all');
  const[calSyncMap,setCalSyncMap]=useState({});const[isAdmin,setIsAdmin]=useState(false);
  const[showGearMenu,setShowGearMenu]=useState(false);const[mode,setMode]=useState('list');
  const gearRef=useRef(null);

  useEffect(()=>{const saved=localStorage.getItem('kigen-pin');if(saved)setPin(saved);else setLoading(false);
    const savedMgr=localStorage.getItem('kigen-manager-filter');if(savedMgr)setManagerFilter(savedMgr);
    const savedRole=localStorage.getItem('auth_role');setIsAdmin(savedRole==='admin');},[]);
  useEffect(()=>{if(!showGearMenu)return;const h=e=>{if(gearRef.current&&!gearRef.current.contains(e.target))setShowGearMenu(false);};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h);},[showGearMenu]);
  const handleManagerFilterChange=(val)=>{setManagerFilter(val);localStorage.setItem('kigen-manager-filter',val);};

  const fetchClients=useCallback(async(p)=>{setLoading(true);try{const res=await fetch('/api/clients',{headers:{'x-pin':p}});if(res.ok){const data=await res.json();setClients(data.clients||[]);const syncMap={};(data.clients||[]).forEach(c=>{if(c.care_manager)syncMap[c.care_manager]=!!c.calendar_sync;});setCalSyncMap(syncMap);}else if(res.status===401){localStorage.removeItem('kigen-pin');setPin(null);}}catch(e){console.error(e);}setLoading(false);},[]);
  useEffect(()=>{if(pin)fetchClients(pin);},[pin,fetchClients]);

  const handleCalSyncToggle=async(name)=>{const newVal=!calSyncMap[name];setCalSyncMap(prev=>({...prev,[name]:newVal}));try{await fetch('/api/care-managers',{method:'PUT',headers:{'Content-Type':'application/json','x-pin':pin},body:JSON.stringify({manager_name:name,calendar_sync:newVal})});}catch(e){console.error(e);}};

  const managers=useMemo(()=>{const set=new Set(clients.map(c=>c.care_manager).filter(Boolean));return Array.from(set).sort();},[clients]);
  const filteredClients=useMemo(()=>{let list=clients;if(managerFilter!=='all')list=list.filter(c=>c.care_manager===managerFilter);return list;},[clients,managerFilter]);
  const summary=useMemo(()=>{const counts={expired:0,warning:0,caution:0,safe:0,attention:0,unset:0};filteredClients.forEach(client=>{if(!hasAnyDeadline(client)){counts.unset++;return;}const statuses=getClientStatuses(client);if(statuses.has('expired'))counts.expired++;if(statuses.has('warning'))counts.warning++;if(statuses.has('caution'))counts.caution++;if(statuses.has('safe'))counts.safe++;if(statuses.has('expired')||statuses.has('warning')||statuses.has('caution'))counts.attention++;});return counts;},[filteredClients]);
  const filteredSortedClients=useMemo(()=>{const priority={expired:0,warning:1,caution:2,safe:3};let list=filteredClients.map(c=>({...c,worstStatus:getWorstStatus(c)}));list=list.filter(c=>clientMatchesFilter(c,activeFilter));list.sort((a,b)=>{const ap=a.worstStatus===null?99:(priority[a.worstStatus]??5);const bp=b.worstStatus===null?99:(priority[b.worstStatus]??5);return ap-bp;});return list;},[filteredClients,activeFilter]);

  const handleSave=(updatedClient)=>{setClients(prev=>prev.map(c=>c.id===updatedClient.id?{...updatedClient,calendar_sync:c.calendar_sync}:c));setEditClient(null);};
  const handleLogout=()=>{setShowGearMenu(false);localStorage.removeItem('kigen-pin');localStorage.removeItem('auth_role');localStorage.removeItem('portal_authed');localStorage.removeItem('auth_pin');setPin(null);setClients([]);};

  if(!pin)return<PinScreen onAuth={p=>setPin(p)}/>;
  if(loading)return<div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'100vh',background:T.bg,fontFamily:"'Noto Sans JP', sans-serif",color:T.muted}}>読み込み中...</div>;

  const FILTER_ITEMS=[
    {key:'safe',label:'余裕あり',color:STATUS_CONFIG.safe.color,count:summary.safe},
    {key:'attention',label:'要注意',count:summary.attention,color:'#8b6914'},
    {key:'warning',label:'30日以内',color:STATUS_CONFIG.warning.color,count:summary.warning},
    {key:'expired',label:'期限切れ',color:STATUS_CONFIG.expired.color,count:summary.expired},
    {key:'unset',label:'未登録',color:T.muted,count:summary.unset},
  ];

  const gearMenu = (
    <div ref={gearRef} style={{position:'relative'}}>
      <button onClick={()=>setShowGearMenu(!showGearMenu)} style={T.btnGear}><GearIcon/></button>
      {showGearMenu && (
        <div style={{position:'absolute',right:0,top:'100%',marginTop:4,background:'#fff',border:'1px solid #d8d8d0',borderRadius:8,boxShadow:'0 4px 16px rgba(0,0,0,.12)',minWidth:180,zIndex:50,overflow:'hidden'}}>
          <button onClick={handleLogout} style={{display:'block',width:'100%',padding:'10px 16px',background:'none',border:'none',borderBottom:'1px solid #f0f0f0',fontSize:13,color:'#4a4a5a',textAlign:'left',cursor:'pointer'}}>ログアウト</button>
          {isAdmin && <button onClick={()=>{setShowGearMenu(false);setMode('calendarSync');}} style={{display:'block',width:'100%',padding:'10px 16px',background:'none',border:'none',fontSize:13,color:'#4a4a5a',textAlign:'left',cursor:'pointer'}}>カレンダー連携設定</button>}
        </div>
      )}
    </div>
  );

  if(mode==='calendarSync'){
    return(
      <div style={{fontFamily:"'Noto Sans JP', sans-serif",background:T.bg,minHeight:'100vh',color:T.text}}>
        <div style={{maxWidth:880,margin:'0 auto',padding:'24px 16px 100px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,paddingBottom:16,borderBottom:'2px solid #2d5a7b'}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <h1 style={{margin:0,fontSize:20,fontWeight:600}}>期限管理</h1>
              {isAdmin&&<span style={{fontSize:11,fontWeight:600,color:'#fff',background:'#c0392b',padding:'2px 8px',borderRadius:4}}>管理者</span>}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <button onClick={()=>setMode('list')} style={T.btnBack}>← 戻る</button>
              {gearMenu}
            </div>
          </div>
          <div style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:20}}>カレンダー連携設定</div>
          <div style={T.card}>
            <div style={T.secTitle}><span style={T.barStyle}></span>Googleカレンダー同期</div>
            <p style={{margin:'0 0 16px',fontSize:12,color:T.muted,lineHeight:1.5}}>
              ☑にすると、担当利用者の期限予定がGoogleカレンダーに自動同期されます。</p>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {managers.map(m=>{const isSynced=!!calSyncMap[m]; return(
                <label key={m} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:8,cursor:'pointer',
                  background:isSynced?'#e8f5f0':'#fafaf8',border:`1px solid ${isSynced?'#27766a':'#d8d8d0'}`}}>
                  <input type="checkbox" checked={isSynced} onChange={()=>handleCalSyncToggle(m)} style={{accentColor:'#2d5a7b',width:16,height:16,flexShrink:0}}/>
                  <span style={{fontSize:14,fontWeight:500,color:T.text}}>{m}</span>
                  <span style={{fontSize:11,color:isSynced?'#27766a':T.muted,marginLeft:'auto'}}>{isSynced?'同期ON':'同期OFF'}</span>
                </label>
              );})}
            </div>
          </div>
          <div style={{fontSize:11,color:T.muted,textAlign:'center',padding:20}}>Copyright &copy; 2026 tkrsys All rights reserved.</div>
        </div>
      </div>
    );
  }

  return(
    <div style={{fontFamily:"'Noto Sans JP', sans-serif",background:T.bg,minHeight:'100vh',color:T.text}}>
      <div style={{maxWidth:880,margin:'0 auto',padding:'24px 16px 100px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,paddingBottom:16,borderBottom:'2px solid #2d5a7b'}}>
          <div>
            <h1 style={{margin:0,fontSize:20,fontWeight:600}}>期限管理</h1>
            <p style={{margin:'4px 0 0',fontSize:12,color:T.muted}}>{new Date().getFullYear()}年{new Date().getMonth()+1}月{new Date().getDate()}日 現在・{clients.length}名</p>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {gearMenu}
          </div>
        </div>

        <div style={{fontSize:14,fontWeight:600,color:'#2d5a7b',marginBottom:10,display:'flex',alignItems:'center',gap:8}}>
          <span style={T.barStyle}></span>検索
        </div>
        <div style={{display:'flex',gap:8,marginBottom:16,alignItems:'center',flexWrap:'wrap'}}>
          {FILTER_ITEMS.map(item=>(
            <button key={item.key} onClick={()=>setActiveFilter(item.key)} style={{
              flexShrink:0,padding:'6px 14px',borderRadius:6,fontSize:12,fontWeight:500,cursor:'pointer',
              background:activeFilter===item.key?item.color:'#fff',
              color:activeFilter===item.key?'#fff':item.color,
              border:`1px solid ${activeFilter===item.key?item.color:'#d8d8d0'}`,
            }}>{item.label} ({item.count})</button>
          ))}
          {managers.length>1&&(
            <select value={managerFilter} onChange={e=>handleManagerFilterChange(e.target.value)}
              style={{padding:'6px 12px',fontSize:12,borderRadius:6,border:'1px solid #d8d8d0',background:'#fff',color:T.text,outline:'none',marginLeft:'auto'}}>
              <option value="all">全ケアマネ</option>
              {managers.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          )}
        </div>

        {(summary.expired>0||summary.warning>0)&&(
          <div style={{...T.card,padding:'12px 16px',marginBottom:16,background:'#fdf0ee',border:'1px solid #e8c8c8',display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:22}}>⚠️</span>
            <div>
              <p style={{margin:0,fontSize:13,fontWeight:600,color:'#c0392b'}}>要対応: {summary.expired+summary.warning}名</p>
              <p style={{margin:'2px 0 0',fontSize:11,color:'#8b6914'}}>期限切れ {summary.expired}名 ・ 30日以内 {summary.warning}名</p>
            </div>
          </div>
        )}

        <div style={{borderTop:'1px solid #d8d8d0',paddingTop:12,marginBottom:8,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontSize:14,fontWeight:600,color:T.accent}}>検索結果</span>
          <span style={{fontSize:12,color:T.muted,background:'#eceae3',padding:'2px 10px',borderRadius:10,fontWeight:500}}>{filteredSortedClients.length}名</span>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:4}}>
        {filteredSortedClients.map(client=>{
          const deadlines=DEADLINE_TYPES.map(dt=>({...dt,date:client[dt.key],days:getDaysUntil(client[dt.key]),status:getStatus(getDaysUntil(client[dt.key]))}));
          const worstInfo=client.worstStatus?STATUS_CONFIG[client.worstStatus]:{color:T.muted,bg:'#eceae3',label:'未設定'};
          const isExpanded=expandedClient===client.id;
          const showCalendar=!!calSyncMap[client.care_manager];
          const visibleCalKeys=getVisibleCalendarKeys(client);
          return(
            <div key={client.id} style={{background:'#fff',border:'1px solid #d8d8d0',borderRadius:6,borderLeft:`4px solid ${worstInfo.color}`,overflow:'hidden',boxShadow:'0 1px 2px rgba(0,0,0,.04)'}}>
              <div onClick={()=>setExpandedClient(isExpanded?null:client.id)} style={{padding:'8px 16px',cursor:'pointer',display:'flex',alignItems:'center'}}>
                <span style={{fontSize:14,fontWeight:600,minWidth:100,flexShrink:0}}>{client.name}</span>
                <span style={{fontSize:10,fontWeight:600,color:worstInfo.color,background:worstInfo.bg,padding:'2px 8px',borderRadius:4,flexShrink:0,marginRight:10}}>{worstInfo.label}</span>
                {client.care_manager&&<span style={{fontSize:12,color:T.muted,flexShrink:0,marginRight:16}}>担当:{client.care_manager}</span>}
                <span style={{display:'flex',gap:12,alignItems:'center',flex:1,justifyContent:'flex-end',marginRight:8}}>
                  {DEADLINE_TYPES.map(dt=><DeadlineSummaryInline key={dt.key} days={getDaysUntil(client[dt.key])} label={dt.short}/>)}
                </span>
                <span style={{fontSize:13,color:T.muted,flexShrink:0,transform:isExpanded?'rotate(180deg)':'rotate(0deg)',transition:'transform 0.2s'}}>▼</span>
              </div>
              {isExpanded&&(
                <div style={{padding:'0 16px 14px',borderTop:'1px solid #eceae3'}}>
                  {deadlines.map(dl=>(
                    <div key={dl.key} style={{padding:'10px 0',borderBottom:'1px solid #f0efe8'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div><span style={{fontSize:12,fontWeight:600,color:T.sub}}>{dl.label}</span><span style={{fontSize:11,color:T.muted,marginLeft:8}}>{formatDate(dl.date)}</span></div>
                        <DaysBadge days={dl.days}/>
                      </div>
                      {showCalendar&&visibleCalKeys.includes(dl.key)&&<CalendarPreview typeKey={dl.key} userName={client.name} dateStr={dl.date}/>}
                    </div>
                  ))}
                  <button onClick={()=>setEditClient(client)} style={{width:'100%',padding:10,marginTop:10,...T.btnSecondary,fontSize:13}}>期限を編集</button>
                </div>
              )}
            </div>
          );
        })}
        </div>
        {filteredSortedClients.length===0&&(
          <div style={{textAlign:'center',padding:40,color:T.muted}}><div style={{fontSize:40,marginBottom:12}}>📋</div><p>該当する利用者はいません</p></div>
        )}
        <div style={{fontSize:11,color:T.muted,textAlign:'center',padding:20}}>Copyright &copy; 2026 tkrsys All rights reserved.</div>
      </div>

      {editClient&&<DeadlineForm client={editClient} pin={pin} onSave={handleSave} onClose={()=>setEditClient(null)} showCalendar={!!calSyncMap[editClient.care_manager]}/>}
    </div>
  );
}
