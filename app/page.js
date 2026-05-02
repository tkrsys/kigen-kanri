'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

const STATUS_CONFIG = {
  expired:  { label: '期限切れ', color: '#c0392b', bg: '#fdf0ee' },
  warning:  { label: '警告:45日以内', color: '#d35400', bg: '#fef5ee' },
  caution:  { label: '注意:75日以内', color: '#8b6914', bg: '#fdf8ee' },
  safe:     { label: '余裕あり', color: '#27766a', bg: '#e8f5f0' },
};
const DEADLINE_TYPES = [
  { key: 'short_end', label: '短期期限', short: '短期' },
  { key: 'long_end',  label: '長期期限', short: '長期' },
  { key: 'nintei_end', label: '認定期限', short: '認定' },
];
const STACKED_ORDER = [
  { key: 'nintei_end', short: '認定' },
  { key: 'long_end',  short: '長期' },
  { key: 'short_end', short: '短期' },
];
const CAL_CONFIG = {
  nintei_end: { label: '認定期限', preAction: '認定調査 ｱｾｽﾒﾝﾄ', midAction: '担当者会議＋ﾌﾟﾗﾝ交付' },
  long_end:   { label: '長期期限', preAction: 'ｱｾｽﾒﾝﾄ', midAction: '担当者会議＋ﾌﾟﾗﾝ交付' },
  short_end:  { label: '短期期限', preAction: 'ｱｾｽﾒﾝﾄ', midAction: 'ﾌﾟﾗﾝ交付' },
};
const GANTT_BAR_COLORS = {
  nintei_end: { bar:'#5B9BD5', lbl:'#2B5F8A' },
  long_end:   { bar:'#D4C84A', lbl:'#8A8520' },
  short_end:  { bar:'#9B72CF', lbl:'#6B3FA0' },
};

function nd(v){return typeof v==='string'?v.split('T')[0]:v;}

function getDaysUntil(dateStr) { if (!dateStr) return null; const today = new Date(); today.setHours(0,0,0,0); const n=nd(dateStr); return Math.floor((new Date(n+'T00:00:00')-today)/(1000*60*60*24)); }
function getStatus(days) { if(days===null)return null; if(days<0)return'expired'; if(days<=45)return'warning'; if(days<=75)return'caution'; return'safe'; }
function formatDate(dateStr) { if(!dateStr)return'未設定'; const n=nd(dateStr); const d=new Date(n+'T00:00:00'); return`${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`; }
function toInputDate(dateStr) { if(!dateStr)return''; return nd(dateStr); }
function normalizeClientDate(dateStr) { if(!dateStr)return null; return nd(dateStr); }
function getNoticeDateStr(dateStr,mb) { const d=new Date(nd(dateStr)+'T00:00:00'); let y=d.getFullYear(),m=d.getMonth()-mb; if(m<0){m+=12;y-=1;} return`${y}-${String(m+1).padStart(2,'0')}-25`; }
function getActionMonth(dateStr,offset) { const d=new Date(nd(dateStr)+'T00:00:00'); let m=d.getMonth()+1+offset; if(m<=0)m+=12; if(m>12)m-=12; return m; }
function buildCalendarTitles(typeKey,userName,dateStr) { if(!dateStr)return null; const n=nd(dateStr); const config=CAL_CONFIG[typeKey]; const d=new Date(n+'T00:00:00'); const endLabel=`${d.getMonth()+1}/${d.getDate()}`; const pre=getNoticeDateStr(n,2),mid=getNoticeDateStr(n,1),day=getNoticeDateStr(n,0); const pD=new Date(pre+'T00:00:00'),mD=new Date(mid+'T00:00:00'),dD=new Date(day+'T00:00:00'); return { pre:{date:`${pD.getMonth()+1}/${pD.getDate()}`,title:`【${config.label} 2ヶ月前】${userName} ${endLabel}(${getActionMonth(n,-1)}月 ${config.preAction})`}, mid:{date:`${mD.getMonth()+1}/${mD.getDate()}`,title:`【${config.label} 1ヶ月前】${userName} ${endLabel}(${getActionMonth(n,0)}月 ${config.midAction})`}, day:{date:`${dD.getMonth()+1}/${dD.getDate()}`,title:`【${config.label}　　　　】${userName} ${endLabel}`} }; }
function getWorstStatus(client) { const p={expired:0,warning:1,caution:2,safe:3}; let w=null; for(const dt of DEADLINE_TYPES){const s=getStatus(getDaysUntil(client[dt.key]));if(s===null)continue;if(w===null||p[s]<p[w])w=s;} return w; }
function getEarliestDays(client) { let min=Infinity; for(const dt of DEADLINE_TYPES){const d=getDaysUntil(client[dt.key]);if(d!==null&&d<min)min=d;} return min===Infinity?null:min; }
function getClientStatuses(client) { const s=new Set(); for(const dt of DEADLINE_TYPES){const st=getStatus(getDaysUntil(client[dt.key]));if(st!==null)s.add(st);} return s; }
function hasAnyDeadline(client) { return DEADLINE_TYPES.some(dt=>client[dt.key]); }
function clientMatchesFilter(client,filter) { if(filter==='unset')return!hasAnyDeadline(client); const s=getClientStatuses(client);if(s.size===0)return false; if(filter==='attention')return s.has('expired')||s.has('warning')||s.has('caution'); return s.has(filter); }
function getVisibleCalendarKeys(client) { const n=normalizeClientDate(client.nintei_end),l=normalizeClientDate(client.long_end),s=normalizeClientDate(client.short_end); const k=[]; if(n)k.push('nintei_end'); if(l&&!(n&&n===l))k.push('long_end'); if(s&&!(n&&n===s)&&!(l&&l===s))k.push('short_end'); return k; }
function getCalendarFeedUrl(managerName) { const base='https://careplan-kigen.vercel.app/api/calendar-feed?token=kenkou1975'; if(!managerName)return base; return base+'&manager='+encodeURIComponent(managerName); }
function parseYearMonthToLastDay(input) { if(!input||!input.trim())return null; const s=input.trim().replace(/[／]/g,'/').replace(/[ー−]/g,'-'); let year,month; const reiwa=s.match(/^[Rr](\d{1,2})[\/\-](\d{1,2})$/); if(reiwa){year=parseInt(reiwa[1],10)+2018;month=parseInt(reiwa[2],10);}else{const seireki=s.match(/^(\d{4})[\/\-](\d{1,2})$/);if(!seireki)return null;year=parseInt(seireki[1],10);month=parseInt(seireki[2],10);} if(month<1||month>12||year<2000||year>2100)return null; return`${year}-${String(month).padStart(2,'0')}-${String(new Date(year,month,0).getDate()).padStart(2,'0')}`; }

function ganttSortCompare(a,b) {
  const sa=getDaysUntil(a.short_end)??Infinity, sb=getDaysUntil(b.short_end)??Infinity;
  if(sa!==sb) return sa-sb;
  const la=getDaysUntil(a.long_end)??Infinity, lb=getDaysUntil(b.long_end)??Infinity;
  if(la!==lb) return la-lb;
  const na=getDaysUntil(a.nintei_end)??Infinity, nb=getDaysUntil(b.nintei_end)??Infinity;
  return na-nb;
}

function YearMonthShortcut({onApply}){
  const[val,setVal]=useState('');const[msg,setMsg]=useState(null);
  const handleApply=()=>{const r=parseYearMonthToLastDay(val);if(r){onApply(r);const d=new Date(r+'T00:00:00');setMsg({ok:true,text:`→ ${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`});setVal('');setTimeout(()=>setMsg(null),2000);}else{setMsg({ok:false,text:'例: 2026/4 or R8/4'});setTimeout(()=>setMsg(null),2000);}};
  return(<div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}><input type="text" value={val} onChange={e=>{setVal(e.target.value);setMsg(null);}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();handleApply();}}} placeholder="年/月 or R8/4 → 末日" style={{width:140,padding:'5px 8px',fontSize:12,border:'1px solid #d8d8d0',borderRadius:5,outline:'none',color:'#4a4a5a',boxSizing:'border-box'}}/><button type="button" onClick={handleApply} style={{padding:'4px 10px',fontSize:11,fontWeight:500,border:'1px solid #d8d8d0',borderRadius:5,background:'#f5f3ee',color:'#2d5a7b',cursor:'pointer',whiteSpace:'nowrap'}}>末日設定</button>{msg&&<span style={{fontSize:10,color:msg.ok?'#27766a':'#c0392b',fontWeight:500}}>{msg.text}</span>}</div>);
}

function getMonthlyDeadlineSummary(clients, months) {
  return months.map(m => {
    const y = m.getFullYear(), mo = m.getMonth();
    const counts = { short_end: 0, long_end: 0, nintei_end: 0 };
    clients.forEach(c => {
      const sn = c.short_end ? nd(c.short_end) : null;
      const ln = c.long_end ? nd(c.long_end) : null;
      const nn = c.nintei_end ? nd(c.nintei_end) : null;
      const sInMonth = sn && new Date(sn+'T00:00:00').getFullYear()===y && new Date(sn+'T00:00:00').getMonth()===mo;
      const lInMonth = ln && new Date(ln+'T00:00:00').getFullYear()===y && new Date(ln+'T00:00:00').getMonth()===mo;
      const nInMonth = nn && new Date(nn+'T00:00:00').getFullYear()===y && new Date(nn+'T00:00:00').getMonth()===mo;
      if(nInMonth && lInMonth && sInMonth && nn===ln && ln===sn) { counts.nintei_end++; }
      else if(nInMonth && lInMonth && nn===ln) { counts.nintei_end++; if(sInMonth) counts.short_end++; }
      else if(nInMonth && sInMonth && nn===sn) { counts.nintei_end++; if(lInMonth) counts.long_end++; }
      else if(lInMonth && sInMonth && ln===sn) { counts.long_end++; if(nInMonth) counts.nintei_end++; }
      else { if(sInMonth) counts.short_end++; if(lInMonth) counts.long_end++; if(nInMonth) counts.nintei_end++; }
    });
    return counts;
  });
}
