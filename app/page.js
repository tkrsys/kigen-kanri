'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

const STATUS_CONFIG = {
  expired:  { label: '期限切れ', color: '#c0392b', bg: '#fdf0ee' },
  warning:  { label: '30日以内', color: '#d35400', bg: '#fef5ee' },
  caution:  { label: '要注意', color: '#8b6914', bg: '#fdf8ee' },
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
function getStatus(days) { if(days===null)return null; if(days<0)return'expired'; if(days<=30)return'warning'; if(days<=75)return'caution'; return'safe'; }
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

/* ★月別サマリー計算関数 */
function getMonthlyDeadlineSummary(clients, months) {
  return months.map(m => {
    const y = m.getFullYear(), mo = m.getMonth();
    const counts = { short_end: 0, long_end: 0, nintei_end: 0 };
    clients.forEach(c => {
      DEADLINE_TYPES.forEach(dt => {
        const dateStr = c[dt.key];
        if (!dateStr) return;
        const n = nd(dateStr);
        const d = new Date(n + 'T00:00:00');
        if (d.getFullYear() === y && d.getMonth() === mo) {
          counts[dt.key]++;
        }
      });
    });
    return counts;
  });
}

/* ★ガントチャート: 統一横スクロール構造 */
function GanttChart({clients,onEditClient}){
  const today=new Date();today.setHours(0,0,0,0);
  const MONTHS=15,MON_W=64,ROW_H=28,BAR_H=14,STACK_H=26;
  const NAME_W=120;
  const HEADER_H=38,COLLAPSED_H=STACK_H+10,EXPANDED_HEADER_H=32;
  const SUMMARY_H=32;
  const startDate=useMemo(()=>new Date(today.getFullYear(),today.getMonth(),1),[]);
  const months=useMemo(()=>{const a=[];for(let i=0;i<MONTHS;i++)a.push(new Date(startDate.getFullYear(),startDate.getMonth()+i,1));return a;},[startDate]);
  const endDate=useMemo(()=>new Date(startDate.getFullYear(),startDate.getMonth()+MONTHS,0),[startDate]);
  const totalDays=(endDate-startDate)/86400000;
  const chartW=MON_W*MONTHS;
  const dayToX=dv=>{const n=nd(dv);const d=new Date(typeof n==='string'?n+'T00:00:00':n);return((d-startDate)/86400000/totalDays)*chartW;};
  const todayX=dayToX(today);
  const ganttClients=useMemo(()=>clients.filter(c=>hasAnyDeadline(c)).sort(ganttSortCompare),[clients]);
  const chartScrollRef=useRef(null);
  const nameScrollRef=useRef(null);
  useEffect(()=>{
    if(chartScrollRef.current){
      const left=Math.max(0,todayX-60);
      chartScrollRef.current.scrollLeft=left;
    }
  },[]);
  const[expandedGantt,setExpandedGantt]=useState({});
  const toggleExpand=id=>setExpandedGantt(p=>({...p,[id]:!p[id]}));

  const allExpanded=useMemo(()=>ganttClients.length>0&&ganttClients.every(c=>!!expandedGantt[c.id]),[ganttClients,expandedGantt]);
  const toggleAll=()=>{
    if(allExpanded){setExpandedGantt({});}
    else{const m={};ganttClients.forEach(c=>{m[c.id]=true;});setExpandedGantt(m);}
  };

  const monthlySummary = useMemo(() => getMonthlyDeadlineSummary(ganttClients, months), [ganttClients, months]);

  const dataScrollRef=useRef(null);
  const syncingRef=useRef(false);
  const handleNameScroll=()=>{if(syncingRef.current)return;syncingRef.current=true;if(dataScrollRef.current&&nameScrollRef.current)dataScrollRef.current.scrollTop=nameScrollRef.current.scrollTop;syncingRef.current=false;};
  const handleDataScroll=()=>{if(syncingRef.current)return;syncingRef.current=true;if(nameScrollRef.current&&dataScrollRef.current)nameScrollRef.current.scrollTop=dataScrollRef.current.scrollTop;syncingRef.current=false;};

  if(!ganttClients.length)return<div style={{textAlign:'center',padding:40,color:'#8888a0',background:'#fff',border:'1px solid #d8d8d0',borderRadius:8}}>期限が設定されている利用者がいません</div>;

  const renderBarContent=(client,dt,rowH,barH)=>{
    const dateStr=client[dt.key];if(!dateStr)return null;
    const days=getDaysUntil(dateStr);const status=getStatus(days);
    const endX=Math.max(0,Math.min(chartW,dayToX(dateStr)));
    const barStartX=Math.max(0,Math.min(chartW,todayX));
    const barColor=GANTT_BAR_COLORS[dt.key].bar;
    const tip=`${dt.label}: ${formatDate(dateStr)} (${days!==null?(days<0?Math.abs(days)+'日超過':'あと'+days+'日'):'未設定'})`;
    if(status==='expired'){return<div onClick={e=>{e.stopPropagation();onEditClient(client);}} title={tip} style={{position:'absolute',left:Math.max(0,endX-2),top:(rowH-barH)/2,width:6,height:barH,borderRadius:2,background:'#c0392b',cursor:'pointer',zIndex:1}}/>;}
    const bw=Math.max(3,endX-barStartX);
    return<div onClick={e=>{e.stopPropagation();onEditClient(client);}} title={tip} style={{position:'absolute',left:barStartX,top:(rowH-barH)/2,width:bw,height:barH,borderRadius:3,background:barColor,opacity:0.9,cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='0.9'}/>;
  };

  const renderStackedBars=(client)=>{
    const h=STACK_H;const layers=[];
    STACKED_ORDER.forEach((dt,li)=>{
      const dateStr=client[dt.key];if(!dateStr)return;
      const days=getDaysUntil(dateStr);const status=getStatus(days);
      const endX=Math.max(0,Math.min(chartW,dayToX(dateStr)));
      const barStartX=Math.max(0,Math.min(chartW,todayX));
      const barColor=GANTT_BAR_COLORS[dt.key].bar;
      const barH=h-li*2;const topOff=(h-barH)/2;
      const tip=`${dt.short}: ${formatDate(dateStr)} (${days!==null?(days<0?Math.abs(days)+'日超過':'あと'+days+'日'):'未設定'})`;
      if(status==='expired'){
        layers.push(<div key={dt.key+'m'} title={tip} style={{position:'absolute',left:Math.max(0,endX-2),top:topOff,width:6,height:barH,borderRadius:2,background:'#c0392b',zIndex:10+li}}/>);
      } else {
        const bw=Math.max(3,endX-barStartX);
        layers.push(<div key={dt.key+'b'} title={tip} style={{position:'absolute',left:barStartX,top:topOff,width:bw,height:barH,borderRadius:3,background:barColor,opacity:0.9,zIndex:10+li}}/>);
      }
    });
    return layers;
  };

  const renderGridLines=()=>months.map((_,i)=>{if(i===0)return null;const m=months[i];const isJan=m.getMonth()===0;return<div key={'g'+i} style={{position:'absolute',top:0,bottom:0,left:MON_W*i,width:isJan?2:1,background:isJan?'#c8c8c0':'#f0efe8',pointerEvents:'none'}}/>;});
  const renderTodayLine=()=><div style={{position:'absolute',top:0,bottom:0,left:Math.max(0,todayX),width:2,background:'#c0392b',opacity:0.4,pointerEvents:'none'}}/>;

  return(
    <div style={{background:'#fff',border:'1px solid #d8d8d0',borderRadius:8,overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
      <div style={{display:'flex',padding:'6px 10px',gap:12,flexWrap:'wrap',alignItems:'center',borderBottom:'1px solid #eceae3'}}>
        {DEADLINE_TYPES.map(dt=><span key={dt.key} style={{display:'flex',alignItems:'center',gap:3,fontSize:12,color:'#4a4a5a'}}><span style={{display:'inline-block',width:12,height:7,borderRadius:2,background:GANTT_BAR_COLORS[dt.key].bar}}/>{dt.short}</span>)}
        <span style={{display:'flex',alignItems:'center',gap:3,fontSize:12,color:'#c0392b'}}><span style={{display:'inline-block',width:2,height:9,background:'#c0392b'}}/>今日</span>
        <button onClick={toggleAll} style={{marginLeft:'auto',padding:'3px 10px',fontSize:11,fontWeight:500,border:'1px solid #d8d8d0',borderRadius:4,background:allExpanded?'#e8f0f5':'#fff',color:'#2d5a7b',cursor:'pointer',whiteSpace:'nowrap'}}>{allExpanded?'全閉':'全展開'}</button>
      </div>
      <div style={{display:'flex'}}>
        <div style={{width:NAME_W,minWidth:NAME_W,flexShrink:0,borderRight:'2px solid #d8d8d0',display:'flex',flexDirection:'column'}}>
          <div style={{height:HEADER_H,display:'flex',alignItems:'flex-end',padding:'0 8px 4px',fontSize:11,fontWeight:600,color:'#2d5a7b',background:'#fafaf8',borderBottom:'1px solid #d8d8d0',boxSizing:'border-box',whiteSpace:'nowrap',flexShrink:0}}>利用者名</div>
          <div style={{height:SUMMARY_H,display:'flex',alignItems:'center',padding:'0 8px',fontSize:10,fontWeight:600,color:'#8888a0',background:'#f8f7f2',borderBottom:'2px solid #d8d8d0',boxSizing:'border-box',whiteSpace:'nowrap',flexShrink:0}}>件数</div>
          <div ref={nameScrollRef} onScroll={handleNameScroll} style={{flex:1,overflowY:'auto',overflowX:'hidden',maxHeight:'65vh',scrollbarWidth:'none',msOverflowStyle:'none'}}>
            <style>{`.gantt-name-col::-webkit-scrollbar{display:none}`}</style>
            <div className="gantt-name-col">
              {ganttClients.map((client,ci)=>{
                const isExp=!!expandedGantt[client.id];
                const ws=getWorstStatus(client);const wc=ws?STATUS_CONFIG[ws].color:'#8888a0';
                if(!isExp){
                  return(
                    <div key={client.id} onClick={()=>toggleExpand(client.id)} style={{height:COLLAPSED_H,display:'flex',alignItems:'center',gap:4,padding:'0 6px',borderLeft:`3px solid ${wc}`,borderTop:ci>0?'1px solid #d8d8d0':'none',cursor:'pointer',background:'#fafaf8',boxSizing:'border-box'}}>
                      <span style={{fontSize:8,color:'#8888a0',flexShrink:0}}>▶</span>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:600,color:'#1a1a2e',lineHeight:1.2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:NAME_W-40}}>{client.name}</div>
                        <div style={{fontSize:9,color:'#8888a0',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:NAME_W-40}}>{client.care_manager||''}</div>
                      </div>
                    </div>
                  );
                } else {
                  return(
                    <div key={client.id}>
                      <div onClick={()=>toggleExpand(client.id)} style={{height:EXPANDED_HEADER_H,display:'flex',alignItems:'center',gap:4,padding:'0 6px',borderLeft:`3px solid ${wc}`,borderTop:ci>0?'1px solid #d8d8d0':'none',cursor:'pointer',background:'#fafaf8',boxSizing:'border-box'}}>
                        <span style={{fontSize:8,color:'#8888a0',flexShrink:0,transform:'rotate(90deg)'}}>▶</span>
                        <div style={{minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:600,color:'#1a1a2e',lineHeight:1.2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:NAME_W-40}}>{client.name}</div>
                          <div style={{fontSize:9,color:'#8888a0',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:NAME_W-40}}>{client.care_manager||''}</div>
                        </div>
                      </div>
                      {DEADLINE_TYPES.map((dt,di)=>(
                        <div key={dt.key} style={{height:ROW_H,display:'flex',alignItems:'center',padding:'0 6px 0 18px',background:'#fafaf8',borderBottom:di===DEADLINE_TYPES.length-1?'1px solid #eceae3':'none',boxSizing:'border-box'}}>
                          <span style={{fontSize:8,color:GANTT_BAR_COLORS[dt.key].lbl,fontWeight:600}}>{dt.short}</span>
                        </div>
                      ))}
                    </div>
                  );
                }
              })}
            </div>
          </div>
        </div>
        <div ref={chartScrollRef} style={{flex:1,overflowX:'auto',overflowY:'hidden'}}>
          <div style={{width:chartW,minWidth:chartW}}>
            <div style={{display:'flex',height:HEADER_H,borderBottom:'1px solid #d8d8d0'}}>
              {months.map((m,i)=>{
                const cur=m.getFullYear()===today.getFullYear()&&m.getMonth()===today.getMonth();
                const isJan=m.getMonth()===0;const isFirst=i===0;
                return<div key={i} style={{width:MON_W,flexShrink:0,display:'flex',alignItems:'flex-end',justifyContent:'center',paddingBottom:4,fontSize:10,fontWeight:cur?700:400,color:cur?'#2d5a7b':'#8888a0',background:cur?'#e8f0f5':'#fff',borderRight:'1px solid #eceae3',borderLeft:isJan&&!isFirst?'2px solid #c8c8c0':'none',position:'relative',boxSizing:'border-box'}}>
                  {(isJan||isFirst)&&<div style={{position:'absolute',top:2,left:isFirst?2:4,fontSize:9,fontWeight:700,color:'#2d5a7b'}}>{m.getFullYear()}</div>}
                  {m.getMonth()+1}月
                </div>;
              })}
            </div>
            <div style={{display:'flex',height:SUMMARY_H,borderBottom:'2px solid #d8d8d0',background:'#f8f7f2'}}>
              {months.map((m,i)=>{
                const s = monthlySummary[i];
                const hasAny = s.short_end > 0 || s.long_end > 0 || s.nintei_end > 0;
                const cur=m.getFullYear()===today.getFullYear()&&m.getMonth()===today.getMonth();
                const isJan=m.getMonth()===0;const isFirst=i===0;
                return<div key={i} style={{width:MON_W,flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontSize:9,color:'#4a4a5a',background:cur?'#e8f0f5':'transparent',borderRight:'1px solid #eceae3',borderLeft:isJan&&!isFirst?'2px solid #c8c8c0':'none',boxSizing:'border-box',gap:0,lineHeight:1.2}}>
                  {hasAny ? <>
                    {s.short_end>0&&<span style={{color:GANTT_BAR_COLORS.short_end.lbl,fontWeight:600}}>短{s.short_end}</span>}
                    {s.long_end>0&&<span style={{color:GANTT_BAR_COLORS.long_end.lbl,fontWeight:600}}>長{s.long_end}</span>}
                    {s.nintei_end>0&&<span style={{color:GANTT_BAR_COLORS.nintei_end.lbl,fontWeight:600}}>認{s.nintei_end}</span>}
                  </> : <span style={{color:'#ccc'}}>-</span>}
                </div>;
              })}
            </div>
            <div ref={dataScrollRef} onScroll={handleDataScroll} style={{maxHeight:'65vh',overflowY:'auto',overflowX:'hidden'}}>
              {ganttClients.map((client,ci)=>{
                const isExp=!!expandedGantt[client.id];
                const rows=[];
                if(!isExp){
                  rows.push(
                    <div key={`c-${client.id}`} onClick={()=>toggleExpand(client.id)} style={{height:COLLAPSED_H,position:'relative',cursor:'pointer',borderTop:ci>0?'1px solid #d8d8d0':'none',paddingTop:5,boxSizing:'border-box'}}>
                      <div style={{position:'relative',height:STACK_H}}>
                        {renderStackedBars(client)}
                      </div>
                      {renderGridLines()}
                      {renderTodayLine()}
                    </div>
                  );
                } else {
                  rows.push(
                    <div key={`n-${client.id}`} onClick={()=>toggleExpand(client.id)} style={{height:EXPANDED_HEADER_H,position:'relative',cursor:'pointer',borderTop:ci>0?'1px solid #d8d8d0':'none',boxSizing:'border-box'}}>
                      {renderGridLines()}
                      {renderTodayLine()}
                    </div>
                  );
                  DEADLINE_TYPES.forEach((dt,di)=>{
                    const isLast=di===DEADLINE_TYPES.length-1;
                    rows.push(
                      <div key={`b-${client.id}-${dt.key}`} style={{height:ROW_H,position:'relative',borderBottom:isLast?'1px solid #eceae3':'none',boxSizing:'border-box',overflow:'visible'}}>
                        {renderBarContent(client,dt,ROW_H,BAR_H)}
                        {renderGridLines()}
                        {renderTodayLine()}
                      </div>
                    );
                  });
                }
                return rows;
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
