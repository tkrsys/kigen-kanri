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
const GANTT_BAR_COLORS = {
  nintei_end: { bar: '#2d5a7b', light: '#d4e4ef' },
  long_end:   { bar: '#5a8a5e', light: '#d8ead8' },
  short_end:  { bar: '#8b6914', light: '#f0e6cc' },
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
function getCalendarFeedUrl(managerName) { const base='https://careplan-kigen.vercel.app/api/calendar-feed?token=kenkou1975'; if(!managerName)return base; return base+'&manager='+encodeURIComponent(managerName); }

function parseYearMonthToLastDay(input) {
  if(!input||!input.trim())return null;
  const s=input.trim().replace(/[／]/g,'/').replace(/[ー−]/g,'-');
  let year,month;
  const reiwa=s.match(/^[Rr](\d{1,2})[\/\-](\d{1,2})$/);
  if(reiwa){
    year=parseInt(reiwa[1],10)+2018;
    month=parseInt(reiwa[2],10);
  }else{
    const seireki=s.match(/^(\d{4})[\/\-](\d{1,2})$/);
    if(!seireki)return null;
    year=parseInt(seireki[1],10);
    month=parseInt(seireki[2],10);
  }
  if(month<1||month>12||year<2000||year>2100)return null;
  const lastDay=new Date(year,month,0).getDate();
  return`${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
}

function YearMonthShortcut({onApply}){
  const[val,setVal]=useState('');
  const[msg,setMsg]=useState(null);
  const handleApply=()=>{
    const result=parseYearMonthToLastDay(val);
    if(result){
      onApply(result);
      const d=new Date(result+'T00:00:00');
      setMsg({ok:true,text:`→ ${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} を設定`});
      setVal('');
      setTimeout(()=>setMsg(null),2000);
    }else{
      setMsg({ok:false,text:'例: 2026/4 or R8/4'});
      setTimeout(()=>setMsg(null),2000);
    }
  };
  return(
    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
      <input type="text" value={val} onChange={e=>{setVal(e.target.value);setMsg(null);}}
        onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();handleApply();}}}
        placeholder="年/月 or R8/4 → 末日"
        style={{width:140,padding:'5px 8px',fontSize:12,border:'1px solid #d8d8d0',borderRadius:5,outline:'none',color:'#4a4a5a',boxSizing:'border-box'}}/>
      <button type="button" onClick={handleApply}
        style={{padding:'4px 10px',fontSize:11,fontWeight:500,border:'1px solid #d8d8d0',borderRadius:5,background:'#f5f3ee',color:'#2d5a7b',cursor:'pointer',whiteSpace:'nowrap'}}>
        末日設定
      </button>
      {msg&&<span style={{fontSize:10,color:msg.ok?'#27766a':'#c0392b',fontWeight:500}}>{msg.text}</span>}
    </div>
  );
}

function GanttChart({clients,onEditClient}){
  const today=new Date();today.setHours(0,0,0,0);
  const MONTHS=12;
  const MON_W=80;
  const NAME_W=100;
  const ROW_H=20;
  const CLIENT_GAP=4;
  const HEADER_H=32;

  const startDate=new Date(today.getFullYear(),today.getMonth(),1);
  const months=useMemo(()=>{const arr=[];for(let i=0;i<MONTHS;i++){const d=new Date(startDate.getFullYear(),startDate.getMonth()+i,1);arr.push(d);}return arr;},[]);
  const endDate=new Date(startDate.getFullYear(),startDate.getMonth()+MONTHS,0);
  const totalDays=(endDate-startDate)/(1000*60*60*24);
  const chartW=MON_W*MONTHS;

  const dayToX=(date)=>{const d=new Date(typeof date==='string'?date+'T00:00:00':date);const diff=(d-startDate)/(1000*60*60*24);return Math.max(0,Math.min(chartW,(diff/totalDays)*chartW));};
  const todayX=dayToX(today);

  const ganttClients=useMemo(()=>{
    return clients.filter(c=>hasAnyDeadline(c)).sort((a,b)=>{
      const pa={expired:0,warning:1,caution:2,safe:3};
      const wa=getWorstStatus(a),wb=getWorstStatus(b);
      const sa=wa===null?99:(pa[wa]??5),sb=wb===null?99:(pa[wb]??5);
      return sa-sb;
    });
  },[clients]);

  const scrollRef=useRef(null);
  useEffect(()=>{if(scrollRef.current){const scrollTo=Math.max(0,todayX-150);scrollRef.current.scrollLeft=scrollTo;}},[]);

  const totalH=ganttClients.reduce((sum)=>sum+DEADLINE_TYPES.length*ROW_H+CLIENT_GAP+24,0)+HEADER_H;

  return(
    <div style={{background:'#fff',border:'1px solid #d8d8d0',borderRadius:8,overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
      <div style={{display:'flex',marginBottom:12,padding:'10px 12px 0',gap:12,flexWrap:'wrap'}}>
        {DEADLINE_TYPES.map(dt=>(
          <span key={dt.key} style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:T.sub}}>
            <span style={{display:'inline-block',width:12,height:8,borderRadius:2,background:GANTT_BAR_COLORS[dt.key].bar}}/>
            {dt.short}
          </span>
        ))}
        <span style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:'#c0392b'}}>
          <span style={{display:'inline-block',width:1,height:10,background:'#c0392b'}}/>今日
        </span>
      </div>
      <div style={{display:'flex'}}>
        {/* 名前列（固定） */}
        <div style={{flexShrink:0,width:NAME_W,borderRight:'1px solid #d8d8d0',background:'#fafaf8'}}>
          <div style={{height:HEADER_H,borderBottom:'1px solid #d8d8d0',padding:'0 8px',display:'flex',alignItems:'center'}}>
            <span style={{fontSize:11,fontWeight:600,color:T.accent}}>利用者名</span>
          </div>
          {ganttClients.map(client=>{
            const ws=getWorstStatus(client);
            const worstColor=ws?STATUS_CONFIG[ws].color:T.muted;
            return(
              <div key={client.id} style={{borderBottom:'1px solid #eceae3'}}>
                <div style={{padding:'4px 8px 2px',borderLeft:`3px solid ${worstColor}`}}>
                  <div onClick={()=>onEditClient(client)} style={{fontSize:11,fontWeight:600,color:T.text,cursor:'pointer',lineHeight:1.3}} title="クリックして編集">{client.name}</div>
                  <div style={{fontSize:9,color:T.muted,marginBottom:2}}>{client.care_manager||''}</div>
                </div>
                {DEADLINE_TYPES.map(dt=>(
                  <div key={dt.key} style={{height:ROW_H,display:'flex',alignItems:'center',padding:'0 8px'}}>
                    <span style={{fontSize:9,color:T.muted}}>{dt.short}</span>
                  </div>
                ))}
                <div style={{height:CLIENT_GAP}}/>
              </div>
            );
          })}
        </div>
        {/* チャート部分（スクロール） */}
        <div ref={scrollRef} style={{flex:1,overflowX:'auto',overflowY:'hidden'}}>
          <div style={{minWidth:chartW,position:'relative'}}>
            {/* 月ヘッダー */}
            <div style={{display:'flex',height:HEADER_H,borderBottom:'1px solid #d8d8d0'}}>
              {months.map((m,i)=>{
                const isCurrentMonth=m.getFullYear()===today.getFullYear()&&m.getMonth()===today.getMonth();
                return(
                  <div key={i} style={{width:MON_W,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',
                    borderRight:'1px solid #eceae3',fontSize:11,fontWeight:isCurrentMonth?700:400,
                    color:isCurrentMonth?T.accent:T.muted,background:isCurrentMonth?'#e8f0f5':'transparent'}}>
                    {m.getMonth()+1}月
                  </div>
                );
              })}
            </div>
            {/* クライアント行 */}
            {ganttClients.map(client=>(
              <div key={client.id} style={{borderBottom:'1px solid #eceae3',position:'relative'}}>
                <div style={{padding:'4px 0 2px',height:16}}/>
                <div style={{fontSize:9,color:'transparent',marginBottom:2,height:10}}>&nbsp;</div>
                {DEADLINE_TYPES.map(dt=>{
                  const dateStr=client[dt.key];
                  const days=getDaysUntil(dateStr);
                  const status=getStatus(days);
                  if(!dateStr) return <div key={dt.key} style={{height:ROW_H}}/>;
                  const endX=dayToX(dateStr);
                  const barStart=0;
                  const barWidth=Math.max(2,endX-barStart);
                  let barColor=GANTT_BAR_COLORS[dt.key].bar;
                  if(status==='expired')barColor='#c0392b';
                  else if(status==='warning')barColor='#d35400';
                  else if(status==='caution')barColor='#8b6914';
                  const d=new Date(dateStr+'T00:00:00');
                  const label=`${d.getMonth()+1}/${d.getDate()}`;
                  return(
                    <div key={dt.key} style={{height:ROW_H,position:'relative',display:'flex',alignItems:'center'}}>
                      <div onClick={()=>onEditClient(client)}
                        title={`${DEADLINE_TYPES.find(x=>x.key===dt.key).label}: ${formatDate(dateStr)} (${days!==null?(days<0?Math.abs(days)+'日超過':'あと'+days+'日'):''})`}
                        style={{position:'absolute',left:barStart,width:barWidth,height:12,borderRadius:3,
                          background:barColor,opacity:0.85,cursor:'pointer',transition:'opacity 0.15s'}}
                        onMouseEnter={e=>e.currentTarget.style.opacity='1'}
                        onMouseLeave={e=>e.currentTarget.style.opacity='0.85'}
                      />
                      {endX>10&&endX<chartW-5&&(
                        <span style={{position:'absolute',left:endX+3,fontSize:9,color:barColor,fontWeight:600,whiteSpace:'nowrap'}}>{label}</span>
                      )}
                    </div>
                  );
                })}
                <div style={{height:CLIENT_GAP}}/>
                {/* 月区切り線 */}
                {months.map((m,i)=>i>0&&(
                  <div key={i} style={{position:'absolute',top:0,bottom:0,left:MON_W*i,width:1,background:'#eceae3',pointerEvents:'none'}}/>
                ))}
              </div>
            ))}
            {/* 今日線 */}
            <div style={{position:'absolute',top:0,bottom:0,left:todayX,width:2,background:'#c0392b',opacity:0.6,pointerEvents:'none',zIndex:5}}/>
            <div style={{position:'absolute',top:2,left:todayX-8,fontSize:8,color:'#c0392b',fontWeight:700,pointerEvents:'none',zIndex:5}}>今日</div>
          </div>
        </div>
      </div>
      {ganttClients.length===0&&(
        <div style={{textAlign:'center',padding:30,color:T.muted,fontSize:13}}>期限が設定されている利用者がいません</div>
      )}
    </div>
  );
}

const T = { bg:'#f5f3ee', accent:'#2d5a7b', text:'#1a1a2e', sub:'#4a4a5a', muted:'#8888a0', border:'#d8d8d0',
  card:{background:'#fff',border:'1px solid #d8d8d0',borderRadius:8,padding:'16px 20px',marginBottom:12,boxShadow:'0 1px 3px rgba(0,0,0,.06)'},
  barStyle:{display:'inline-block',width:3,height:16,background:'#2d5a7b',borderRadius:2},
  secTitle:{fontSize:14,fontWeight:600,color:'#2d5a7b',display:'flex',alignItems:'center',gap:8,marginBottom:12},
  btnPrimary:{padding:'8px 18px',background:'#2d5a7b',color:'#fff',border:'none',borderRadius:6,fontSize:13,fontWeight:500,cursor:'pointer'},
  btnSecondary:{padding:'8px 18px',background:'#fff',color:'#4a4a5a',border:'1px solid #d8d8d0',borderRadius:6,fontSize:13,fontWeight:500,cursor:'pointer'},
  btnBack:{padding:'6px 16px',background:'#fff',color:'#2d5a7b',border:'1px solid #d8d8d0',borderRadius:6,fontSize:13,fontWeight:500,cursor:'pointer'},
  btnGear:{padding:'6px 10px',background:'transparent',color:'#8888a0',border:'1px solid #d8d8d0',borderRadius:6,cursor:'pointer',display:'flex',alignItems:'center'},
  btnAdd:{padding:'6px 16px',background:'#2d5a7b',color:'#fff',border:'none',borderRadius:6,fontSize:13,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap'},
};
const GearIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8888a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
const EyeIcon = ({show}) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8888a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{show?<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>:<><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>}</svg>;
const CopyIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
const CheckIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const GanttIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="14" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="16" width="10" height="4" rx="1"/></svg>;
const ListIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;

function DaysBadge({days}){if(days===null)return<span style={{fontSize:11,color:T.muted,padding:'2px 8px',borderRadius:4,background:'#eceae3'}}>未設定</span>;const s=getStatus(days),c=STATUS_CONFIG[s];return<span style={{fontSize:11,fontWeight:600,color:c.color,background:c.bg,padding:'2px 8px',borderRadius:4}}>{s==='expired'?`${Math.abs(days)}日超過`:`あと${days}日`}</span>;}
function DeadlineSummaryInline({days,label}){if(days===null)return<span style={{fontSize:12,color:T.muted}}>{label}:未設定</span>;const s=getStatus(days),c=STATUS_CONFIG[s];return<span style={{fontSize:12,color:c.color,fontWeight:600}}>{label}:{s==='expired'?`${Math.abs(days)}日超過`:`あと${days}日`}</span>;}
function CalendarPreview({typeKey,userName,dateStr}){const titles=buildCalendarTitles(typeKey,userName,dateStr);if(!titles)return null;return(<div style={{marginTop:6,padding:'8px 12px',background:'#fafaf8',borderRadius:6,border:'1px solid #d8d8d0'}}><p style={{margin:0,fontSize:10,fontWeight:600,color:T.accent,marginBottom:4}}>📅 登録情報</p><div style={{fontSize:11,color:T.sub,lineHeight:1.6}}>{[titles.pre,titles.mid,titles.day].map((t,i)=>(<div key={i} style={{display:'flex',gap:6,alignItems:'flex-start',marginTop:i?3:0}}><span style={{flexShrink:0,fontSize:10,padding:'1px 6px',borderRadius:4,background:'#eceae3',color:T.sub,fontWeight:600}}>{t.date}</span><span style={{wordBreak:'break-all'}}>{t.title}</span></div>))}</div></div>);}

function PinScreen({onAuth}){
  const[pin,setPin]=useState('');const[error,setError]=useState('');const[loading,setLoading]=useState(false);const[showPin,setShowPin]=useState(false);
  const submit=async()=>{
    if(!pin.trim()){setError('パスワードを入力してください');return;}
    setLoading(true);setError('');
    try{
      const res=await fetch('/api/clients',{headers:{'x-pin':pin}});
      if(res.ok){
        const data=await res.json();
        const role=data.role||'user';
        localStorage.setItem('kigen-pin',pin);
        localStorage.setItem('auth_role',role);
        onAuth(pin,role);
      }else{
        setError('パスワードが正しくありません');
      }
    }catch{setError('接続エラー');}
    setLoading(false);
  };
  return(<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:T.bg,fontFamily:"'Noto Sans JP', sans-serif"}}><div style={{background:'#fff',padding:40,borderRadius:12,boxShadow:'0 4px 20px rgba(0,0,0,0.1)',textAlign:'center',maxWidth:360,width:'100%'}}><div style={{fontSize:40,marginBottom:12}}>🔒</div><h2 style={{fontSize:18,fontWeight:600,marginBottom:8}}>プラン期限システム</h2><p style={{fontSize:13,color:T.muted,marginBottom:24}}>パスワードを入力してアクセス</p><div style={{position:'relative',marginBottom:16,height:48}}><input type={showPin?'text':'password'} value={pin} onChange={e=>{setPin(e.target.value);setError('');}} onKeyDown={e=>e.key==='Enter'&&submit()} placeholder="パスワード" autoFocus style={{textAlign:'center',fontSize:16,width:'100%',height:48,lineHeight:'48px',boxSizing:'border-box',padding:'0 40px 0 0'}}/><button type="button" onMouseDown={()=>setShowPin(true)} onMouseUp={()=>setShowPin(false)} onMouseLeave={()=>setShowPin(false)} onTouchStart={()=>setShowPin(true)} onTouchEnd={()=>setShowPin(false)} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',padding:4,display:'flex',alignItems:'center'}}><EyeIcon show={showPin}/></button></div>{error&&<p style={{color:'#c0392b',fontSize:13,marginBottom:12}}>{error}</p>}<button onClick={submit} disabled={loading} style={{width:'100%',padding:10,background:'#2d5a7b',color:'#fff',border:'none',borderRadius:6,fontSize:14,fontWeight:500,opacity:loading?0.5:1}}>{loading?'認証中...':'ログイン'}</button></div></div>);}

function DeadlineForm({client,onSave,onClose,pin,showCalendar}){
  const[form,setForm]=useState({nintei_end:toInputDate(client.nintei_end),long_end:toInputDate(client.long_end),short_end:toInputDate(client.short_end)});
  const[saving,setSaving]=useState(false);const[error,setError]=useState('');
  const visibleCalKeys=useMemo(()=>{const n=form.nintei_end||null,l=form.long_end||null,s=form.short_end||null,k=[];if(n)k.push('nintei_end');if(l&&!(n&&n===l))k.push('long_end');if(s&&!(n&&n===s)&&!(l&&l===s))k.push('short_end');return k;},[form]);
  const handleSave=async()=>{setSaving(true);setError('');try{const res=await fetch(`/api/clients/${client.id}/deadlines`,{method:'PUT',headers:{'Content-Type':'application/json','x-pin':pin},body:JSON.stringify(form)});if(res.ok){const data=await res.json();onSave(data.client);}else{const data=await res.json();setError(data.error||'保存に失敗しました');}}catch{setError('接続エラー');}setSaving(false);};
  return(<div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,fontFamily:"'Noto Sans JP', sans-serif"}} onClick={e=>e.target===e.currentTarget&&onClose()}><div style={{width:'100%',maxWidth:440,backgroundColor:'#fff',borderRadius:12,padding:'28px 24px',boxShadow:'0 4px 20px rgba(0,0,0,0.1)',maxHeight:'85vh',overflow:'auto'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,paddingBottom:12,borderBottom:'2px solid #2d5a7b'}}><div><h2 style={{margin:0,fontSize:16,fontWeight:600,color:T.text}}>期限設定</h2><p style={{margin:'4px 0 0',fontSize:13,color:T.muted}}>{client.name}{client.care_manager?` ・ 担当: ${client.care_manager}`:''}</p></div><button onClick={onClose} style={{background:'none',border:'none',fontSize:18,color:T.muted,cursor:'pointer'}}>✕</button></div>
    {DEADLINE_TYPES.map(dt=>(<div key={dt.key} style={{marginBottom:16}}><label style={{display:'block',fontSize:12,fontWeight:500,color:T.sub,marginBottom:6}}>{dt.label}</label><YearMonthShortcut onApply={v=>setForm(prev=>({...prev,[dt.key]:v}))}/><input type="date" value={form[dt.key]} onChange={e=>setForm({...form,[dt.key]:e.target.value})} style={{width:'100%',padding:10,fontSize:14,border:'1px solid #d8d8d0',borderRadius:6,outline:'none',boxSizing:'border-box',color:T.text}}/>{showCalendar&&form[dt.key]&&visibleCalKeys.includes(dt.key)&&<CalendarPreview typeKey={dt.key} userName={client.name} dateStr={form[dt.key]}/>}</div>))}
    {error&&<p style={{color:'#c0392b',fontSize:13,margin:'8px 0'}}>{error}</p>}<div style={{display:'flex',gap:10,marginTop:20}}><button onClick={onClose} style={{...T.btnSecondary,flex:1,padding:'10px 0'}}>キャンセル</button><button onClick={handleSave} disabled={saving} style={{...T.btnPrimary,flex:1,padding:'10px 0',opacity:saving?0.5:1}}>{saving?'保存中...':'保存'}</button></div></div></div>);}

function RegisterScreen({pin,onBack,onRegistered,managers:managerList,gearMenu,isAdmin}){
  const savedCM=typeof window!=='undefined'?localStorage.getItem('kigen-reg-cm')||'':'';
  const initialCM=managerList.includes(savedCM)?savedCM:(managerList[0]||'');
  const[name,setName]=useState('');const[careManager,setCareManager]=useState(initialCM);
  const[ninteiEnd,setNinteiEnd]=useState('');const[longEnd,setLongEnd]=useState('');const[shortEnd,setShortEnd]=useState('');
  const[saving,setSaving]=useState(false);const[error,setError]=useState('');const[success,setSuccess]=useState('');

  useEffect(()=>{if(managerList.length>0&&!careManager){const s=localStorage.getItem('kigen-reg-cm')||'';const v=managerList.includes(s)?s:managerList[0];setCareManager(v);}},[managerList,careManager]);
  const handleCMChange=(v)=>{setCareManager(v);setError('');setSuccess('');try{localStorage.setItem('kigen-reg-cm',v);}catch{}};

  const handleSubmit=async()=>{
    if(!name.trim()){setError('利用者名を入力してください');return;}
    if(!careManager){setError('担当ケアマネジャーを選択してください');return;}
    setSaving(true);setError('');setSuccess('');
    try{
      const res=await fetch('/api/clients',{method:'POST',headers:{'Content-Type':'application/json','x-pin':pin},body:JSON.stringify({name:name.trim(),care_manager:careManager,nintei_end:ninteiEnd||null,long_end:longEnd||null,short_end:shortEnd||null})});
      if(res.ok){const data=await res.json();setSuccess(`${data.client.name} さんを登録しました`);setName('');setNinteiEnd('');setLongEnd('');setShortEnd('');onRegistered(data.client);}
      else{const data=await res.json();setError(data.error||'登録に失敗しました');}
    }catch{setError('接続エラー');}
    setSaving(false);
  };

  const inputStyle={width:'100%',padding:10,fontSize:14,border:'1px solid #d8d8d0',borderRadius:6,outline:'none',boxSizing:'border-box',color:T.text};
  const labelStyle={display:'block',fontSize:12,fontWeight:500,color:T.sub,marginBottom:6};

  return(
    <div style={{fontFamily:"'Noto Sans JP', sans-serif",background:T.bg,minHeight:'100vh',color:T.text}}>
      <div style={{maxWidth:880,margin:'0 auto',padding:'24px 16px 100px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,paddingBottom:16,borderBottom:'2px solid #2d5a7b'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}><h1 style={{margin:0,fontSize:20,fontWeight:600}}>プラン期限システム</h1>{isAdmin&&<span style={{fontSize:11,fontWeight:600,color:'#fff',background:'#c0392b',padding:'2px 8px',borderRadius:4}}>管理者</span>}</div>
          <div style={{display:'flex',alignItems:'center',gap:10}}><button onClick={onBack} style={T.btnBack}>← 戻る</button>{gearMenu}</div>
        </div>
        <div style={{fontWeight:700,fontSize:16,color:T.text,marginBottom:16}}>利用者登録</div>
        {error&&<div style={{padding:'10px 16px',background:'#fdf0ee',border:'1px solid #e8c8c8',borderRadius:6,marginBottom:16,fontSize:13,color:'#c0392b'}}>{error}</div>}
        {success&&<div style={{padding:'10px 16px',background:'#e8f5f0',border:'1px solid #b8ddd0',borderRadius:6,marginBottom:16,fontSize:13,color:'#27766a'}}>✓ {success}</div>}
        <div style={T.card}>
          <div style={{marginBottom:16}}><label style={labelStyle}>利用者名 <span style={{color:'#c0392b'}}>*</span></label><input type="text" value={name} onChange={e=>{setName(e.target.value);setError('');setSuccess('');}} placeholder="例：山田 太郎" style={inputStyle}/></div>
          <div style={{marginBottom:16}}><label style={labelStyle}>担当ケアマネジャー <span style={{color:'#c0392b'}}>*</span></label><select value={careManager} onChange={e=>handleCMChange(e.target.value)} style={{...inputStyle,appearance:'auto'}}>{managerList.map(m=><option key={m} value={m}>{m}</option>)}</select></div>
          <div style={{borderTop:'1px solid #eceae3',paddingTop:16,marginTop:8,marginBottom:16}}><div style={T.secTitle}><span style={T.barStyle}></span>期限設定（任意）</div></div>
          <div style={{marginBottom:16}}><label style={labelStyle}>認定期限</label><YearMonthShortcut onApply={v=>setNinteiEnd(v)}/><input type="date" value={ninteiEnd} onChange={e=>setNinteiEnd(e.target.value)} style={inputStyle}/></div>
          <div style={{marginBottom:16}}><label style={labelStyle}>長期期限</label><YearMonthShortcut onApply={v=>setLongEnd(v)}/><input type="date" value={longEnd} onChange={e=>setLongEnd(e.target.value)} style={inputStyle}/></div>
          <div style={{marginBottom:16}}><label style={labelStyle}>短期期限</label><YearMonthShortcut onApply={v=>setShortEnd(v)}/><input type="date" value={shortEnd} onChange={e=>setShortEnd(e.target.value)} style={inputStyle}/></div>
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}><button onClick={handleSubmit} disabled={saving} style={{...T.btnPrimary,padding:'10px 32px',opacity:saving?0.5:1}}>{saving?'登録中...':'登録'}</button></div>
        <div style={{fontSize:11,color:T.muted,textAlign:'center',padding:20}}>Copyright &copy; 2026 tkrsys All rights reserved.</div>
      </div>
    </div>
  );
}

export default function KigenKanri(){
  const[pin,setPin]=useState(null);const[clients,setClients]=useState([]);const[loading,setLoading]=useState(true);
  const[activeFilter,setActiveFilter]=useState('attention');const[expandedClient,setExpandedClient]=useState(null);
  const[editClient,setEditClient]=useState(null);const[managerFilter,setManagerFilter]=useState('all');
  const[calSyncMap,setCalSyncMap]=useState({});const[isAdmin,setIsAdmin]=useState(false);
  const[showGearMenu,setShowGearMenu]=useState(false);const[mode,setMode]=useState('list');
  const[allManagers,setAllManagers]=useState([]);
  const[copiedManager,setCopiedManager]=useState(null);
  const[viewMode,setViewMode]=useState('list');
  const gearRef=useRef(null);

  useEffect(()=>{const saved=localStorage.getItem('kigen-pin');if(saved)setPin(saved);else setLoading(false);
    const savedMgr=localStorage.getItem('kigen-manager-filter');if(savedMgr)setManagerFilter(savedMgr);
    const savedRole=localStorage.getItem('auth_role');setIsAdmin(savedRole==='admin');},[]);
  useEffect(()=>{if(!showGearMenu)return;const h=e=>{if(gearRef.current&&!gearRef.current.contains(e.target))setShowGearMenu(false);};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h);},[showGearMenu]);
  const handleManagerFilterChange=(val)=>{setManagerFilter(val);localStorage.setItem('kigen-manager-filter',val);};

  const fetchClients=useCallback(async(p)=>{setLoading(true);try{const res=await fetch('/api/clients',{headers:{'x-pin':p}});if(res.ok){const data=await res.json();setClients(data.clients||[]);const syncMap={};(data.clients||[]).forEach(c=>{if(c.care_manager)syncMap[c.care_manager]=!!c.calendar_sync;});setCalSyncMap(syncMap);if(data.role)localStorage.setItem('auth_role',data.role);setIsAdmin(data.role==='admin');}else if(res.status===401){localStorage.removeItem('kigen-pin');localStorage.removeItem('auth_role');setPin(null);}}catch(e){console.error(e);}setLoading(false);},[]);
  useEffect(()=>{if(pin)fetchClients(pin);},[pin,fetchClients]);

  const fetchManagers=useCallback(async(p)=>{try{const res=await fetch('/api/care-managers',{headers:{'x-pin':p}});if(res.ok){const data=await res.json();setAllManagers((data.managers||[]).map(m=>m.name));}}catch(e){console.error(e);}},[]);
  useEffect(()=>{if(pin)fetchManagers(pin);},[pin,fetchManagers]);

  const handleCalSyncToggle=async(name)=>{const newVal=!calSyncMap[name];setCalSyncMap(prev=>({...prev,[name]:newVal}));if(!newVal)setCopiedManager(null);try{await fetch('/api/care-managers',{method:'PUT',headers:{'Content-Type':'application/json','x-pin':pin},body:JSON.stringify({manager_name:name,calendar_sync:newVal})});}catch(e){console.error(e);}};

  const handleCopyUrl=async(managerName)=>{
    const url=getCalendarFeedUrl(managerName);
    try{await navigator.clipboard.writeText(url);setCopiedManager(managerName);setTimeout(()=>setCopiedManager(prev=>prev===managerName?null:prev),2000);}catch{
      const ta=document.createElement('textarea');ta.value=url;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);setCopiedManager(managerName);setTimeout(()=>setCopiedManager(prev=>prev===managerName?null:prev),2000);
    }
  };

  const managers=useMemo(()=>{const set=new Set(clients.map(c=>c.care_manager).filter(Boolean));return Array.from(set).sort();},[clients]);
  const filteredClients=useMemo(()=>{let list=clients;if(managerFilter!=='all')list=list.filter(c=>c.care_manager===managerFilter);return list;},[clients,managerFilter]);
  const summary=useMemo(()=>{const counts={expired:0,warning:0,caution:0,safe:0,attention:0,unset:0};filteredClients.forEach(client=>{if(!hasAnyDeadline(client)){counts.unset++;return;}const statuses=getClientStatuses(client);if(statuses.has('expired'))counts.expired++;if(statuses.has('warning'))counts.warning++;if(statuses.has('caution'))counts.caution++;if(statuses.has('safe'))counts.safe++;if(statuses.has('expired')||statuses.has('warning')||statuses.has('caution'))counts.attention++;});return counts;},[filteredClients]);
  const filteredSortedClients=useMemo(()=>{const priority={expired:0,warning:1,caution:2,safe:3};let list=filteredClients.map(c=>({...c,worstStatus:getWorstStatus(c)}));list=list.filter(c=>clientMatchesFilter(c,activeFilter));list.sort((a,b)=>{const ap=a.worstStatus===null?99:(priority[a.worstStatus]??5);const bp=b.worstStatus===null?99:(priority[b.worstStatus]??5);return ap-bp;});return list;},[filteredClients,activeFilter]);

  const handleSave=(updatedClient)=>{setClients(prev=>prev.map(c=>c.id===updatedClient.id?{...updatedClient,calendar_sync:c.calendar_sync}:c));setEditClient(null);};
  const handleLogout=()=>{
    setShowGearMenu(false);
    if(!window.confirm('ログアウトしなければ次回以降もログインは不要です。ログアウトしますか？'))return;
    localStorage.removeItem('kigen-pin');localStorage.removeItem('auth_role');localStorage.removeItem('portal_authed');localStorage.removeItem('auth_pin');setPin(null);setClients([]);setIsAdmin(false);
  };
  const handleAuth=(p,role)=>{setPin(p);setIsAdmin(role==='admin');};
  const handleRegistered=(newClient)=>{setClients(prev=>[...prev,newClient].sort((a,b)=>(a.name||'').localeCompare(b.name||'')));};

  if(!pin)return<PinScreen onAuth={handleAuth}/>;
  if(loading)return<div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'100vh',background:T.bg,fontFamily:"'Noto Sans JP', sans-serif",color:T.muted}}>読み込み中...</div>;

  const gearMenu = (
    <div ref={gearRef} style={{position:'relative'}}>
      <button onClick={()=>setShowGearMenu(!showGearMenu)} style={T.btnGear}><GearIcon/></button>
      {showGearMenu && (
        <div style={{position:'absolute',right:0,top:'100%',marginTop:4,background:'#fff',border:'1px solid #d8d8d0',borderRadius:8,boxShadow:'0 4px 16px rgba(0,0,0,.12)',minWidth:180,zIndex:50,overflow:'hidden'}}>
          {isAdmin && <button onClick={()=>{setShowGearMenu(false);setMode('calendarSync');}} style={{display:'block',width:'100%',padding:'10px 16px',background:'none',border:'none',borderBottom:'1px solid #f0f0f0',fontSize:13,color:'#4a4a5a',textAlign:'left',cursor:'pointer'}}>カレンダー連携設定</button>}
          <button onClick={handleLogout} style={{display:'block',width:'100%',padding:'10px 16px',background:'none',border:'none',fontSize:13,color:'#4a4a5a',textAlign:'left',cursor:'pointer'}}>ログアウト</button>
        </div>
      )}
    </div>
  );

  if(mode==='register'){
    return<RegisterScreen pin={pin} onBack={()=>setMode('list')} onRegistered={handleRegistered} managers={allManagers} gearMenu={gearMenu} isAdmin={isAdmin}/>;
  }

  const FILTER_ITEMS=[
    {key:'safe',label:'余裕あり',color:STATUS_CONFIG.safe.color,count:summary.safe},
    {key:'attention',label:'要注意',count:summary.attention,color:'#8b6914'},
    {key:'warning',label:'30日以内',color:STATUS_CONFIG.warning.color,count:summary.warning},
    {key:'expired',label:'期限切れ',color:STATUS_CONFIG.expired.color,count:summary.expired},
    {key:'unset',label:'未登録',color:T.muted,count:summary.unset},
  ];

  if(mode==='calendarSync'){
    const calSyncManagers=managerFilter!=='all'?managers.filter(m=>m===managerFilter):managers;
    return(
      <div style={{fontFamily:"'Noto Sans JP', sans-serif",background:T.bg,minHeight:'100vh',color:T.text}}>
        <div style={{maxWidth:880,margin:'0 auto',padding:'24px 16px 100px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,paddingBottom:16,borderBottom:'2px solid #2d5a7b'}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}><h1 style={{margin:0,fontSize:20,fontWeight:600}}>プラン期限システム</h1><span style={{fontSize:11,fontWeight:600,color:'#fff',background:'#c0392b',padding:'2px 8px',borderRadius:4}}>管理者</span></div>
            <div style={{display:'flex',alignItems:'center',gap:10}}><button onClick={()=>setMode('list')} style={T.btnBack}>← 戻る</button>{gearMenu}</div>
          </div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
            <div style={{fontSize:16,fontWeight:700,color:T.text}}>カレンダー連携設定</div>
            {managerFilter!=='all'&&(<span style={{fontSize:11,color:T.accent,background:'#e8f0f5',padding:'3px 10px',borderRadius:4,fontWeight:500}}>絞込中: {managerFilter}</span>)}
          </div>
          <div style={T.card}>
            <div style={T.secTitle}><span style={T.barStyle}></span>Googleカレンダー同期</div>
            <p style={{margin:'0 0 16px',fontSize:12,color:T.muted,lineHeight:1.5}}>☑にすると、担当利用者の期限予定がGoogleカレンダーに自動同期されます。</p>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {calSyncManagers.map(m=>{const isSynced=!!calSyncMap[m];const isCopied=copiedManager===m; return(
                <div key={m} style={{borderRadius:8,background:isSynced?'#e8f5f0':'#fafaf8',border:`1px solid ${isSynced?'#27766a':'#d8d8d0'}`,overflow:'hidden'}}>
                  <label style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',cursor:'pointer'}}>
                    <input type="checkbox" checked={isSynced} onChange={()=>handleCalSyncToggle(m)} style={{accentColor:'#2d5a7b',width:16,height:16,flexShrink:0}}/>
                    <span style={{fontSize:14,fontWeight:500,color:T.text}}>{m}</span>
                    <span style={{fontSize:11,color:isSynced?'#27766a':T.muted,marginLeft:'auto'}}>{isSynced?'同期ON':'同期OFF'}</span>
                  </label>
                  {isSynced&&(
                    <div style={{padding:'0 14px 12px',borderTop:'1px solid #b8ddd0'}}>
                      <p style={{margin:'8px 0 6px',fontSize:11,color:T.sub,fontWeight:500}}>📋 カレンダー同期URL</p>
                      <div style={{display:'flex',gap:6,alignItems:'center'}}>
                        <input type="text" readOnly value={getCalendarFeedUrl(m)} style={{flex:1,padding:'7px 10px',fontSize:11,border:'1px solid #d8d8d0',borderRadius:5,background:'#fff',color:T.sub,outline:'none',boxSizing:'border-box',fontFamily:'monospace'}}/>
                        <button onClick={()=>handleCopyUrl(m)} style={{flexShrink:0,display:'flex',alignItems:'center',gap:4,padding:'6px 12px',fontSize:11,fontWeight:500,border:'1px solid #d8d8d0',borderRadius:5,cursor:'pointer',background:isCopied?'#27766a':'#fff',color:isCopied?'#fff':T.sub,transition:'all 0.2s'}}>
                          {isCopied?<><CheckIcon/> コピー済</>:<><CopyIcon/> コピー</>}
                        </button>
                      </div>
                      <p style={{margin:'6px 0 0',fontSize:10,color:T.muted,lineHeight:1.4}}>GoogleカレンダーのURL追加で登録してください</p>
                    </div>
                  )}
                </div>
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
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div>
              <h1 style={{margin:0,fontSize:20,fontWeight:600}}>プラン期限システム</h1>
              <p style={{margin:'4px 0 0',fontSize:12,color:T.muted}}>{new Date().getFullYear()}年{new Date().getMonth()+1}月{new Date().getDate()}日 現在・{clients.length}名</p>
            </div>
            {isAdmin&&<span style={{fontSize:11,fontWeight:600,color:'#fff',background:'#c0392b',padding:'2px 8px',borderRadius:4}}>管理者</span>}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <button onClick={()=>setMode('register')} style={T.btnAdd}>＋ 利用者</button>
            {gearMenu}
          </div>
        </div>

        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
          <div style={{fontSize:14,fontWeight:600,color:'#2d5a7b',display:'flex',alignItems:'center',gap:8}}>
            <span style={T.barStyle}></span>検索
          </div>
          <div style={{display:'flex',gap:2,background:'#eceae3',borderRadius:6,padding:2}}>
            <button onClick={()=>setViewMode('list')} style={{display:'flex',alignItems:'center',gap:4,padding:'4px 10px',fontSize:11,fontWeight:500,border:'none',borderRadius:4,cursor:'pointer',background:viewMode==='list'?'#fff':'transparent',color:viewMode==='list'?T.accent:T.muted,boxShadow:viewMode==='list'?'0 1px 2px rgba(0,0,0,.1)':'none'}}>
              <ListIcon/>一覧
            </button>
            <button onClick={()=>setViewMode('gantt')} style={{display:'flex',alignItems:'center',gap:4,padding:'4px 10px',fontSize:11,fontWeight:500,border:'none',borderRadius:4,cursor:'pointer',background:viewMode==='gantt'?'#fff':'transparent',color:viewMode==='gantt'?T.accent:T.muted,boxShadow:viewMode==='gantt'?'0 1px 2px rgba(0,0,0,.1)':'none'}}>
              <GanttIcon/>ガント
            </button>
          </div>
        </div>
        <div style={{display:'flex',gap:8,marginBottom:16,alignItems:'center',flexWrap:'wrap'}}>
          {viewMode==='list'&&FILTER_ITEMS.map(item=>(
            <button key={item.key} onClick={()=>setActiveFilter(item.key)} style={{
              flexShrink:0,padding:'6px 14px',borderRadius:6,fontSize:12,fontWeight:500,cursor:'pointer',
              background:activeFilter===item.key?item.color:'#fff',
              color:activeFilter===item.key?'#fff':item.color,
              border:`1px solid ${activeFilter===item.key?item.color:'#d8d8d0'}`,
            }}>{item.label} ({item.count})</button>
          ))}
          {managers.length>1&&(
            <select value={managerFilter} onChange={e=>handleManagerFilterChange(e.target.value)}
              style={{padding:'6px 12px',fontSize:12,borderRadius:6,border:'1px solid #d8d8d0',background:'#fff',color:T.text,outline:'none',marginLeft:viewMode==='list'?'auto':0}}>
              <option value="all">全ケアマネ</option>
              {managers.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          )}
        </div>

        {viewMode==='gantt'?(
          <GanttChart clients={filteredClients} onEditClient={c=>setEditClient(c)}/>
        ):(
          <>
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
          </>
        )}
        <div style={{fontSize:11,color:T.muted,textAlign:'center',padding:20}}>Copyright &copy; 2026 tkrsys All rights reserved.</div>
      </div>

      {editClient&&<DeadlineForm client={editClient} pin={pin} onSave={handleSave} onClose={()=>setEditClient(null)} showCalendar={!!calSyncMap[editClient.care_manager]}/>}
    </div>
  );
}
