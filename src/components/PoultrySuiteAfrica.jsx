import React, { useState, useEffect, useCallback, useReducer, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useCurrency, getCountryByName, CurrencySwitcher } from '../currency/index.js';
const _S={fill:"none",strokeWidth:"1.75",strokeLinecap:"square",strokeLinejoin:"miter"};

// ══════════════════════════════════════════════════════════
//  PRODUCTION REFINEMENTS - ADDED FOR DEPLOYMENT
// ══════════════════════════════════════════════════════════

// ─── ERROR BOUNDARY ───────────────────────────────────────
class ErrorBoundary extends React.Component{
  constructor(props){super(props);this.state={hasError:false,error:null,errorInfo:null};}
  static getDerivedStateFromError(error){return{hasError:true,error};}
  componentDidCatch(error,errorInfo){
    console.error('PoultrySuite Error:',error,errorInfo);
    this.setState({errorInfo});
    // Log to audit if available
    try{
      const errLog=JSON.parse(localStorage.getItem('ps_errors')||'[]');
      errLog.unshift({ts:new Date().toISOString(),error:error.toString(),stack:errorInfo?.componentStack});
      localStorage.setItem('ps_errors',JSON.stringify(errLog.slice(0,50)));
    }catch(e){}
  }
  handleReset=()=>{this.setState({hasError:false,error:null,errorInfo:null});};
  handleReload=()=>{window.location.reload();};
  render(){
    if(this.state.hasError){
      return React.createElement('div',{style:{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#F9FAFB',padding:20}},
        React.createElement('div',{style:{maxWidth:520,background:'#fff',padding:40,boxShadow:'0 4px 20px rgba(0,0,0,0.1)',textAlign:'center'}},
          React.createElement('div',{style:{fontSize:48,marginBottom:16}},'⚠️'),
          React.createElement('h2',{style:{fontSize:20,fontWeight:700,color:'#111',marginBottom:12}},'Something went wrong'),
          React.createElement('p',{style:{fontSize:14,color:'#666',marginBottom:24,lineHeight:1.6}},'We encountered an unexpected error. Your data is safe. Please try refreshing the page or contact support if the issue persists.'),
          React.createElement('div',{style:{background:'#FEF2F2',padding:12,marginBottom:20,fontSize:12,color:'#991B1B',textAlign:'left',fontFamily:'monospace',maxHeight:100,overflow:'auto'}},this.state.error?.toString()||'Unknown error'),
          React.createElement('div',{style:{display:'flex',gap:12,justifyContent:'center'}},
            React.createElement('button',{onClick:this.handleReset,style:{padding:'10px 24px',background:'#111',color:'#fff',border:'none',cursor:'pointer',fontSize:13,fontWeight:600}},'Try Again'),
            React.createElement('button',{onClick:this.handleReload,style:{padding:'10px 24px',background:'#DC2626',color:'#fff',border:'none',cursor:'pointer',fontSize:13,fontWeight:600}},'Reload App')
          )
        )
      );
    }
    return this.props.children;
  }
}

// ─── USER-FRIENDLY ERROR MESSAGES ─────────────────────────
const friendlyError=(error)=>{
  const msg=error?.message||error?.toString()||'Unknown error';
  if(msg.includes('Network')||msg.includes('fetch'))return'Connection issue. Please check your internet and try again.';
  if(msg.includes('storage')||msg.includes('quota'))return'Storage is full. Please backup and clear old data.';
  if(msg.includes('JSON'))return'Data format error. The file may be corrupted.';
  if(msg.includes('permission'))return'Permission denied. Please check your access rights.';
  if(msg.includes('not found'))return'The requested item could not be found.';
  if(msg.includes('timeout'))return'Operation timed out. Please try again.';
  return'Something went wrong. Please try again or contact support.';
};

// ─── SESSION TIMEOUT HOOK ─────────────────────────────────
const useSessionTimeout=(timeoutMinutes=15,onTimeout,enabled=true)=>{
  const timerRef=useRef(null);
  const warningRef=useRef(null);
  const countdownRef=useRef(null);
  const [showWarning,setShowWarning]=useState(false);
  const [secondsLeft,setSecondsLeft]=useState(60);
  const showWarningRef=useRef(false);

  // Keep ref in sync with state for use inside event handlers
  useEffect(()=>{showWarningRef.current=showWarning;},[showWarning]);

  const clearAllTimers=useCallback(()=>{
    if(timerRef.current){clearTimeout(timerRef.current);timerRef.current=null;}
    if(warningRef.current){clearTimeout(warningRef.current);warningRef.current=null;}
    if(countdownRef.current){clearInterval(countdownRef.current);countdownRef.current=null;}
  },[]);

  const resetTimer=useCallback(()=>{
    if(!enabled)return;
    clearAllTimers();
    setShowWarning(false);
    setSecondsLeft(60);
    // Show warning 1 minute before timeout
    warningRef.current=setTimeout(()=>{
      setShowWarning(true);
      setSecondsLeft(60);
      countdownRef.current=setInterval(()=>{
        setSecondsLeft(s=>{
          if(s<=1){if(countdownRef.current){clearInterval(countdownRef.current);countdownRef.current=null;}return 0;}
          return s-1;
        });
      },1000);
    },(timeoutMinutes-1)*60*1000);
    // Actual timeout
    timerRef.current=setTimeout(()=>{
      if(onTimeout)onTimeout();
    },timeoutMinutes*60*1000);
  },[timeoutMinutes,onTimeout,enabled,clearAllTimers]);

  useEffect(()=>{
    if(!enabled)return;
    const events=['mousedown','keydown','touchstart','scroll'];
    // CRITICAL FIX: do NOT reset the timer while the warning modal is visible.
    // Otherwise any click (including on the modal buttons themselves) silently
    // dismisses the modal before the button onClick fires, making both buttons
    // appear unresponsive.
    const handler=()=>{if(!showWarningRef.current)resetTimer();};
    events.forEach(e=>document.addEventListener(e,handler));
    resetTimer();
    return()=>{
      events.forEach(e=>document.removeEventListener(e,handler));
      clearAllTimers();
    };
  },[resetTimer,enabled,clearAllTimers]);

  return{showWarning,secondsLeft,resetTimer};
};

// ─── SESSION TIMEOUT WARNING MODAL ────────────────────────
function SessionTimeoutWarning({secondsLeft,onContinue,onLogout}){
  return React.createElement('div',{style:{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:99000,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}},
    React.createElement('div',{style:{background:'#fff',maxWidth:420,width:'100%',padding:28,boxShadow:'0 24px 64px rgba(0,0,0,0.4)'}},
      React.createElement('div',{style:{fontSize:40,marginBottom:12,textAlign:'center'}},'⏱️'),
      React.createElement('div',{style:{fontSize:18,fontWeight:700,color:'#111',marginBottom:8,textAlign:'center'}},'Session Expiring Soon'),
      React.createElement('div',{style:{fontSize:14,color:'#666',marginBottom:20,textAlign:'center',lineHeight:1.5}},`You'll be logged out in ${secondsLeft} seconds due to inactivity. Click "Stay Logged In" to continue.`),
      React.createElement('div',{style:{display:'flex',gap:10}},
        React.createElement('button',{onClick:onLogout,style:{flex:1,padding:'12px',background:'transparent',color:'#666',border:'1px solid #ddd',cursor:'pointer',fontSize:13,fontWeight:600}},'Logout Now'),
        React.createElement('button',{onClick:onContinue,style:{flex:1,padding:'12px',background:'#059669',color:'#fff',border:'none',cursor:'pointer',fontSize:13,fontWeight:600}},'Stay Logged In')
      )
    )
  );
}

// ─── NETWORK STATUS HOOK ──────────────────────────────────
const useNetworkStatus=()=>{
  const [isOnline,setIsOnline]=useState(typeof navigator!=='undefined'?navigator.onLine:true);
  useEffect(()=>{
    const handleOnline=()=>setIsOnline(true);
    const handleOffline=()=>setIsOnline(false);
    window.addEventListener('online',handleOnline);
    window.addEventListener('offline',handleOffline);
    return()=>{
      window.removeEventListener('online',handleOnline);
      window.removeEventListener('offline',handleOffline);
    };
  },[]);
  return isOnline;
};

// ─── OFFLINE BANNER ───────────────────────────────────────
function OfflineBanner({isOnline}){
  if(isOnline)return null;
  return React.createElement('div',{style:{position:'fixed',top:0,left:0,right:0,zIndex:9500,background:'#F59E0B',color:'#fff',padding:'8px 16px',textAlign:'center',fontSize:13,fontWeight:600,boxShadow:'0 2px 8px rgba(0,0,0,0.15)'}},
    '⚠️ You are offline. Changes will be saved locally and synced when connection returns.'
  );
}

// ─── AUTO-BACKUP UTILITIES ────────────────────────────────
const getAutoBackupSettings=()=>{
  try{return JSON.parse(localStorage.getItem('ps_autobackup')||'{"enabled":true,"frequency":"daily","lastBackup":null}');}
  catch{return{enabled:true,frequency:'daily',lastBackup:null};}
};
const setAutoBackupSettings=(s)=>{try{localStorage.setItem('ps_autobackup',JSON.stringify(s));}catch{}};

const shouldAutoBackup=()=>{
  const s=getAutoBackupSettings();
  if(!s.enabled)return false;
  if(!s.lastBackup)return true;
  const now=Date.now();
  const last=new Date(s.lastBackup).getTime();
  const diff=now-last;
  if(s.frequency==='daily')return diff>86400000; // 24 hrs
  if(s.frequency==='weekly')return diff>604800000; // 7 days
  if(s.frequency==='hourly')return diff>3600000; // 1 hr
  return false;
};

const performAutoBackup=(data,moduleName='PoultrySuite')=>{
  try{
    const backup={data,_autoBackup:true,_module:moduleName,_timestamp:new Date().toISOString()};
    const backups=JSON.parse(localStorage.getItem('ps_auto_backups')||'[]');
    backups.unshift(backup);
    // Keep last 10 auto-backups
    localStorage.setItem('ps_auto_backups',JSON.stringify(backups.slice(0,10)));
    const s=getAutoBackupSettings();
    setAutoBackupSettings({...s,lastBackup:new Date().toISOString()});
    return true;
  }catch(e){console.warn('Auto-backup failed:',e);return false;}
};

// ─── PUSH NOTIFICATIONS ───────────────────────────────────
const requestNotificationPermission=async()=>{
  if(!('Notification'in window))return'unsupported';
  if(Notification.permission==='granted')return'granted';
  if(Notification.permission==='denied')return'denied';
  try{
    const result=await Notification.requestPermission();
    return result;
  }catch{return'denied';}
};

const sendNotification=(title,options={})=>{
  if(!('Notification'in window))return false;
  if(Notification.permission!=='granted')return false;
  try{
    const notif=new Notification(title,{
      body:options.body||'',
      icon:options.icon||'',
      tag:options.tag||'poultrysuite',
      requireInteraction:options.requireInteraction||false,
      silent:options.silent||false
    });
    if(options.onClick)notif.onclick=options.onClick;
    setTimeout(()=>notif.close(),options.duration||8000);
    return true;
  }catch(e){console.warn('Notification failed:',e);return false;}
};

// Check vaccination due dates and send notifications
const checkVaccinationNotifications=(vaccinations,batches)=>{
  if(!vaccinations||!batches)return;
  const today=new Date();
  const tomorrow=new Date(today.getTime()+86400000);
  const sent=JSON.parse(localStorage.getItem('ps_notif_sent')||'[]');
  vaccinations.forEach(v=>{
    if(v.status!=='Pending')return;
    const dueDate=new Date(v.dueDate);
    const batch=batches.find(b=>b.id===v.batchId);
    if(!batch)return;
    const notifId=`vax_${v.id}_${v.dueDate}`;
    if(sent.includes(notifId))return;
    // Due tomorrow
    if(dueDate.toDateString()===tomorrow.toDateString()){
      sendNotification('💉 Vaccination Due Tomorrow',{
        body:`${v.vaccine} for ${batch.name} is due tomorrow`,
        tag:notifId,
        requireInteraction:true
      });
      sent.push(notifId);
    }
    // Due today
    if(dueDate.toDateString()===today.toDateString()){
      sendNotification('⚠️ Vaccination Due Today',{
        body:`${v.vaccine} for ${batch.name} is due today!`,
        tag:notifId,
        requireInteraction:true
      });
      sent.push(notifId);
    }
    // Overdue
    if(dueDate<today&&(today-dueDate)<172800000){ // within 2 days overdue
      sendNotification('🚨 Vaccination Overdue',{
        body:`${v.vaccine} for ${batch.name} is overdue!`,
        tag:notifId,
        requireInteraction:true
      });
      sent.push(notifId);
    }
  });
  localStorage.setItem('ps_notif_sent',JSON.stringify(sent.slice(-100)));
};

// ─── VIRTUAL SCROLLING HOOK ───────────────────────────────
const useVirtualScroll=(items,itemHeight=60,containerHeight=400,overscan=5)=>{
  const [scrollTop,setScrollTop]=useState(0);
  const startIdx=Math.max(0,Math.floor(scrollTop/itemHeight)-overscan);
  const endIdx=Math.min(items.length,Math.ceil((scrollTop+containerHeight)/itemHeight)+overscan);
  const visibleItems=items.slice(startIdx,endIdx);
  const totalHeight=items.length*itemHeight;
  const offsetY=startIdx*itemHeight;
  return{visibleItems,totalHeight,offsetY,onScroll:(e)=>setScrollTop(e.target.scrollTop),startIdx};
};

// ─── VIRTUAL LIST COMPONENT ───────────────────────────────
function VirtualList({items,itemHeight=60,height=400,renderItem,emptyMessage='No items'}){
  const{visibleItems,totalHeight,offsetY,onScroll,startIdx}=useVirtualScroll(items,itemHeight,height);
  if(items.length===0){
    return React.createElement('div',{style:{padding:40,textAlign:'center',color:'#999',fontSize:13}},emptyMessage);
  }
  return React.createElement('div',{style:{height,overflow:'auto',position:'relative'},onScroll},
    React.createElement('div',{style:{height:totalHeight,position:'relative'}},
      React.createElement('div',{style:{transform:`translateY(${offsetY}px)`,position:'absolute',top:0,left:0,right:0}},
        visibleItems.map((item,idx)=>renderItem(item,startIdx+idx))
      )
    )
  );
}

// ─── END PRODUCTION REFINEMENTS ───────────────────────────

const getCapFee=(mod,val)=>{const v=Number(val)||0;if(mod==='poultry'){if(v<=5000)return 0;if(v<=20000)return 120000;if(v<=50000)return 250000;if(v<=100000)return 400000;return 600000;}if(mod==='hatchery'){if(v<=10000)return 0;if(v<=50000)return 200000;if(v<=150000)return 400000;return 700000;}if(mod==='feedmill'){if(v<=50)return 0;if(v<=200)return 250000;if(v<=500)return 500000;return 900000;}return 0;};
const getCapTier=(mod,val)=>{const v=Number(val)||0;if(mod==='poultry'){if(v<=5000)return 'Micro';if(v<=20000)return 'Small';if(v<=50000)return 'Medium';if(v<=100000)return 'Large';return 'Industrial';}if(mod==='hatchery'){if(v<=10000)return 'Micro';if(v<=50000)return 'Small';if(v<=150000)return 'Medium';return 'Industrial';}if(mod==='feedmill'){if(v<=50)return 'Micro';if(v<=200)return 'Small';if(v<=500)return 'Medium';return 'Industrial';}return '';};
const returnReact = Object.assign(React.createElement.bind(React), React);

function fmReducer(state,action){
  const audit=(s,act,ent,prev,next)=>({...s,auditLog:[{id:fmuid('FMA'),ts:new Date().toISOString(),user:'User',action:act,entity:ent,prev,next},...s.auditLog].slice(0,500)});
  switch(action.type){
    case 'ADD_RECIPE':{const s={...state,recipes:[action.p,...state.recipes]};return audit(s,`Recipe "${action.p.name}" created`,'Recipe',null,action.p);}
    case 'UPDATE_RECIPE':{const s={...state,recipes:state.recipes.map(r=>r.id===action.p.id?action.p:r)};return audit(s,'Recipe updated','Recipe',null,action.p);}
    case 'ADD_RM':{const s={...state,rawMaterials:[action.p,...state.rawMaterials]};return audit(s,`RM "${action.p.name}" received`,'RawMaterial',null,action.p);}
    case 'UPDATE_RM':{const s={...state,rawMaterials:state.rawMaterials.map(r=>r.id===action.p.id?action.p:r)};return audit(s,`Stock updated: ${action.p.name}`,'RawMaterial',null,action.p);}
    case 'ADD_BATCH':{const s={...state,productionBatches:[action.p,...state.productionBatches]};return audit(s,`Batch ${action.p.batchNo} started`,'Batch',null,action.p);}
    case 'UPDATE_BATCH':{const s={...state,productionBatches:state.productionBatches.map(b=>b.id===action.p.id?action.p:b)};return audit(s,`Batch ${action.p.batchNo}: ${action.p.status}`,'Batch',null,action.p);}
    case 'ADD_QC':{const s={...state,qcRecords:[action.p,...state.qcRecords]};return audit(s,`QC: ${action.p.result}`,'QC',null,action.p);}
    case 'ADD_FI':{const s={...state,finishedInventory:[action.p,...state.finishedInventory]};return audit(s,`Inventory: ${fmFmt(action.p.qty)}kg`,'Inventory',null,action.p);}
    case 'UPDATE_FI':{const s={...state,finishedInventory:state.finishedInventory.map(f=>f.id===action.p.id?action.p:f)};return audit(s,'Inventory updated','Inventory',null,action.p);}
    case 'ADD_DIST':{
      const fi=state.finishedInventory.find(f=>f.id===action.p.finishedInventoryId);
      const nq=Math.max(0,(fi?.qty||0)-action.p.qty);
      const ns=nq===0?'Depleted':nq<(fi?.qty||0)?'Partial':'Available';
      const s={...state,distributions:[action.p,...state.distributions],finishedInventory:state.finishedInventory.map(f=>f.id===action.p.finishedInventoryId?{...f,qty:nq,status:ns}:f)};
      return audit(s,`Dispatched ${fmFmt(action.p.qty)}kg to ${action.p.destination}`,'Distribution',null,action.p);
    }
    case 'ADD_FIN':{const s={...state,financialLogs:[action.p,...state.financialLogs]};return audit(s,`${action.p.type}: ${fmNgn(action.p.amount)}`,'Financial',null,action.p);}
    case 'UPDATE_SETTINGS':{const s={...state,settings:{...state.settings,...action.p}};return audit(s,'Settings updated','Settings',null,action.p);}
    case 'RESTORE':return action.p;
    default:return state;
  }
}


function hsReducer(state,action){
  const audit=(s,act,entity,prev,next)=>({...s,auditLog:[{id:huid('HAL'),ts:new Date().toISOString(),user:'User',action:act,entity,prev,next},...s.auditLog].slice(0,500)});
  switch(action.type){
    case 'ADD_EGG_BATCH':{const s={...state,eggBatches:[action.p,...state.eggBatches]};return audit(s,`Egg batch ${action.p.batchNo} received`,'EggBatch',null,action.p);}
    case 'UPDATE_EGG_BATCH':{const s={...state,eggBatches:state.eggBatches.map(e=>e.id===action.p.id?action.p:e)};return audit(s,`Egg batch ${action.p.batchNo}: ${action.p.status}`,'EggBatch',null,action.p);}
    case 'ADD_INCUBATION':{const s={...state,incubationRecords:[action.p,...state.incubationRecords],eggBatches:state.eggBatches.map(e=>e.id===action.p.eggBatchId?{...e,status:'Incubating'}:e)};return audit(s,`Incubation started in ${action.p.setterId}`,'Incubation',null,action.p);}
    case 'UPDATE_INCUBATION':{const s={...state,incubationRecords:state.incubationRecords.map(r=>r.id===action.p.id?action.p:r)};return audit(s,`Incubation stage: ${action.p.stage}`,'Incubation',null,action.p);}
    case 'ADD_CANDLE':{const s={...state,candlingRecords:[action.p,...state.candlingRecords],eggBatches:state.eggBatches.map(e=>e.id===action.p.eggBatchId?{...e,status:'Candling'}:e)};return audit(s,`Candling recorded`,'Candling',null,action.p);}
    case 'ADD_HATCH':{const s={...state,hatchRecords:[action.p,...state.hatchRecords],eggBatches:state.eggBatches.map(e=>e.id===action.p.eggBatchId?{...e,status:'Hatched'}:e)};return audit(s,`Hatch: ${hFmt(action.p.totalHatched)} chicks`,'Hatch',null,action.p);}
    case 'ADD_PROCESSING':{const s={...state,processingRecords:[action.p,...state.processingRecords]};return audit(s,`Processing: ${hFmt(action.p.packed)} packed`,'Processing',null,action.p);}
    case 'UPDATE_INVENTORY':{const s={...state,inventory:state.inventory.map(i=>i.id===action.p.id?action.p:i)};return audit(s,`Inventory: ${action.p.item} = ${action.p.stock} ${action.p.unit}`,'Inventory',null,action.p);}
    case 'ADD_INVENTORY':{const s={...state,inventory:[action.p,...state.inventory]};return audit(s,`Inventory added: ${action.p.item}`,'Inventory',null,action.p);}
    case 'ADD_FIN':{const s={...state,financialLogs:[action.p,...state.financialLogs]};return audit(s,`Financial: ${action.p.type} ${hNgn(action.p.amount)}`,'Financial',null,action.p);}
    case 'UPDATE_SETTINGS':{const s={...state,settings:{...state.settings,...action.p}};return audit(s,'Settings updated','Settings',null,action.p);}
    case 'RESTORE':return action.p;
    default:return state;
  }
}


function psReducer(state,action){
  const audit=(s,act,ent,eid,prev,next)=>({...s,auditLog:[{id:uid('AL'),ts:new Date().toISOString(),user:'User',action:act,entity:ent,entityId:eid,prev,next},...s.auditLog].slice(0,500)});
  switch(action.type){
    case 'ADD_HOUSE':{const s={...state,houses:[...state.houses,action.p]};return audit(s,`House "${action.p.name}" created`,'House',action.p.id,null,action.p);}
    case 'UPDATE_HOUSE':{const s={...state,houses:state.houses.map(h=>h.id===action.p.id?action.p:h)};return audit(s,`House "${action.p.name}" updated`,'House',action.p.id,null,action.p);}
    case 'ADD_BATCH':{const s={...state,batches:[...state.batches,action.p]};return audit(s,`Batch "${action.p.name}" created`,'Batch',action.p.id,null,action.p);}
    case 'UPDATE_BATCH':{const s={...state,batches:state.batches.map(b=>b.id===action.p.id?action.p:b)};return audit(s,`Batch "${action.p.name}" -> ${action.p.status}`,'Batch',action.p.id,null,action.p);}
    case 'LOG_MORT':{const s={...state,mortalityLogs:[action.p,...state.mortalityLogs],batches:state.batches.map(b=>b.id===action.p.batchId?{...b,currentCount:Math.max(0,b.currentCount-action.p.count)}:b)};return audit(s,`Mortality: ${action.p.count} (${action.p.cause})`,'Mortality',action.p.batchId,null,action.p);}
    case 'LOG_FEED':{const s={...state,feedLogs:[action.p,...state.feedLogs]};return audit(s,`Feed: ${action.p.qty}kg ${action.p.feedType}`,'Feed',action.p.batchId,null,action.p);}
    case 'ADD_FEED_TYPE':{if(state.feedTypes.includes(action.p))return state;return{...state,feedTypes:[...state.feedTypes,action.p]};}
    case 'ADD_VAX':{const s={...state,vaccinations:[...state.vaccinations,action.p]};return audit(s,`Vaccination: ${action.p.vaccine}`,'Vaccination',action.p.id,null,action.p);}
    case 'UPDATE_VAX':{const s={...state,vaccinations:state.vaccinations.map(v=>v.id===action.p.id?action.p:v)};return audit(s,`Vaccination "${action.p.vaccine}" -> ${action.p.status}`,'Vaccination',action.p.id,null,action.p);}
    case 'ADD_VAX_BATCH':{const s={...state,vaccinations:[...state.vaccinations,...action.p]};return audit(s,`Template applied (${action.p.length} doses)`,'Vaccination',action.batchId,null,action.p);}
    case 'LOG_HEALTH':{const s={...state,healthLogs:[action.p,...state.healthLogs],batches:state.batches.map(b=>b.id===action.p.batchId&&action.p.quarantine?{...b,status:'Quarantined'}:b)};return audit(s,`Health: ${action.p.symptom}`,'Health',action.p.batchId,null,action.p);}
    case 'UPDATE_HEALTH':{const s={...state,healthLogs:state.healthLogs.map(h=>h.id===action.p.id?action.p:h)};return audit(s,'Health log resolved','Health',action.p.id,null,action.p);}
    case 'LIFT_QUARANTINE':{const s={...state,batches:state.batches.map(b=>b.id===action.p?{...b,status:'Active'}:b)};return audit(s,'Quarantine lifted','Health',action.p,null,'Active');}
    case 'ADD_FIN':{const s={...state,financialLogs:[action.p,...state.financialLogs]};return audit(s,`Financial: ${action.p.type} ${ngn(action.p.amount)}`,'Financial',action.p.batchId,null,action.p);}
    case 'UPDATE_SETTINGS':return{...state,settings:{...state.settings,...action.p}};
    case 'RESTORE':return action.p;
    default:return state;
  }
}


const T = {
  // Backgrounds
  bg0:"#FFFFFF", bg1:"#F9FAFB", bg2:"#F3F4F6", bg3:"#E5E7EB",
  // Text
  ink:"#111827", ink2:"#374151", ink3:"#6B7280", ink4:"#9CA3AF",
  // Borders
  line:"#E5E7EB", lineMid:"#D1D5DB",
  // Accent — ONLY two approved blues: #DCE9FF (soft) and #2F4A6D (primary)
  accent:"#2F4A6D", accentBg:"#DCE9FF", accentBg2:"#DCE9FF", accentLine:"#DCE9FF",
  // Buttons
  btnBg:"#2F4A6D", btnBorder:"#2F4A6D", btnText:"#FFFFFF",
  selected:"#2F4A6D", selectedBg:"#DCE9FF",
  accentHov:"#2F4A6D", accentDark:"#2F4A6D",
  // Legacy aliases (keep for compat)
  charcoal:"#1F2937", charcoalDark:"#1F2937", charcoalLight:"#6B7280",
  // Status
  ok:"#059669", okBg:"#ECFDF5", okLine:"#6EE7B7",
  warn:"#D97706", warnBg:"#FFFBEB", warnLine:"#FCD34D",
  err:"#DC2626", errBg:"#FEF2F2", errLine:"#FCA5A5",
  info:"#2F4A6D", infoBg:"#DCE9FF", infoLine:"#DCE9FF",
  shadow:"0 1px 3px rgba(0,0,0,0.08)",
  shadowMd:"0 2px 8px rgba(0,0,0,0.10)",
  shadowLg:"0 4px 20px rgba(0,0,0,0.12)",
};

const GCSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%;height:100%;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);}
body{background:#FFFFFF;color:#1F2937;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',sans-serif;-webkit-font-smoothing:antialiased;font-size:16px;line-height:1.5;min-height:100%;overscroll-behavior:none;-webkit-touch-callout:none;}
button,a,[role="button"]{min-height:48px;min-width:48px;touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:opacity .12s,background .12s,box-shadow .12s;}
input,select,button,textarea{font-family:inherit;border-radius:0!important;}
input,select,textarea{font-size:16px;}
select{-webkit-appearance:none;appearance:none;}
::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:#D1D5DB;}
.scroll-ios{-webkit-overflow-scrolling:touch;overflow-y:auto;}
@keyframes fadeUp{from{opacity:0;transform:translateY(4px)}to{opacity:1}}
@keyframes scaleIn{from{opacity:0;transform:scale(0.99)}to{opacity:1}}
.au{animation:fadeUp 0.18s ease;}.au2{animation:scaleIn 0.14s ease;}
.mono{font-family:'JetBrains Mono','SF Mono','Fira Mono',ui-monospace,monospace;letter-spacing:-0.01em;}
input:focus,select:focus{outline:none!important;border-color:#2F4A6D!important;box-shadow:0 0 0 2px rgba(47,74,109,0.15)!important;}
input::placeholder{color:#9CA3AF;}
@media(min-width:768px){body{font-size:14px;}}
`;

// ── Notification deep-link action mapping
// Maps notification actionType tokens → engine id that handles them.
// Each engine reads its `pendingAction` prop and opens the matching modal.
const ACTION_TO_ENGINE = {
  // PoultryOS
  logMortality:       'health',
  viewHealth:         'health',
  markVaccination:    'vax',
  addVaccination:     'vax',
  logFeed:            'feed',
  viewEgg:            'egg',
  viewFinance:        'finance',
  // HatcheryOS
  viewCandling:       'candling',
  viewHatch:          'hatch',
  restockInventory:   'inventory',
  // FeedMillOS
  restockMaterial:    'intake',
  viewQC:             'qc',
  viewBatch:          'batch',
  viewStock:          'stock',
};
function matchesEngine(actionType,engineId){
  return ACTION_TO_ENGINE[actionType]===engineId;
}

// ── Notification Rules
const NOTIF_RULES = {
  MORTALITY_HIGH:   {id:'MORT_HIGH',  mod:'poultry',  pri:'critical',label:'Abnormal Mortality',        icon:'[!]'},
  VAX_OVERDUE:      {id:'VAX_OVR',    mod:'poultry',  pri:'critical',label:'Vaccination Overdue',       icon:'[V]'},
  VAX_DUE:          {id:'VAX_DUE',    mod:'poultry',  pri:'warning', label:'Vaccination Due',            icon:'[V]'},
  QUARANTINE_ACTIVE:{id:'QUAR_ACT',   mod:'poultry',  pri:'critical',label:'Quarantine Active',         icon:'[!]'},
  PROFIT_LOSS:      {id:'PROFIT_LOSS',mod:'poultry',  pri:'warning', label:'Batch Running at Loss',     icon:'[P]'},
  EGG_PROD_LOW:     {id:'EGG_PROD',   mod:'poultry',  pri:'warning', label:'Egg Production Below Target',icon:'[E]'},
  FEED_STOCK_LOW:   {id:'FEED_STOCK', mod:'poultry',  pri:'warning', label:'Feed Stock Running Low',    icon:'[F]'},
  FERTILITY_LOW:    {id:'FERT_LOW',   mod:'hatchery', pri:'warning', label:'Low Fertility Rate',        icon:'[E]'},
  HATCH_LOW:        {id:'HATCH_LOW',  mod:'hatchery', pri:'warning', label:'Low Hatchability',          icon:'[H]'},
  INV_LOW:          {id:'INV_LOW',    mod:'hatchery', pri:'warning', label:'Inventory Low',             icon:'[I]'},
  INV_OUT:          {id:'INV_OUT',    mod:'hatchery', pri:'critical',label:'Inventory Depleted',        icon:'[!]'},
  RM_LOW:           {id:'RM_LOW',     mod:'feedmill', pri:'warning', label:'Raw Material Low',          icon:'[R]'},
  RM_CRITICAL:      {id:'RM_CRIT',    mod:'feedmill', pri:'critical',label:'Raw Material Critical',     icon:'[!]'},
  QC_FAIL:          {id:'QC_FAIL',    mod:'feedmill', pri:'critical',label:'QC Failure Detected',       icon:'[Q]'},
  PROD_EFF_LOW:     {id:'EFF_LOW',    mod:'feedmill', pri:'warning', label:'Production Efficiency Low', icon:'[E]'},
  EXPIRY_WARN:      {id:'EXP_WARN',   mod:'feedmill', pri:'warning', label:'Feed Nearing Expiry',       icon:'[X]'},
};

function generateNotifications(poultryState, hatcheryState, feedmillState, thresholds={}) {
  const notifs=[];
  const now=new Date();
  const today=now.toISOString().split('T')[0];
  const in2days=new Date(now.getTime()+2*86400000).toISOString().split('T')[0];
  const last7=new Date(now.getTime()-7*86400000).toISOString().split('T')[0];
  const {mortalityThreshold=2.0,targetFertility=90,targetHatchability=85,targetEfficiency=95,eggProductionThreshold=75,feedStockDaysThreshold=3}=thresholds;
  if(poultryState){
    const {batches,vaccinations,mortalityLogs,financialLogs,feedLogs,settings}=poultryState;
    batches.filter(b=>b.status==='Active').forEach(b=>{
      const mort=mortalityLogs.filter(m=>m.batchId===b.id).reduce((s,m)=>s+m.count,0);
      const rate=b.initialCount>0?((mort/b.initialCount)*100):0;
      const thresh=settings?.mortalityThreshold||mortalityThreshold;
      if(rate>=thresh) notifs.push({...NOTIF_RULES.MORTALITY_HIGH,msg:`${b.name}: mortality ${rate.toFixed(1)}% exceeds ${thresh}%`,ts:now.toISOString(),actionLabel:'Log Mortality',actionEngine:'health',actionType:'logMortality',actionContext:{batchId:b.id}});
    });
    vaccinations.filter(v=>v.status!=='Done'&&v.dueDate<today).forEach(v=>{
      const b=batches.find(x=>x.id===v.batchId);
      notifs.push({...NOTIF_RULES.VAX_OVERDUE,msg:`${v.vaccine} for ${b?.name||'batch'} was due ${v.dueDate}`,ts:now.toISOString(),actionLabel:'Mark as Done',actionEngine:'vax',actionType:'markVaccination',actionContext:{vaxId:v.id}});
    });
    vaccinations.filter(v=>v.status!=='Done'&&v.dueDate>=today&&v.dueDate<=in2days).forEach(v=>{
      const b=batches.find(x=>x.id===v.batchId);
      notifs.push({...NOTIF_RULES.VAX_DUE,msg:`${v.vaccine} for ${b?.name||'batch'} due ${v.dueDate}`,ts:now.toISOString(),actionLabel:'Schedule Vaccination',actionEngine:'vax',actionType:'addVaccination',actionContext:{vaxId:v.id}});
    });
    batches.filter(b=>b.status==='Quarantined').forEach(b=>{
      notifs.push({...NOTIF_RULES.QUARANTINE_ACTIVE,msg:`Batch "${b.name}" is under quarantine`,ts:now.toISOString(),actionLabel:'View Health Record',actionEngine:'health',actionType:'viewHealth',actionContext:{batchId:b.id}});
    });
    batches.filter(b=>b.status==='Active').forEach(b=>{
      const fin=financialLogs.filter(f=>f.batchId===b.id);
      const cost=fin.filter(f=>f.type==='Cost').reduce((s,f)=>s+Number(f.amount),0);
      const rev=fin.filter(f=>f.type==='Revenue').reduce((s,f)=>s+Number(f.amount),0);
      if(rev>0&&rev<cost) notifs.push({...NOTIF_RULES.PROFIT_LOSS,msg:`Batch "${b.name}" running at loss`,ts:now.toISOString(),actionLabel:'Review Financials',actionEngine:'finance',actionType:'viewFinance',actionContext:{batchId:b.id}});
    });
    // Egg Production Performance — alert when 7-day laying rate per layer batch falls below target
    const eggThresh=settings?.eggProductionThreshold||eggProductionThreshold;
    batches.filter(b=>b&&b.type==='Layer'&&b.status==='Active'&&b.startDate&&(((new Date(today)-new Date(b.startDate))/86400000)>=140)).forEach(b=>{
      const recentEggLogs=financialLogs.filter(f=>f.batchId===b.id&&f.category==='Egg Sales'&&f.date>=last7);
      const cratesLast7=recentEggLogs.reduce((s,f)=>s+(Number(f.qty)||0),0);
      const eggsLast7=cratesLast7*30;
      const hens=b.currentCount||0;
      if(hens>0&&recentEggLogs.length>0){
        const layingRate=(eggsLast7/(hens*7))*100;
        if(layingRate<eggThresh) notifs.push({...NOTIF_RULES.EGG_PROD_LOW,msg:`${b.name}: 7-day laying rate ${layingRate.toFixed(1)}% below ${eggThresh}% target`,ts:now.toISOString(),actionLabel:'View Egg Production',actionEngine:'egg',actionType:'viewEgg',actionContext:{batchId:b.id}});
      }
    });
    // Feed Stock — alert when days since last feed log for active batch exceeds threshold (proxy for stock concern)
    const feedThresh=settings?.feedStockDaysThreshold||feedStockDaysThreshold;
    batches.filter(b=>b.status==='Active').forEach(b=>{
      const batchFeed=feedLogs.filter(f=>f.batchId===b.id);
      if(batchFeed.length===0)return;
      const latestDate=batchFeed.reduce((m,f)=>f.date>m?f.date:m,batchFeed[0].date);
      const daysSince=Math.floor((new Date(today)-new Date(latestDate))/86400000);
      if(daysSince>=feedThresh) notifs.push({...NOTIF_RULES.FEED_STOCK_LOW,msg:`${b.name}: no feed logged in ${daysSince} days — verify feed stock`,ts:now.toISOString(),actionLabel:'Log Feed',actionEngine:'feed',actionType:'logFeed',actionContext:{batchId:b.id}});
    });
  }
  if(hatcheryState){
    const {candlingRecords,hatchRecords,inventory,eggBatches,settings:hs}=hatcheryState;
    const tFert=hs?.targetFertility||targetFertility;
    const tHatch=hs?.targetHatchability||targetHatchability;
    candlingRecords.slice(0,5).forEach(cr=>{
      const fert=cr.totalCandled>0?((cr.fertile/cr.totalCandled)*100):0;
      const eb=eggBatches.find(e=>e.id===cr.eggBatchId);
      if(fert<tFert) notifs.push({...NOTIF_RULES.FERTILITY_LOW,msg:`Batch ${eb?.batchNo||cr.eggBatchId}: fertility ${fert.toFixed(1)}% below ${tFert}%`,ts:now.toISOString(),actionLabel:'View Candling',actionEngine:'candling',actionType:'viewCandling',actionContext:{batchId:cr.eggBatchId}});
    });
    hatchRecords.slice(0,5).forEach(hr=>{
      const hatch=hr.eggsSet>0?((hr.totalHatched/hr.eggsSet)*100):0;
      const eb=eggBatches.find(e=>e.id===hr.eggBatchId);
      if(hatch<tHatch) notifs.push({...NOTIF_RULES.HATCH_LOW,msg:`Batch ${eb?.batchNo||hr.eggBatchId}: hatchability ${hatch.toFixed(1)}% below ${tHatch}%`,ts:now.toISOString(),actionLabel:'View Hatch',actionEngine:'hatch',actionType:'viewHatch',actionContext:{batchId:hr.eggBatchId}});
    });
    inventory.filter(i=>i.status==='Low').forEach(i=>{
      notifs.push({...NOTIF_RULES.INV_LOW,msg:`${i.item}: stock ${i.stock} ${i.unit} at reorder level`,ts:now.toISOString(),actionLabel:'Restock Item',actionEngine:'inventory',actionType:'restockInventory',actionContext:{itemId:i.id}});
    });
    inventory.filter(i=>i.status==='Out'||i.status==='Critical').forEach(i=>{
      notifs.push({...NOTIF_RULES.INV_OUT,msg:`${i.item}: DEPLETED — immediate restocking required`,ts:now.toISOString(),actionLabel:'Restock Now',actionEngine:'inventory',actionType:'restockInventory',actionContext:{itemId:i.id,critical:true}});
    });
  }
  if(feedmillState){
    const {rawMaterials,qcRecords,productionBatches,finishedInventory,settings:fms}=feedmillState;
    const tEff=fms?.targetEfficiency||targetEfficiency;
    rawMaterials.filter(r=>r.status==='Low').forEach(r=>{
      notifs.push({...NOTIF_RULES.RM_LOW,msg:`${r.name}: ${r.stock.toLocaleString('en-NG')} ${r.unit} remaining`,ts:now.toISOString(),actionLabel:'Restock Material',actionEngine:'intake',actionType:'restockMaterial',actionContext:{itemId:r.id}});
    });
    rawMaterials.filter(r=>r.status==='Critical').forEach(r=>{
      notifs.push({...NOTIF_RULES.RM_CRITICAL,msg:`${r.name}: CRITICAL — production at risk`,ts:now.toISOString(),actionLabel:'Restock Now',actionEngine:'intake',actionType:'restockMaterial',actionContext:{itemId:r.id,critical:true}});
    });
    qcRecords.filter(q=>q.result==='Fail').slice(0,3).forEach(q=>{
      const b=productionBatches.find(x=>x.id===q.batchId);
      notifs.push({...NOTIF_RULES.QC_FAIL,msg:`QC FAIL: Batch ${b?.batchNo||q.batchId} — Moisture ${q.moisture}%, PDI ${q.pelletDurability}%`,ts:now.toISOString(),actionLabel:'Review QC',actionEngine:'qc',actionType:'viewQC',actionContext:{batchId:q.batchId}});
    });
    productionBatches.filter(b=>b.status==='Completed'&&b.targetQty>0).slice(0,3).forEach(b=>{
      const eff=(b.actualQty/b.targetQty)*100;
      if(eff<tEff) notifs.push({...NOTIF_RULES.PROD_EFF_LOW,msg:`Batch ${b.batchNo} efficiency ${eff.toFixed(1)}% below ${tEff}%`,ts:now.toISOString(),actionLabel:'View Production Batch',actionEngine:'batch',actionType:'viewBatch',actionContext:{batchId:b.id}});
    });
    finishedInventory.filter(fi=>fi.status!=='Depleted'&&fi.expiryDate).forEach(fi=>{
      const daysLeft=Math.ceil((new Date(fi.expiryDate)-now)/86400000);
      if(daysLeft<=14&&daysLeft>0) notifs.push({...NOTIF_RULES.EXPIRY_WARN,msg:`${fi.recipeName}: ${fi.qty.toLocaleString('en-NG')}kg expiring in ${daysLeft} days`,ts:now.toISOString(),actionLabel:'View Finished Stock',actionEngine:'stock',actionType:'viewStock',actionContext:{itemId:fi.id}});
    });
  }
  const priOrder={critical:0,warning:1,info:2};
  return notifs.sort((a,b)=>(priOrder[a.pri]||2)-(priOrder[b.pri]||2));
}

function NotificationBell({notifs,onOpen}){
  const critical=notifs.filter(n=>n.pri==='critical').length;
  const total=notifs.length;
  if(total===0) return(
    <button onClick={onOpen} style={{background:'none',border:'none',cursor:'pointer',padding:8,display:'flex',alignItems:'center',justifyContent:'center',minHeight:44,minWidth:44}}>
      <svg width={20} height={20} viewBox='0 0 24 24' fill='none' stroke={T.ink3} strokeWidth='1.75' strokeLinecap="square" strokeLinejoin="miter"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
    </button>
  );
  return(
    <button onClick={onOpen} style={{position:'relative',background:'none',border:'none',cursor:'pointer',padding:8,display:'flex',alignItems:'center',justifyContent:'center',minHeight:44,minWidth:44}}>
      <svg width={20} height={20} viewBox='0 0 24 24' fill='none' stroke={critical>0?T.err:T.warn} strokeWidth='1.75' strokeLinecap="square" strokeLinejoin="miter"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
      <span style={{position:'absolute',top:4,right:4,background:critical>0?T.err:T.warn,color:'#fff',fontSize:9,fontWeight:700,borderRadius:0,minWidth:16,height:16,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 3px',border:'1.5px solid #fff'}}>
        {total>99?'99+':total}
      </span>
    </button>
  );
}

function NotificationPanel({notifs,onClose,onNavigate}){
  const priColor={critical:T.err,warning:T.warn,info:T.info};
  const priBg={critical:T.errBg,warning:'#FFFBEB',info:T.infoBg};
  const [filter,setFilter]=useState('all');
  const filtered=filter==='all'?notifs:notifs.filter(n=>n.pri===filter);
  const counts={critical:notifs.filter(n=>n.pri==='critical').length,warning:notifs.filter(n=>n.pri==='warning').length};
  return(
    <div style={{position:'fixed',inset:0,zIndex:400,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'flex-start',justifyContent:'flex-end'}}>
      <div style={{width:Math.min(420,window?.innerWidth||420),height:'100vh',background:T.bg0,display:'flex',flexDirection:'column',boxShadow:'-8px 0 32px rgba(0,0,0,0.15)'}}>
        <div style={{padding:'16px 20px',borderBottom:`1px solid ${T.line}`,display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:T.ink}}>Notifications</div>
            <div style={{fontSize:12,color:T.ink4,marginTop:1}}>{notifs.length} alert{notifs.length!==1?'s':''}</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:22,color:T.ink3,minHeight:44,minWidth:44,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
        </div>
        <div style={{display:'flex',borderBottom:`1px solid ${T.line}`,flexShrink:0}}>
          {[['all','All',notifs.length],['critical','Critical',counts.critical],['warning','Warning',counts.warning]].map(([id,label,cnt])=>(
            <button key={id} onClick={()=>setFilter(id)} style={{flex:1,padding:'10px 0',background:'none',border:'none',borderBottom:`2px solid ${filter===id?T.ink:'transparent'}`,cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:filter===id?700:400,color:filter===id?T.ink:T.ink3,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
              {label}
              {cnt>0&&<span style={{background:id==='critical'?T.err:id==='warning'?T.warn:T.ink3,color:'#fff',fontSize:9,padding:'1px 5px',fontWeight:700}}>{cnt}</span>}
            </button>
          ))}
        </div>
        <div style={{flex:1,overflowY:'auto'}}>
          {filtered.length===0?(
            <div style={{textAlign:'center',padding:'40px 20px',color:T.ink4}}><div style={{width:38,height:38,border:`1px solid ${T.line}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px"}}><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={T.ink4} strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg></div><div style={{fontSize:14,fontWeight:600,color:T.ink3}}>No {filter==='all'?'':filter} alerts</div></div>
          ):filtered.map((n,i)=>(
            <div key={i} style={{padding:'14px 20px',borderBottom:`1px solid ${T.line}`,background:priBg[n.pri]||'#fff',display:'flex',gap:12,alignItems:'flex-start'}}>
              <div style={{width:28,height:28,border:`1px solid ${priColor[n.pri]||T.line}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={priColor[n.pri]||T.ink3} strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
                  <span style={{fontSize:12,fontWeight:700,color:priColor[n.pri]||T.ink,textTransform:'uppercase',letterSpacing:.5}}>{n.label}</span>
                  <span style={{fontSize:10,color:T.ink4,flexShrink:0,marginLeft:8}}>{n.mod?.toUpperCase()}</span>
                </div>
                <div style={{fontSize:13,color:T.ink,lineHeight:1.45,marginBottom:8}}>{n.msg}</div>
                {n.actionLabel&&onNavigate&&(
                  <button onClick={()=>{onNavigate(n.mod,n.actionEngine,n.actionType,n.actionContext);onClose();}} style={{fontSize:12,fontWeight:600,color:priColor[n.pri]||T.ink,background:'none',border:`1px solid ${priColor[n.pri]||T.line}`,padding:'4px 10px',cursor:'pointer',fontFamily:'inherit'}}>
                    {n.actionLabel} →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div style={{padding:'12px 20px',borderTop:`1px solid ${T.line}`,background:T.bg1,flexShrink:0}}>
          <div style={{fontSize:11,color:T.ink4,textAlign:'center'}}>Rule-based · Offline-first · Auto-refreshed on data change</div>
        </div>
      </div>
    </div>
  );
}
// ── Brand Logo
const LOGO_BLACK="#1A1A1A",LOGO_RED="#CC1C1C",LOGO_WHITE="#FFFFFF";
function PSLogo({size=64}){
  return(<img src="data:image/png;base64,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" alt="PoultrySuite Africa" width={size} height={size} style={{objectFit:'contain',display:'block',background:'transparent'}}/>);
}
function LogoBadge({size=32}){
  return(<img src="data:image/png;base64,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" alt="PoultrySuite Africa" width={size} height={size} style={{objectFit:'contain',display:'block'}}/>);
}
function IcoPoultry({size=22,color=T.ink3}){
  return(<svg width={size} height={size} viewBox="0 0 24 24" {..._S} stroke={color}>
    <path d="M3 10L12 3L21 10V21H3V10Z"/>
    <path d="M3 10H21"/>
    <rect x="9" y="14" width="6" height="7"/>
  </svg>);
}
function IcoHatchery({size=22,color=T.ink3}){
  return(<svg width={size} height={size} viewBox="0 0 24 24" {..._S} stroke={color}>
    <path d="M14 4V14.5C15.2 15.3 16 16.6 16 18C16 20.2 14.2 22 12 22C9.8 22 8 20.2 8 18C8 16.6 8.8 15.3 10 14.5V4C10 2.9 10.9 2 12 2C13.1 2 14 2.9 14 4Z"/>
    <line x1="12" y1="9" x2="12" y2="15"/>
  </svg>);
}
function IcoFeedmill({size=22,color=T.ink3}){
  return(<svg width={size} height={size} viewBox="0 0 24 24" {..._S} stroke={color}>
    <path d="M12 22V8"/>
    <path d="M12 8C9 8 6 9 6 12C9 12 12 11 12 8Z"/>
    <path d="M12 8C15 8 18 9 18 12C15 12 12 11 12 8Z"/>
    <path d="M12 14C9 14 6 15 6 18C9 18 12 17 12 14Z"/>
    <path d="M12 14C15 14 18 15 18 18C15 18 12 17 12 14Z"/>
    <path d="M12 4C10 4 8 5 8 7C10 7 12 6 12 4Z"/>
    <path d="M12 4C14 4 16 5 16 7C14 7 12 6 12 4Z"/>
  </svg>);
}
function IcoCore({size=22,color=T.ink3}){
  return(<svg width={size} height={size} viewBox="0 0 24 24" {..._S} stroke={color}>
    <rect x="4" y="4" width="16" height="16" rx="2"/>
    <rect x="9" y="9" width="6" height="6"/>
    <line x1="9" y1="2" x2="9" y2="4"/>
    <line x1="15" y1="2" x2="15" y2="4"/>
    <line x1="9" y1="20" x2="9" y2="22"/>
    <line x1="15" y1="20" x2="15" y2="22"/>
    <line x1="20" y1="9" x2="22" y2="9"/>
    <line x1="20" y1="14" x2="22" y2="14"/>
    <line x1="2" y1="9" x2="4" y2="9"/>
    <line x1="2" y1="14" x2="4" y2="14"/>
  </svg>);
}
function IcoLock({size=22,color=T.ink3}){
  return(<svg width={size} height={size} viewBox="0 0 24 24" {..._S} stroke={color}>
    <rect x="4" y="11" width="16" height="10"/>
    <path d="M8 11V7A4 4 0 0116 7V11"/>
    <rect x="11" y="15" width="2" height="2"/>
  </svg>);
}
function IcoCheck({size=18,color=T.ink}){
  return(<svg width={size} height={size} viewBox="0 0 24 24" {..._S} stroke={color}>
    <path d="M4 12L10 18L20 6"/>
  </svg>);
}
function IcoArrow({size=18,color=T.ink3}){
  return(<svg width={size} height={size} viewBox="0 0 24 24" {..._S} stroke={color}>
    <path d="M4 12H20M14 6L20 12L14 18"/>
  </svg>);
}
function IcoDelete({size=18,color=T.ink3}){
  return(<svg width={size} height={size} viewBox="0 0 24 24" {..._S} stroke={color}>
    <path d="M3 6H21M8 6V4H16V6M19 6L18 20H6L5 6"/>
    <path d="M10 11V16M14 11V16"/>
  </svg>);
}
function IcoReport({size=18,color=T.ink3}){
  return(<svg width={size} height={size} viewBox="0 0 24 24" {..._S} stroke={color}>
    <rect x="4" y="2" width="16" height="20"/>
    <path d="M8 7H16M8 11H16M8 15H12"/>
  </svg>);
}
function IcoUser({size=18,color=T.ink3}){
  return(<svg width={size} height={size} viewBox="0 0 24 24" {..._S} stroke={color}>
    <rect x="7" y="3" width="10" height="8"/>
    <path d="M3 21V19C3 16.8 4.8 15 7 15H17C19.2 15 21 16.8 21 19V21"/>
  </svg>);
}

// ── Unified engine icon dispatcher — PoultryOS
function EngineIcon({id,size=22,color="currentColor"}){
  const p={stroke:color,fill:"none",strokeWidth:"1.75",strokeLinecap:"square",strokeLinejoin:"miter"};
  const v="0 0 24 24";
  switch(id){
    case "cmd":return(<svg width={size} height={size} viewBox={v} {...p}>
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>);
    case "daily":return(<svg width={size} height={size} viewBox={v} {...p}>
      <rect x="3" y="4" width="18" height="17" rx="1"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <rect x="7" y="13" width="3" height="3"/>
    </svg>);
    case "house":return(<svg width={size} height={size} viewBox={v} {...p}>
      <path d="M2 21V11L7 7L12 11V21Z"/>
      <path d="M12 21V14L17 10L22 14V21Z"/>
      <line x1="2" y1="21" x2="22" y2="21"/>
      <rect x="5" y="16" width="2" height="3"/>
      <rect x="15" y="17" width="2" height="2"/>
    </svg>);
    case "eggs":return(<svg width={size} height={size} viewBox={v} {...p}>
      <rect x="5" y="3" width="14" height="18"/>
      <path d="M5 9H19M5 15H19"/>
      <path d="M11 3V21M13 3V21"/>
    </svg>);
    case "vax":return(<svg width={size} height={size} viewBox={v} {...p}>
      <path d="M18 2L22 6"/>
      <path d="M17 7L20 4"/>
      <path d="M19 9L10.5 17.5C9.67 18.33 8.33 18.33 7.5 17.5C6.67 16.67 6.67 15.33 7.5 14.5L16 6"/>
      <path d="M16 6L20 10"/>
      <path d="M8 16L5 19"/>
      <path d="M5 19L2 16"/>
    </svg>);
    case "feed":return(<svg width={size} height={size} viewBox={v} {...p}>
      <path d="M3 11H21L20 18C19.9 19.1 18.95 20 17.85 20H6.15C5.05 20 4.1 19.1 4 18Z"/>
      <line x1="3" y1="11" x2="21" y2="11"/>
      <circle cx="9" cy="7" r="1"/>
      <circle cx="13" cy="6" r="1"/>
      <circle cx="16" cy="8" r="1"/>
    </svg>);
    case "finance":return(<svg width={size} height={size} viewBox={v} {...p}>
      <line x1="12" y1="2" x2="12" y2="22"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>);
    case "audit":return(<svg width={size} height={size} viewBox={v} {...p}>
      <path d="M3 12C3 7.03 7.03 3 12 3C16.97 3 21 7.03 21 12C21 16.97 16.97 21 12 21C9.24 21 6.76 19.76 5.1 17.8"/>
      <polyline points="3 3 3 8 8 8"/>
      <polyline points="12 7 12 12 15 14"/>
    </svg>);
    case "settings":return(<svg width={size} height={size} viewBox={v} {...p}>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>);
    case "health":return(<svg width={size} height={size} viewBox={v} {...p}>
      <path d="M4 2V8C4 10.21 5.79 12 8 12C10.21 12 12 10.21 12 8V2"/>
      <line x1="2" y1="2" x2="6" y2="2"/>
      <line x1="10" y1="2" x2="14" y2="2"/>
      <path d="M8 12V15C8 17.21 9.79 19 12 19H14C16.21 19 18 17.21 18 15V13"/>
      <circle cx="18" cy="11" r="2"/>
    </svg>);
    case "help":return(<svg width={size} height={size} viewBox={v} {...p}>
      <path d="M9 18H15"/>
      <path d="M10 21H14"/>
      <path d="M12 2C8.69 2 6 4.69 6 8C6 9.66 6.67 11.16 7.76 12.24C8.88 13.36 10 14.34 10 16H14C14 14.34 15.12 13.36 16.24 12.24C17.33 11.16 18 9.66 18 8C18 4.69 15.31 2 12 2Z"/>
    </svg>);
    default:return(<svg width={size} height={size} viewBox={v} {...p}>
      <rect x="3" y="3" width="18" height="18"/>
      <path d="M12 8V13M12 16H12.01"/>
    </svg>);
  }
}

// ── HatcheryOS engine icons
function HIcon({id,size=22,color="currentColor"}){
  const p={stroke:color,fill:"none",strokeWidth:"1.75",strokeLinecap:"square",strokeLinejoin:"miter"};
  const v="0 0 24 24";
  switch(id){
    case "cmd":return(<svg width={size} height={size} viewBox={v} {...p}>
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>);
    case "intake":return(<svg width={size} height={size} viewBox={v} {...p}>
      <path d="M8 4C6 4 4.5 7.5 4.5 10C4.5 11.93 6.07 13.5 8 13.5C9.93 13.5 11.5 11.93 11.5 10C11.5 7.5 10 4 8 4Z"/>
      <path d="M16 8C14 8 12.5 11.5 12.5 14C12.5 15.93 14.07 17.5 16 17.5C17.93 17.5 19.5 15.93 19.5 14C19.5 11.5 18 8 16 8Z"/>
      <path d="M11 14C9.5 14 8.5 17 8.5 18.5C8.5 19.88 9.62 21 11 21C12.38 21 13.5 19.88 13.5 18.5C13.5 17 12.5 14 11 14Z"/>
    </svg>);
    case "incubation":return(<svg width={size} height={size} viewBox={v} {...p}>
      <path d="M12 6C9.5 6 8 10 8 12.5C8 14.71 9.79 16.5 12 16.5C14.21 16.5 16 14.71 16 12.5C16 10 14.5 6 12 6Z"/>
      <path d="M3 8C5.16 4.27 9.32 2 13.5 2.5"/>
      <polyline points="18 2 18 5 15 5"/>
      <path d="M21 16C18.84 19.73 14.68 22 10.5 21.5"/>
      <polyline points="6 22 6 19 9 19"/>
    </svg>);
    case "candling":return(<svg width={size} height={size} viewBox={v} {...p}>
      <path d="M10 2C7 2 4 8 4 13C4 16.31 6.69 19 10 19C13.31 19 16 16.31 16 13C16 12 16 11 15.7 10"/>
      <path d="M14 5L17 8L22 3"/>
    </svg>);
    case "hatch":return(<svg width={size} height={size} viewBox={v} {...p}>
      <rect x="3" y="3" width="18" height="18"/>
      <path d="M3 12H21"/>
      <path d="M8 3V12M16 12V21"/>
      <path d="M8 17H16"/>
    </svg>);
    case "vaccine":return(<svg width={size} height={size} viewBox={v} {...p}>
      <path d="M18 2L22 6"/>
      <path d="M17 7L20 4"/>
      <path d="M19 9L10.5 17.5C9.67 18.33 8.33 18.33 7.5 17.5C6.67 16.67 6.67 15.33 7.5 14.5L16 6"/>
      <path d="M16 6L20 10"/>
      <path d="M4 20C4 18.5 5 17 6 17C7 17 8 18.5 8 20C8 21.1 7.1 22 6 22C4.9 22 4 21.1 4 20Z"/>
    </svg>);
    case "inventory":return(<svg width={size} height={size} viewBox={v} {...p}>
      <rect x="2" y="4" width="20" height="4"/>
      <rect x="2" y="11" width="20" height="4"/>
      <rect x="2" y="18" width="20" height="3"/>
    </svg>);
    case "finance":return(<svg width={size} height={size} viewBox={v} {...p}>
      <line x1="12" y1="2" x2="12" y2="22"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>);
    case "audit":return(<svg width={size} height={size} viewBox={v} {...p}>
      <path d="M3 12C3 7.03 7.03 3 12 3C16.97 3 21 7.03 21 12C21 16.97 16.97 21 12 21C9.24 21 6.76 19.76 5.1 17.8"/>
      <polyline points="3 3 3 8 8 8"/>
      <polyline points="12 7 12 12 15 14"/>
    </svg>);
    case "settings":return(<svg width={size} height={size} viewBox={v} {...p}>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>);
    case "help":return(<svg width={size} height={size} viewBox={v} {...p}>
      <path d="M9 18H15"/>
      <path d="M10 21H14"/>
      <path d="M12 2C8.69 2 6 4.69 6 8C6 9.66 6.67 11.16 7.76 12.24C8.88 13.36 10 14.34 10 16H14C14 14.34 15.12 13.36 16.24 12.24C17.33 11.16 18 9.66 18 8C18 4.69 15.31 2 12 2Z"/>
    </svg>);
    default:return(<svg width={size} height={size} viewBox={v} {...p}>
      <rect x="3" y="3" width="18" height="18"/>
      <path d="M12 8V13M12 16H12.01"/>
    </svg>);
  }
}

// ── FeedMillOS engine icons
function FMIcon({id,size=22,color="currentColor"}){
  const p={stroke:color,fill:"none",strokeWidth:"1.75",strokeLinecap:"square",strokeLinejoin:"miter"};
  const v="0 0 24 24";
  switch(id){
    case "cmd":return(<svg width={size} height={size} viewBox={v} {...p}>
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>);
    case "recipe":return(<svg width={size} height={size} viewBox={v} {...p}>
      <path d="M9 3V9L4 18C3.4 19.3 4.3 21 5.7 21H18.3C19.7 21 20.6 19.3 20 18L15 9V3"/>
      <line x1="8" y1="3" x2="16" y2="3"/>
      <line x1="6.5" y1="14" x2="17.5" y2="14"/>
    </svg>);
    case "intake":return(<svg width={size} height={size} viewBox={v} {...p}>
      <path d="M5 7H19L18 21H6Z"/>
      <line x1="3" y1="7" x2="21" y2="7"/>
      <line x1="9" y1="4" x2="15" y2="4"/>
      <line x1="9" y1="4" x2="9" y2="7"/>
      <line x1="15" y1="4" x2="15" y2="7"/>
      <line x1="10" y1="11" x2="10" y2="18"/>
      <line x1="14" y1="11" x2="14" y2="18"/>
    </svg>);
    case "batch":return(<svg width={size} height={size} viewBox={v} {...p}>
      <circle cx="9" cy="9" r="3"/>
      <path d="M9 3V5M9 13V15M3 9H5M13 9H15M5.6 5.6L7 7M11 11L12.4 12.4M5.6 12.4L7 11M11 7L12.4 5.6"/>
      <circle cx="17" cy="17" r="2"/>
      <path d="M17 13V14M17 20V21M13 17H14M20 17H21"/>
    </svg>);
    case "qc":return(<svg width={size} height={size} viewBox={v} {...p}>
      <rect x="3" y="3" width="18" height="18"/>
      <path d="M8 12L11 15L16 9"/>
      <path d="M3 8H21M8 3V8M16 3V8"/>
    </svg>);
    case "stock":return(<svg width={size} height={size} viewBox={v} {...p}>
      <path d="M16 16V8C16 7.3 15.6 6.6 15 6.27L10 3.39C9.4 3.04 8.6 3.04 8 3.39L3 6.27C2.4 6.6 2 7.3 2 8V16C2 16.7 2.4 17.4 3 17.73L8 20.61C8.6 20.96 9.4 20.96 10 20.61L15 17.73"/>
      <polyline points="2.32 6.16 9 10 15.68 6.16"/>
      <line x1="9" y1="20" x2="9" y2="10"/>
      <line x1="14" y1="13" x2="22" y2="13"/>
      <polyline points="19 10 22 13 19 16"/>
    </svg>);
    case "distrib":return(<svg width={size} height={size} viewBox={v} {...p}>
      <rect x="2" y="5" width="12" height="10"/>
      <path d="M14 9H19L22 12V17H14V9"/>
      <rect x="4" y="17" width="4" height="4"/>
      <rect x="16" y="17" width="4" height="4"/>
    </svg>);
    case "finance":return(<svg width={size} height={size} viewBox={v} {...p}>
      <line x1="12" y1="2" x2="12" y2="22"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>);
    case "audit":return(<svg width={size} height={size} viewBox={v} {...p}>
      <path d="M3 12C3 7.03 7.03 3 12 3C16.97 3 21 7.03 21 12C21 16.97 16.97 21 12 21C9.24 21 6.76 19.76 5.1 17.8"/>
      <polyline points="3 3 3 8 8 8"/>
      <polyline points="12 7 12 12 15 14"/>
    </svg>);
    case "settings":return(<svg width={size} height={size} viewBox={v} {...p}>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>);
    case "help":return(<svg width={size} height={size} viewBox={v} {...p}>
      <path d="M9 18H15"/>
      <path d="M10 21H14"/>
      <path d="M12 2C8.69 2 6 4.69 6 8C6 9.66 6.67 11.16 7.76 12.24C8.88 13.36 10 14.34 10 16H14C14 14.34 15.12 13.36 16.24 12.24C17.33 11.16 18 9.66 18 8C18 4.69 15.31 2 12 2Z"/>
    </svg>);
    default:return(<svg width={size} height={size} viewBox={v} {...p}>
      <rect x="3" y="3" width="18" height="18"/>
      <path d="M12 8V13M12 16H12.01"/>
    </svg>);
  }
}

// ── Help section icons
function HelpSectionIcon({id, size=18, color}){
  const c=color||T.ink3;
  const p={stroke:c,fill:"none",strokeWidth:"1.75",strokeLinecap:"square",strokeLinejoin:"miter"};
  const v="0 0 24 24";
  switch(id){
    case "overview":return(<svg width={size} height={size} viewBox={v} {...p}>
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>);
    case "start":return(<svg width={size} height={size} viewBox={v} {...p}>
      <path d="M22 10V16"/>
      <path d="M2 10L12 5L22 10L12 15L2 10Z"/>
      <path d="M6 12V17C9 19 15 19 18 17V12"/>
    </svg>);
    case "daily":return(<svg width={size} height={size} viewBox={v} {...p}>
      <rect x="3" y="4" width="18" height="17"/>
      <path d="M3 9H21M8 2V6M16 2V6"/>
      <path d="M7 13H11M7 17H11"/>
    </svg>);
    case "health":return(<svg width={size} height={size} viewBox={v} {...p}>
      <path d="M4 2V8C4 10.21 5.79 12 8 12C10.21 12 12 10.21 12 8V2"/>
      <line x1="2" y1="2" x2="6" y2="2"/>
      <line x1="10" y1="2" x2="14" y2="2"/>
      <path d="M8 12V15C8 17.21 9.79 19 12 19H14C16.21 19 18 17.21 18 15V13"/>
      <circle cx="18" cy="11" r="2"/>
    </svg>);
    case "finance":return(<svg width={size} height={size} viewBox={v} {...p}>
      <line x1="12" y1="2" x2="12" y2="22"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>);
    case "settings":return(<svg width={size} height={size} viewBox={v} {...p}>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>);
    case "glossary":return(<svg width={size} height={size} viewBox={v} {...p}>
      <rect x="4" y="2" width="16" height="20"/>
      <path d="M8 7H16M8 11H14M8 15H12"/>
    </svg>);
    default:return(<svg width={size} height={size} viewBox={v} {...p}>
      <rect x="3" y="3" width="18" height="18"/>
      <path d="M9 9H15M12 9V15"/>
    </svg>);
  }
}

// ══════════════════════════════════════════════════════════
//  DESIGN TOKENS & SHARED UTILITIES
// ══════════════════════════════════════════════════════════
// ngn() and fmtN() are the original money/number formatters used throughout
// the codebase. They cannot directly use the useCurrency() hook (they're
// called from reducers, static utilities, and audit log builders — outside
// the React render tree).
//
// Instead, the CurrencyProvider writes the active currency to window.__psa
// on every change, and these helpers read it. The Intl.NumberFormat calls
// stay locale-aware so display formatting still respects the user's region.
//
// Result: every existing ngn(x)/fmtN(x) call across the 6,000-line codebase
// updates automatically when the user changes country/currency. No call-site
// edits required.
const _activeCurrency = () => {
  try {
    const c = (typeof window !== 'undefined' && window.__psa && window.__psa.currency) || null;
    return c || { code: 'NGN', symbol: '₦', locale: 'en-NG', decimals: 2 };
  } catch (_) {
    return { code: 'NGN', symbol: '₦', locale: 'en-NG', decimals: 2 };
  }
};
const ngn = (n) => {
  const c = _activeCurrency();
  const v = Number(n || 0);
  try {
    return new Intl.NumberFormat(c.locale, {
      style: 'currency',
      currency: c.code,
      maximumFractionDigits: c.decimals === 0 ? 0 : 2,
      minimumFractionDigits: 0,
    }).format(v);
  } catch (_) {
    return `${c.symbol}${v.toLocaleString('en-US')}`;
  }
};
const fmtN = (n) => {
  const c = _activeCurrency();
  const v = Number(n || 0);
  try {
    return new Intl.NumberFormat(c.locale).format(v);
  } catch (_) {
    return v.toLocaleString('en-US');
  }
};
const uid=(p='ID')=>`${p}-${Date.now().toString(36).toUpperCase().slice(-5)}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;
const todayStr=()=>new Date().toISOString().split('T')[0];
const fmtDate=d=>d?new Date(d).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'}):'—';
const daysDiff=(a,b=Date.now())=>Math.max(0,Math.floor((new Date(b)-new Date(a))/86400000));
const pct=(a,b)=>b>0?((a/b)*100).toFixed(1):'0.0';

// ── Location data
const AFRICA_LOCATIONS={
  "Nigeria":{
    "Abia":["Aba North","Aba South","Arochukwu","Bende","Ikwuano","Isiala Ngwa North","Isiala Ngwa South","Obi Ngwa","Ohafia","Osisioma","Ugwunagbo","Ukwa East","Ukwa West","Umuahia North","Umuahia South"],
    "Adamawa":["Demsa","Fufore","Ganye","Gombi","Hong","Jada","Lamurde","Madagali","Maiha","Mayo-Belwa","Michika","Mubi North","Mubi South","Numan","Song","Yola North","Yola South"],
    "Akwa Ibom":["Abak","Eket","Essien Udim","Etinan","Ikono","Ikot Abasi","Ikot Ekpene","Ini","Itu","Mbo","Obot Akara","Okobo","Onna","Oron","Oruk Anam","Ukanafun","Uruan","Uyo"],
    "Anambra":["Aguata","Anaocha","Awka North","Awka South","Ayamelum","Dunukofia","Ekwusigo","Idemili North","Idemili South","Ihiala","Njikoka","Nnewi North","Nnewi South","Ogbaru","Onitsha North","Onitsha South","Orumba North","Orumba South"],
    "Bauchi":["Alkaleri","Bauchi","Bogoro","Darazo","Dass","Gamawa","Ganjuwa","Katagum","Kirfi","Misau","Ningi","Tafawa Balewa","Toro","Warji","Zaki"],
    "Bayelsa":["Brass","Ekeremor","Kolokuma/Opokuma","Nembe","Ogbia","Sagbama","Southern Ijaw","Yenagoa"],
    "Benue":["Ado","Agatu","Apa","Buruku","Gboko","Guma","Gwer East","Gwer West","Katsina-Ala","Konshisha","Kwande","Logo","Makurdi","Obi","Ogbadibo","Oju","Okpokwu","Oturkpo","Tarka","Ukum","Ushongo","Vandeikya"],
    "Borno":["Bama","Biu","Chibok","Damboa","Dikwa","Gwoza","Jere","Konduga","Kukawa","Maiduguri","Marte","Monguno","Ngala","Shani"],
    "Cross River":["Abi","Akamkpa","Akpabuyo","Bekwarra","Biase","Boki","Calabar Municipal","Calabar South","Etung","Ikom","Obanliku","Obubra","Obudu","Odukpani","Ogoja","Yakuur","Yala"],
    "Delta":["Aniocha North","Aniocha South","Bomadi","Burutu","Ethiope East","Ethiope West","Ika North East","Ika South","Isoko North","Isoko South","Ndokwa East","Ndokwa West","Okpe","Oshimili North","Oshimili South","Patani","Sapele","Udu","Ughelli North","Ughelli South","Ukwuani","Uvwie","Warri North","Warri South","Warri South West"],
    "Ebonyi":["Abakaliki","Afikpo North","Afikpo South","Ebonyi","Ezza North","Ezza South","Ikwo","Ishielu","Ivo","Izzi","Ohaozara","Ohaukwu","Onicha"],
    "Edo":["Akoko-Edo","Egor","Esan Central","Esan North-East","Esan South-East","Esan West","Etsako Central","Etsako East","Etsako West","Igueben","Ikpoba-Okha","Oredo","Orhionmwon","Ovia North-East","Ovia South-West","Owan East","Owan West","Uhunmwonde"],
    "Ekiti":["Ado Ekiti","Efon","Ekiti East","Ekiti South-West","Ekiti West","Emure","Gbonyin","Ido/Osi","Ijero","Ikere","Ikole","Ilejemeje","Irepodun/Ifelodun","Ise/Orun","Moba","Oye"],
    "Enugu":["Aninri","Awgu","Enugu East","Enugu North","Enugu South","Ezeagu","Igbo Etiti","Igbo Eze North","Igbo Eze South","Isi-Uzo","Nkanu East","Nkanu West","Nsukka","Oji River","Udenu","Udi","Uzo-Uwani"],
    "FCT":["Abaji","Abuja Municipal","Bwari","Gwagwalada","Kuje","Kwali"],
    "Gombe":["Akko","Balanga","Billiri","Dukku","Funakaye","Gombe","Kaltungo","Kwami","Nafada","Shomgom","Yamaltu/Deba"],
    "Imo":["Aboh Mbaise","Ahiazu Mbaise","Ehime Mbano","Ezinihitte","Ideato North","Ideato South","Ihitte/Uboma","Ikeduru","Isiala Mbano","Isu","Mbaitoli","Ngor Okpala","Njaba","Nkwerre","Nwangele","Obowo","Oguta","Ohaji/Egbema","Okigwe","Onuimo","Orlu","Orsu","Oru East","Oru West","Owerri Municipal","Owerri North","Owerri West"],
    "Jigawa":["Auyo","Babura","Biriniwa","Birnin Kudu","Buji","Dutse","Gagarawa","Garki","Gumel","Guri","Gwaram","Gwiwa","Hadejia","Jahun","Kafin Hausa","Kaugama","Kazaure","Maigatari","Malam Madori","Miga","Ringim","Roni","Sule Tankarkar","Taura","Yankwashi"],
    "Kaduna":["Birnin Gwari","Chikun","Giwa","Igabi","Ikara","Jaba","Jema'a","Kachia","Kaduna North","Kaduna South","Kagarko","Kajuru","Kaura","Kauru","Kubau","Kudan","Lere","Makarfi","Sabon Gari","Sanga","Soba","Zangon Kataf","Zaria"],
    "Kano":["Dala","Fagge","Garko","Gwale","Gwarzo","Kano Municipal","Karaye","Kibiya","Kiru","Kumbotso","Kunchi","Kura","Madobi","Makoda","Minjibir","Nassarawa","Rano","Rimin Gado","Shanono","Sumaila","Takai","Tarauni","Tofa","Tsanyawa","Tudun Wada","Ungogo","Warawa","Wudil"],
    "Katsina":["Bakori","Batagarawa","Batsari","Baure","Bindawa","Charanchi","Dan Musa","Dandume","Danja","Daura","Dutsi","Dutsin Ma","Faskari","Funtua","Ingawa","Jibia","Kafur","Kaita","Kankara","Kankia","Katsina","Kurfi","Kusada","Malumfashi","Mani","Mashi","Matazu","Musawa","Rimi","Sabuwa","Safana","Sandamu","Zango"],
    "Kebbi":["Aleiro","Arewa Dandi","Argungu","Augie","Bagudo","Birnin Kebbi","Bunza","Dandi","Fakai","Gwandu","Jega","Kalgo","Koko/Besse","Maiyama","Ngaski","Sakaba","Shanga","Suru","Wasagu/Danko","Yauri","Zuru"],
    "Kogi":["Adavi","Ajaokuta","Ankpa","Bassa","Dekina","Ibaji","Idah","Igalamela-Odolu","Ijumu","Kabba/Bunu","Kogi","Lokoja","Mopa-Muro","Ofu","Ogori/Magongo","Okehi","Okene","Olamaboro","Omala","Yagba East","Yagba West"],
    "Kwara":["Asa","Baruten","Edu","Ekiti","Ifelodun","Ilorin East","Ilorin South","Ilorin West","Irepodun","Isin","Kaiama","Moro","Offa","Oke Ero","Oyun","Pategi"],
    "Lagos":["Agege","Ajeromi-Ifelodun","Alimosho","Amuwo-Odofin","Apapa","Badagry","Epe","Eti-Osa","Ibeju-Lekki","Ifako-Ijaiye","Ikeja","Ikorodu","Kosofe","Lagos Island","Lagos Mainland","Mushin","Ojo","Oshodi-Isolo","Shomolu","Surulere"],
    "Nasarawa":["Akwanga","Awe","Doma","Karu","Keana","Keffi","Kokona","Lafia","Nasarawa","Nasarawa Egon","Obi","Toto","Wamba"],
    "Niger":["Agaie","Agwara","Bida","Borgu","Bosso","Chanchaga","Edati","Gbako","Gurara","Katcha","Kontagora","Lapai","Lavun","Magama","Mariga","Mashegu","Mokwa","Moya","Paikoro","Rafi","Rijau","Shiroro","Suleja","Tafa","Wushishi"],
    "Ogun":["Abeokuta North","Abeokuta South","Ado-Odo/Ota","Ewekoro","Ifo","Ijebu East","Ijebu North","Ijebu North East","Ijebu Ode","Ikenne","Imeko Afon","Ipokia","Obafemi Owode","Odeda","Odogbolu","Ogun Waterside","Remo North","Sagamu","Yewa North","Yewa South"],
    "Ondo":["Akoko North-East","Akoko North-West","Akoko South-East","Akoko South-West","Akure North","Akure South","Ese Odo","Idanre","Ifedore","Ilaje","Ile-Oluji/Okeigbo","Irele","Odigbo","Okitipupa","Ondo East","Ondo West","Ose","Owo"],
    "Osun":["Aiyedade","Aiyedire","Atakunmosa East","Atakunmosa West","Boripe","Ede North","Ede South","Egbedore","Ejigbo","Ife Central","Ife East","Ife North","Ife South","Ifedayo","Ifelodun","Ila","Ilesa East","Ilesa West","Irepodun","Irewole","Isokan","Iwo","Obokun","Odo-Otin","Ola-Oluwa","Olorunda","Oriade","Orolu","Osogbo"],
    "Oyo":["Afijio","Akinyele","Atiba","Atisbo","Egbeda","Ibadan North","Ibadan North-East","Ibadan North-West","Ibadan South-East","Ibadan South-West","Ibarapa Central","Ibarapa East","Ibarapa North","Ido","Irepo","Iseyin","Itesiwaju","Iwajowa","Kajola","Lagelu","Ogbomosho North","Ogbomosho South","Ogo Oluwa","Olorunsogo","Oluyole","Ona Ara","Orelope","Ori Ire","Oyo East","Oyo West","Saki East","Saki West","Surulere"],
    "Plateau":["Barkin Ladi","Bassa","Bokkos","Jos East","Jos North","Jos South","Kanam","Kanke","Langtang North","Langtang South","Mangu","Mikang","Pankshin","Qua'an Pan","Riyom","Shendam","Wase"],
    "Rivers":["Abua/Odual","Ahoada East","Ahoada West","Akuku-Toru","Andoni","Asari-Toru","Bonny","Degema","Eleme","Emohua","Etche","Gokana","Ikwerre","Khana","Obio-Akpor","Ogba/Egbema/Ndoni","Ogu/Bolo","Okrika","Omuma","Opobo/Nkoro","Oyigbo","Port Harcourt","Tai"],
    "Sokoto":["Binji","Bodinga","Dange-Shuni","Gada","Goronyo","Gudu","Gwadabawa","Illela","Isa","Kebbe","Kware","Rabah","Sabon Birni","Shagari","Silame","Sokoto North","Sokoto South","Tambuwal","Tangaza","Tureta","Wamako","Wurno","Yabo"],
    "Taraba":["Ardo-Kola","Bali","Donga","Gashaka","Gassol","Ibi","Jalingo","Karim-Lamido","Kurmi","Lau","Sardauna","Takum","Ussa","Wukari","Yorro","Zing"],
    "Yobe":["Bade","Bursari","Damaturu","Fika","Fune","Geidam","Gujba","Gulani","Jakusko","Karasuwa","Machina","Nangere","Nguru","Potiskum","Tarmuwa","Yunusari","Yusufari"],
    "Zamfara":["Anka","Bakura","Birnin Magaji/Kiyaw","Bukkuyum","Bungudu","Gummi","Gusau","Kaura Namoda","Maradun","Maru","Shinkafi","Talata-Mafara","Tsafe","Zurmi"]
  },
  "Ghana":{
    "Ashanti":["Asante Akim Central","Asante Akim North","Asante Akim South","Bekwai","Bosome Freho","Ejisu","Ejura-Sekyedumase","Juaben","Kumasi","Kwabre East","Mampong","Obuasi","Oforikrom","Bosomtwe"],
    "Brong-Ahafo":["Asunafo North","Asunafo South","Asutifi North","Asutifi South","Atebubu-Amantin","Banda","Berekum East","Dormaa Central","Dormaa East","Dormaa West","Jaman North","Jaman South","Kintampo North","Kintampo South","Nkoranza North","Nkoranza South","Sunyani Municipal","Tain","Techiman","Wenchi"],
    "Central":["Agona East","Agona West","Ajumako-Enyan-Esiam","Asikuma-Odoben-Brakwa","Assin Central","Assin North","Assin South","Awutu Senya","Cape Coast","Effutu","Ekumfi","Gomoa Central","Gomoa East","Gomoa West","Komenda-Edina-Eguafo-Abrem","Mfantsiman","Upper Denkyira East","Upper Denkyira West"],
    "Eastern":["Asuogyaman","Atiwa","Ayensuano","Birim Central","Birim North","Birim South","Denkyembour","Eastern Akyem","Fanteakwa","Kwaebibirem","Kwahu Afram Plains North","Kwahu Afram Plains South","Kwahu East","Kwahu South","Kwahu West","Lower Manya Krobo","New Juaben North","New Juaben South","Nsawam Adoagyiri","Suhum","Upper Manya Krobo","Upper West Akyem","West Akyem","Yilo Krobo"],
    "Greater Accra":["Accra","Adenta","Ashaiman","Ayawaso Central","Ayawaso East","Ayawaso North","Ayawaso West Wuogon","Ga Central","Ga East","Ga North","Ga South","Ga West","Korle-Bu","Kpone-Katamanso","La Dade-Kotopon","La Nkwantanang-Madina","Ledzokuku","Ningo-Prampram","Okaikwei North","Tema Metropolitan","Tema West","Weija-Gbawe"],
    "Northern":["Bole","Central Gonja","Gushegu","Karaga","Kpandai","Kumbungu","Mamprugu Moagduri","Mion","Nanumba North","Nanumba South","Nanton","Savelugu","Sagnarigu","Tamale","Tolon","West Gonja","Yendi","Zabzugu"],
    "Upper East":["Bawku Municipal","Bawku West","Binduri","Bolgatanga","Bolgatanga East","Builsa North","Builsa South","Garu","Kassena-Nankana East","Kassena-Nankana West","Nabdam","Pusiga","Talensi","Tempane"],
    "Upper West":["Daffiama-Bussie-Issa","Jirapa","Lambussie-Karni","Lawra","Nadowli-Kaleo","Nandom","Sissala East","Sissala West","Wa Municipal","Wa East","Wa West"],
    "Volta":["Afadjato South","Agortime-Ziope","Akatsi North","Akatsi South","Anloga","Central Tongu","Ho Municipal","Ho West","Hohoe","Jasikan","Kadjebi","Keta","Ketu North","Ketu South","Kpando","North Dayi","North Tongu","Nkwanta North","Nkwanta South","South Dayi","South Tongu"],
    "Western":["Ahanta West","Amenfi Central","Amenfi East","Amenfi West","Ellembelle","Effia-Kwesimintsim","Jomoro","Mpohor","Nzema East","Prestea-Huni Valley","Sekondi-Takoradi","Shama","Tarkwa-Nsuaem","Wassa Amenfi East","Wassa East"]
  },
  "Kenya":{
    "Baringo":["Baringo Central","Baringo North","Baringo South","Eldama Ravine","Mogotio","Tiaty"],
    "Bomet":["Bomet Central","Bomet East","Chepalungu","Konoin","Sotik"],
    "Bungoma":["Bumula","Kabuchai","Kanduyi","Kimilili","Mt Elgon","Sirisia","Tongaren","Webuye East","Webuye West"],
    "Busia":["Budalangi","Butula","Funyula","Nambale","Teso North","Teso South"],
    "Elgeyo-Marakwet":["Keiyo North","Keiyo South","Marakwet East","Marakwet West"],
    "Embu":["Embu East","Embu North","Embu West","Manyatta","Mbeere North","Mbeere South","Runyenjes"],
    "Garissa":["Dadaab","Fafi","Garissa Township","Hulugho","Ijara","Lagdera","Balambala"],
    "Homa Bay":["Gem","Kabondo Kasipul","Karachuonyo","Kasipul","Mbita","Ndhiwa","Rangwe","Suba"],
    "Isiolo":["Garbatulla","Isiolo","Merti"],
    "Kajiado":["Kajiado Central","Kajiado East","Kajiado North","Kajiado South","Kajiado West"],
    "Kakamega":["Butere","Ikolomani","Khwisero","Likuyani","Lugari","Lurambi","Malava","Matungu","Mumias East","Mumias West","Navakholo","Shinyalu"],
    "Kericho":["Ainamoi","Belgut","Bureti","Kipkelion East","Kipkelion West","Soin-Sigowet"],
    "Kiambu":["Gatundu North","Gatundu South","Githunguri","Juja","Kabete","Kiambaa","Kiambu","Kikuyu","Limuru","Lari","Ruiru","Thika Town","Githunguri"],
    "Kilifi":["Ganze","Kaloleni","Kilifi North","Kilifi South","Magarini","Malindi","Rabai"],
    "Kirinyaga":["Kirinyaga Central","Kirinyaga East","Kirinyaga West","Mwea East","Mwea West"],
    "Kisii":["Bonchari","Bomachoge Borabu","Bomachoge Chache","Bobasi","Kitutu Chache North","Kitutu Chache South","Nyaribari Chache","Nyaribari Masaba","South Mugirango"],
    "Kisumu":["Kisumu Central","Kisumu East","Kisumu West","Muhoroni","Nyakach","Nyando","Seme"],
    "Kitui":["Kitui Central","Kitui East","Kitui Rural","Kitui South","Kitui West","Lower Yatta","Mwingi Central","Mwingi North","Mwingi West"],
    "Kwale":["Kinango","Lungalunga","Matuga","Msambweni"],
    "Laikipia":["Laikipia Central","Laikipia East","Laikipia North","Laikipia West","Nyahururu","Mukogodo East","Mukogodo West"],
    "Lamu":["Lamu East","Lamu West"],
    "Machakos":["Kathiani","Machakos Town","Masinga","Matungulu","Mavoko","Mwala","Yatta"],
    "Makueni":["Kaiti","Kibwezi East","Kibwezi West","Kilome","Makueni","Mbooni"],
    "Mandera":["Banissa","Lafey","Mandera East","Mandera North","Mandera South","Mandera West"],
    "Marsabit":["Laisamis","Moyale","North Horr","Saku"],
    "Meru":["Buuri","Igembe Central","Igembe North","Igembe South","Imenti North","Imenti South","Tigania East","Tigania West","Meru"],
    "Migori":["Awendo","Kuria East","Kuria West","Mabera","Ntimaru","Rongo","Suna East","Suna West","Uriri"],
    "Mombasa":["Changamwe","Jomvu","Kisauni","Likoni","Mvita","Nyali"],
    "Murang'a":["Gatanga","Kandara","Kang'undo","Kigumo","Kiharu","Mathioya","Maragwa","Murang'a South"],
    "Nairobi":["Dagoretti North","Dagoretti South","Embakasi Central","Embakasi East","Embakasi North","Embakasi South","Embakasi West","Kamukunji","Kasarani","Kibra","Lang'ata","Makadara","Mathare","Roysambu","Ruaraka","Starehe","Westlands"],
    "Nakuru":["Bahati","Gilgil","Kuresoi North","Kuresoi South","Molo","Naivasha","Nakuru Town East","Nakuru Town West","Njoro","Rongai","Subukia"],
    "Nandi":["Aldai","Chesumei","Emgwen","Mosop","Nandi Hills","Tindiret"],
    "Narok":["Emurua Dikirr","Kilgoris","Narok East","Narok North","Narok South","Narok West"],
    "Nyamira":["Borabu","Kitutu Masaba","North Mugirango","West Mugirango"],
    "Nyandarua":["Kinangop","Kipipiri","Mirangine","Ndaragwa","Ol Kalou"],
    "Nyeri":["Kieni","Mathira","Mukurweini","Nyeri Town","Othaya","Tetu"],
    "Samburu":["Samburu Central","Samburu East","Samburu North"],
    "Siaya":["Alego-Usonga","Bondo","Gem","Rarieda","Ugenya","Ugunja"],
    "Taita-Taveta":["Mwatate","Taveta","Voi","Wundanyi"],
    "Tana River":["Bura","Galole","Garsen"],
    "Tharaka-Nithi":["Chuka/Igambang'ombe","Maara","Tharaka"],
    "Trans-Nzoia":["Cherangany","Endebess","Kiminini","Kwanza","Saboti"],
    "Turkana":["Loima","Turkana Central","Turkana East","Turkana North","Turkana South","Turkana West"],
    "Uasin Gishu":["Ainabkoi","Kapseret","Kesses","Moiben","Soy","Turbo"],
    "Vihiga":["Emuhaya","Hamisi","Luanda","Sabatia","Vihiga"],
    "Wajir":["Eldas","Tarbaj","Wajir East","Wajir North","Wajir South","Wajir West"],
    "West Pokot":["Central Pokot","North Pokot","Pokot South","West Pokot"]
  },
  "Ethiopia":{
    "Addis Ababa":["Addis Ketema","Akaky Kaliti","Arada","Bole","Gullele","Kirkos","Kolfe Keranio","Lideta","Nifas Silk-Lafto","Yeka"],
    "Amhara":["Awi","East Gojjam","North Gondar","North Shewa","North Wollo","Oromia","South Gondar","South Wollo","Wag Hemra","West Gojjam"],
    "Oromia":["Arsi","Bale","Borena","East Hararghe","East Shewa","East Wollega","Guji","Horo Guduru Wollega","Illubabor","Jimma","Kelam Wollega","Kofale","North Shewa","South West Shewa","West Arsi","West Hararghe","West Shewa","West Wollega"],
    "SNNPR":["Aleta Wondo","Bench-Sheko","Basketo","Dawro","Gamo","Gedeo","Gofa","Gurage","Hadiya","Halaba","Kaffa","Konso","Silte","Sidama","Wolaita","Yem"],
    "Tigray":["Central Tigray","Eastern Tigray","North Western Tigray","South Eastern Tigray","Southern Tigray","Western Tigray"],
    "Afar":["Afar Zone 1","Afar Zone 2","Afar Zone 3","Afar Zone 4","Afar Zone 5"],
    "Somali":["Afder","Doolo","Erer","Fafen","Jarar","Korahe","Liben","Nogob","Shabelle","Siti"],
    "Benishangul-Gumuz":["Asosa","Kamashi","Mao-Komo","Metekel"],
    "Gambella":["Agnuak","Itang Special","Majang","Nuer"],
    "Harari":["Aboker","Erer","Harar"],
    "Dire Dawa":["Dire Dawa"]
  },
  "South Africa":{
    "Eastern Cape":["Alfred Nzo","Amathole","Buffalo City","Chris Hani","Joe Gqabi","Nelson Mandela Bay","OR Tambo","Sarah Baartman"],
    "Free State":["Fezile Dabi","Lejweleputswa","Mangaung","Thabo Mofutsanyana","Xhariep"],
    "Gauteng":["City of Ekurhuleni","City of Johannesburg","City of Tshwane","Sedibeng","West Rand"],
    "KwaZulu-Natal":["Amajuba","eThekwini","Harry Gwala","iLembe","King Cetshwayo","Ugu","uMgungundlovu","uMkhanyakude","uMzinyathi","uThukela","Zululand"],
    "Limpopo":["Capricorn","Greater Sekhukhune","Mopani","Vhembe","Waterberg"],
    "Mpumalanga":["Ehlanzeni","Gert Sibande","Nkangala"],
    "Northern Cape":["Frances Baard","John Taolo Gaetsewe","Namakwa","Pixley ka Seme","ZF Mgcawu"],
    "North West":["Bojanala Platinum","Dr Kenneth Kaunda","Dr Ruth Segomotsi Mompati","Ngaka Modiri Molema"],
    "Western Cape":["Cape Winelands","Central Karoo","Garden Route","Overberg","Cape Metro","West Coast"]
  },
  "Tanzania":{
    "Arusha":["Arusha City","Arusha District","Karatu","Longido","Meru","Monduli","Ngorongoro"],
    "Dar es Salaam":["Ilala","Kinondoni","Kigamboni","Temeke","Ubungo"],
    "Dodoma":["Bahi","Chamwino","Chemba","Dodoma Urban","Kondoa","Kongwa","Mpwapwa"],
    "Geita":["Bukombe","Chato","Geita District","Mbogwe","Nyang'hwale"],
    "Iringa":["Iringa District","Iringa Municipal","Kilolo","Mafinga","Mufindi"],
    "Kagera":["Biharamulo","Bukoba District","Bukoba Municipal","Karagwe","Kyerwa","Misenyi","Muleba","Ngara"],
    "Katavi":["Mlele","Mpanda District","Mpanda Town"],
    "Kigoma":["Buhigwe","Kakonko","Kasulu District","Kasulu Town","Kibondo","Kigoma District","Kigoma/Ujiji","Uvinza"],
    "Kilimanjaro":["Hai","Moshi District","Moshi Municipal","Mwanga","Rombo","Same","Siha"],
    "Manyara":["Babati District","Babati Town","Hanang","Kiteto","Mbulu","Simanjiro"],
    "Mara":["Bunda","Butiama","Musoma District","Musoma Municipal","Rorya","Serengeti","Tarime"],
    "Mbeya":["Busokelo","Chunya","Kyela","Mbarali","Mbeya City","Mbeya District","Rungwe"],
    "Mjini Magharibi":["Mjini","Magharibi","Kaskazini A","Kaskazini B","Kusini"],
    "Morogoro":["Gairo","Kilombero","Kilosa","Morogoro District","Morogoro Municipal","Mvomero","Ulanga"],
    "Mtwara":["Masasi","Mtwara District","Mtwara Municipal","Nanyumbu","Newala","Tandahimba"],
    "Mwanza":["Buchosa","Ilemela","Kwimba","Magu","Misungwi","Nyamagana","Sengerema","Ukerewe"],
    "Njombe":["Ludewa","Makambako","Makete","Njombe District","Njombe Town","Wanging'ombe"],
    "Pwani":["Bagamoyo","Kibaha District","Kibaha Town","Kisarawe","Mafia","Mkuranga","Rufiji"],
    "Rukwa":["Kalambo","Nkasi","Sumbawanga District","Sumbawanga Municipal"],
    "Ruvuma":["Mbinga","Namtumbo","Nyasa","Songea District","Songea Municipal","Tunduru"],
    "Shinyanga":["Kahama District","Kahama Town","Kishapu","Shinyanga District","Shinyanga Municipal"],
    "Simiyu":["Bariadi","Busega","Itilima","Maswa","Meatu"],
    "Singida":["Ikungi","Iramba","Manyoni","Mkalama","Singida District","Singida Municipal"],
    "Tabora":["Igunga","Kaliua","Nzega","Sikonge","Tabora Municipal","Urambo","Uyui"],
    "Tanga":["Handeni","Kilindi","Korogwe","Lushoto","Mkinga","Muheza","Pangani","Tanga City"]
  },
  "Uganda":{
    "Buganda":["Kampala","Wakiso","Mukono","Buikwe","Kayunga","Luwero","Nakaseke","Nakasongola","Mubende","Mityana","Kiboga","Kyankwanzi"],
    "Busoga":["Jinja","Iganga","Bugiri","Busia","Kamuli","Kaliro","Luuka","Mayuge","Namutumba","Buyende"],
    "Acholi":["Gulu","Amuru","Nwoya","Agago","Kitgum","Pader","Lamwo"],
    "Lango":["Lira","Alebtong","Amolatar","Dokolo","Kole","Otuke","Oyam"],
    "West Nile":["Arua","Adjumani","Koboko","Maracha","Moyo","Nebbi","Pakwach","Yumbe","Zombo"],
    "Western":["Mbarara","Bushenyi","Ibanda","Isingiro","Kiruhura","Ntungamo","Rwampara","Kabale","Kisoro","Rubanda","Rukiga"],
    "Eastern":["Mbale","Bukedea","Butaleja","Butebo","Manafwa","Namisindwa","Pallisa","Sironko","Tororo","Busia"],
    "Northern":["Moroto","Amudat","Napak","Nakapiripirit","Kotido","Kaabong","Abim","Otuke"]
  },
  "Cameroon":{
    "Adamawa":["Djérem","Faro-et-Déo","Mayo-Banyo","Mbéré","Vina"],
    "Centre":["Haute-Sanaga","Lékié","Mbam-et-Inoubou","Mbam-et-Kim","Méfou-et-Afamba","Méfou-et-Akono","Mfoundi","Nyong-et-Kellé","Nyong-et-Mfoumou","Nyong-et-So'o"],
    "East":["Boumba-et-Ngoko","Haut-Nyong","Kadey","Lom-et-Djérem"],
    "Far North":["Diamaré","Logone-et-Chari","Mayo-Danay","Mayo-Kani","Mayo-Sava","Mayo-Tsanaga"],
    "Littoral":["Moungo","Nkam","Sanaga-Maritime","Wouri"],
    "North":["Bénoué","Faro","Mayo-Louti","Mayo-Rey"],
    "North West":["Boyo","Bui","Donga-Mantung","Menchum","Mezam","Momo","Ngokétunjia"],
    "South":["Dja-et-Lobo","Mvila","Océan","Vallée-du-Ntem"],
    "South West":["Fako","Koupé-Manengouba","Lebialem","Manyu","Meme","Ndian"],
    "West":["Bamboutos","Haut-Nkam","Hauts-Plateaux","Koung-Khi","Menoua","Mifi","Nde","Noun"]
  },
  "Senegal":{
    "Dakar":["Dakar","Guédiawaye","Pikine","Rufisque","Keur Massar"],
    "Diourbel":["Bambey","Diourbel","Mbacké"],
    "Fatick":["Fatick","Foundiougne","Gossas"],
    "Kaolack":["Guinguinéo","Kaolack","Nioro du Rip"],
    "Kolda":["Kolda","Médina Yoro Foulah","Vélingara"],
    "Louga":["Kébémer","Linguère","Louga"],
    "Matam":["Kanel","Matam","Ranérou Ferlo"],
    "Saint-Louis":["Dagana","Podor","Saint-Louis"],
    "Sédhiou":["Bounkiling","Goudomp","Sédhiou"],
    "Tambacounda":["Bakel","Goudiry","Koumpentoum","Tambacounda"],
    "Thiès":["Mbour","Thiès","Tivaouane"],
    "Ziguinchor":["Bignona","Oussouye","Ziguinchor"]
  },
  "Ivory Coast":{
    "Abidjan":["Abobo","Adjamé","Attécoubé","Cocody","Koumassi","Marcory","Plateau","Port-Bouët","Treichville","Yopougon"],
    "Bas-Sassandra":["Buyo","Grand-Béréby","Méagui","San-Pédro","Sassandra","Soubré","Tabou"],
    "Comoé":["Aboisso","Adiaké","Ayamé","Grand-Bassam","Mafèrè"],
    "Denguélé":["Kabadougou","Minignan","Odienné","Seguela"],
    "Goh-Djiboua":["Divo","Fresco","Guitry","Lakota"],
    "Lacs":["Bongouanou","Dimbokro","Mbatto","M'Batto"],
    "Lagunes":["Agboville","Adzopé","Alépé","Grand-Lahou","Tiassalé"],
    "Montagnes":["Biankouma","Bangolo","Danané","Guiglo","Man","Sipilou","Touba","Zouan-Hounien"],
    "Sassandra-Marahoué":["Bouaflé","Daloa","Issia","Vavoua","Zuenoula"],
    "Savanes":["Boundiali","Ferkessédougou","Korhogo","Tengrela"],
    "Sud-Bandama":["Divo","Grand-Lahou","Guitry","Lakota"],
    "Sud-Comoé":["Aboisso","Adiaké","Ayamé","Grand-Bassam"],
    "Vallée du Bandama":["Dabakala","Katiola","Niakaramandougou"],
    "Woroba":["Bafing","Béré","Biankouma","Touba"],
    "Yamoussoukro":["Attiégouakro","Djékanou","Tiébissou","Toumodi","Yamoussoukro"]
  },
  "Mali":{
    "Bamako":["Commune I","Commune II","Commune III","Commune IV","Commune V","Commune VI"],
    "Gao":["Ansongo","Bourem","Gao Cercle","Ménaka"],
    "Kayes":["Bafoulabé","Diéma","Kéniéba","Kita","Nioro","Yelimané"],
    "Kidal":["Abeïbara","Kidal Cercle","Tessalit","Tin-Essako"],
    "Koulikoro":["Banamba","Dioïla","Kati","Kolokani","Koulikoro Cercle","Nara"],
    "Mopti":["Bandiagara","Bankass","Djenné","Douentza","Koro","Mopti Cercle","Ténenkou","Timbuktu","Youwarou"],
    "Ségou":["Bla","Macina","Niono","San","Ségou Cercle","Tominian"],
    "Sikasso":["Bougouni","Kadiolo","Kolondiéba","Koutiala","Sikasso Cercle","Yanfolila","Yorosso"],
    "Timbuktu":["Diré","Goundam","Gourma-Rharous","Niafunké","Timbuktu Cercle"]
  },
  "Burkina Faso":{
    "Boucle du Mouhoun":["Barani","Boromo","Dédougou","Di","Nouna","Toma"],
    "Cascades":["Banfora","Diébougou","Gaoua","Léo","Pô","Sindou"],
    "Centre":["Komsilga","Saaba","Signoghin","Tanghin-Dassouri","Ouagadougou"],
    "Centre-Est":["Bittou","Garango","Koupéla","Pouytenga","Tenkodogo"],
    "Centre-Nord":["Boulsa","Kaya","Kongoussi","Titao"],
    "Centre-Ouest":["Koudougou","Léo","Réo","Yako","Ziniaré"],
    "Centre-Sud":["Kombissiri","Manga","Pô"],
    "Est":["Bogandé","Diapaga","Fada N'Gourma","Gayéri","Pama"],
    "Hauts-Bassins":["Bobo-Dioulasso","Dédougou","Houndé","Orodara"],
    "Nord":["Gourcy","Ouahigouya","Séguénéga","Thiou","Titao","Yako"],
    "Plateau-Central":["Ziniare","Boussé","Ziniaré"],
    "Sahel":["Dori","Djibo","Gorom-Gorom","Markoye","Sebba"],
    "Sud-Ouest":["Batié","Diébougou","Gaoua","Kampti","Loropéni"]
  },
  "Rwanda":{
    "Kigali":["Gasabo","Kicukiro","Nyarugenge"],
    "Eastern":["Bugesera","Gatsibo","Kayonza","Kirehe","Ngoma","Nyagatare","Rwamagana"],
    "Northern":["Burera","Gakenke","Gicumbi","Musanze","Rulindo"],
    "Southern":["Gisagara","Huye","Kamonyi","Muhanga","Nyamagabe","Nyanza","Nyaruguru","Ruhango"],
    "Western":["Karongi","Ngororero","Nyabihu","Nyamasheke","Rubavu","Rusizi","Rutsiro"]
  },
  "Zambia":{
    "Central":["Chibombo","Chisamba","Kabwe","Kapiri Mposhi","Mkushi","Mumbwa","Ngabwe","Serenje","Shibuyunji"],
    "Copperbelt":["Chililabombwe","Chingola","Kalulushi","Kitwe","Luanshya","Lufwanyama","Masaiti","Mpongwe","Mufulira","Ndola"],
    "Eastern":["Chadiza","Chama","Chipata","Jumbe","Katete","Lundazi","Mambwe","Nyimba","Petauke","Sinda","Vubwi"],
    "Luapula":["Chembe","Chienge","Kawambwa","Mansa","Milenge","Mwense","Nchelenge","Samfya"],
    "Lusaka":["Chilanga","Chirundu","Chongwe","Kafue","Luangwa","Lusaka","Rufunsa"],
    "Muchinga":["Chinsali","Isoka","Lavushi Manda","Mafinga","Mpika","Mushindamo","Nakonde","Shiwang'andu"],
    "North-Western":["Chavuma","Ikelenge","Kabompo","Kasempa","Mufumbwe","Mwinilunga","Mushindamo","Solwezi","Zambezi"],
    "Northern":["Chilubi","Chimbwe","Kaputa","Kasama","Luwingu","Mbala","Mporokoso","Mpulungu","Mungwi","Nsama"],
    "Southern":["Chikankata","Chirundu","Gwembe","Itezhi-Tezhi","Kalomo","Kazungula","Livingstone","Mazabuka","Monze","Namwala","Pemba","Siavonga","Sinazongwe","Zimba"],
    "Western":["Kalabo","Kaoma","Limulunga","Lukulu","Mongu","Mulobezi","Nalolo","Nkeyema","Senanga","Shangombo","Sikongo"]
  },
  "Zimbabwe":{
    "Harare":["Harare","Chitungwiza","Epworth","Norton","Ruwa"],
    "Bulawayo":["Bulawayo"],
    "Manicaland":["Buhera","Chimanimani","Chipinge","Makoni","Mutare","Mutasa","Nyanga"],
    "Mashonaland Central":["Bindura","Guruve","Mazowe","Mbire","Mount Darwin","Muzarabani","Rushinga","Shamva"],
    "Mashonaland East":["Chikomba","Goromonzi","Hwedza","Marondera","Mudzi","Murehwa","Mutoko","Seke","UMP"],
    "Mashonaland West":["Chegutu","Hurungwe","Kadoma","Kariba","Makonde","Zvimba"],
    "Masvingo":["Bikita","Chiredzi","Chivi","Gutu","Masvingo","Mwenezi","Zaka"],
    "Matabeleland North":["Binga","Bubi","Hwange","Lupane","Nkayi","Tsholotsho","Umguza"],
    "Matabeleland South":["Beitbridge","Bulilima","Gwanda","Insiza","Matobo","Umzingwane"],
    "Midlands":["Chirumanzu","Gokwe North","Gokwe South","Gweru","Kwekwe","Mberengwa","Msungwe","Shurugwi","Zvishavane"]
  },
  "Egypt":{
    "Cairo":["Cairo Governorate"],
    "Alexandria":["Alexandria Governorate"],
    "Giza":["Giza"],
    "Dakahlia":["Mansoura","Mit Ghamr","Shibin El Kawm","Talkha"],
    "Beheira":["Damanhour","Kafr El Dawwar","Rosetta"],
    "Qalyubia":["Banha","Qalyub","Shubra El Kheima"],
    "Sharqia":["Zagazig","10th of Ramadan","Bilbeis"],
    "Menoufia":["Shebin El Kawm","Menouf","Tala"],
    "Gharbia":["Tanta","El Mahalla El Kubra","Kafr El Zayat"],
    "Sohag":["Sohag","Akhmim","Girga"],
    "Assiut":["Assiut","Manfalut","Abnub"],
    "Luxor":["Luxor","Esna","Armant"],
    "Aswan":["Aswan","Edfu","Kom Ombo"],
    "Port Said":["Port Said"],
    "Suez":["Suez"],
    "Ismailia":["Ismailia"],
    "Fayoum":["Fayoum","Tamiya","Sinnuris"],
    "Beni Suef":["Beni Suef","Al Fashn","Biba"],
    "Minya":["Minya","Mallawi","Beni Mazar"],
    "New Valley":["Kharga","Dakhla","Farafra"],
    "Red Sea":["Hurghada","Safaga","Qusayr"],
    "Matrouh":["Marsa Matruh","Siwa","El Alamein"],
    "North Sinai":["Arish","Rafah","Sheikh Zuweid"],
    "South Sinai":["Arish","Dahab","Nuweiba","Sharm El Sheikh","Taba"]
  },
  "Morocco":{
    "Casablanca-Settat":["Casablanca","Mohammedia","El Jadida","Settat","Berrechid","Benslimane","Khouribga","Sidi Bennour"],
    "Rabat-Sale-Kenitra":["Rabat","Sale","Kenitra","Skhirat-Temara","Sidi Kacem","Sidi Slimane","Khemisset"],
    "Marrakech-Safi":["Marrakech","Safi","El Kelaa des Sraghna","Essaouira","Chichaoua","Al Haouz","Youssoufia"],
    "Fes-Meknes":["Fes","Meknes","Ifrane","El Hajeb","Taounate","Taza","Sefrou","Moulay Yacoub","Boulemane"],
    "Souss-Massa":["Agadir","Taroudant","Tiznit","Chtouka-Ait Baha","Inezgane-Ait Melloul","Ait Melloul"],
    "Tanger-Tetouan-Al Hoceima":["Tangier","Tetouan","Al Hoceima","Chefchaouen","Larache","Ouezzane","Fahs-Anjra","M'diq-Fnideq"],
    "Oriental":["Oujda","Nador","Berkane","Taourirt","Driouch","Jerada","Figuig","Guercif"],
    "Draa-Tafilalet":["Errachidia","Ouarzazate","Zagora","Midelt","Tinghir"],
    "Beni Mellal-Khenifra":["Beni Mellal","Khenifra","Azilal","Fquih Ben Salah","Khouribga"],
    "Laayoune-Sakia El Hamra":["Laayoune","Boujdour","Tarfaya","Es Semara"],
    "Dakhla-Oued Ed Dahab":["Dakhla","Aousserd"],
    "Guelmim-Oued Noun":["Guelmim","Assa-Zag","Sidi Ifni","Tan-Tan","Tata"]
  }
};
function getCountries(){return Object.keys(AFRICA_LOCATIONS).sort();}
function getStates(c){return c&&AFRICA_LOCATIONS[c]?Object.keys(AFRICA_LOCATIONS[c]).sort():[];}
function getLGAs(c,s){return c&&s&&AFRICA_LOCATIONS[c]&&AFRICA_LOCATIONS[c][s]?AFRICA_LOCATIONS[c][s]:[];}

// ── Phone/Email validation
const PHONE_PATTERNS={Nigeria:/^(\+?234|0)(7[0-9]|8[0-9]|9[0-9])[0-9]{8}$/,Ghana:/^(\+?233|0)(2[0-9]|5[0-9])[0-9]{7}$/,Kenya:/^(\+?254|0)(7[0-9]|1[0-1])[0-9]{7}$/,"South Africa":/^(\+?27|0)(6[0-9]|7[0-9]|8[0-9])[0-9]{7}$/,_intl:/^\+[1-9][0-9]{6,14}$/};
function validatePhone(phone,country){const p=(phone||'').replace(/[\s\-().]/g,'');if(!p)return{ok:false,msg:'Phone number is required.'};if(country&&PHONE_PATTERNS[country]){if(PHONE_PATTERNS[country].test(p)||PHONE_PATTERNS._intl.test(p))return{ok:true,msg:''};return{ok:false,msg:'Invalid format for '+country+'.'}}if(PHONE_PATTERNS._intl.test(p)||/^\d{7,15}$/.test(p))return{ok:true,msg:''};return{ok:false,msg:'Enter a valid phone number.'};}
function validateEmail(email){const e=(email||'').trim();if(!e)return{ok:false,msg:'Email address is required.'};if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e))return{ok:false,msg:'Enter a valid email address.'};return{ok:true,msg:''};}

// ── License helpers
const PAYSTACK_CONFIG={publicKey:'pk_live_YOUR_PAYSTACK_KEY',plans:{single:'PLN_single',professional:'PLN_professional',enterprise:'PLN_enterprise'}};
async function getDeviceId(){try{const s=await window.storage.get('psa:device_id');if(s)return s.value;}catch(_){}const raw=[navigator.userAgent,navigator.language,screen.width+'x'+screen.height].join('|');let h=5381;for(let i=0;i<raw.length;i++){h=((h<<5)+h)^raw.charCodeAt(i);h>>>=0;}const id='DEV-'+h.toString(16).toUpperCase().padStart(8,'0');try{await window.storage.set('psa:device_id',id);}catch(_){}return id;}
const DEMO_DAYS=7;
async function getDemoRecord(){try{const r=await window.storage.get('psa:demo');return r?JSON.parse(r.value):null;}catch(_){return null;}}
async function startDemo(tier){const rec={tier,startedAt:new Date().toISOString(),demoUsed:true};try{await window.storage.set('psa:demo',JSON.stringify(rec));}catch(_){}return rec;}
function demoDaysLeft(rec){if(!rec)return 0;return Math.max(0,DEMO_DAYS-Math.floor((Date.now()-new Date(rec.startedAt).getTime())/86400000));}
function isDemoActive(rec){return rec&&demoDaysLeft(rec)>0;}
async function getStoredLicense(){try{const r=await window.storage.get('psa:license');return r?JSON.parse(r.value):null;}catch(_){return null;}}
async function storeLicense(lic){try{await window.storage.set('psa:license',JSON.stringify(lic));}catch(_){}}
function isLicenseValid(lic){if(!lic)return false;return new Date(lic.expiry)>new Date();}
function licenseDaysLeft(lic){if(!lic)return 0;return Math.max(0,Math.ceil((new Date(lic.expiry)-new Date())/86400000));}
async function getStoredSetup(){try{const r=await window.storage.get('psa:setup');return r?JSON.parse(r.value):null;}catch(_){return null;}}
async function storeSetup(data){try{await window.storage.set('psa:setup',JSON.stringify(data));}catch(_){}}
async function getDataMode(){try{const r=await window.storage.get('psa:dataMode');return r?r.value:'demo';}catch(_){return'demo';}}
async function setDataMode(mode){try{await window.storage.set('psa:dataMode',mode);}catch(_){}}
async function getTCAccepted(){try{const r=await window.storage.get('psa:tc_accepted');return r?JSON.parse(r.value):null;}catch(_){return null;}}
async function setTCAccepted(data){try{await window.storage.set('psa:tc_accepted',JSON.stringify(data));}catch(_){}}
// ── License key verification (must match PoultrySuite_KeyGenerator.jsx encoding)
const PSA_KEY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 chars, no 0/O/1/I
function _psaHash(str,len){
  let h=2166136261>>>0;const s=String(str);
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
  let out='';
  for(let i=0;i<len;i++){out+=PSA_KEY_CHARS[h%32];h=((h>>>5)^Math.imul(h,2654435761))>>>0;}
  return out;
}
function _psaTierChar(t){return({single:'S',professional:'P',enterprise:'E'})[t]||'S';}
function _psaModsBits(mods){return(mods||[]).reduce((s,m)=>s+({poultry:1,hatchery:2,feedmill:4}[m]||0),0);}
function _psaNormCap(cap){return[(Number(cap&&cap.poultry)||0),(Number(cap&&cap.hatchery)||0),(Number(cap&&cap.feedmill)||0)].join('|');}
function _psaNormClient(name,farm){return((name||'')+'|'+(farm||'')).toUpperCase().replace(/\s+/g,'');}

function parseLicenseKey(key,deviceId,tier,modules,profile,capacity,pin){
  const k=(key||'').trim().toUpperCase();
  // 1. Format check (32-char restricted set, not raw alphanumeric)
  if(!/^PSA-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(k))return null;
  const [, seg1, seg2, seg3, seg4]=k.split('-');
  // 2. Tier + modules check (seg1)
  const allMods=tier==='enterprise'?['poultry','hatchery','feedmill']:(modules||[]);
  const expTier=_psaTierChar(tier);
  const expBits=_psaModsBits(allMods);
  const expBChar=PSA_KEY_CHARS[expBits%32];
  const expTMCk=_psaHash('TM|'+expTier+expBChar,2);
  if(seg1!==expTier+expBChar+expTMCk)return null;
  // 3. Capacity check (seg2)
  const expCap=_psaHash('CAP|'+expTier+'|'+expBits+'|'+_psaNormCap(capacity||{}),4);
  if(seg2!==expCap)return null;
  // 4. Expiry+Client check (seg3) — search for valid YYYY-MM within reasonable window
  //    Window: -2 to +60 months from today (covers up to 5-year license terms + small back-buffer for grace)
  const clientNorm=_psaNormClient(profile&&profile.contactName,profile&&profile.farmName);
  const now=new Date();
  let matchedYM=null;
  for(let monthOffset=-2;monthOffset<=60&&!matchedYM;monthOffset++){
    const d=new Date(now.getFullYear(),now.getMonth()+monthOffset,1);
    const ym=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    if(_psaHash('EXP|'+ym+'|'+clientNorm,4)===seg3){matchedYM=ym;break;}
  }
  if(!matchedYM)return null;
  // 5. Master checksum (seg4)
  const expMaster=_psaHash('MK|'+[seg1,seg2,seg3,expTier,expBits,_psaNormCap(capacity||{}),matchedYM,clientNorm].join('~'),4);
  if(seg4!==expMaster)return null;
  // 6. Build license — expiry is the LAST DAY of the encoded month
  const [yy,mm]=matchedYM.split('-').map(Number);
  const expiryDate=new Date(yy,mm,0); // day 0 of next month = last day of this month
  const expiry=expiryDate.toISOString().split('T')[0];
  return buildLicense(tier,modules,capacity,profile,pin,{id:k,expiry,deviceId,paid:true});
}
function buildLicense(tier,mods,cap,profile,pin,overrides){
  overrides=overrides||{};
  const allMods=tier==='enterprise'?['poultry','hatchery','feedmill']:mods;
  const items=allMods.map(function(m){return{mod:m,base:(MODULE_DEF[m]&&MODULE_DEF[m].base)||0,cap:getCapFee(m,(cap&&cap[m])||0)};});
  var total=items.reduce(function(s,i){return s+i.base+i.cap;},0);
  if(tier==='enterprise'){var rawCap=items.reduce(function(s,i){return s+i.cap;},0);total=600000+Math.round(rawCap*0.85);}
  const licId=overrides.id||('PSA-'+Date.now().toString(36).toUpperCase().slice(-8));
  const ownerUser={
    id:'usr-owner-'+licId.slice(-6),
    name:profile.contactName||'Owner',
    role:'Owner / Director',
    pin:pin,
    active:true,
    ownerLock:true,
    createdAt:new Date().toISOString().split('T')[0]
  };
  return{id:licId,tier:tier,enabledModules:allMods,profile:{farmName:profile.farmName,contactName:profile.contactName,role:profile.role,phone:profile.phone,email:profile.email,city:profile.city||'',location:profile.location,country:profile.country,state:profile.state,lga:profile.lga},capacity:{poultry:Number((cap&&cap.poultry)||0),hatchery:Number((cap&&cap.hatchery)||0),feedmill:Number((cap&&cap.feedmill)||0)},costBreakdown:{total:total,items:items},issued:new Date().toISOString().split('T')[0],expiry:overrides.expiry||new Date(Date.now()+365*86400000).toISOString().split('T')[0],deviceId:overrides.deviceId||null,paid:overrides.paid||false,pin:pin,users:[ownerUser]};
}

// ── Module and Tier definitions
const MODULE_DEF={
  poultry:{id:'poultry',name:'PoultryOS',Icon:IcoPoultry,desc:'Poultry Farm Operating System',capLabel:'Bird Count',capUnit:'birds',base:180000},
  hatchery:{id:'hatchery',name:'HatcheryOS',Icon:IcoHatchery,desc:'Chick Production Operating System',capLabel:'Eggs Per Month',capUnit:'eggs/mo',base:250000},
  feedmill:{id:'feedmill',name:'FeedMillOS',Icon:IcoFeedmill,desc:'Feed Production Operating System',capLabel:'Tons Per Month',capUnit:'tons/mo',base:300000},
};
const TIER_DEF={
  single:{id:'single',label:'Single',n:1,hasCore:false},
  professional:{id:'professional',label:'Professional',n:2,hasCore:true},
  enterprise:{id:'enterprise',label:'Enterprise',n:3,hasCore:true},
};
const ROLES=['Owner / Director','Farm Manager','Operations Supervisor','Production Analyst','Auditor / Compliance','Field Technician'];

// ══════════════════════════════════════════════════════════
//  ROLE-BASED ACCESS CONTROL
// ══════════════════════════════════════════════════════════
// Levels: 'none' | 'read' | 'write'
// Resources:
//   {module}.operations  → data entry (batches, daily log, intake, etc.)
//   {module}.analytics   → command center, audit log, help & docs
//   {module}.finance     → financials
//   {module}.admin       → settings & backup, restore, live mode, identity
//   module.core          → Core Engine (cross-module dashboard)
//   users                → user management (add/edit/delete users)
//   license              → license tab (view license details, renew)
const PERMS={
  'Owner / Director':{_default:'write'},
  'Farm Manager':{_default:'write','license':'read'},
  'Operations Supervisor':{
    _default:'write',
    'poultry.finance':'read','hatchery.finance':'read','feedmill.finance':'read',
    'poultry.admin':'none','hatchery.admin':'none','feedmill.admin':'none',
    'module.core':'read','users':'none','license':'none'
  },
  'Production Analyst':{
    _default:'read',
    'poultry.finance':'write','hatchery.finance':'write','feedmill.finance':'write',
    'poultry.admin':'none','hatchery.admin':'none','feedmill.admin':'none',
    'module.core':'read','users':'none','license':'none'
  },
  'Auditor / Compliance':{
    _default:'read',
    'poultry.admin':'none','hatchery.admin':'none','feedmill.admin':'none',
    'users':'read','license':'read','module.core':'read'
  },
  'Field Technician':{
    _default:'none',
    'poultry.operations':'write','poultry.analytics':'read',
    'hatchery.operations':'write','hatchery.analytics':'read',
    'feedmill.operations':'write','feedmill.analytics':'read'
  }
};
function can(role,resource,action){
  action=action||'view';
  if(!resource)return true; // unmapped resources are open
  const map=PERMS[role]||PERMS['Owner / Director'];
  const level=(map[resource]!==undefined)?map[resource]:map._default;
  if(action==='view')return level==='read'||level==='write';
  if(action==='write')return level==='write';
  if(action==='read')return level==='read'||level==='write';
  return false;
}
function roleLevel(role,resource){
  const map=PERMS[role]||PERMS['Owner / Director'];
  return (map[resource]!==undefined)?map[resource]:map._default;
}

// Engine → resource maps (per module)
const POULTRY_ENGINE_RES={
  cmd:'poultry.analytics',daily:'poultry.operations',house:'poultry.operations',
  vax:'poultry.operations',feed:'poultry.operations',health:'poultry.operations',
  finance:'poultry.finance',audit:'poultry.analytics',settings:'poultry.admin',
  help:'poultry.analytics'
};
const HATCHERY_ENGINE_RES={
  cmd:'hatchery.analytics',intake:'hatchery.operations',incubation:'hatchery.operations',
  candling:'hatchery.operations',hatch:'hatchery.operations',vaccine:'hatchery.operations',
  inventory:'hatchery.operations',finance:'hatchery.finance',audit:'hatchery.analytics',
  settings:'hatchery.admin',help:'hatchery.analytics'
};
const FEEDMILL_ENGINE_RES={
  cmd:'feedmill.analytics',recipe:'feedmill.operations',intake:'feedmill.operations',
  batch:'feedmill.operations',qc:'feedmill.operations',stock:'feedmill.operations',
  distrib:'feedmill.operations',finance:'feedmill.finance',audit:'feedmill.analytics',
  settings:'feedmill.admin',help:'feedmill.analytics'
};
// Whether a role can see a top-level module: any view access to its operations/analytics/finance
function canSeeModule(role,modId){
  return can(role,modId+'.operations','view')||can(role,modId+'.analytics','view')||can(role,modId+'.finance','view');
}

// ── License user model: migrate old licenses + helpers
function migrateLicense(lic){
  if(!lic)return lic;
  if(Array.isArray(lic.users)&&lic.users.length>0)return lic;
  const owner={
    id:'usr-owner-'+(lic.id||'x').slice(-6),
    name:lic.profile?.contactName||'Owner',
    role:'Owner / Director',
    pin:lic.pin||'0000',
    active:true,
    ownerLock:true,
    createdAt:lic.issued||new Date().toISOString().split('T')[0]
  };
  return {...lic,users:[owner]};
}
function findUserByPin(lic,pin){
  if(!lic)return null;
  const ml=migrateLicense(lic);
  return (ml.users||[]).find(u=>u.active!==false&&u.pin===pin)||null;
}
function makeUserId(){return 'usr-'+Date.now().toString(36).slice(-6)+'-'+Math.random().toString(36).slice(2,5);}

// ── CSS injection

// ══════════════════════════════════════════════════════════
//  SHARED UI COMPONENTS
// ══════════════════════════════════════════════════════════
function AppFooter({light=false}){
  const tc=light?'rgba(255,255,255,0.45)':T.ink4;
  const tc2=light?'rgba(255,255,255,0.65)':T.ink3;
  const tc3=light?'rgba(255,255,255,0.50)':T.ink3;
  const bc=light?'rgba(255,255,255,0.10)':T.line;
  return(<div style={{textAlign:'center',padding:'20px 16px 18px',borderTop:`1px solid ${bc}`}}>
    <div style={{fontSize:12,fontWeight:600,color:tc2,letterSpacing:-0.1,marginBottom:4}}>
      <span style={{fontWeight:700,color:light?'rgba(255,255,255,0.85)':T.ink}}>PoultrySuite </span>
      <span style={{fontWeight:700,color:light?'rgba(255,255,255,0.65)':T.ink3}}>Africa</span>
    </div>
    <div style={{fontSize:10,color:tc,lineHeight:1.9}}>Powered by <span style={{fontWeight:600,color:tc2}}>AgoroX Technologies</span>&nbsp;&middot;&nbsp;v1.0.0</div>
    <div style={{fontSize:10,color:tc,marginTop:2,opacity:.65}}>&copy; 2026 All Rights Reserved</div>
  </div>);
}
function FieldError({msg}){if(!msg)return null;return<div style={{fontSize:11,color:T.err,marginTop:3,display:'flex',alignItems:'center',gap:4}}><span style={{fontWeight:700,fontFamily:'monospace'}}>x</span>{msg}</div>;}
function FieldOk({msg}){if(!msg)return null;return<div style={{fontSize:11,color:T.ok,marginTop:3,display:'flex',alignItems:'center',gap:4}}><span style={{fontWeight:700,fontFamily:'monospace'}}>+</span>{msg}</div>;}
function Inp({label,value,onChange,type='text',placeholder='',hint,disabled=false}){
  return(<div style={{display:'flex',flexDirection:'column',gap:0}}>
    {label&&<label style={{display:'block',fontSize:11,fontWeight:600,color:T.ink3,marginBottom:6,letterSpacing:0.3,textTransform:'uppercase'}}>{label}</label>}
    <input disabled={disabled} type={type} value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)}
      style={{width:'100%',background:disabled?T.bg2:T.bg0,border:`1px solid ${T.line}`,padding:'10px 12px',fontSize:14,color:T.ink,outline:'none',opacity:disabled?0.5:1,cursor:disabled?'not-allowed':'text',transition:'border-color .15s',fontFamily:'inherit'}}/>
    {hint&&<span style={{fontSize:11,color:T.ink4,marginTop:4,display:'block'}}>{hint}</span>}
  </div>);
}
function Sel({label,value,onChange,options,hint}){
  return(<div style={{display:'flex',flexDirection:'column',gap:0,position:'relative'}}>
    {label&&<label style={{display:'block',fontSize:11,fontWeight:600,color:T.ink3,marginBottom:6,letterSpacing:0.3,textTransform:'uppercase'}}>{label}</label>}
    <div style={{position:'relative'}}>
      <select value={value} onChange={e=>onChange(e.target.value)}
        style={{width:'100%',background:T.bg0,border:`1px solid ${T.line}`,padding:'10px 36px 10px 12px',fontSize:14,color:T.ink,outline:'none',cursor:'pointer',WebkitAppearance:'none',appearance:'none',fontFamily:'inherit',transition:'border-color .15s'}}>
        {options.map(o=><option key={o.value||o} value={o.value||o}>{o.label||o}</option>)}
      </select>
      <svg style={{position:'absolute',right:11,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}} width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={T.ink4} strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter"><path d="M6 9L12 15L18 9"/></svg>
    </div>
    {hint&&<span style={{fontSize:11,color:T.ink4,marginTop:4,display:'block'}}>{hint}</span>}
  </div>);
}
function Btn({children,onClick,variant='primary',size='md',disabled=false,full=false,sx={}}){
  const sz={sm:{fontSize:12,padding:'7px 14px',minHeight:36,gap:6},md:{fontSize:14,padding:'10px 18px',minHeight:44,gap:8},lg:{fontSize:15,padding:'12px 24px',minHeight:48,gap:8}}[size];
  const vr={primary:{background:T.btnBg,color:T.btnText,border:`1px solid ${T.btnBorder}`},secondary:{background:T.bg3,color:T.ink,border:`1px solid ${T.line}`},ghost:{background:'transparent',color:T.ink3,border:'none'},danger:{background:T.errBg,color:T.err,border:`1px solid ${T.errLine}`}}[variant]||{};
  const [hov,setHov]=useState(false);
  const hvr=hov&&!disabled?{primary:{background:T.accentHov,borderColor:T.accentHov},secondary:{background:T.bg2,borderColor:T.lineMid},ghost:{color:T.ink2},danger:{}}[variant]||{}:{};
  return(<button onClick={disabled?undefined:onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
    style={{...sz,...vr,...hvr,fontWeight:600,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.38:1,display:'inline-flex',alignItems:'center',justifyContent:'center',width:full?'100%':'auto',transition:'background 0.12s',fontFamily:'inherit',touchAction:'manipulation',outline:'none',WebkitTapHighlightColor:'transparent',WebkitAppearance:'none',...sx}}>
    {children}
  </button>);
}
function Tag({label,dark=false}){return(<span style={{fontSize:10,padding:'2px 7px',background:dark?T.accentBg:T.bg2,color:dark?T.accent:T.ink3,fontWeight:600,letterSpacing:0.7,display:'inline-block',textTransform:'uppercase',border:dark?`1px solid ${T.accentLine}`:`1px solid ${T.line}`}}>{label}</span>);}

// ── RBAC UI primitives
function ReadOnlyBanner({role}){
  return(<div style={{background:T.warnBg,border:`1px solid ${T.warnLine}`,padding:'9px 13px',display:'flex',gap:9,alignItems:'center',marginBottom:12}}>
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={T.warn} strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter" style={{flexShrink:0}}><rect x="4" y="10" width="16" height="11"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>
    <div style={{flex:1}}>
      <div style={{fontSize:12,fontWeight:700,color:T.warn,letterSpacing:0.3}}>READ-ONLY</div>
      <div style={{fontSize:11,color:T.ink3,marginTop:1}}>Your role ({role||'User'}) doesn't have write access here. Data entry is disabled.</div>
    </div>
  </div>);
}
function RoleChip({role}){
  const c={'Owner / Director':T.accent,'Farm Manager':T.accent,'Operations Supervisor':T.ink3,'Production Analyst':T.ink3,'Auditor / Compliance':T.warn,'Field Technician':T.ink3}[role]||T.ink3;
  const bg={'Owner / Director':T.accentBg,'Farm Manager':T.accentBg,'Operations Supervisor':T.bg2,'Production Analyst':T.bg2,'Auditor / Compliance':T.warnBg,'Field Technician':T.bg2}[role]||T.bg2;
  const ln={'Owner / Director':T.accentLine,'Farm Manager':T.accentLine,'Operations Supervisor':T.line,'Production Analyst':T.line,'Auditor / Compliance':T.warnLine,'Field Technician':T.line}[role]||T.line;
  return(<span style={{fontSize:10,padding:'2px 7px',background:bg,color:c,fontWeight:600,letterSpacing:0.6,border:`1px solid ${ln}`,whiteSpace:'nowrap'}}>{role||'User'}</span>);
}
function UserManagementPanel({license,activeUser,onUpdateLicense}){
  const ml=migrateLicense(license);
  const users=ml.users||[];
  const canWrite=can(activeUser?.role,'users','write');
  const [editing,setEditing]=useState(null); // null | 'new' | userId
  const [form,setForm]=useState({name:'',role:'Farm Manager',pin:'',active:true});
  const [err,setErr]=useState('');
  const [confirmDel,setConfirmDel]=useState(null);
  const startNew=()=>{setEditing('new');setForm({name:'',role:'Farm Manager',pin:'',active:true});setErr('');};
  const startEdit=(u)=>{setEditing(u.id);setForm({name:u.name,role:u.role,pin:u.pin,active:u.active!==false});setErr('');};
  const cancel=()=>{setEditing(null);setErr('');};
  const save=()=>{
    const name=(form.name||'').trim();
    const pin=(form.pin||'').trim();
    if(!name){setErr('Name is required.');return;}
    if(!/^\d{4}$/.test(pin)){setErr('PIN must be exactly 4 digits.');return;}
    const dup=users.find(u=>u.pin===pin&&u.id!==editing);
    if(dup){setErr('That PIN is already in use by '+dup.name+'.');return;}
    if(form.role==='Owner / Director'){setErr('Only one Owner is allowed. Choose a different role.');return;}
    let newUsers;
    if(editing==='new'){
      const u={id:makeUserId(),name,role:form.role,pin,active:form.active,ownerLock:false,createdAt:new Date().toISOString().split('T')[0]};
      newUsers=[...users,u];
    }else{
      newUsers=users.map(u=>u.id===editing?{...u,name,role:u.ownerLock?u.role:form.role,pin,active:form.active}:u);
    }
    onUpdateLicense({...ml,users:newUsers});
    setEditing(null);
    setErr('');
  };
  const remove=(id)=>{
    const newUsers=users.filter(u=>u.id!==id);
    onUpdateLicense({...ml,users:newUsers});
    setConfirmDel(null);
  };
  const roleOpts=ROLES.filter(r=>r!=='Owner / Director').map(r=>({value:r,label:r}));
  return(<div style={{display:'flex',flexDirection:'column',gap:14}}>
    <div style={{background:T.accentBg,border:`1px solid ${T.accentLine}`,padding:'12px 14px',fontSize:12,color:T.accentDark,lineHeight:1.5}}>
      Each user signs in with their own 4-digit PIN. Their role determines what they can see and edit across all modules. The Owner cannot be removed.
    </div>
    {canWrite&&editing===null&&<Btn onClick={startNew} full>+ Add User</Btn>}
    {editing!==null&&canWrite&&(<div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'14px 16px'}}>
      <div style={{fontSize:13,fontWeight:700,color:T.ink,marginBottom:12}}>{editing==='new'?'Add User':'Edit User'}</div>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        <Inp label="Full Name" value={form.name} onChange={v=>setForm(f=>({...f,name:v}))} placeholder="e.g. Ada Eze"/>
        {(editing==='new'||!users.find(u=>u.id===editing)?.ownerLock)&&<Sel label="Role" value={form.role} onChange={v=>setForm(f=>({...f,role:v}))} options={roleOpts}/>}
        {users.find(u=>u.id===editing)?.ownerLock&&<div style={{fontSize:11,color:T.ink4}}>The Owner role cannot be changed.</div>}
        <Inp label="4-Digit PIN" value={form.pin} onChange={v=>setForm(f=>({...f,pin:v.replace(/\D/g,'').slice(0,4)}))} placeholder="0000" hint="Used to sign in to this device"/>
        <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:T.ink,cursor:'pointer'}}>
          <input type="checkbox" checked={form.active} onChange={e=>setForm(f=>({...f,active:e.target.checked}))} style={{width:15,height:15,cursor:'pointer'}}/>
          Active (user can sign in)
        </label>
        {err&&<Notice type="error" message={err}/>}
        <div style={{display:'flex',gap:8}}>
          <Btn onClick={save}>{editing==='new'?'Add User':'Save Changes'}</Btn>
          <Btn variant="secondary" onClick={cancel}>Cancel</Btn>
        </div>
      </div>
    </div>)}
    <div style={{background:T.bg0,border:`1px solid ${T.line}`}}>
      <div style={{padding:'11px 14px',borderBottom:`1px solid ${T.line}`,background:T.bg1,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span style={{fontSize:11,fontWeight:700,color:T.ink,textTransform:'uppercase',letterSpacing:0.7}}>Users ({users.length})</span>
        {!canWrite&&<Tag label="Read-Only" dark={false}/>}
      </div>
      {users.length===0&&<div style={{padding:20,textAlign:'center',color:T.ink4,fontSize:13}}>No users yet.</div>}
      {users.map((u,i)=>{const isMe=u.id===activeUser?.id;return(
        <div key={u.id} style={{padding:'12px 14px',borderTop:i>0?`1px solid ${T.line}`:'none',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <div style={{flex:'1 1 200px',minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              <span style={{fontSize:13,fontWeight:600,color:T.ink}}>{u.name}</span>
              {isMe&&<span style={{fontSize:10,color:T.accent,fontWeight:600}}>(you)</span>}
              {u.ownerLock&&<svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={T.ink3} strokeWidth="2"><rect x="4" y="10" width="16" height="11"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>}
              {u.active===false&&<Tag label="Inactive"/>}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginTop:4}}>
              <RoleChip role={u.role}/>
              <span className="mono" style={{fontSize:11,color:T.ink4}}>PIN ••••</span>
            </div>
          </div>
          {canWrite&&!u.ownerLock&&(<div style={{display:'flex',gap:6}}>
            <Btn size="sm" variant="secondary" onClick={()=>startEdit(u)}>Edit</Btn>
            {confirmDel===u.id?<Btn size="sm" variant="danger" onClick={()=>remove(u.id)}>Confirm Delete</Btn>:<Btn size="sm" variant="ghost" onClick={()=>setConfirmDel(u.id)}>Delete</Btn>}
          </div>)}
          {canWrite&&u.ownerLock&&<Btn size="sm" variant="secondary" onClick={()=>startEdit(u)}>Edit</Btn>}
        </div>
      );})}
    </div>
    <div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'12px 14px'}}>
      <div style={{fontSize:11,fontWeight:700,color:T.ink,textTransform:'uppercase',letterSpacing:0.7,marginBottom:8}}>Role Reference</div>
      <div style={{display:'flex',flexDirection:'column',gap:8,fontSize:12,color:T.ink3,lineHeight:1.55}}>
        <div><strong style={{color:T.ink}}>Owner / Director</strong> — full access. Cannot be removed.</div>
        <div><strong style={{color:T.ink}}>Farm Manager</strong> — full operations, finance, settings, user management. Cannot edit license.</div>
        <div><strong style={{color:T.ink}}>Operations Supervisor</strong> — write to operations. Read-only on financials. No settings or user access.</div>
        <div><strong style={{color:T.ink}}>Production Analyst</strong> — read operations. Write financials and analytics.</div>
        <div><strong style={{color:T.ink}}>Auditor / Compliance</strong> — read-only across all modules including financials and audit log.</div>
        <div><strong style={{color:T.ink}}>Field Technician</strong> — write to operations (daily log, vaccinations, health, etc.) only. No financials or settings.</div>
      </div>
    </div>
  </div>);
}
function Notice({type='info',message}){
  const mp={
    info:{bg:T.accentBg,b:T.accentLine,tc:T.accentDark,d:'M12 8V12M12 16H12.01M21 12A9 9 0 113 12a9 9 0 0118 0z'},
    warn:{bg:T.warnBg,b:T.warnLine,tc:T.warn,d:'M12 9V13M12 17H12.01M10.3 4L2 20H22L13.7 4a2 2 0 00-3.4 0z'},
    error:{bg:T.errBg,b:T.errLine,tc:T.err,d:'M18 6L6 18M6 6L18 18'},
    success:{bg:T.okBg,b:T.okLine,tc:T.ok,d:'M4 12L10 18L20 6'},
  };
  const t=mp[type]||mp.info;
  return(<div style={{background:t.bg,border:`1px solid ${t.b}`,padding:'10px 14px',display:'flex',gap:10,alignItems:'flex-start',fontSize:13,color:t.tc,lineHeight:1.5}}>
    <svg width={15} height={15} viewBox='0 0 24 24' fill='none' stroke={t.tc} strokeWidth='1.75' strokeLinecap='square' strokeLinejoin='miter' style={{flexShrink:0,marginTop:1}}><path d={t.d}/></svg>
    <span>{message}</span>
  </div>);
}
function HR({label}){return(<div style={{display:'flex',alignItems:'center',gap:10}}><div style={{flex:1,height:1,background:T.line}}/>{label&&<span style={{fontSize:10,color:T.ink4,textTransform:'uppercase',letterSpacing:1.5,whiteSpace:'nowrap'}}>{label}</span>}{label&&<div style={{flex:1,height:1,background:T.line}}/>}</div>);}
function TabBar({tabs,active,onChange}){
  return(<div style={{display:'flex',gap:0,marginBottom:20,overflowX:'auto',borderBottom:`2px solid ${T.line}`,WebkitOverflowScrolling:'touch',flexShrink:0}}>
    {tabs.map(t=>{const a=active===t.id;return(<button key={t.id} onClick={()=>onChange(t.id)}
      style={{padding:'10px 14px',border:'none',borderBottom:`2px solid ${a?T.accent:'transparent'}`,background:'transparent',cursor:'pointer',
        fontSize:12,fontWeight:a?700:500,color:a?T.accent:T.ink3,marginBottom:-2,display:'flex',alignItems:'center',gap:5,
        fontFamily:'inherit',whiteSpace:'nowrap',minHeight:44,flexShrink:0,transition:'color .12s,border-color .12s',letterSpacing:a?0:-0.1}}>
      {t.Icon&&<t.Icon size={13} color={a?T.accent:T.ink4}/>}{t.label}
    </button>);})}
  </div>);
}
function Modal({title,onClose,children,width=520}){
  React.useEffect(()=>{
    const handleEsc=(e)=>{if(e.key==='Escape')onClose();};
    document.addEventListener('keydown',handleEsc);
    return()=>document.removeEventListener('keydown',handleEsc);
  },[onClose]);
  return(<div style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:9000,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px 16px'}} onClick={onClose}>
    <div style={{background:T.bg0,width:'100%',maxWidth:width,maxHeight:'85vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.35)',position:'relative',borderRadius:4,marginTop:'auto',marginBottom:'auto'}} onClick={e=>e.stopPropagation()}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 18px 18px 24px',borderBottom:`1px solid ${T.line}`,background:T.bg0,flexShrink:0,gap:12,minHeight:60}}>
        <span style={{fontSize:16,fontWeight:700,color:T.ink,flex:1,minWidth:0,lineHeight:1.3}}>{title}</span>
        <button onClick={onClose} type="button" aria-label="Close" style={{background:'#DC2626',border:'none',cursor:'pointer',color:'#fff',width:36,height:36,minHeight:36,minWidth:36,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,lineHeight:1,fontWeight:700,padding:0,borderRadius:4,flexShrink:0}}>×</button>
      </div>
      <div style={{padding:'24px',overflowY:'auto',flex:1}}>{children}</div>
    </div>
  </div>);
}
function SectionHeader({title,action}){return(<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,paddingBottom:12,borderBottom:`1px solid ${T.line}`}}><div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:3,height:18,background:T.accent,flexShrink:0}}/><span style={{fontSize:15,fontWeight:700,color:T.ink,letterSpacing:-0.2}}>{title}</span></div>{action}</div>);}
function EmptyState({icon,title,sub}){
  return(<div style={{textAlign:'center',padding:'44px 24px',color:T.ink4}}>
    <div style={{width:44,height:44,border:`1px solid ${T.lineMid}`,display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:14,background:T.bg1}}>
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={T.ink4} strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter"><rect x="3" y="3" width="18" height="18"/><path d="M12 8V16M8 12H16"/></svg>
    </div>
    <div style={{fontSize:13,fontWeight:600,color:T.ink2,marginBottom:5,letterSpacing:-0.1}}>{title}</div>
    <div style={{fontSize:12,color:T.ink4,lineHeight:1.6,maxWidth:220,margin:'0 auto'}}>{sub}</div>
  </div>);
}
function BatchPill({batch}){const sc={Active:T.ok,Quarantined:T.warn,Closed:T.ink4,Sold:T.accent}[batch.status]||T.ink3;return(<span style={{fontSize:11,padding:'2px 8px',background:`${sc}18`,color:sc,fontWeight:600,letterSpacing:.5,border:`1px solid ${sc}40`}}>{batch.status}</span>);}
function Sparkline({data,color,height=40,width=160}){
  if(!data||data.length<2)return<div style={{height,width,background:T.bg2}}/>;
  const max=Math.max(...data,1);
  const pts=data.map((v,i)=>`${(i/(data.length-1))*width},${height-((v/max)*height*.85)-2}`).join(' ');
  return(<svg width={width} height={height} style={{display:'block'}}><polygon points={`${pts} ${width},${height} 0,${height}`} fill={`${color}22`}/><polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="miter" strokeLinecap="square"/></svg>);
}
function PinPad({length=4,onComplete,label,hint}){
  const [digits,setDigits]=useState([]);
  const doAdd=(d)=>{setDigits(prev=>{if(prev.length>=length)return prev;const next=[...prev,d];if(next.length===length)setTimeout(()=>{onComplete(next.join(''));setDigits([]);},100);return next;});};
  const doDel=()=>setDigits(p=>p.slice(0,-1));
  const keys=['1','2','3','4','5','6','7','8','9','','0','del'];
  return(<div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:20}}>
    <div style={{textAlign:'center'}}>
      {label&&<div style={{fontSize:11,fontWeight:600,color:T.ink4,textTransform:'uppercase',letterSpacing:1,marginBottom:16}}>{label}</div>}
      <div style={{display:'flex',gap:12,justifyContent:'center'}}>
        {Array.from({length}).map((_,i)=>(<div key={i} style={{width:12,height:12,background:i<digits.length?T.accent:T.bg2,border:`1.5px solid ${i<digits.length?T.accentLine:T.lineMid}`,transition:'all 0.12s'}}/>))}
      </div>
      {hint&&<div style={{fontSize:12,color:T.ink4,marginTop:10}}>{hint}</div>}
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,64px)',gap:8}}>
      {keys.map((k,i)=>{if(!k)return<div key={i}/>;return(
        <button key={i} onClick={()=>k==='del'?doDel():doAdd(k)}
          style={{height:60,background:k==='del'?T.bg2:T.bg0,border:`1px solid ${T.line}`,color:T.ink,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'background 0.08s',touchAction:'manipulation',fontFamily:'inherit'}}>
          {k==='del'?<IcoDelete size={18} color={T.ink3}/>:<span className="mono" style={{fontSize:19,fontWeight:500}}>{k}</span>}
        </button>);})}
    </div>
  </div>);
}
function PageShell({children,maxWidth=580,withFooter=true}){
  return(<div style={{minHeight:'100vh',background:T.bg1,display:'flex',flexDirection:'column'}}>
    <div style={{flex:1,padding:'0 16px'}}><div style={{maxWidth,margin:'0 auto',paddingTop:28,paddingBottom:20}}>{children}</div></div>
    {withFooter&&<AppFooter/>}
  </div>);
}
function NavHeader({title}){
  return(<div style={{marginBottom:32}}>
    <div style={{fontSize:18,fontWeight:700,color:T.ink,letterSpacing:-0.3,lineHeight:1.2}}>PoultrySuite<span style={{color:T.ink3}}> Africa</span></div>
    {title&&<div style={{fontSize:11,fontWeight:600,color:T.ink4,marginTop:6,letterSpacing:1.4,textTransform:'uppercase',lineHeight:1}}>{title}</div>}
  </div>);
}

// ── Vaccination templates
const VAX_TEMPLATES={
  Broiler:[
    {vaccine:"Marek's Disease",day:0,method:'SQ Injection',note:'At hatchery — auto-marked Done'},
    {vaccine:'Newcastle (HB1)',day:7,method:'Intra-Ocular',note:''},
    {vaccine:'Gumboro (IBD)',day:10,method:'Drinking Water',note:''},
    {vaccine:'Newcastle (Lasota)',day:21,method:'Drinking Water',note:''},
    {vaccine:'Gumboro Booster',day:24,method:'Drinking Water',note:''},
    {vaccine:'Newcastle Booster',day:35,method:'Drinking Water',note:''},
  ],
  Layer:[
    {vaccine:"Marek's Disease",day:0,method:'SQ Injection',note:'At hatchery — auto-marked Done'},
    {vaccine:'Newcastle (HB1)',day:7,method:'Intra-Ocular',note:''},
    {vaccine:'Gumboro (IBD)',day:14,method:'Drinking Water',note:''},
    {vaccine:'Newcastle (Lasota)',day:28,method:'Drinking Water',note:''},
    {vaccine:'Fowl Pox',day:42,method:'Wing Web Stab',note:''},
    {vaccine:'Newcastle Booster',day:56,method:'Drinking Water',note:''},
    {vaccine:'Infectious Bronchitis',day:70,method:'Drinking Water',note:''},
    {vaccine:'Fowl Typhoid',day:84,method:'IM Injection',note:''},
  ],
};
function isLayingBatch(b){return b&&b.type==='Layer'&&b.status==='Active'&&b.startDate?daysDiff(b.startDate)>=140:false;}

function KPICard({label,value,unit,sub,alert}){
  return(<div style={{background:T.bg0,border:`1px solid ${alert?T.errLine:T.line}`,padding:"13px 15px",borderLeft:`3px solid ${alert?T.err:T.accentLine}`}}>
    <div style={{fontSize:11,fontWeight:500,color:T.ink4,marginBottom:5,letterSpacing:0.2}}>{label}</div>
    <div className="mono" style={{fontSize:24,fontWeight:700,color:alert?T.err:T.ink,lineHeight:1}}>{value}{unit&&<span style={{fontSize:12,color:T.ink4,marginLeft:3,fontWeight:400}}>{unit}</span>}</div>
    {sub&&<div style={{fontSize:11,color:T.ink4,marginTop:4}}>{sub}</div>}
  </div>);
}

function SplashScreen(){
  const [prog,setProg]=useState(0);
  const [ready,setReady]=useState(false);
  useEffect(()=>{const t=setInterval(()=>setProg(p=>{if(p>=100){clearInterval(t);setReady(true);return 100;}return p+2;}),40);return()=>clearInterval(t);},[]);
  return(
    <div style={{height:'100vh',background:T.bg0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:T.accentLine}}/>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:24}} className="au">
        <div style={{width:64,height:64,display:'flex',alignItems:'center',justifyContent:'center',background:'transparent'}}><PSLogo size={44}/></div>
        <div style={{textAlign:'center',maxWidth:360}}>
          <div style={{fontSize:24,letterSpacing:-0.7,lineHeight:1.1}}>
            <span style={{color:T.ink,fontWeight:800,letterSpacing:-1}}>PoultrySuite</span><span style={{color:T.ink3,fontWeight:300,letterSpacing:-0.5}}> Africa</span>
          </div>
          <div style={{fontSize:13,fontWeight:400,color:T.ink3,marginTop:10,letterSpacing:0.6,lineHeight:1.45,textTransform:'uppercase'}}>A Fully Integrated Poultry Production Intelligence Infrastructure</div>
        </div>
        <div style={{width:200,display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
          <div style={{width:'100%',height:2,background:T.line,overflow:'hidden'}}><div style={{height:'100%',background:T.accent,width:`${prog}%`,transition:'width 0.04s linear'}}/></div>
          <div className="mono" style={{fontSize:10,color:T.ink4,letterSpacing:1.5,textTransform:'uppercase'}}>{ready?'Ready':'Initializing'}</div>
        </div>
      </div>
      <div style={{position:'absolute',bottom:0,left:0,right:0,borderTop:`1px solid ${T.line}`}}><AppFooter/></div>
    </div>
  );
}

function TierSelectScreen({onSelect}){
  const [hov,setHov]=useState(null);
  const tiers=[
    {id:'single',label:'Single',tagline:'One module. Full depth.',modules:'1 module',details:['One module of your choice','Full operational dashboard','Offline — no internet required','Local encrypted storage']},
    {id:'professional',label:'Professional',tagline:'Two modules. Cross-module visibility.',modules:'2 modules',recommended:true,details:['Any two modules','Core Engine + Reports','Full audit logging','Backup & restore']},
    {id:'enterprise',label:'Enterprise',tagline:'Everything. Nothing held back.',modules:'All 3 modules',details:['PoultryOS + HatcheryOS + FeedMillOS','Core Engine included','15% capacity fee discount','Priority documentation']},
  ];
  return(
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',background:T.bg1}}>
      <div style={{background:T.bg0,borderBottom:`1px solid ${T.line}`,padding:'28px 24px 22px'}}>
        <div style={{marginBottom:20}}>


            <div style={{fontSize:18,fontWeight:900,color:T.ink,letterSpacing:-0.3,lineHeight:1.2}}>PoultrySuite<span style={{color:T.ink3}}> Africa</span></div>
            <div style={{fontSize:11,fontWeight:500,color:T.ink4,marginTop:4,letterSpacing:1.2,textTransform:'uppercase'}}>License Setup</div>
        </div>

        <div style={{borderTop:`1px solid ${T.line}`,paddingTop:18}}>
          <div style={{fontSize:19,fontWeight:700,color:T.ink,letterSpacing:-0.3}}>Choose your plan</div>
          <div style={{fontSize:13,color:T.ink3,marginTop:5}}>All plans include a 7-day free trial. No credit card required.</div>
        </div>
      </div>
      <div style={{flex:1,padding:'16px 16px 24px',display:'flex',flexDirection:'column',gap:10}}>
        {tiers.map(t=>{const isRec=!!t.recommended,isHov=hov===t.id;return(
          <div key={t.id} onMouseEnter={()=>setHov(t.id)} onMouseLeave={()=>setHov(null)}
            style={{position:'relative',background:T.bg0,border:`1.5px solid ${isRec?T.accentLine:(isHov?T.lineMid:T.line)}`,boxShadow:isRec?'0 4px 24px rgba(0,0,0,0.10)':'0 1px 4px rgba(0,0,0,0.04)',overflow:'hidden',transition:'box-shadow 0.15s,border-color 0.15s'}}>
            {isRec&&<div style={{background:T.accentBg,color:T.accent,fontSize:9,fontWeight:700,padding:'4px 12px',letterSpacing:1.2,textTransform:'uppercase',textAlign:'center',borderBottom:`1px solid ${T.accentLine}`}}>Most Popular</div>}
            <div style={{padding:'14px 16px 10px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                <div><div style={{fontSize:18,fontWeight:700,color:T.ink,letterSpacing:-0.3}}>{t.label}</div><div style={{fontSize:12,color:T.ink3,marginTop:3}}>{t.tagline}</div></div>
                <span style={{fontSize:10,padding:'2px 8px',background:isRec?T.accentBg:T.bg1,color:isRec?T.accent:T.ink3,fontWeight:700,border:isRec?`1px solid ${T.accentLine}`:`1px solid ${T.line}`}}>{t.modules}</span>
              </div>
            </div>
            <div style={{borderTop:`1px solid ${T.line}`,padding:'10px 16px',background:isRec?T.accentBg:T.bg1}}>
              {t.details.map(d=>(<div key={d} style={{display:'flex',gap:8,alignItems:'flex-start',marginBottom:5}}>
                <svg style={{marginTop:2,flexShrink:0}} width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={isRec?T.accent:T.ok} strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><path d="M4 12L10 18L20 6"/></svg>
                <span style={{fontSize:12,lineHeight:1.4,color:T.ink3}}>{d}</span>
              </div>))}
            </div>
            <div style={{padding:'10px 16px 14px'}}>
              <button onClick={()=>onSelect(t.id)}
                style={{display:'block',width:'100%',padding:'12px 0',background:isRec?T.btnBg:T.bg0,color:isRec?'#fff':T.ink,border:`1.5px solid ${isRec?T.btnBorder:T.line}`,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit',transition:'background 0.12s'}}>
                Select {t.label}
              </button>
            </div>
          </div>
        );})}
      </div>
      <AppFooter/>
    </div>
  );
}

function ModuleSelectScreen({tier,onSelect}){
  const limit=TIER_DEF[tier].n;
  const [chosen,setChosen]=useState([]);
  const toggle=(id)=>{if(chosen.includes(id)){setChosen(c=>c.filter(x=>x!==id));return;}if(chosen.length<limit)setChosen(c=>[...c,id]);};
  const td=TIER_DEF[tier];
  return(
    <PageShell maxWidth={520}><NavHeader title="Module Selection"/>
      <div style={{marginBottom:24}}>
        <div style={{fontSize:22,fontWeight:700,color:T.ink,marginBottom:5,letterSpacing:-0.3}}>{td.label} Plan</div>
        <div style={{fontSize:14,color:T.ink3}}>Select {limit} module{limit>1?'s':''} to include in your license.</div>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:24}}>
        {Object.values(MODULE_DEF).map(m=>{const sel=chosen.includes(m.id),dis=!sel&&chosen.length>=limit,MI=m.Icon;return(
          <div key={m.id} onClick={()=>!dis&&toggle(m.id)}
            style={{border:`1.5px solid ${sel?T.accentLine:T.line}`,padding:'14px 16px',cursor:dis?'not-allowed':'pointer',background:sel?T.accentBg:T.bg0,opacity:dis?0.35:1,display:'flex',gap:14,alignItems:'center',transition:'all 0.15s',borderLeft:`3px solid ${sel?T.accent:T.line}`}}>
            <div style={{width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><MI size={22} color={sel?T.accent:T.ink3}/></div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:600,color:T.ink,marginBottom:2}}>{m.name}</div>
              <div style={{fontSize:12,color:T.ink3}}>{m.desc}</div>
            </div>
            <div style={{width:18,height:18,border:`2px solid ${sel?T.accent:T.lineMid}`,background:sel?T.accent:T.bg0,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.13s'}}>{sel&&<IcoCheck size={10} color="#fff"/>}</div>
          </div>);})}
      </div>
      <Btn onClick={()=>chosen.length===limit&&onSelect(chosen)} disabled={chosen.length!==limit} full size="lg">
        {chosen.length>0?`Continue with ${chosen.map(c=>MODULE_DEF[c].name).join(' + ')}`:`Select ${limit} module${limit>1?'s':''}`}
      </Btn>
    </PageShell>
  );
}

function ProfileRegScreen({tier,modules,onComplete}){
  const {setCountry: setCurrencyCountry, currency, currencyCode}=useCurrency();
  const allMods=tier==='enterprise'?['poultry','hatchery','feedmill']:modules;
  const [step,setStep]=useState(0);
  const [form,setForm]=useState({farmName:'',contactName:'',phone:'',email:'',emailConfirm:'',city:'',location:'',country:'',state:'',lga:'',regNo:'',capacity:{poultry:'',hatchery:'',feedmill:''},role:ROLES[0]});
  const [pinPhase,setPinPhase]=useState('set');
  const [pinFirst,setPinFirst]=useState('');
  const [pinErr,setPinErr]=useState('');
  const [touched,setTouched]=useState({});
  const setF=(k,v)=>{setForm(f=>({...f,[k]:v}));setTouched(t=>({...t,[k]:true}));};
  const setCap=(m,v)=>setForm(f=>({...f,capacity:{...f.capacity,[m]:v}}));
  const phoneV=validatePhone(form.phone,form.country);
  const emailV=validateEmail(form.email);
  const emailMatchOk=form.email===form.emailConfirm;
  const emailConfirmFilled=form.emailConfirm.length>0;
  const step0ok=form.farmName.trim().length>=2&&form.contactName.trim().length>=2&&phoneV.ok&&emailV.ok&&form.city.trim().length>=2&&form.location.trim()&&form.country&&form.state&&form.lga;
  const step1ok=allMods.every(m=>Number(form.capacity[m])>0);
  const handlePin=(pin)=>{if(pinPhase==='set'){setPinFirst(pin);setPinPhase('confirm');setPinErr('');}else{if(pin===pinFirst){onComplete({...form,pin});}else{setPinErr('PINs do not match. Please try again.');setPinPhase('set');setPinFirst('');}}};
  const touchAll=()=>setTouched({farmName:true,contactName:true,phone:true,email:true,emailConfirm:true,city:true,location:true,country:true,state:true,lga:true});
  const stepLabels=['Organisation','Capacity','Role & PIN'];
  return(
    <PageShell maxWidth={520}><div style={{marginBottom:32}}><div style={{fontSize:18,fontWeight:700,color:T.ink,letterSpacing:-0.3,lineHeight:1.2}}>PoultrySuite<span style={{color:T.ink3}}> Africa</span></div><div style={{fontSize:11,fontWeight:600,color:T.ink4,marginTop:6,letterSpacing:1.4,textTransform:'uppercase',lineHeight:1}}>Registration</div></div>
      <div style={{display:'flex',alignItems:'flex-start',marginBottom:28}}>
        {stepLabels.map((sl,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',flex:i<stepLabels.length-1?1:'none'}}>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
              <div style={{width:26,height:26,background:i<=step?T.accentBg:T.bg2,border:`1.5px solid ${i<=step?T.accentLine:T.line}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                {i<step?<IcoCheck size={12} color={T.accent}/>:<span style={{fontSize:12,fontWeight:600,color:i===step?T.accent:T.ink4}}>{i+1}</span>}
              </div>
              <span style={{fontSize:11,color:i===step?T.accent:T.ink4,fontWeight:i===step?600:400,whiteSpace:'nowrap'}}>{sl}</span>
            </div>
            {i<stepLabels.length-1&&<div style={{flex:1,height:1,background:i<step?T.accentLine:T.line,margin:'0 8px',marginBottom:18}}/>}
          </div>
        ))}
      </div>
      <div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'22px 22px'}} className="au">
        {step===0&&(<>
          <div style={{fontSize:18,fontWeight:700,color:T.ink,marginBottom:18}}>Organisation Details</div>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <Inp label="Farm / Organisation Name *" value={form.farmName} onChange={v=>setF('farmName',v)} placeholder="e.g. Sunrise Farms Nigeria Ltd."/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <Inp label="Contact Name *" value={form.contactName} onChange={v=>setF('contactName',v)} placeholder="Full name"/>
              <div>
                <Inp label="Phone Number *" value={form.phone} onChange={v=>setF('phone',v)} placeholder="08012345678"/>
                {touched.phone&&form.phone&&!phoneV.ok&&<FieldError msg={phoneV.msg}/>}
                {touched.phone&&form.phone&&phoneV.ok&&<FieldOk msg="Valid"/>}
              </div>
            </div>
            <div>
              <Inp label="Email Address *" value={form.email} onChange={v=>setF('email',v)} placeholder="contact@yourfarm.com" type="email"/>
              {touched.email&&!emailV.ok&&<FieldError msg={emailV.msg}/>}
            </div>
            {form.email.length>0&&(
              <div>
                <Inp label="Confirm Email *" value={form.emailConfirm} onChange={v=>setF('emailConfirm',v)} placeholder="Re-enter email" type="email"/>
                {touched.emailConfirm&&form.emailConfirm&&!emailMatchOk&&<FieldError msg="Email addresses do not match."/>}
              </div>
            )}
            <Sel label="Country *" value={form.country} onChange={v=>{
              setF('country',v);setF('state','');setF('lga','');
              // Auto-switch the active currency to match the selected country
              const iso=getCountryByName(v);
              if(iso)setCurrencyCountry(iso.code);
            }} options={[{value:'',label:'Select Country'},...getCountries().map(c=>({value:c,label:c}))]}/>
            <Sel label="State / Province *" value={form.state} onChange={v=>{setF('state',v);setF('lga','');}} options={form.country?[{value:'',label:'Select State'},...getStates(form.country).map(s=>({value:s,label:s}))]:[{value:'',label:'Select a country first'}]}/>
            <Sel label="Local Government *" value={form.lga} onChange={v=>setF('lga',v)} options={form.state?[{value:'',label:'Select LGA'},...getLGAs(form.country,form.state).map(l=>({value:l,label:l}))]:[{value:'',label:'Select a state first'}]}/>
            <Inp label="Farm Street Address *" value={form.location} onChange={v=>setF('location',v)} placeholder="Street address"/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div>
                <Inp label="City *" value={form.city} onChange={v=>setF('city',v)} placeholder="e.g. Lagos"/>
                {touched.city&&form.city.trim().length<2&&<FieldError msg="City is required."/>}
              </div>
              <Inp label="CAC / Reg No." value={form.regNo} onChange={v=>setF('regNo',v)} placeholder="RC000000"/>
            </div>
          </div>
          <div style={{marginTop:20}}><Btn onClick={()=>{touchAll();if(step0ok)setStep(1);}} disabled={!step0ok} full>Continue to Capacity <IcoArrow size={16} color={"currentColor"}/></Btn></div>
        </>)}
        {step===1&&(<>
          <div style={{fontSize:18,fontWeight:700,color:T.ink,marginBottom:18}}>Operational Capacity</div>
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {allMods.map(m=>{const md=MODULE_DEF[m],MI=md.Icon;const fee=getCapFee(m,form.capacity[m]);const tl=Number(form.capacity[m])>0?getCapTier(m,form.capacity[m]):null;return(
              <div key={m} style={{border:`1px solid ${T.line}`,padding:15,background:T.bg1}}>
                <div style={{display:'flex',gap:7,alignItems:'center',marginBottom:11}}><MI size={18} color={T.ink3}/><span style={{fontSize:13,fontWeight:600,color:T.ink}}>{md.name}</span></div>
                <Inp label={`${md.capLabel} (${md.capUnit})`} type="number" value={form.capacity[m]} onChange={v=>setCap(m,v)} placeholder={`Enter ${md.capLabel.toLowerCase()}`} hint={tl?`Tier: ${tl} · Fee: ${ngn(fee)}/yr`:'Enter your operational capacity'}/>
              </div>
            );})}
          </div>
          <div style={{marginTop:20,display:'flex',gap:10}}>
            <Btn variant="secondary" onClick={()=>setStep(0)} sx={{flexShrink:0}}>Back</Btn>
            <Btn onClick={()=>setStep(2)} disabled={!step1ok} full>Continue to Role & PIN</Btn>
          </div>
        </>)}
        {step===2&&(<>
          <div style={{fontSize:18,fontWeight:700,color:T.ink,marginBottom:18}}>Role & Access PIN</div>
          <div style={{marginBottom:20}}><Sel label="Your Role *" value={form.role} onChange={v=>setF('role',v)} options={ROLES} hint="Your PIN will be linked to this role"/></div>
          <HR label={pinPhase==='set'?'Create Role PIN':'Confirm Role PIN'}/>
          <div style={{marginTop:18,background:T.bg2,border:`1px solid ${T.line}`,padding:'18px 16px 22px',textAlign:'center'}}>
            <PinPad length={4} onComplete={handlePin} label={pinPhase==='set'?'Create 4-digit PIN':'Confirm your PIN'} hint={pinPhase==='set'?'Authenticates your role on this device':'Re-enter your PIN to confirm'}/>
          </div>
          {pinErr&&<div style={{marginTop:12}}><Notice type="error" message={pinErr}/></div>}
          <div style={{marginTop:14}}><Btn variant="secondary" onClick={()=>{setStep(1);setPinPhase('set');setPinFirst('');setPinErr('');}}>Back</Btn></div>
        </>)}
      </div>
    </PageShell>
  );
}

function PaymentGateScreen({tier,modules,license,deviceId,demoRec,onDemo,onActivateKey,onBack}){
  const td=TIER_DEF[tier],price=license?.costBreakdown?.total||0;
  const daysLeft=demoDaysLeft(demoRec),demoUsed=demoRec&&!isDemoActive(demoRec);
  const [showKeyEntry,setShowKeyEntry]=useState(false),[licKey,setLicKey]=useState(''),[keyErr,setKeyErr]=useState(''),[activating,setActivating]=useState(false);
  const formatKey=v=>{const clean=v.toUpperCase().replace(/[^A-Z0-9]/g,'');const parts=['PSA',clean.slice(0,4),clean.slice(4,8),clean.slice(8,12),clean.slice(12,16)];return parts.filter(Boolean).join('-');};
  const tryActivate=()=>{setActivating(true);setKeyErr('');const result=parseLicenseKey(licKey,deviceId,tier,modules,license.profile,license.capacity,license.pin);setTimeout(()=>{setActivating(false);if(!result){setKeyErr('Invalid license key. The key may be malformed, or it does not match the tier, modules, capacity, or client name entered. Verify each field matches what was provided at purchase.');return;}if(!isLicenseValid(result)){setKeyErr('This license key has expired. Please contact AgoroX for renewal.');return;}onActivateKey(result);},800);};
  const openPaystack=()=>{
    if(!PAYSTACK_CONFIG.publicKey||PAYSTACK_CONFIG.publicKey.includes('YOUR_')){
      setKeyErr('Payment not configured. Enter your license key manually.');
      setShowKeyEntry(true);
      return;
    }
    const handler=window.PaystackPop&&window.PaystackPop.setup({
      key:PAYSTACK_CONFIG.publicKey,
      email:license?.profile?.email||'user@example.com',
      amount:price*100,
      currency:'NGN',
      ref:'PSA-'+Date.now()+'-'+Math.random().toString(36).slice(2,7).toUpperCase(),
      metadata:{deviceId,tier,modules:modules.join(',')},
      callback:(response)=>{setKeyErr('Payment successful! Ref: '+response.reference+'. Enter your license key below.');setShowKeyEntry(true);},
      onClose:()=>{},
    });
    if(handler){handler.openIframe();}else{setKeyErr('Paystack not loaded. Enter license key manually.');setShowKeyEntry(true);}
  };
  return(
    <PageShell withFooter><NavHeader title="License & Activation"/>
      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        <div style={{background:T.bg2,border:`1px solid ${T.line}`,padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div><div style={{fontSize:10,fontWeight:600,color:T.ink4,textTransform:'uppercase',letterSpacing:.8}}>Device ID</div><div className="mono" style={{fontSize:12,color:T.ink,marginTop:2}}>{deviceId||'—'}</div></div>
        </div>
        <div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'18px 20px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
            <div><div style={{fontSize:17,fontWeight:700,color:T.ink}}>{td.label} License</div><div style={{fontSize:12,color:T.ink3,marginTop:3}}>Annual subscription · 365 days</div></div>
            <div style={{textAlign:'right'}}><div className="mono" style={{fontSize:20,fontWeight:700,color:T.ink}}>{ngn(price)}</div><div style={{fontSize:11,color:T.ink4}}>per year</div></div>
          </div>
        </div>
        {!demoUsed&&(<div style={{background:T.accentBg,border:`1px solid ${T.accentLine}`,padding:'14px 18px'}}><div style={{fontSize:13,fontWeight:600,color:T.accentDark,marginBottom:4}}>{demoRec?`Demo Active — ${daysLeft} days remaining`:'7-Day Free Demo Available'}</div><div style={{fontSize:12,color:T.ink3}}>Try the full system free for 7 days. No credit card required.</div></div>)}
        {demoUsed&&<Notice type="warn" message="Your 7-day demo has expired. Activate a paid license to continue."/>}
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <button onClick={openPaystack} style={{width:'100%',padding:'14px 20px',background:T.accent,color:'#fff',border:'none',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>Pay {ngn(price)} / year via Paystack</button>
          {!demoRec&&!demoUsed&&<Btn full onClick={onDemo} variant="secondary">Start 7-Day Free Demo</Btn>}
          {demoRec&&isDemoActive(demoRec)&&<Btn full onClick={onDemo} variant="secondary">Continue Demo ({daysLeft} days left)</Btn>}
          <button onClick={()=>setShowKeyEntry(v=>!v)} style={{width:'100%',padding:'10px',background:'transparent',color:T.ink3,border:`1px solid ${T.line}`,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>{showKeyEntry?'Hide License Key Entry':'I have a license key'}</button>
        </div>
        {showKeyEntry&&(<div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'18px 20px',display:'flex',flexDirection:'column',gap:12}}>
          <Inp label="License Key" value={licKey} onChange={v=>setLicKey(formatKey(v))} placeholder="PSA-XXXX-XXXX-XXXX-XXXX"/>
          {keyErr&&<Notice type="error" message={keyErr}/>}
          <div style={{display:'flex',gap:8}}><Btn onClick={tryActivate} disabled={licKey.length<23||activating}>{activating?'Activating...':'Activate License'}</Btn><Btn variant="ghost" onClick={()=>setShowKeyEntry(false)}>Cancel</Btn></div>
        </div>)}
        <button onClick={onBack} style={{background:'none',border:'none',cursor:'pointer',color:T.ink4,fontSize:12,fontFamily:'inherit',textAlign:'left',padding:'4px 0'}}>Back to setup</button>
      </div>
    </PageShell>
  );
}

function DemoBanner({demoRec,onUpgrade}){
  const days=demoDaysLeft(demoRec),urgent=days<=2;
  if(!isDemoActive(demoRec))return null;
  return(<div style={{background:urgent?T.errBg:T.accentBg,borderBottom:`1px solid ${urgent?T.errLine:T.accentLine}`,padding:'8px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
    <div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:6,height:6,background:urgent?T.err:T.accent}}/><span style={{fontSize:12,fontWeight:600,color:urgent?T.err:T.accentDark}}>{urgent?`Demo expires in ${days} day${days!==1?'s':''}`:`Demo — ${days} day${days!==1?'s':''} remaining`}</span></div>
    <button onClick={onUpgrade} style={{fontSize:11,fontWeight:700,padding:'5px 14px',background:T.accent,color:'#fff',border:'none',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>Upgrade to Full License</button>
  </div>);
}

function LicenseExpiryBanner({license,onRenew}){
  const days=licenseDaysLeft(license);
  if(!license?.paid||days>30)return null;
  return(<div style={{background:T.warnBg,borderBottom:`1px solid ${T.warnLine}`,padding:'8px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
    <span style={{fontSize:12,fontWeight:600,color:T.warn}}>License expires in {days} days</span>
    <button onClick={onRenew} style={{fontSize:11,fontWeight:700,padding:'4px 12px',background:T.warn,color:'#fff',border:'none',cursor:'pointer',fontFamily:'inherit'}}>Renew Now</button>
  </div>);
}

function LicenseViewScreen({license,onActivate}){
  const tier=TIER_DEF[license.tier],cost=license.costBreakdown;
  return(
    <PageShell maxWidth={560}><NavHeader title="License Generated"/>
      <Notice type="success" message="Your license has been generated and stored securely on this device."/>
      <div style={{marginTop:16,background:T.bg0,border:`1.5px solid ${T.line}`,overflow:'hidden'}}>
        <div style={{background:T.bg1,padding:'22px 24px',display:'flex',justifyContent:'space-between',alignItems:'flex-start',borderBottom:`1px solid ${T.line}`}}>
          <div><div style={{fontSize:10,fontWeight:600,color:T.ink4,letterSpacing:2,textTransform:'uppercase',marginBottom:5}}>License Certificate</div><div style={{fontSize:20,fontWeight:700,color:T.ink,letterSpacing:-0.3}}>{license.profile.farmName}</div><div style={{fontSize:13,color:T.ink3,marginTop:3}}>{[license.profile.city,license.profile.country].filter(Boolean).join(', ')}</div></div>
          <div className="mono" style={{fontSize:10,color:T.ink4,marginTop:8}}>#{license.id}</div>
        </div>
        <div style={{padding:'20px 24px'}}>
          <div style={{fontSize:11,fontWeight:600,color:T.ink4,textTransform:'uppercase',letterSpacing:0.8,marginBottom:10}}>Enabled Modules</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:7,marginBottom:18}}>
            {license.enabledModules.map(m=>{const md=MODULE_DEF[m],MI=md.Icon;return(<div key={m} style={{display:'flex',alignItems:'center',gap:7,background:T.bg2,border:`1px solid ${T.line}`,padding:'6px 12px'}}><MI size={18} color={T.ink3}/><span style={{fontSize:13,fontWeight:500,color:T.ink}}>{md.name}</span></div>);})}
            {tier.hasCore&&<div style={{display:'flex',alignItems:'center',gap:7,background:T.bg2,border:`1px solid ${T.line}`,padding:'6px 12px'}}><IcoCore size={18} color={T.ink3}/><span style={{fontSize:13,fontWeight:500,color:T.ink}}>Core Engine</span></div>}
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:11,marginTop:5,borderTop:`2px solid ${T.ink}`}}><span style={{fontSize:14,fontWeight:600,color:T.ink}}>Annual License Fee</span><span className="mono" style={{fontSize:20,fontWeight:700,color:T.ink}}>{ngn(cost.total)}</span></div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginTop:14}}>
            {[['Role',license.profile.role],['Issued',license.issued],['Expires',license.expiry]].map(([k,v])=>(<div key={k} style={{background:T.bg2,padding:'9px 11px'}}><div style={{fontSize:10,color:T.ink4,textTransform:'uppercase',letterSpacing:1,marginBottom:3}}>{k}</div><div className="mono" style={{fontSize:12,color:T.ink}}>{v}</div></div>))}
          </div>
        </div>
      </div>
      <div style={{marginTop:16}}><Btn onClick={onActivate} full size="lg">Activate PoultrySuite Africa</Btn></div>
    </PageShell>
  );
}

function ExpiredScreen({type,tier,onRenew,onResetDemo}){
  const td=TIER_DEF[tier]||TIER_DEF.single;
  return(<PageShell withFooter><NavHeader title="License Expired"/>
    <div style={{display:'flex',flexDirection:'column',gap:16,paddingTop:16}}>
      <div style={{background:T.errBg,border:`1px solid ${T.errLine}`,padding:'20px 22px',textAlign:'center'}}>
        <div style={{width:44,height:44,border:`1px solid ${T.errLine}`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={T.err} strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter"><rect x="3" y="3" width="18" height="18"/><path d="M3 3L21 21"/></svg>
        </div>
        <div style={{fontSize:17,fontWeight:700,color:T.err,marginBottom:6}}>{type==='demo'?'Demo Period Expired':'License Expired'}</div>
        <div style={{fontSize:13,color:T.ink3,lineHeight:1.7}}>{type==='demo'?'Your 7-day demo has ended. Activate a paid license to continue.':'Your annual license has expired. Renew to restore full access.'}</div>
      </div>
      <button onClick={onRenew} style={{width:'100%',padding:'14px',background:T.accent,color:'#fff',border:'none',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>Renew {td.label} License</button>
      {type==='demo'&&<button onClick={onResetDemo} style={{width:'100%',padding:'10px',background:'transparent',color:T.ink4,border:`1px solid ${T.line}`,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Back to tier selection</button>}
    </div>
  </PageShell>);
}

function PinLoginScreen({storedPin,license,onSuccess}){
  const [attempts,setAttempts]=useState(0),[error,setError]=useState('');
  const MAX=5,locked=attempts>=MAX,profile=license?.profile,tier=license?TIER_DEF[license.tier]:null;
  const handlePin=(pin)=>{
    const matched=findUserByPin(license,pin);
    if(matched){onSuccess(matched);return;}
    // Legacy fallback: license without users array
    if(!license?.users&&pin===storedPin){
      const ml=migrateLicense(license);
      onSuccess(ml.users[0]);
      return;
    }
    const n=attempts+1;setAttempts(n);
    if(n>=MAX)setError('Device locked after 5 failed attempts.');
    else setError(`Incorrect PIN. ${MAX-n} attempt${MAX-n!==1?'s':''} remaining.`);
  };
  return(
    <div style={{minHeight:'100vh',background:T.bg1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{width:'100%',maxWidth:340}} className="au">
        {profile&&(<div style={{background:T.bg0,border:`1px solid ${T.line}`,textAlign:'center',marginBottom:14,padding:18}}>
          <div style={{fontSize:17,fontWeight:700,color:T.ink}}>{profile.farmName}</div>
          <div style={{fontSize:13,color:T.ink3,marginTop:2}}>{[profile.city,profile.country].filter(Boolean).join(', ')}</div>
          {tier&&<div style={{marginTop:10}}><span style={{fontSize:11,color:T.ink3}}>{tier.label} License</span></div>}
        </div>)}
        <div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:22}}>
          <div style={{textAlign:'center',marginBottom:22}}>
            <div style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:44,height:44,marginBottom:12}}><IcoLock size={26} color={T.ink3}/></div>
            <div style={{fontSize:19,fontWeight:700,color:T.ink}}>Device Authentication</div>
            <div style={{fontSize:13,color:T.ink3,marginTop:4}}>Enter your role PIN to continue</div>
          </div>
          {locked?<Notice type="error" message="Device locked. Please restart the application to reset."/>:<PinPad length={4} onComplete={handlePin} label="Enter PIN"/>}
          {error&&!locked&&<div style={{marginTop:13}}><Notice type="error" message={error}/></div>}
        </div>
        <AppFooter/>
      </div>
    </div>
  );
}

function TermsAcceptanceScreen({onAccept}){
  const [agreed,setAgreed]=useState(false);
  const [eulaOpen,setEulaOpen]=useState(false);
  const [privOpen,setPrivOpen]=useState(false);
  const [ipOpen,setIpOpen]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const handleAccept=async()=>{if(!agreed)return;setSubmitting(true);try{const record={acceptedAt:new Date().toISOString(),version:'1.0'};await setTCAccepted(record);}catch(_){}finally{setSubmitting(false);onAccept();}};
  if(eulaOpen)return <LegalDocViewer doc={LEGAL_DOCS.eula} onClose={()=>setEulaOpen(false)}/>;
  if(privOpen)return <LegalDocViewer doc={LEGAL_DOCS.privacy} onClose={()=>setPrivOpen(false)}/>;
  if(ipOpen)return <LegalDocViewer doc={LEGAL_DOCS.ip} onClose={()=>setIpOpen(false)}/>;
  return(
    <div style={{minHeight:'100vh',background:T.bg1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{width:'100%',maxWidth:460}} className="au">
        <div style={{textAlign:'center',marginBottom:28}}>

          <div style={{fontSize:18,fontWeight:700,color:T.ink,letterSpacing:-0.3,lineHeight:1.2}}>PoultrySuite<span style={{color:T.ink3}}> Africa</span></div>
          <div style={{fontSize:12,color:T.ink4,marginTop:6}}>Please review and accept our terms to continue.</div>
        </div>
        <div style={{background:T.bg0,border:`1px solid ${T.line}`,marginBottom:16,overflow:'hidden'}}>
          <div style={{padding:'12px 16px',borderBottom:`1px solid ${T.line}`,background:T.bg2}}><div style={{fontSize:11,fontWeight:700,color:T.ink4,textTransform:'uppercase',letterSpacing:.8}}>Legal Agreements</div></div>
          {[{label:'End User License Agreement (EULA)',date:LEGAL_DOCS.eula.lastUpdated,fn:()=>setEulaOpen(true)},{label:'Privacy Policy',date:LEGAL_DOCS.privacy.lastUpdated,fn:()=>setPrivOpen(true)},{label:'Intellectual Property Policy',date:LEGAL_DOCS.ip.lastUpdated,fn:()=>setIpOpen(true)}].map((doc,i)=>(
            <button key={i} onClick={doc.fn}
              style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 16px',background:'transparent',border:'none',borderTop:i>0?`1px solid ${T.line}`:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left',transition:'background 0.1s'}}
              onMouseEnter={e=>e.currentTarget.style.background=T.bg1} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <div style={{display:'flex',gap:12,alignItems:'center'}}>
                <div style={{width:24,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {i===0&&<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={T.ink4} strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter"><rect x="4" y="2" width="16" height="20"/><path d="M8 7H16M8 11H16M8 15H12"/></svg>}
                  {i===1&&<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={T.ink4} strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
                  {i===2&&<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={T.ink4} strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter"><rect x="3" y="3" width="18" height="18"/><path d="M9 9H12C12 9 14 9 14 11C14 13 12 13 12 13V15"/><rect x="11" y="17" width="2" height="2"/></svg>}
                </div>
                <div><div style={{fontSize:13,fontWeight:500,color:T.ink}}>{doc.label}</div><div style={{fontSize:10,color:T.ink4,marginTop:2}}>Updated {doc.date}</div></div>
              </div>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={T.accentDark} strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter"><path d="M4 12H20M14 6L20 12L14 18"/></svg>
            </button>
          ))}
        </div>
        <div onClick={()=>setAgreed(v=>!v)}
          style={{display:'flex',alignItems:'flex-start',gap:12,padding:'14px 16px',background:agreed?T.accentBg:T.bg0,border:`1.5px solid ${agreed?T.accentLine:T.line}`,cursor:'pointer',marginBottom:14,transition:'all 0.15s'}}>
          <div style={{width:20,height:20,border:`2px solid ${agreed?T.accent:T.lineMid}`,background:agreed?T.accent:T.bg0,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1,transition:'all 0.15s'}}>
            {agreed&&<IcoCheck size={10} color="#fff"/>}
          </div>
          <div style={{fontSize:13,color:T.ink,lineHeight:1.6,userSelect:'none'}}>I have read and agree to the <span style={{fontWeight:600}}>End User License Agreement</span>, <span style={{fontWeight:600}}>Privacy Policy</span>, and <span style={{fontWeight:600}}>Intellectual Property Policy</span>.</div>
        </div>
        <button onClick={handleAccept} disabled={!agreed||submitting}
          style={{width:'100%',padding:'14px',background:agreed?T.accent:T.bg2,color:agreed?'#fff':T.ink4,border:'none',fontSize:14,fontWeight:700,cursor:agreed?'pointer':'not-allowed',fontFamily:'inherit',transition:'background 0.15s',minHeight:48,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          {submitting?'Accepting...':'Accept & Continue'}
        </button>
        <div style={{marginTop:14,textAlign:'center',fontSize:11,color:T.ink4,lineHeight:1.7}}>You must accept these terms to use PoultrySuite Africa.</div>
        <AppFooter/>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════
//  LIVE MODE PANEL — shared across all Settings engines
// ══════════════════════════════════════════════════════════
function LiveModePanel({dataMode,onSwitchToLive,onRestoreTraining}){
  const [confirm,setConfirm]=useState(false);
  const [typed,setTyped]=useState('');
  const [switching,setSwitching]=useState(false);
  const [restoreConfirm,setRestoreConfirm]=useState(false);
  const [restoring,setRestoring]=useState(false);
  const isLive=dataMode==='live';

  const doSwitch=async()=>{
    setSwitching(true);
    await new Promise(r=>setTimeout(r,600));
    await onSwitchToLive();
    setSwitching(false);
    setConfirm(false);
    setTyped('');
  };

  const doRestore=async()=>{
    setRestoring(true);
    await new Promise(r=>setTimeout(r,600));
    if(onRestoreTraining)await onRestoreTraining();
    setRestoring(false);
    setRestoreConfirm(false);
  };

  if(isLive){
    return(
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div style={{background:T.bg0,border:`1px solid ${T.okLine}`,padding:'22px 24px',display:'flex',gap:16,alignItems:'flex-start'}}>
          <div style={{width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><path d="M5 12l5 5L19 7"/></svg>
          </div>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:T.ok,marginBottom:4}}>Live Mode Active</div>
            <div style={{fontSize:13,color:T.ink3,lineHeight:1.7}}>This system is running on real farm data. Demo data has been permanently removed. All entries you create are your actual operational records.</div>
          </div>
        </div>
        <div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'18px 20px'}}>
          <div style={{fontSize:13,fontWeight:700,color:T.ink,marginBottom:8}}>Live Mode Guarantees</div>
          {[['No demo data remains — the environment is clean','+'],['All records you create are real operational data','+'],['Data persists across sessions via backup/restore','+'],['Backup regularly to prevent data loss on refresh','!']].map(([t,ic])=>(
            <div key={t} style={{display:'flex',gap:10,alignItems:'flex-start',marginBottom:8}}>
              <span style={{fontSize:11,fontWeight:700,color:ic==='+'?T.ok:'#F59E0B',flexShrink:0,width:16,marginTop:2}}>{ic}</span>
              <span style={{fontSize:13,color:T.ink3,lineHeight:1.5}}>{t}</span>
            </div>
          ))}
        </div>
        {onRestoreTraining&&<div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'18px 20px'}}>
          <div style={{fontSize:13,fontWeight:700,color:T.ink,marginBottom:6}}>Restore Training Data</div>
          <div style={{fontSize:12,color:T.ink3,lineHeight:1.6,marginBottom:12}}>Return to demo/training data to explore features or onboard new staff. Your current live data will be replaced with the training sample data. The audit log entries from your live session will be preserved for compliance records. Export a backup first if you want to preserve your live records.</div>
          {!restoreConfirm?(
            <Btn variant="secondary" onClick={()=>setRestoreConfirm(true)} full>Restore Training Data</Btn>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <Notice type="warn" message="Switching back will replace your current live data view with training data. Audit log entries from live mode will remain visible. Make sure you have exported a backup."/>
              <div style={{display:'flex',gap:10}}>
                <Btn variant="secondary" onClick={doRestore} disabled={restoring} sx={{flex:1}}>{restoring?'Restoring…':'Confirm — Restore Training Data'}</Btn>
                <Btn variant="ghost" onClick={()=>setRestoreConfirm(false)} disabled={restoring}>Cancel</Btn>
              </div>
            </div>
          )}
        </div>}
      </div>
    );
  }

  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{background:T.bg0,border:`1px solid ${T.warnLine}`,padding:'18px 20px',display:'flex',gap:14,alignItems:'flex-start'}}>
        <div style={{width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:'#F59E0B',marginBottom:4}}>You are currently in Demo Mode</div>
          <div style={{fontSize:13,color:T.ink3,lineHeight:1.7}}>The system is loaded with sample data to help you explore features. Switching to Live Mode will permanently delete all demo data and initialize a clean environment for real farm operations.</div>
        </div>
      </div>

      <div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'18px 20px'}}>
        <div style={{fontSize:13,fontWeight:700,color:T.ink,marginBottom:10}}>What happens when you switch?</div>
        {[['All demo houses, batches, eggs, and records are permanently deleted','DEL'],['A clean, empty environment is initialized for your real data','NEW'],['Live Mode is persisted — the system will always start in Live Mode','PRS'],['You will be prompted to add your first house or flock','GO'],['Demo data and live data can never coexist or mix','NO']].map(([t,ic])=>(
          <div key={t} style={{display:'flex',gap:10,alignItems:'flex-start',marginBottom:8}}>
            <span style={{fontSize:10,fontWeight:700,color:T.ink4,fontFamily:'monospace',flexShrink:0,width:26,marginTop:1}}>{ic}</span>
            <span style={{fontSize:13,color:T.ink3,lineHeight:1.5}}>{t}</span>
          </div>
        ))}
      </div>

      {!confirm?(
        <div>
          <Btn variant="danger" onClick={()=>setConfirm(true)} full>
            Switch to Live Mode — Delete All Demo Data
          </Btn>
          <div style={{fontSize:11,color:T.ink4,textAlign:'center',marginTop:8}}>This action cannot be undone.</div>
        </div>
      ):(
        <div style={{background:T.errBg,border:`1px solid ${T.errLine}`,padding:'20px 22px',display:'flex',flexDirection:'column',gap:14}}>
          <div style={{fontSize:14,fontWeight:700,color:T.err}}>Confirm Live Mode Switch</div>
          <div style={{fontSize:13,color:T.ink3,lineHeight:1.7}}>Type <strong style={{fontWeight:700,color:T.ink,fontFamily:'monospace'}}>CONFIRM</strong> below to permanently delete all demo data and activate Live Mode.</div>
          <Inp label="" value={typed} onChange={setTyped} placeholder='Type CONFIRM to proceed'/>
          {typed.toUpperCase()==='CONFIRM'&&<Notice type="warn" message="All demo data will be permanently deleted. This cannot be undone."/>}
          <div style={{display:'flex',gap:10}}>
            <Btn
              variant="danger"
              disabled={typed.toUpperCase()!=='CONFIRM'||switching}
              onClick={doSwitch}
              sx={{flex:1}}
            >
              {switching?'Switching to Live Mode…':'Confirm — Activate Live Mode'}
            </Btn>
            <Btn variant="secondary" onClick={()=>{setConfirm(false);setTyped('');}} disabled={switching}>Cancel</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  LIVE MODE WELCOME — shown on Command Center when live + empty
// ══════════════════════════════════════════════════════════
function LiveModeWelcome({module}){
  const steps={
    poultry:[
      {n:1,title:'Add a House',desc:'Go to Houses & Batches to register your first poultry house and set its bird capacity.'},
      {n:2,title:'Create a Batch',desc:'Once a house exists, create a batch to record your flock — breed, source, and start date.'},
      {n:3,title:'Log Daily Operations',desc:'Use the Daily Log engine to record mortality, feed consumption, and vaccinations every day.'},
      {n:4,title:'Track Financials',desc:'Log procurement costs, feed costs, and bird/egg sales to track your profitability per batch.'},
    ],
    hatchery:[
      {n:1,title:'Record Egg Intake',desc:'Go to Egg Intake to log your first egg batch — source farm, breed, quantity, and graded count.'},
      {n:2,title:'Start Incubation',desc:'Set the batch in an incubator/setter. Track temperature, humidity, and expected hatch date.'},
      {n:3,title:'Candling & Hatch',desc:'Record candling results at day 7 and hatch output when the cycle completes.'},
      {n:4,title:'Process & Distribute',desc:'Log chick grading, vaccination at hatch, and dispatch to farms or customers.'},
    ],
    feedmill:[
      {n:1,title:'Define a Recipe',desc:'Go to Formulation & Recipe to create your first feed formula with ingredients and percentages.'},
      {n:2,title:'Stock Raw Materials',desc:'Record raw material intake — maize, soybean meal, premixes — with quantities and costs.'},
      {n:3,title:'Run a Production Batch',desc:'Start a production run against your recipe. Record actual output and efficiency.'},
      {n:4,title:'QC & Dispatch',desc:'Log quality control results, then distribute finished feed to farms or external customers.'},
    ],
  };
  const list=steps[module]||steps.poultry;
  const modName=module==='poultry'?'PoultryOS':module==='hatchery'?'HatcheryOS':'FeedMillOS';
  return(
    <div style={{display:'flex',flexDirection:'column',gap:16}} className="au">
      <div style={{background:T.bg0,border:`1px solid ${T.okLine}`,padding:'20px 24px',display:'flex',gap:14,alignItems:'flex-start'}}>
        <div style={{width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><path d="M5 12l5 5L19 7"/></svg>
        </div>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:T.ok,marginBottom:3}}>Live Mode Active — {modName} Ready</div>
          <div style={{fontSize:13,color:T.ink3,lineHeight:1.6}}>Your environment is clean with no demo data. Follow the steps below to start recording your real farm operations.</div>
        </div>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {list.map(step=>(
          <div key={step.n} style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'16px 18px',display:'flex',gap:14,alignItems:'flex-start'}}>
            <div style={{width:32,height:32,border:`1px solid ${T.line}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:13,fontWeight:700,color:T.ink3}}>{step.n}</div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:T.ink,marginBottom:4}}>{step.title}</div>
              <div style={{fontSize:12,color:T.ink3,lineHeight:1.6}}>{step.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  HELP & DOCUMENTATION ENGINE — shared across all modules
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
//  HELP & DOCUMENTATION SYSTEM
//  Comprehensive help for PoultryOS, HatcheryOS, FeedMillOS
// ══════════════════════════════════════════════════════════

// ── Tooltip / Inline Hint component
function Hint({text,children}){
  const [show,setShow]=useState(false);
  return(
    <span style={{position:'relative',display:'inline-flex',alignItems:'center'}}>
      {children}
      <button
        onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}
        onFocus={()=>setShow(true)} onBlur={()=>setShow(false)}
        onClick={e=>{e.stopPropagation();setShow(v=>!v);}}
        style={{marginLeft:5,width:15,height:15,borderRadius:0,background:'none',border:`1px solid ${T.line}`,cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0,padding:0}}
        aria-label="More info"
      >
        <span style={{fontSize:9,fontWeight:700,color:T.accent,lineHeight:1}}>?</span>
      </button>
      {show&&(
        <span style={{position:'absolute',bottom:'calc(100% + 6px)',left:'50%',transform:'translateX(-50%)',background:T.ink,color:'#fff',fontSize:11,lineHeight:1.5,padding:'7px 10px',whiteSpace:'normal',width:220,zIndex:500,boxShadow:'0 4px 16px rgba(0,0,0,0.18)',pointerEvents:'none'}}>
          {text}
          <span style={{position:'absolute',bottom:-5,left:'50%',transform:'translateX(-50%)',width:8,height:8,background:T.ink,clipPath:'polygon(0 0,100% 0,50% 100%)'}}/>
        </span>
      )}
    </span>
  );
}

// ── Field with inline help hint
function HintedLabel({label,hint,required}){
  return(
    <div style={{display:'flex',alignItems:'center',gap:0,marginBottom:6}}>
      <label style={{fontSize:12,fontWeight:500,color:T.ink3,letterSpacing:0.1}}>{label}{required&&<span style={{color:T.err,marginLeft:2}}>*</span>}</label>
      {hint&&<Hint text={hint}><span/></Hint>}
    </div>
  );
}

// ── Contextual step guide shown inside engines
function StepGuide({steps,accent}){
  const ac=accent||T.accent;
  return(
    <div style={{background:T.bg0,border:`1px solid ${T.accentLine}`,padding:'14px 16px',marginBottom:14}}>
      <div style={{fontSize:11,fontWeight:700,color:T.ink4,textTransform:'uppercase',letterSpacing:.8,marginBottom:10}}>How it works</div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {steps.map((s,i)=>(
          <div key={i} style={{display:'flex',gap:10,alignItems:'flex-start'}}>
            <div style={{width:20,height:20,background:ac,color:'#fff',fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>{i+1}</div>
            <div style={{fontSize:12,color:T.ink3,lineHeight:1.5,flex:1}}>{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  HELP CONTENT — PoultryOS, HatcheryOS, FeedMillOS
// ═══════════════════════════════════════════════════════════
const HELP_CONTENT={
  poultry:{
    accent:T.info,
    moduleName:'PoultryOS',
    tagline:'Poultry Farm Operating System',
    overview:'PoultryOS is an offline-first, batch-level farm management system. It tracks every aspect of poultry production — from flock intake to sales — across houses, batches, mortality, feed, vaccinations, health events, egg production, and financials. All data is stored locally on your device.',
    sections:[
      {
        id:'overview',label:'Module Overview',icon:'overview',
        topics:[
          {
            title:'What is PoultryOS?',
            preview:'PoultryOS manages your entire poultry operation in one place — from housing to sales.',
            body:'PoultryOS is structured around Houses and Batches. A House is a physical building; a Batch is a group of birds placed in a house on a given date. Every other engine — Mortality, Feed, Vaccinations, Health, Egg Production, Financials — records data against specific batches. The Command Center aggregates all data into a single live dashboard.\n\nPoultryOS works entirely offline. No internet connection is needed for any feature. Data is held in memory during your session and must be exported via Settings > Backup & Data to persist between sessions.',
            terms:[
              {t:'House',d:'A physical poultry building with a fixed maximum bird capacity.'},
              {t:'Batch',d:'A group of birds of the same breed placed in one house on one start date. All production data is tracked per batch.'},
              {t:'Active Batch',d:'A batch with status "Active" — birds are alive and in production. Quarantined batches are also counted separately.'},
              {t:'DOC',d:'Day-Old Chick — newly hatched birds received from a hatchery.'},
            ]
          },
          {
            title:'Engine Overview — What Each Section Does',
            preview:'A quick guide to every section in PoultryOS and when to use each one.',
            body:'Command Center: Live dashboard showing all active batch KPIs, mortality trend, vaccination alerts, and egg production totals. Always your starting point.\n\nDaily Log: The fastest way to record today\'s mortality, feed, and overdue vaccinations. Designed for daily farm staff use — minimal input, maximum speed.\n\nHouses & Batches: Register buildings and create flocks. Manage batch status changes (Active, Quarantined, Sold, Closed).\n\nEgg Production: Log daily egg collections, crate counts, and sales for Layer batches aged 140+ days.\n\nVaccinations: Schedule doses, apply full breed templates, and mark vaccinations as administered.\n\nFeed Tracking: Log daily feed consumption per batch. Track FCR (Feed Conversion Ratio) and total feed cost.\n\nHealth & Mortality: Record disease events, quarantine decisions, and treatment outcomes.\n\nFinancials: Log all costs and revenues per batch. View batch-level P&L.\n\nAudit Log: Every system action is recorded here with timestamp, entity, and user for full traceability.\n\nSettings & Backup: Configure alerts, thresholds, and export/import your data.',
            terms:[]
          },
        ]
      },
      {
        id:'getting-started',label:'Getting Started',icon:'start',
        topics:[
          {
            title:'Setting Up Your First House',
            preview:'Step-by-step: how to add a house and configure its capacity.',
            body:'1. Open the Houses & Batches engine.\n2. Click "+ Add House" at the top right.\n3. Enter a House Name (e.g., "House Alpha" or "Block A"). Choose the bird type that will occupy this house — Broiler, Layer, Pullet, etc.\n4. Enter the Capacity — the maximum number of birds this building can physically hold. This is used to prevent accidental over-stocking.\n5. Click Save House.\n\nYou can add as many houses as you have buildings. Each house can hold multiple batches over time, but typically one active batch at a time.',
            terms:[
              {t:'Capacity',d:'The maximum bird count a house can hold. The system checks this when you create a batch.'},
            ]
          },
          {
            title:'Creating Your First Batch',
            preview:'How to register a flock and start tracking it in PoultryOS.',
            body:'1. Open Houses & Batches and click "View Batches" for your chosen house.\n2. Click "+ New Batch."\n3. Enter: Batch Name, Breed (e.g., Ross 308), Source/Hatchery, Batch Type (Broiler or Layer), Initial Bird Count, and Start Date.\n4. The system checks that the initial count does not exceed remaining house capacity.\n5. Click Save Batch.\n\nOnce a batch is saved, it appears in the Command Center and all other engines (Mortality, Feed, Vaccinations, etc.) will list it as an option.',
            terms:[
              {t:'Initial Bird Count',d:'The number of birds placed on the start date. This becomes the baseline for mortality rate calculations.'},
              {t:'Current Count',d:'Initial count minus all logged mortality. Updates automatically each time you log a death.'},
            ]
          },
          {
            title:'Applying a Vaccination Template',
            preview:'Auto-generate a full vaccination schedule for a new batch in seconds.',
            body:'1. Go to the Vaccinations engine.\n2. Click "Apply Template."\n3. Select the batch you just created.\n4. The system generates a full schedule based on breed type (Broiler or Layer) and the batch start date.\n   - Broiler template: 6 doses from Day 0 to Day 35\n   - Layer template: 8 doses from Day 0 to Day 84\n5. Day 0 entries (hatchery vaccines) are automatically marked Done.\n6. Click Apply.\n\nAll scheduled doses will appear in the Vaccination schedule table and in the Daily Log > Vaccines tab as they approach their due dates.',
            terms:[
              {t:'Template',d:'A pre-built vaccination schedule based on batch type. Calculates actual calendar dates from the batch start date.'},
              {t:'Day 0',d:'The day the batch was placed (start date). Hatchery vaccines are auto-marked Done on this day.'},
            ]
          },
          {
            title:'Demo Mode vs Live Mode',
            preview:'Understand the difference and how to switch to real farm data.',
            body:'Demo Mode: The system loads with pre-populated sample data — houses, batches, records — so you can explore every feature without entering real data. A small "DEMO" indicator appears in the top navigation bar.\n\nLive Mode: A completely clean environment with no pre-loaded data. All records you create are your actual farm operations.\n\nTo switch: Go to any module\'s Settings > Live Mode tab. Read the confirmation message, type CONFIRM, and click the button. This permanently deletes all demo data and cannot be undone.\n\nImportant: Demo data and live data can never coexist. Once switched to Live Mode, the system always starts in Live Mode.',
            terms:[
              {t:'Demo Mode',d:'Pre-loaded sample data for exploration. Shown with orange "DEMO" pill in the nav bar.'},
              {t:'Live Mode',d:'Clean slate for real farm operations. Persisted so the system always remembers your choice.'},
            ]
          },
        ]
      },
      {
        id:'daily-ops',label:'Daily Operations',icon:'daily',
        topics:[
          {
            title:'Logging Daily Mortality',
            preview:'The fastest way to record bird deaths every day.',
            body:'Method 1 — Daily Log (recommended for daily use):\n1. Open Daily Log > Mortality tab.\n2. Select the batch, enter the bird count, select the cause, and click Log Mortality.\nThe batch\'s current count is immediately reduced.\n\nMethod 2 — Health & Mortality engine:\n1. Go to Health & Mortality > Mortality Log.\n2. Click "+ Mortality" for more detailed records including date override.\n\nCause options: Natural, Disease, Heat Stress, Cold Stress, Injury, Culling, Unknown.\n\nMortality rate is calculated as: Total Mortalities / Initial Count × 100. When this exceeds the threshold in Settings (default: 2%), the Command Center shows an alert.',
            terms:[
              {t:'Mortality Rate',d:'Cumulative deaths divided by initial bird count, expressed as a percentage. A key batch health indicator.'},
              {t:'Cause of Death',d:'The logged reason for mortality. Used for trend analysis and supplier/management feedback.'},
            ]
          },
          {
            title:'Logging Feed Consumption',
            preview:'Track daily feed usage to calculate FCR and cost per batch.',
            body:'Method 1 — Daily Log > Feed tab (fastest):\n1. Select the batch and feed type.\n2. Enter the quantity in kg.\n3. Enter the cost per kg (optional but required for accurate financials).\n4. Click Log Feed.\n\nMethod 2 — Feed Tracking engine:\nProvides the same form with historical view and batch-level FCR calculations.\n\nFeed Cost = Quantity (kg) × Cost per kg. This is automatically included in the batch financial summary.\n\nFCR (Feed Conversion Ratio) for Broilers = Total Feed Consumed (kg) / Estimated Biomass (kg). Lower is better. Target FCR for Ross 308 is 1.6–1.8.',
            terms:[
              {t:'FCR',d:'Feed Conversion Ratio — total feed consumed divided by live weight gain. Measures feed efficiency.'},
              {t:'Feed Type',d:'The specific feed formulation used (e.g., Broiler Starter, Layer Mash). Add custom types under Feed Tracking.'},
            ]
          },
          {
            title:'Recording Egg Collections',
            preview:'Log daily egg output for Layer batches aged 140+ days.',
            body:'Only Layer batches aged 140 days or older appear in the Egg Production engine. Broilers, Pullets, and younger layers are excluded automatically.\n\n1. Go to Egg Production.\n2. Click "+ Log Collection."\n3. Select the eligible batch.\n4. Enter either the total egg count OR the number of crates (1 crate = 30 eggs). The other field auto-calculates.\n5. Optionally enter Grade A, Grade B, and Broken/Rejected counts.\n6. Enter Price per Crate if selling — this auto-creates a financial entry.\n7. Click Save Collection.\n\nThe Command Center shows 7-day and 30-day crate and egg totals, plus revenue, across all eligible batches.',
            terms:[
              {t:'Crate',d:'Standard egg packaging unit = 30 eggs. All egg quantities are stored in crates for consistent aggregation.'},
              {t:'Laying Batch',d:'A Layer batch aged 140 days or more. Only these batches are eligible for egg collection logging.'},
            ]
          },
          {
            title:'Marking Vaccinations as Administered',
            preview:'Record vaccine administration in the Daily Log or Vaccination engine.',
            body:'Method 1 — Daily Log > Vaccines tab (recommended on vaccination day):\n- Shows all overdue and today-due vaccinations.\n- Click "✓ Done" to mark as administered. The date is set to today.\n\nMethod 2 — Vaccinations engine:\n- View the full schedule table.\n- Click "Done" next to any pending or overdue entry.\n\nOverdue vaccinations (past due date, not Done) appear with a red "OVERDUE" badge and trigger an alert in the Command Center notification bell.\n\nDue vaccinations (within 2 days of due date) appear with a yellow "Due" badge.',
            terms:[
              {t:'Overdue',d:'A vaccination that passed its due date without being marked Done. Triggers a Command Center alert.'},
              {t:'Due',d:'A vaccination due within the next 2 days. Shown in yellow in the schedule and Daily Log.'},
            ]
          },
        ]
      },
      {
        id:'health',label:'Health & Quarantine',icon:'health',
        topics:[
          {
            title:'Logging a Health Event',
            preview:'How to record disease observations and treatments.',
            body:'1. Go to Health & Mortality.\n2. Click "+ Health Event."\n3. Select the batch and enter the Symptom/Observation.\n4. Set Severity: Mild, Moderate, Severe, or Critical.\n5. Enter any Treatment Administered.\n6. Check "Quarantine this batch immediately" if the condition warrants isolation.\n7. Click Log Event.\n\nHealth events remain open until you click Resolve. The Daily Log > Health tab shows all open issues for fast daily review.',
            terms:[
              {t:'Severity',d:'Mild = observation only; Moderate = treatment started; Severe = significant flock impact; Critical = immediate intervention.'},
              {t:'Quarantine',d:'Isolating a batch to prevent disease spread. Status changes to Quarantined and a Command Center alert fires.'},
            ]
          },
          {
            title:'Quarantine and Lifting Quarantine',
            preview:'How quarantine works and how to return a batch to active status.',
            body:'When you quarantine a batch:\n- Its status changes from Active to Quarantined\n- A critical red alert appears on the Command Center\n- The batch is excluded from normal flock counts but still shows in the Quarantine alert section\n- You can still log mortality and feed for a quarantined batch\n\nTo lift quarantine:\n- Go to Health & Mortality\n- Click "Lift Quarantine" on the quarantined batch, OR\n- Go to Houses & Batches > the batch card and click "Lift Quarantine"\n- The batch status returns to Active and the alert is cleared',
            terms:[
              {t:'Quarantined Status',d:'A batch under disease isolation. Excluded from active flock counts but fully trackable.'},
            ]
          },
        ]
      },
      {
        id:'financials',label:'Financials & P&L',icon:'finance',
        topics:[
          {
            title:'Understanding Batch P&L',
            preview:'How revenue, cost, and net profit are calculated per batch.',
            body:'Every financial entry in PoultryOS is tagged to a specific batch. The Financials engine shows:\n\nTotal Revenue = sum of all Revenue entries for the batch (Bird Sales + Egg Sales + Manure Sales + Other)\nTotal Cost = sum of all Cost entries (Procurement + Feed + Medication + Labor + Utilities + Maintenance)\nNet P&L = Total Revenue − Total Cost\n\nFeed costs from the Feed Tracking engine are separate from Financial log entries — they do not automatically appear in the Financial log. To include feed cost in P&L, log it as a Financial entry under Cost > Feed.\n\nThe Command Center shows global Net P&L including egg revenue from the last 30 days.',
            terms:[
              {t:'P&L',d:'Profit and Loss — revenue minus total cost. Positive = profitable batch; negative = loss-making batch.'},
              {t:'Cost Categories',d:'Procurement, Feed, Medication, Labor, Utilities, Maintenance, Other.'},
              {t:'Revenue Categories',d:'Bird Sales, Egg Sales, Manure Sales, Other.'},
            ]
          },
          {
            title:'Logging Egg Sale Revenue',
            preview:'Two ways to record egg sales — Egg Production engine or Financials.',
            body:'Method 1 — Via Egg Production (recommended):\nWhen logging a collection, enter the Price per Crate. A financial Revenue entry is automatically created with the crate count stored in the qty field.\n\nMethod 2 — Via Financials engine:\n1. Go to Financials > "+ Add Entry."\n2. Type: Revenue, Category: Egg Sales.\n3. Enter the amount and date.\n\nImportant: Entries created via the Egg Production engine store the qty (crate count) which the Command Center uses for egg production totals. Entries created manually via Financials without a qty field still add to revenue but do not contribute to crate/egg count aggregations.',
            terms:[
              {t:'qty field',d:'The crate count stored on each egg sale entry. Used by the Command Center to calculate weekly and monthly egg output.'},
            ]
          },
        ]
      },
      {
        id:'settings',label:'Settings & Backup',icon:'settings',
        topics:[
          {
            title:'Backing Up Your Data',
            preview:'How to export and restore your PoultryOS data.',
            body:'PoultryOS stores data in browser memory. This means data is lost if you close or refresh the tab without exporting.\n\nTo export:\n1. Go to Settings & Backup > Backup & Data tab.\n2. Click "Download Backup JSON."\n3. A JSON file is saved to your device. Name it clearly (e.g., PoultryOS_2025-01-28.json).\n\nTo restore:\n1. Go to Settings & Backup > Backup & Data tab.\n2. Click "Import Backup File."\n3. Select your previously exported JSON file.\n4. All data is restored instantly.\n\nBest practice: Export after every session. Store backups in Google Drive or a cloud folder.',
            terms:[
              {t:'JSON Backup',d:'A complete export of all PoultryOS data in a portable file format. Can be imported to restore the exact state.'},
            ]
          },
          {
            title:'Configuring Mortality Alert Threshold',
            preview:'Set the mortality rate that triggers an alert on the Command Center.',
            body:'1. Go to Settings & Backup > Settings tab.\n2. Find "Mortality Alert Threshold (%)"\n3. Enter your desired threshold (default: 2.0%).\n4. Click Save Settings.\n\nWhen cumulative mortality for any active batch exceeds this percentage, the Command Center shows a warning banner and the notification bell increments.\n\nTypical thresholds by production type:\n- Commercial Broiler: 2–3%\n- Commercial Layer: 1–2% (monthly)\n- Breeder: 1–1.5%',
            terms:[
              {t:'Mortality Threshold',d:'The cumulative mortality rate percentage at which a Command Center alert is triggered.'},
            ]
          },
        ]
      },
      {
        id:'terms',label:'Glossary',icon:'glossary',
        topics:[
          {
            title:'Key Terms — Poultry Production',
            preview:'Definitions of all important terms used in PoultryOS.',
            body:'FCR (Feed Conversion Ratio): Total feed consumed (kg) ÷ total live weight gain (kg). Lower = more efficient. Target 1.6–1.8 for broilers.\n\nBiomass: Estimated total live weight of the current batch = Current Count × Estimated Weight per bird.\n\nLaying Rate: Percentage of hens producing eggs on a given day = Eggs Collected ÷ Current Hen Count × 100. Not directly tracked in PoultryOS but derivable from egg logs.\n\nPeak Production: The period (usually weeks 28–45 for layers) when daily egg output is highest.\n\nDOC: Day-Old Chick — birds received on placement day.\n\nP&L: Profit and Loss — total revenue minus total cost for a batch.\n\nMortality Rate: Total deaths ÷ initial count × 100. Cumulative for the batch lifetime.',
            terms:[]
          },
          {
            title:'Status Definitions',
            preview:'What Active, Quarantined, Sold, and Closed mean for a batch.',
            body:'Active: Birds are alive, healthy (or under observation), and in production. All engines fully operational.\n\nQuarantined: Batch is isolated due to disease concern. Still trackable but flagged critically on the Command Center. Cannot be interacted with for sales until quarantine is lifted.\n\nSold: Birds have been sold. Batch is closed for operational data entry but remains in Financials for P&L reporting.\n\nClosed: Batch cycle has ended (birds disposed, cycle completed). Historical data retained. No longer counted as active stock.',
            terms:[]
          },
        ]
      },
    ]
  },

  hatchery:{
    accent:T.info,
    moduleName:'HatcheryOS',
    tagline:'Chick Production Operating System',
    overview:'HatcheryOS manages the complete lifecycle of egg hatching — from egg intake through incubation, candling, hatch output, chick processing, vaccination, inventory, and financials. Each egg batch moves through defined lifecycle stages with full traceability at every step.',
    sections:[
      {
        id:'overview',label:'Module Overview',icon:'overview',
        topics:[
          {
            title:'What is HatcheryOS?',
            preview:'HatcheryOS tracks every stage from egg intake to DOC delivery.',
            body:'HatcheryOS organizes work around Egg Batches — groups of eggs received from a breeder farm on a single date. Each batch moves through a defined lifecycle:\n\nReceived → Incubating → Candling → Transfer → Hatching → Hatched → Processing\n\nEach stage has its own engine with dedicated data entry and KPI tracking. The Command Center shows the live pipeline across all active batches.\n\nAll data is stored locally. No internet connection is required. Export backups via Settings > Backup & Data after each session.',
            terms:[
              {t:'Egg Batch',d:'A group of eggs received from one source farm on one date. The primary unit of tracking in HatcheryOS.'},
              {t:'DOC',d:'Day-Old Chick — the output of a successful hatch, ready for dispatch to poultry farms.'},
              {t:'Setter',d:'The incubation machine used during the first 18 days of the cycle.'},
              {t:'Hatcher',d:'The machine used for the final 3 days (Day 18–21) before hatch.'},
            ]
          },
          {
            title:'Lifecycle Stages Explained',
            preview:'Understand what happens at each stage of the egg batch lifecycle.',
            body:'Received: Eggs have arrived from the breeder farm. Grading completed (good eggs vs. rejected).\n\nIncubating: Graded eggs are set in a setter. Temperature (37.7–37.8°C) and humidity (55–60%) are maintained for Days 1–18.\n\nCandling: At Day 7 (configurable), eggs are inspected under bright light. Fertile, infertile, and dead embryos are counted.\n\nTransfer: At Day 18 (configurable), eggs are moved from setter to hatcher trays. Position is changed to horizontal for pip and hatch.\n\nHatching: Days 18–21. Chicks are emerging. No disturbance to the hatcher.\n\nHatched: Pull day. Chicks are removed and processed.\n\nProcessing: Grading, vaccination (Marek\'s Disease), sexing (if applicable), and packing into chick boxes.',
            terms:[]
          },
        ]
      },
      {
        id:'getting-started',label:'Getting Started',icon:'start',
        topics:[
          {
            title:'Recording Your First Egg Intake',
            preview:'Step-by-step: receive eggs and create your first batch.',
            body:'1. Open the Egg Intake engine.\n2. Click "+ Record Intake."\n3. Enter: Source Farm/Breeder name, Farm/Company name, Breed (e.g., Ross 308, Isa Brown), Date Received.\n4. Enter Total Qty received from the supplier.\n5. Enter Rejected count — cracked, undersized, or contaminated eggs.\n6. Graded count (settable eggs) auto-calculates as Total minus Rejected. You can override it.\n7. Add any quality observations in Notes.\n8. Click Record Intake.\n\nThe batch number auto-generates (e.g., HEB-2025-001) or you can enter your own.',
            terms:[
              {t:'Graded (Settable)',d:'Eggs that passed quality inspection and are suitable for incubation. Total Received minus Rejected.'},
              {t:'Rejected',d:'Eggs discarded before setting — cracked shell, undersized, double yolk, or contaminated.'},
            ]
          },
          {
            title:'Starting Incubation',
            preview:'How to set eggs in a machine and track the incubation cycle.',
            body:'1. Go to the Incubation engine.\n2. Click "+ Set Batch."\n3. Select the egg batch you just received.\n4. Select the Setter/Incubator (SET-A, SET-B, etc.).\n5. Enter the Set Date (usually same day or day after receipt).\n6. Record Temperature (°C) and Humidity (%) for reference.\n7. Click Start Incubation.\n\nThe system automatically calculates the expected hatch date = Set Date + Incubation Days (configured in Settings, default 21).\n\nA progress bar on the incubation card shows days elapsed vs. total incubation period.',
            terms:[
              {t:'Set Date',d:'The date eggs are placed in the setter. Day 1 of the incubation cycle.'},
              {t:'Expected Hatch Date',d:'Set Date + Incubation Days. Calculated automatically.'},
            ]
          },
        ]
      },
      {
        id:'daily-ops',label:'Operations',icon:'daily',
        topics:[
          {
            title:'Candling — Recording Fertility',
            preview:'How to log candling results and interpret the fertility rate.',
            body:'Candling is performed at Day 7 (configurable in Settings). Each egg is held over a bright light source:\n- Fertile eggs show veining or embryo movement\n- Infertile eggs appear clear\n- Early dead embryos show a blood ring\n- Late dead embryos show a dark mass\n\nTo record:\n1. Go to Candling engine > "+ Record Candling."\n2. Select the batch and date.\n3. Enter Total Candled.\n4. Enter counts for Infertile, Early Dead, Late Dead.\n5. Fertile count auto-calculates (Total minus all losses) or you can override.\n6. Click Save Candling.\n\nFertility Rate = Fertile ÷ Total Candled × 100. Target ≥ 90%. Batches below target trigger a Command Center alert.',
            terms:[
              {t:'Fertility Rate',d:'Fertile eggs ÷ total candled × 100. Indicates breeder flock quality. Target ≥ 90%.'},
              {t:'Blood Ring',d:'Sign of early embryo death — a ring of blood vessels visible when candled. Logged as Early Dead.'},
            ]
          },
          {
            title:'Recording Hatch Output',
            preview:'How to log the number of chicks hatched and calculate hatchability.',
            body:'After the hatch window (Day 21 for chickens):\n1. Go to Hatch Output engine > "+ Record Hatch."\n2. Select the egg batch.\n3. Enter Hatch Date and Eggs Set (defaults to the graded count).\n4. Enter Total Hatched.\n5. Enter Culls (live but unviable chicks) and Defects.\n6. If chicks were sexed, check the box and enter Male/Female counts.\n7. Click Record Hatch.\n\nHatchability = Total Hatched ÷ Eggs Set × 100. Industry target ≥ 85%.\nHatch Rate (on Fertile) = Total Hatched ÷ Fertile Eggs × 100. Target ≥ 90%.',
            terms:[
              {t:'Hatchability',d:'Total chicks hatched ÷ eggs set × 100. The primary hatchery performance metric.'},
              {t:'Hatch Rate',d:'Total chicks hatched ÷ fertile eggs × 100. Measures incubation efficiency on viable eggs.'},
              {t:'Culls',d:'Live chicks at hatch that are too weak, underweight, or deformed to survive. Not dispatched.'},
            ]
          },
          {
            title:'Processing, Vaccination, and Packing',
            preview:'Record what happens to chicks after they hatch.',
            body:'Processing happens immediately after pull (removing chicks from the hatcher):\n\n1. Go to Vaccination & Processing > "+ Record Processing."\n2. Select the egg batch (must have status Hatched).\n3. The chick count from the hatch record auto-fills.\n4. Enter Chicks Graded (quality sort count).\n5. Enter Packed for Delivery (chicks going into boxes).\n6. Enter Post Culls (chicks culled during processing).\n7. Under Vaccines, add each vaccine administered:\n   - Marek\'s Disease (SQ Injection at 0.2 ml/chick) is pre-filled — it must always be given at hatch.\n   - Add any additional vaccines if required.\n8. Click Save Processing.\n\nTotal DOC Output = Packed count. This is your saleable product.',
            terms:[
              {t:'Pull Day',d:'The day chicks are removed from the hatcher — typically Day 21 or when 95% of fertile eggs have hatched.'},
              {t:'Marek\'s Disease',d:'A mandatory Day 0 vaccination given at the hatchery. Prevents a common and fatal herpesvirus in poultry.'},
            ]
          },
          {
            title:'Managing Hatchery Inventory',
            preview:'Track vaccines, disinfectants, packaging, and equipment.',
            body:'The Inventory engine tracks all consumables used in hatchery operations.\n\nCategories: Vaccine, Equipment, Disinfectant, Packaging, PPE, Consumable.\n\nTo add an item:\n1. Click "+ Add Item."\n2. Enter item name, category, unit (dose, litre, box), current stock, reorder level, and cost per unit.\n3. Click Add Item.\n\nTo adjust stock:\n- Use the +/- buttons on each item card for quick adjustments after using supplies.\n- Reorder items when a new delivery arrives to update the stock.\n\nStock status:\n- OK: Above reorder level\n- Low: At or below reorder level → Command Center warning\n- Out: Zero stock → Command Center critical alert',
            terms:[
              {t:'Reorder Level',d:'The stock quantity that triggers a Low alert. Set this to the minimum buffer you need to avoid running out.'},
            ]
          },
        ]
      },
      {
        id:'financials',label:'Financials',icon:'finance',
        topics:[
          {
            title:'Tracking Hatchery Costs and Revenue',
            preview:'How to log procurement costs, incubation costs, and chick sales.',
            body:'All financial entries are tagged to an egg batch.\n\nCost categories: Egg Procurement, Incubation, Labor, Utilities, Vaccination, Packaging, Transport, Other.\nRevenue categories: Chick Sales, Infertile Egg Sales, Culled Chick Sales, Other.\n\nTo add an entry:\n1. Go to Financials > "+ Add Entry."\n2. Select the egg batch.\n3. Select Cost or Revenue and the category.\n4. Enter amount and date.\n5. Click Save Entry.\n\nThe Batch Profitability table shows Revenue, Cost, and Net P&L for every batch at a glance.',
            terms:[
              {t:'Cost per DOC',d:'Total batch cost ÷ total DOC produced. Calculated per batch — essential for pricing sold chicks.'},
            ]
          },
        ]
      },
      {
        id:'settings',label:'Settings & Backup',icon:'settings',
        topics:[
          {
            title:'Configuring Incubation Parameters',
            preview:'Set incubation days, candle day, and transfer day for your species.',
            body:'In HatcheryOS Settings you can configure:\n\nIncubation Days (default 21): Total days from set to hatch.\n- Chickens: 21 days\n- Turkeys: 28 days\n- Ducks: 28 days\n- Guinea fowl: 26–28 days\n\nCandle Day (default 7): When the "Mark Candling" button activates on incubation cards.\n\nTransfer Day (default 18): When the "Transfer to Hatcher" action activates.\n\nTarget Fertility (default 90%): Below this triggers an alert.\nTarget Hatchability (default 85%): Below this triggers an alert.\nTarget Hatch Rate (default 80%): Below this triggers an alert.',
            terms:[]
          },
        ]
      },
      {
        id:'terms',label:'Glossary',icon:'glossary',
        topics:[
          {
            title:'Hatchery Terms Reference',
            preview:'All important hatchery terminology defined clearly.',
            body:'Setter: Incubation machine for Days 1–18. Eggs are placed vertically and turned automatically every 1–2 hours.\n\nHatcher: Machine for Days 18–21. Eggs are laid horizontal. No turning. Higher humidity for pip and hatch.\n\nPip: When a chick breaks through the air cell membrane and begins breathing. External pip = the first crack in the shell.\n\nHatch Window: The 12–24 hour period during which most chicks in a batch hatch. Typically Day 20.5–21.5.\n\nFertility Rate: Fertile ÷ Total Candled × 100. Reflects breeder flock quality and egg storage/transport conditions.\n\nHatchability: Hatched ÷ Eggs Set × 100. Overall measure of hatchery performance.\n\nFertile Hatchability (Hatch Rate): Hatched ÷ Fertile × 100. Measures incubation machine and management quality.\n\nEmbryonic Mortality: Embryos that died during incubation. Early dead (Days 1–7), mid dead (Days 8–14), late dead (Days 15–18).',
            terms:[]
          },
        ]
      },
    ]
  },

  feedmill:{
    accent:'#2F4A6D',
    moduleName:'FeedMillOS',
    tagline:'Feed Production Operating System',
    overview:'FeedMillOS manages the complete feed manufacturing workflow — from recipe formulation through raw material intake, production batching, quality control, finished inventory, and distribution. Every batch is fully costed and traceable from raw ingredient to farm delivery.',
    sections:[
      {
        id:'overview',label:'Module Overview',icon:'overview',
        topics:[
          {
            title:'What is FeedMillOS?',
            preview:'FeedMillOS manages feed manufacturing from recipe to farm delivery.',
            body:'FeedMillOS organizes work around two parallel tracks:\n\n1. Recipe Library: Your library of feed formulations with ingredient composition, target nutritional specs, and version history.\n\n2. Production Batches: Individual production runs against a recipe. Each batch has a target quantity, actual output, and efficiency tracking.\n\nSupporting these are:\n- Raw Material Inventory: Track ingredient stocks with reorder alerts\n- Quality Control: Record moisture, PDI, uniformity per batch\n- Finished Inventory: Manage packaged feed with FIFO dispatch\n- Distribution: Track deliveries to farms and customers\n- Financials: Full cost and revenue P&L per batch\n\nAll data is stored locally. Export backups via Settings > Backup & Data after each session.',
            terms:[
              {t:'PDI',d:'Pellet Durability Index — the percentage of pellets that remain intact after tumbling. Industry standard ≥ 88%.'},
              {t:'FIFO',d:'First In, First Out — dispatching oldest stock first to minimize expiry risk.'},
              {t:'Inclusion Rate',d:'The percentage of each ingredient in a complete feed formula. All inclusions must sum to exactly 100%.'},
            ]
          },
          {
            title:'Engine Overview',
            preview:'What each section does and when to use it.',
            body:'Formulation & Recipe: Define and version your feed formulas. Set target Crude Protein (CP%) and Metabolizable Energy (ME kcal/kg).\n\nRaw Materials: Receive and track all input ingredients with stock levels, reorder alerts, and value.\n\nProduction Batch: Start and complete production runs. Record actual output against target. Completed batches auto-create finished inventory.\n\nQuality Control: Record moisture content, PDI, uniformity, and contamination check for each batch. Pass/Fail determination is automatic.\n\nFinished Inventory: View packaged feed with quantity, location, production date, and expiry. Alerts for near-expiry stock.\n\nDistribution: Dispatch feed to farms (internal) or external customers. Deducts from finished inventory.\n\nFinancials: Log production costs (raw materials, labor, energy) and revenue (feed sales) per batch. View cost per kg and batch P&L.',
            terms:[]
          },
        ]
      },
      {
        id:'getting-started',label:'Getting Started',icon:'start',
        topics:[
          {
            title:'Creating Your First Feed Recipe',
            preview:'How to define a complete feed formula with ingredients and targets.',
            body:'1. Go to Formulation & Recipe > "+ New Recipe."\n2. Enter a Recipe Name (e.g., "Broiler Starter v2.1").\n3. Select Feed Type (Broiler, Layer, Grower, etc.).\n4. Enter Version (e.g., v1.0).\n5. Enter Target CP% (Crude Protein) and Target ME (kcal/kg) for your nutritional goals.\n6. Add Ingredients row by row:\n   - Ingredient name, Percentage inclusion, Purpose (Energy, Protein, Mineral, etc.)\n   - The running total must reach exactly 100%\n   - Include a "Moisture" ingredient to account for expected moisture loss/content\n7. Click Save Recipe.\n\nTip: Standard Broiler Starter composition: Maize 55%, Soybean Meal 28%, Fish Meal 5%, Palm Oil 3%, Limestone 1.5%, DCP 2%, Salt 0.3%, Premix 0.25%, Lysine 0.2%, Methionine 0.15%, Toxin Binder 0.1%, Moisture 4.5%.',
            terms:[
              {t:'CP%',d:'Crude Protein percentage — the total protein content of the finished feed. Target varies: Broiler Starter ~22%, Layer Mash ~16%.'},
              {t:'ME',d:'Metabolizable Energy in kcal/kg — the energy available to the bird. Broiler Starter ~3050 kcal/kg, Layer ~2750 kcal/kg.'},
            ]
          },
          {
            title:'Receiving Raw Materials',
            preview:'How to stock ingredients before running a production batch.',
            body:'1. Go to Raw Materials > "+ Record Intake."\n2. Enter Material Name (e.g., Maize), Category (Grain, Protein, Fat, Mineral, etc.).\n3. Enter Supplier, Unit (kg, litre), Quantity Received, Reorder Level.\n4. Enter Cost per Unit for accurate batch costing.\n5. Set Quality Grade (A, B, C, Rejected) and Moisture % for grain quality tracking.\n6. Click Record Intake.\n\nStock adjustments: Use the +100/-100 buttons for quick adjustments, or record a new intake for large deliveries.\n\nStock status:\n- OK: Above reorder level\n- Low: At or below reorder level → Command Center warning\n- Critical: Zero stock → Command Center critical alert\n\nThe stock value summary shows total inventory value across all materials.',
            terms:[
              {t:'Reorder Level',d:'The minimum stock quantity at which you need to order more. Setting this correctly ensures you never run out during production.'},
              {t:'Moisture Content',d:'The water content of grain (usually 12–14%). Higher moisture increases spoilage risk and reduces effective nutrient concentration.'},
            ]
          },
          {
            title:'Running a Production Batch',
            preview:'Start, monitor, and complete a feed production run.',
            body:'1. Go to Production Batch > "+ Start Batch."\n2. Select a Feed Recipe (must be Active status).\n3. Enter Target Quantity in kg.\n4. Select the Mill/Line (MILL-A, MILL-B, etc.).\n5. Enter the Lead Operator name.\n6. Click Start Production.\n\nThe batch is now "In Progress." Other staff can continue operations.\n\nWhen production finishes:\n1. Find the batch card in Production Batch.\n2. Enter Actual Quantity produced (kg).\n3. Click Complete.\n\nA Finished Inventory entry is automatically created with a 90-day default expiry.\n\nProduction Efficiency = Actual Qty ÷ Target Qty × 100. Target ≥ 95%. Lower efficiency indicates dust losses, spillage, or equipment issues.',
            terms:[
              {t:'Production Efficiency',d:'Actual output ÷ target output × 100. Losses below 95% typically come from dust, spillage, or moisture changes.'},
            ]
          },
        ]
      },
      {
        id:'daily-ops',label:'Operations',icon:'daily',
        topics:[
          {
            title:'Quality Control — Passing a Batch',
            preview:'How QC works and what Pass vs Fail means.',
            body:'QC is performed after each completed batch before dispatching to farms.\n\n1. Go to Quality Control > "+ Record QC."\n2. Select the production batch.\n3. Enter Moisture Content (%). Pass threshold: ≤ 14%.\n4. Enter PDI — Pellet Durability Index (%). Pass threshold: ≥ 88%.\n5. Select Uniformity: Excellent, Good, Fair, or Poor.\n6. Record Contaminants (default: None).\n7. Click Save QC.\n\nPass/Fail is automatic:\n- PASS: Moisture ≤ 14% AND PDI ≥ 88%\n- FAIL: Either parameter outside specification\n\nFailed batches trigger a critical alert in the notification system. The finished inventory entry still exists — you decide operationally whether to reprocess, blend, or discount.',
            terms:[
              {t:'Moisture Content',d:'Water % in finished feed. Above 14% risks mold and mycotoxin development in storage.'},
              {t:'PDI',d:'Pellet Durability Index — % of pellets surviving tumbling intact. Below 88% means excess fines reducing feed efficiency.'},
            ]
          },
          {
            title:'Dispatching Finished Feed (FIFO)',
            preview:'How to record feed deliveries to farms and external customers.',
            body:'FeedMillOS uses FIFO (First In, First Out) dispatch to manage feed shelf life.\n\n1. Go to Distribution > "+ Record Dispatch."\n2. Under Feed Stock, the dropdown shows available batches sorted oldest-first (by production date). Always select the oldest available stock.\n3. Enter Date, Destination (farm or customer name), Destination Type (Internal = PoultryOS farm, External = outside customer).\n4. Enter Quantity (kg) to dispatch.\n5. The system checks you are not dispatching more than available stock.\n6. Remaining quantity and status update automatically:\n   - Partial: Some stock remains\n   - Depleted: All dispatched\n7. Click Record Dispatch.\n\nTip: Feed marked with an expiry warning (≤ 14 days remaining) should be prioritized for immediate dispatch.',
            terms:[
              {t:'FIFO',d:'First In, First Out — always dispatch the oldest batch first to minimize the risk of feed expiring in store.'},
              {t:'Internal Transfer',d:'Dispatching to your own PoultryOS farm operation. Shows as "Internal (PoultryOS)" in destination type.'},
            ]
          },
        ]
      },
      {
        id:'financials',label:'Financials',icon:'finance',
        topics:[
          {
            title:'Costing a Production Batch',
            preview:'How to build an accurate cost per kg for each batch produced.',
            body:'All financial entries are tagged to a production batch.\n\nCost categories: Raw Materials, Labor, Energy, Overhead, Maintenance, Transport, Packaging, Other.\nRevenue categories: Feed Sales, Waste Recovery, Other.\n\nFor accurate Cost Per kg:\n1. Log Raw Material cost (your primary cost).\n2. Log Labor cost for the production shift.\n3. Log Energy cost (electricity/gas for the run).\n4. Log any Packaging or Transport costs.\n\nCost Per kg = Total Batch Cost ÷ Actual Qty Produced.\n\nThe Batch Profitability table shows Cost Per kg alongside Revenue, Total Cost, and Net P&L for every batch. This is the key number for setting your feed selling price.',
            terms:[
              {t:'Cost per kg',d:'Total production cost divided by kg produced. Your minimum selling price floor.'},
            ]
          },
        ]
      },
      {
        id:'settings',label:'Settings & Backup',icon:'settings',
        topics:[
          {
            title:'Setting Production Targets',
            preview:'Configure efficiency targets and alert thresholds.',
            body:'In FeedMillOS Settings:\n\nTarget Efficiency (%): Default 95%. When a completed batch falls below this, a Command Center warning appears. Adjust based on your mill type and acceptable loss rates.\n\nCurrency and Weight Unit: Set to match your operation (NGN/kg is default for Nigerian operations).\n\nMill Identity: Enter your mill name for identification on records and reports.\n\nAlerts: Toggle production and stock alerts on or off.',
            terms:[]
          },
          {
            title:'Backing Up FeedMillOS Data',
            preview:'How to export and restore your complete FeedMillOS data.',
            body:'1. Go to Settings & Backup > Backup & Data tab.\n2. Click "Download Backup."\n3. A JSON file containing all recipes, raw materials, batches, QC, inventory, distribution, and financial data is saved.\n\nTo restore:\n1. Go to Settings & Backup > Backup & Data tab.\n2. Click "Import Backup" and select your JSON file.\n3. All data is instantly restored.\n\nBackup after every session. FeedMillOS stores data in browser memory — it will be lost if you close or refresh the browser tab without exporting.',
            terms:[]
          },
        ]
      },
      {
        id:'terms',label:'Glossary',icon:'glossary',
        topics:[
          {
            title:'Feed Manufacturing Terms',
            preview:'Definitions of all key terms used in FeedMillOS.',
            body:'CP (Crude Protein): The total protein content of feed, measured as percentage. Broiler Starter ~22%, Broiler Finisher ~19%, Layer Mash ~16%.\n\nME (Metabolizable Energy): Energy available to the bird in kcal/kg. Drives growth rate and egg production. Broiler feeds typically 2950–3100 kcal/kg.\n\nPremix: A concentrated blend of vitamins and minerals added at low inclusion (typically 0.25%). Supplies micronutrients not present in sufficient quantities in base ingredients.\n\nToxin Binder: An additive that adsorbs mycotoxins (mold toxins from grain) in the bird\'s digestive tract, preventing absorption. Critical for grain-based feeds.\n\nPDI (Pellet Durability Index): % pellets surviving a standardized tumbling test intact. Low PDI = excess feed fines = waste and reduced intake efficiency.\n\nFCR Impact: Feed quality directly affects the FCR of birds consuming it. High-quality, well-pelleted feed with correct nutrient density drives lower FCR and better production.',
            terms:[]
          },
        ]
      },
    ]
  }
};

// ── Search across all sections for a query
function searchHelp(cfg, query){
  if(!query.trim()) return [];
  const q = query.toLowerCase();
  const results = [];
  cfg.sections.forEach(sec=>{
    sec.topics.forEach(topic=>{
      const titleMatch = topic.title.toLowerCase().includes(q);
      const bodyMatch = topic.body.toLowerCase().includes(q);
      const previewMatch = topic.preview.toLowerCase().includes(q);
      const termMatch = topic.terms && topic.terms.some(t=>
        t.t.toLowerCase().includes(q) || t.d.toLowerCase().includes(q)
      );
      if(titleMatch || bodyMatch || previewMatch || termMatch){
        // Extract a context snippet from body
        let snippet = topic.preview;
        if(bodyMatch){
          const bi = topic.body.toLowerCase().indexOf(q);
          const start = Math.max(0, bi-40);
          const raw = topic.body.substring(start, bi+80);
          snippet = (start>0?'…':'')+raw+(raw.length<120?'':'…');
        }
        results.push({
          sectionId: sec.id,
          sectionLabel: sec.label,
          sectionIcon: sec.icon,
          title: topic.title,
          snippet,
          topic
        });
      }
    });
  });
  return results;
}

// ── Main HelpDocEngine

function HelpDocEngine({module}){
  const cfg = HELP_CONTENT[module] || HELP_CONTENT.poultry;
  const accent = cfg.accent;
  const accentBg = accent===T.ok?T.okBg:accent===T.info?T.infoBg:'#DCE9FF';
  const accentLine = accent===T.ok?T.okLine:accent===T.info?T.infoLine:'#DCE9FF';

  const [activeSec, setActiveSec] = useState(cfg.sections[0].id);
  const [activeTopic, setActiveTopic] = useState(null);
  const [search, setSearch] = useState('');

  const isSearching = search.trim().length > 0;
  const searchResults = isSearching ? searchHelp(cfg, search) : [];
  const currentSection = cfg.sections.find(s=>s.id===activeSec) || cfg.sections[0];

  // Group search results by section
  const resultsBySec = {};
  searchResults.forEach(r=>{
    if(!resultsBySec[r.sectionId])
      resultsBySec[r.sectionId]={label:r.sectionLabel,icon:r.sectionIcon,items:[]};
    resultsBySec[r.sectionId].items.push(r);
  });

  function highlight(text, query){
    if(!query||!text) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if(idx<0) return text;
    return(
      <span>
        {text.slice(0,idx)}
        <mark style={{background:'#FFFBEB',color:T.ink,padding:'0 2px',fontWeight:600}}>{text.slice(idx,idx+query.length)}</mark>
        {text.slice(idx+query.length)}
      </span>
    );
  }

  // ── TOPIC DETAIL VIEW ──────────────────────────────────
  if(activeTopic){
    const tp = activeTopic;
    return(
      <div style={{display:'flex',flexDirection:'column',gap:0,animation:'fadeUp .18s ease'}}>

        {/* Back nav */}
        <button onClick={()=>setActiveTopic(null)}
          style={{display:'inline-flex',alignItems:'center',gap:7,background:'none',border:'none',cursor:'pointer',color:T.ink3,fontSize:12,fontWeight:600,padding:'0 0 16px',fontFamily:'inherit',minHeight:36,width:'fit-content'}}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={T.ink4} strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><path d="M15 18l-6-6 6-6"/></svg>
          Back to Help
        </button>

        {/* Article header — editorial */}
        <div style={{padding:'4px 2px 22px',marginBottom:0,borderBottom:`1px solid ${T.line}`}}>
          <div style={{fontSize:10,fontWeight:700,color:accent,textTransform:'uppercase',letterSpacing:1.6,marginBottom:10}}>{cfg.moduleName} · Documentation</div>
          <div style={{fontSize:22,fontWeight:800,color:T.ink,lineHeight:1.2,letterSpacing:-0.5}}>{tp.title}</div>
        </div>

        {/* Article body */}
        <div style={{padding:'24px 2px 24px',marginBottom:tp.terms&&tp.terms.length?0:0}}>
          {tp.body.split('\n').filter(Boolean).map((para,i)=>{
            const isHeader = para.endsWith(':') && para.length<70 && !para.startsWith('-') && !para.match(/^\d/);
            const isBullet = para.startsWith('- ') || para.startsWith('• ');
            const isNumbered = /^\d+\./.test(para);
            if(isHeader) return(
              <div key={i} style={{fontSize:10,fontWeight:700,color:T.ink4,textTransform:'uppercase',letterSpacing:1,marginTop:i>0?20:0,marginBottom:8,paddingBottom:6,borderBottom:`1px solid ${T.line}`}}>{para}</div>
            );
            if(isBullet) return(
              <div key={i} style={{display:'flex',gap:10,fontSize:13,color:T.ink3,lineHeight:1.7,marginBottom:5}}>
                <span style={{width:5,height:5,background:accent,borderRadius:'50%',flexShrink:0,marginTop:8}}/>
                <span>{para.slice(2)}</span>
              </div>
            );
            if(isNumbered){
              const match = para.match(/^(\d+)\.\s(.*)/);
              return(
                <div key={i} style={{display:'flex',gap:12,fontSize:13,color:T.ink3,lineHeight:1.7,marginBottom:10}}>
                  <div style={{width:22,height:22,background:accent,color:'#fff',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1,borderRadius:0}}>{match?match[1]:''}</div>
                  <div style={{flex:1,paddingTop:2}}>{match?match[2]:para}</div>
                </div>
              );
            }
            return <p key={i} style={{fontSize:13,color:T.ink3,lineHeight:1.8,marginBottom:10,marginTop:0}}>{para}</p>;
          })}
        </div>

        {/* Glossary terms */}
        {tp.terms&&tp.terms.length>0&&(
          <div style={{padding:'20px 22px',background:T.bg1,border:`1px solid ${T.line}`,marginBottom:0}}>
            <div style={{fontSize:10,fontWeight:700,color:T.ink4,textTransform:'uppercase',letterSpacing:1.4,marginBottom:14,paddingBottom:10,borderBottom:`1px solid ${T.line}`}}>Key Terms</div>
            {tp.terms.map((term,i)=>(
              <div key={i} style={{display:'flex',gap:18,padding:'12px 0',borderTop:i>0?`1px solid ${T.line}`:'none',alignItems:'flex-start'}}>
                <span style={{fontSize:12,fontWeight:700,color:T.ink,minWidth:130,flexShrink:0,lineHeight:1.5,letterSpacing:-0.1}}>{term.t}</span>
                <span style={{fontSize:12,color:T.ink3,lineHeight:1.7}}>{term.d}</span>
              </div>
            ))}
          </div>
        )}

        {/* Article footer notice */}
        <div style={{marginTop:18,padding:'14px 16px',background:T.bg2,border:`1px solid ${T.line}`,display:'flex',alignItems:'flex-start',gap:11}}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={T.ink4} strokeWidth="1.75" strokeLinecap="square" style={{flexShrink:0,marginTop:1}}><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
          <span style={{fontSize:11,color:T.ink4,lineHeight:1.6}}>Export backups regularly via <strong style={{color:T.ink3,fontWeight:700}}>Settings › Backup &amp; Data</strong>. Data is in-memory and will not survive a page refresh.</span>
        </div>
      </div>
    );
  }

  // ── MAIN HELP VIEW ─────────────────────────────────────
  return(
    <div style={{display:'flex',flexDirection:'column',gap:0}}>

      {/* Hero header — editorial style */}
      <div style={{padding:'4px 2px 22px',marginBottom:18,borderBottom:`1px solid ${T.line}`}}>
        <div style={{fontSize:10,fontWeight:700,color:accent,textTransform:'uppercase',letterSpacing:1.6,marginBottom:10}}>{cfg.moduleName} · Knowledge Base</div>
        <div style={{fontSize:24,letterSpacing:-0.6,lineHeight:1.15,marginBottom:8}}>
          <span style={{color:T.ink,fontWeight:800,letterSpacing:-0.8}}>Help</span><span style={{color:T.ink3,fontWeight:300}}> &amp; Documentation</span>
        </div>
        <div style={{fontSize:13,color:T.ink3,lineHeight:1.6,maxWidth:560}}>{cfg.overview.slice(0,140)}…</div>
      </div>

      {/* Search bar */}
      <div style={{position:'relative',marginBottom:18}}>
        <div style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={isSearching?accent:T.ink4} strokeWidth="1.75" strokeLinecap="square"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        </div>
        <input
          value={search}
          onChange={e=>{setSearch(e.target.value);setActiveTopic(null);}}
          placeholder={`Search ${cfg.moduleName} documentation…`}
          style={{width:'100%',background:T.bg0,border:`1px solid ${isSearching?accent:T.line}`,padding:'12px 40px',fontSize:13,color:T.ink,outline:'none',fontFamily:'inherit',transition:'border-color .15s,box-shadow .15s',boxShadow:isSearching?`0 0 0 3px ${accent}14`:'none',boxSizing:'border-box'}}
        />
        {isSearching&&(
          <button onClick={()=>setSearch('')}
            style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:T.ink4,width:24,height:24,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,lineHeight:1,fontFamily:'inherit'}}>×</button>
        )}
      </div>

      {/* ── SEARCH STATE ── */}
      {isSearching&&(
        <div style={{display:'flex',flexDirection:'column',gap:0}} className="au">
          {searchResults.length===0?(
            <div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'40px 24px',textAlign:'center'}}>
              <div style={{width:52,height:52,background:T.bg2,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px'}}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={T.ink4} strokeWidth="1.75" strokeLinecap="square"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M8 11h6M11 8v6"/></svg>
              </div>
              <div style={{fontSize:14,fontWeight:700,color:T.ink3,marginBottom:4}}>No results for "{search}"</div>
              <div style={{fontSize:12,color:T.ink4}}>Try different keywords, or browse sections below after clearing search.</div>
            </div>
          ):(
            <>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                <div style={{fontSize:12,fontWeight:700,color:accent}}>{searchResults.length}</div>
                <div style={{fontSize:12,color:T.ink4}}>result{searchResults.length!==1?'s':''} for "<span style={{color:T.ink,fontWeight:500}}>{search}</span>"</div>
              </div>
              {Object.entries(resultsBySec).map(([secId,sec])=>(
                <div key={secId} style={{marginBottom:14}}>
                  {/* Section grouping header */}
                  <div style={{display:'flex',alignItems:'center',gap:8,padding:'7px 0 7px 12px',borderLeft:`2px solid ${T.lineMid}`,marginBottom:6}}>
                    <HelpSectionIcon id={sec.icon} size={18} color={T.ink4}/>
                    <span style={{fontSize:11,fontWeight:700,color:T.ink,textTransform:'uppercase',letterSpacing:.7}}>{sec.label}</span>
                    <span style={{marginLeft:'auto',fontSize:10,color:T.ink4,background:T.bg0,border:`1px solid ${T.line}`,padding:'1px 7px',fontWeight:600}}>{sec.items.length}</span>
                  </div>
                  {sec.items.map((r,i)=>(
                    <button key={i} onClick={()=>setActiveTopic(r.topic)}
                      style={{width:'100%',display:'flex',alignItems:'flex-start',gap:12,padding:'12px 14px',background:T.bg0,border:`1px solid ${T.line}`,borderTop:i>0?'none':'',cursor:'pointer',fontFamily:'inherit',textAlign:'left',transition:'background .1s'}}
                      onMouseEnter={e=>e.currentTarget.style.background=T.bg1}
                      onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                      <div style={{width:6,height:6,background:accent,borderRadius:'50%',flexShrink:0,marginTop:6}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:T.ink,lineHeight:1.3,marginBottom:4}}>{highlight(r.title,search)}</div>
                        <div style={{fontSize:11,color:T.ink4,lineHeight:1.6,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{highlight(r.snippet,search)}</div>
                      </div>
                      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={T.ink4} strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" style={{flexShrink:0,marginTop:4}}><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── BROWSE STATE ── */}
      {!isSearching&&(
        <>
          {/* Section tab strip */}
          <div style={{display:'flex',gap:0,overflowX:'auto',WebkitOverflowScrolling:'touch',borderBottom:`1px solid ${T.line}`,marginBottom:14}}>
            {cfg.sections.map(sec=>{
              const active = activeSec===sec.id;
              return(
                <button key={sec.id}
                  onClick={()=>{setActiveSec(sec.id);setActiveTopic(null);}}
                  style={{display:'flex',alignItems:'center',gap:6,padding:'9px 13px',border:'none',borderBottom:`2.5px solid ${active?accent:'transparent'}`,background:'transparent',cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:active?700:400,color:active?accent:T.ink3,marginBottom:-1,whiteSpace:'nowrap',flexShrink:0,transition:'color .12s'}}>
                  <HelpSectionIcon id={sec.icon} size={18} color={T.ink4}/>
                  {sec.label}
                </button>
              );
            })}
          </div>

          {/* Section header — clean editorial style */}
          <div style={{padding:'2px 2px 14px',marginBottom:12,display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:32,height:32,background:accentBg,border:`1px solid ${accentLine}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <HelpSectionIcon id={currentSection.icon} size={16} color={accent}/>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:700,color:T.ink,letterSpacing:-0.2,lineHeight:1.2}}>{currentSection.label}</div>
              <div style={{fontSize:11,color:T.ink4,marginTop:3,letterSpacing:0.2}}>{currentSection.topics.length} article{currentSection.topics.length!==1?'s':''}</div>
            </div>
          </div>

          {/* Topic cards — refined editorial style */}
          <div style={{display:'flex',flexDirection:'column',gap:0,border:`1px solid ${T.line}`,background:T.bg0}} className="au" key={activeSec}>
            {currentSection.topics.map((topic,i)=>(
              <button key={i} onClick={()=>setActiveTopic(topic)}
                style={{display:'flex',gap:0,background:T.bg0,border:'none',borderTop:i>0?`1px solid ${T.line}`:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left',transition:'background .12s',width:'100%',padding:0}}
                onMouseEnter={e=>{e.currentTarget.style.background=T.bg1;}}
                onMouseLeave={e=>{e.currentTarget.style.background=T.bg0;}}>
                {/* Index number */}
                <div style={{width:48,padding:'18px 0',display:'flex',alignItems:'flex-start',justifyContent:'center',flexShrink:0}}>
                  <span className="mono" style={{fontSize:11,fontWeight:600,color:T.ink4,letterSpacing:0.5}}>{String(i+1).padStart(2,'0')}</span>
                </div>
                {/* Content */}
                <div style={{flex:1,padding:'16px 18px 16px 0',minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:700,color:T.ink,lineHeight:1.35,marginBottom:6,letterSpacing:-0.1}}>{topic.title}</div>
                  <div style={{fontSize:12,color:T.ink4,lineHeight:1.6}}>{topic.preview}</div>
                  {topic.terms&&topic.terms.length>0&&(
                    <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:10}}>
                      {topic.terms.slice(0,4).map(t=>(
                        <span key={t.t} style={{fontSize:10,padding:'3px 8px',background:T.bg2,color:T.ink3,fontWeight:600,letterSpacing:0.3}}>{t.t}</span>
                      ))}
                    </div>
                  )}
                </div>
                {/* Arrow */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'0 18px',flexShrink:0}}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={T.ink4} strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter"><path d="M9 18l6-6-6-6"/></svg>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Footer tip */}
      <div style={{marginTop:18,padding:'14px 16px',background:T.bg2,border:`1px solid ${T.line}`,display:'flex',gap:11,alignItems:'flex-start'}}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={T.ink4} strokeWidth="1.75" strokeLinecap="square" style={{flexShrink:0,marginTop:1}}><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
        <span style={{fontSize:11,color:T.ink4,lineHeight:1.6}}>Data is stored in-memory. <strong style={{color:T.ink3,fontWeight:700}}>Export a backup</strong> via Settings › Backup &amp; Data after every session to prevent data loss.</span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  batchStats — PoultryOS batch aggregation utility
// ══════════════════════════════════════════════════════════
function batchStats(bId,state){
  const mort=state.mortalityLogs.filter(m=>m.batchId===bId);
  const feed=state.feedLogs.filter(f=>f.batchId===bId);
  const fin=state.financialLogs.filter(f=>f.batchId===bId);
  const b=state.batches.find(x=>x.id===bId)||{};
  const totalMort=mort.reduce((s,m)=>s+m.count,0);
  const mortRate=b.initialCount>0?pct(totalMort,b.initialCount):'0.0';
  const totalFeed=feed.reduce((s,f)=>s+f.qty,0);
  const feedCost=feed.reduce((s,f)=>s+(f.qty*f.costPerKg),0);
  const age=b.startDate?daysDiff(b.startDate):0;
  const estWtKg=b.type==='Broiler'?Math.min(3.2,(age*0.055+0.04)):0;
  const biomassKg=estWtKg*(b.currentCount||0);
  const fcr=b.type==='Broiler'&&biomassKg>0&&totalFeed>0?(totalFeed/biomassKg).toFixed(2):'—';
  const eggRevLogs=fin.filter(f=>f.type==='Revenue'&&f.category==='Egg Sales');
  const eggRev=eggRevLogs.reduce((s,f)=>s+Number(f.amount),0);
  const totalCost=fin.filter(f=>f.type==='Cost').reduce((s,f)=>s+Number(f.amount),0);
  const totalRev=fin.filter(f=>f.type==='Revenue').reduce((s,f)=>s+Number(f.amount),0);
  const profit=totalRev-totalCost;
  return{totalMort,mortRate,totalFeed,feedCost,age,estWtKg,biomassKg,fcr,totalCost,totalRev,profit,eggRev};
}

// ══════════════════════════════════════════════════════════
//  LEGAL DOCUMENTS
// ══════════════════════════════════════════════════════════

const LEGAL_DOCS={
  eula:{
    id:'eula',title:'End User License Agreement (EULA)',lastUpdated:'01 June 2026',
    sections:[
      {heading:'1. Parties',body:'This End User License Agreement ("Agreement") is between AgoroX Technologies ("Licensor") and the entity that has activated PoultrySuite Africa ("Licensee").'},
      {heading:'2. Grant of License',body:'Subject to payment of applicable fees, Licensor grants Licensee a non-exclusive, non-transferable, device-bound license to use PoultrySuite Africa solely for internal business operations on the licensed device.\n\nYou may not: (a) sublicense or sell the Software; (b) decompile or reverse-engineer; (c) use on unlicensed devices without prior written consent.'},
      {heading:'3. License Tiers and Modules',body:'The Software is available under Single, Professional, and Enterprise tiers enabling access to PoultryOS, HatcheryOS, and FeedMillOS. Access to modules outside your tier is prohibited and constitutes a material breach.'},
      {heading:'4. Subscription and Renewal',body:'Licenses are annual, commencing on activation. Upon expiry, access is restricted until renewal. Data is not deleted on expiry.'},
      {heading:'5. Data Ownership',body:'All operational data entered by Licensee remains the sole property of Licensee. Licensor makes no claim to this data. Licensee is solely responsible for maintaining backups using the export functionality provided.'},
      {heading:'6. Data Storage',body:'PoultrySuite Africa is an offline-first, device-local application. Operational data is stored in browser memory and must be exported by Licensee to persist beyond the session.'},
      {heading:'7. Intellectual Property',body:'The Software, including all source code, algorithms, UI elements, logos, and documentation, is the exclusive intellectual property of AgoroX Technologies, protected under Nigerian and international IP law.'},
      {heading:'8. Warranty disclaimer',body:'The software is provided "as is" without warranty of any kind. Licensor disclaims all implied warranties of merchantability and fitness for a particular purpose.'},
      {heading:'9. Limitation of liability',body:'Licensor shall not be liable for any indirect, incidental, or consequential damages. Aggregate liability shall not exceed license fees paid in the preceding 12 months.'},
      {heading:'10. Governing Law',body:'This Agreement is governed by the laws of the Federal Republic of Nigeria.'},
      {heading:'11. Contact',body:'AgoroX Technologies\nIbadan, Nigeria\nEmail: legal@agorox.africa'},
    ]
  },
  privacy:{
    id:'privacy',title:'Privacy Policy',lastUpdated:'01 June 2026',
    sections:[
      {heading:'1. Introduction',body:'AgoroX Technologies is committed to protecting your privacy. This Policy explains how PoultrySuite Africa handles information when you use the Software.'},
      {heading:'2. Information We Collect',body:'Profile Information: During registration you provide name, farm name, phone, email, and location. This is stored locally on your device and used only to generate your license certificate.\n\nOperational Data: All farm records are created by you and stored entirely on your device. We do not collect or access this data.\n\nDevice Identifier: A unique identifier is generated locally to bind your license to your device. It is not transmitted to our servers.'},
      {heading:'3. How We Use Information',body:'Profile information is used only to generate your license certificate and verify license authenticity. We do not use your information for marketing or analytics. We do not sell or share your personal information with any third party except where required by law.'},
      {heading:'4. Data Storage',body:'PoultrySuite Africa is offline-first. All data is stored in your device browser storage. You are solely responsible for maintaining backups. We cannot recover data lost without a backup file.'},
      {heading:'5. Payment Data',body:'License payments are processed through Paystack, a PCI-DSS compliant payment processor. We do not collect or store card details. All payment data is handled securely by Paystack under their privacy policy.'},
      {heading:'6. Cookies and Tracking',body:'PoultrySuite Africa does not use cookies, web analytics, tracking pixels, or any third-party tracking technologies.'},
      {heading:'7. Your Rights',body:'You have the right to: (a) access your personal information; (b) correct inaccurate profile information; (c) delete your data by clearing browser local storage; (d) export your data at any time.'},
      {heading:'8. Contact',body:'Data Privacy Officer\nAgoroX Technologies\nIbadan, Nigeria\nEmail: privacy@agorox.africa'},
    ]
  },
  ip:{
    id:'ip',title:'Intellectual Property Policy',lastUpdated:'01 June 2026',
    sections:[
      {heading:'1. Ownership',body:'PoultrySuite Africa, including all source code, algorithms, UI designs, logos, trademarks, and documentation, is the exclusive intellectual property of AgoroX Technologies, protected under the Copyright Act of Nigeria (Cap. C28 LFN 2004) and applicable international conventions.'},
      {heading:'2. Trademarks',body:'"PoultrySuite Africa," "PoultryOS," "HatcheryOS," and "FeedMillOS" are trademarks of AgoroX Technologies. Unauthorized use may constitute trademark infringement.'},
      {heading:'3. Restrictions',body:'Licensee may not: (a) copy or create derivative works from the Software; (b) sell or distribute any intellectual property embodied therein; (c) remove copyright or trademark notices; (d) register similar marks without written permission.'},
      {heading:'4. User-Generated Content',body:'Licensee retains all IP rights in operational data entered into the Software. Licensor makes no claim to user-generated content.'},
      {heading:'5. Enforcement',body:'AgoroX Technologies actively monitors for unauthorized use and will take appropriate legal action to protect its rights, including seeking injunctive relief and damages.'},
      {heading:'6. Contact',body:'Intellectual Property Department\nAgoroX Technologies\nIbadan, Nigeria\nEmail: ip@agorox.africa'},
    ]
  }
};

function LegalDocViewer({doc,onClose}){
  return(
    <div style={{display:"flex",flexDirection:"column",background:T.bg0,minHeight:400}}>
      <div style={{borderBottom:`1px solid ${T.line}`,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,background:T.bg0}}>
        <button onClick={onClose} style={{display:"flex",alignItems:"center",justifyContent:"center",width:44,height:44,background:"none",border:`1px solid ${T.line}`,cursor:"pointer",flexShrink:0}}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={T.ink3} strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter"><path d="M15 3L3 12L15 21"/></svg>
        </button>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,color:T.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.title}</div>
          <div style={{fontSize:10,color:T.ink4,marginTop:2}}>Last Updated: {doc.lastUpdated}</div>
        </div>
      </div>
      <div style={{padding:"20px 16px 40px"}}>
        <div style={{borderLeft:`3px solid ${T.line}`,paddingLeft:14,marginBottom:24}}>
          <div style={{fontSize:16,fontWeight:700,color:T.ink,marginBottom:6}}>{doc.title}</div>
          <div style={{fontSize:11,color:T.ink4}}>PoultrySuite Africa · AgoroX Technologies</div>
          <div style={{fontSize:11,color:T.ink4,marginTop:2}}>Effective Date: {doc.lastUpdated}</div>
        </div>
        {doc.sections.map((sec,i)=>(
          <div key={i} style={{marginBottom:20}}>
            <div style={{fontSize:11,fontWeight:700,color:T.ink,marginBottom:6,textTransform:"uppercase",letterSpacing:.7,paddingBottom:5,borderBottom:`1px solid ${T.line}`}}>{sec.heading}</div>
            <div style={{fontSize:13,color:T.ink3,lineHeight:1.8,whiteSpace:"pre-line",marginTop:6}}>{sec.body}</div>
          </div>
        ))}
        <div style={{marginTop:28,paddingTop:16,borderTop:`1px solid ${T.line}`,textAlign:"center"}}>
          <div style={{fontSize:11,color:T.ink4,lineHeight:1.7}}>
            <div style={{fontWeight:600,color:T.ink3,marginBottom:3}}>AgoroX Technologies</div>
            <div>PoultrySuite Africa · Ibadan, Nigeria</div>
            <div>© 2026 All Rights Reserved</div>
          </div>
        </div>
      </div>
    </div>
  );
}
function LegalSettingsPanel(){
  const [openDoc,setOpenDoc]=useState(null);
  const docs=[
    {key:'eula',label:'End User License Agreement',subtitle:'Licensing terms and conditions of use'},
    {key:'privacy',label:'Privacy Policy',subtitle:'How we handle your personal information'},
    {key:'ip',label:'Intellectual Property Policy',subtitle:'Ownership rights and usage restrictions'},
  ];
  if(openDoc) return <LegalDocViewer doc={LEGAL_DOCS[openDoc]} onClose={()=>setOpenDoc(null)}/>;
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{border:`1px solid ${T.line}`,padding:'16px 18px'}}>
        <div style={{fontSize:13,fontWeight:700,color:T.ink,marginBottom:4}}>Legal Documents</div>
        <div style={{fontSize:12,color:T.ink4,lineHeight:1.6}}>Review the legal agreements governing your use of PoultrySuite Africa.</div>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:1,border:`1px solid ${T.line}`,overflow:'hidden'}}>
        {docs.map((doc,i)=>(
          <button key={doc.key} onClick={()=>setOpenDoc(doc.key)}
            style={{display:'flex',alignItems:'center',gap:14,padding:'15px 18px',background:'transparent',border:'none',borderTop:i>0?`1px solid ${T.line}`:'none',cursor:'pointer',fontFamily:'inherit',textAlign:'left',transition:'background 0.1s'}}
            onMouseEnter={e=>e.currentTarget.style.background=T.bg1}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <div style={{width:24,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
              {doc.key==='eula'&&<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={T.ink4} strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter"><rect x="4" y="2" width="16" height="20"/><path d="M8 7H16M8 11H16M8 15H12"/></svg>}
              {doc.key==='privacy'&&<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={T.ink4} strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
              {doc.key==='ip'&&<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={T.ink4} strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter"><rect x="3" y="3" width="18" height="18"/><path d="M9 9H12C12 9 14 9 14 11C14 13 12 13 12 13V15"/><rect x="11" y="17" width="2" height="2"/></svg>}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:T.ink,lineHeight:1.2}}>{doc.label}</div>
              <div style={{fontSize:11,color:T.ink4,marginTop:3}}>{doc.subtitle}</div>
              <div style={{fontSize:10,color:T.ink4,marginTop:2}}>Last Updated: {LEGAL_DOCS[doc.key].lastUpdated}</div>
            </div>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={T.ink4} strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter" style={{flexShrink:0}}><path d="M4 12H20M14 6L20 12L14 18"/></svg>
          </button>
        ))}
      </div>
      <div style={{border:`1px solid ${T.line}`,padding:'13px 16px',display:'flex',gap:10,alignItems:'flex-start'}}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={T.ink4} strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter" style={{flexShrink:0,marginTop:1}}><rect x="3" y="3" width="18" height="18"/><path d="M12 8V13M12 16H12.01"/></svg>
        <div style={{fontSize:12,color:T.ink3,lineHeight:1.6}}>By continuing to use PoultrySuite Africa you agree to all three documents above. Contact <span style={{fontWeight:600,color:T.ink}}>legal@agorox.africa</span> with any questions.</div>
      </div>
    </div>
  );
}




// ══════════════════════════════════════════════════════════
//  POULTRY OS — Seed Data & Reducer
// ══════════════════════════════════════════════════════════
const PS_SEED={
  houses:[{id:'H001',name:'House Alpha',type:'Broiler',capacity:15000,status:'Active',notes:''},{id:'H002',name:'House Beta',type:'Layer',capacity:10000,status:'Active',notes:''}],
  batches:[{id:'BT001',houseId:'H001',name:'Batch Jan-A',breed:'Ross 308',source:'Crown Hatchery',type:'Broiler',initialCount:12000,currentCount:11856,startDate:'2025-01-05',status:'Active',notes:''},{id:'BT002',houseId:'H002',name:'Batch Dec-B',breed:'Isa Brown',source:'Gold Hatchery',type:'Layer',initialCount:8500,currentCount:8412,startDate:'2024-12-10',status:'Active',notes:''}],
  mortalityLogs:[{id:'M001',batchId:'BT001',date:'2025-01-28',count:10,cause:'Heat Stress',notes:''},{id:'M002',batchId:'BT001',date:'2025-01-27',count:8,cause:'Natural',notes:''},{id:'M003',batchId:'BT002',date:'2025-01-28',count:4,cause:'Natural',notes:''}],
  feedLogs:[{id:'FL001',batchId:'BT001',date:'2025-01-28',feedType:'Broiler Finisher',qty:480,costPerKg:420,notes:''},{id:'FL002',batchId:'BT002',date:'2025-01-28',feedType:'Layer Mash',qty:340,costPerKg:390,notes:''}],
  feedTypes:['Broiler Starter','Broiler Grower','Broiler Finisher','Layer Mash','Layer Concentrate','Chick Mash','Pre-Starter'],
  vaccinations:[{id:'V001',batchId:'BT001',vaccine:'Newcastle (HB1)',method:'Intra-Ocular',dueDate:'2025-01-12',status:'Done',adminDate:'2025-01-12',dosePerBird:1,notes:''},{id:'V002',batchId:'BT001',vaccine:'Newcastle Booster',method:'Drinking Water',dueDate:'2025-02-09',status:'Pending',adminDate:'',dosePerBird:1,notes:''},{id:'V003',batchId:'BT002',vaccine:'Fowl Pox',method:'Wing Web Stab',dueDate:'2025-01-31',status:'Pending',adminDate:'',dosePerBird:1,notes:''}],
  healthLogs:[{id:'HL001',batchId:'BT002',date:'2025-01-25',symptom:'Reduced Feed Intake',severity:'Mild',treatment:'Vitamin B complex in water',status:'Resolved',quarantine:false,notes:''}],
  financialLogs:[{id:'FIN001',batchId:'BT001',date:'2025-01-05',type:'Cost',category:'Procurement',amount:3600000,notes:'DOC 12,000 x N300'},{id:'FIN002',batchId:'BT001',date:'2025-01-05',type:'Cost',category:'Feed',amount:1200000,notes:''},{id:'FIN003',batchId:'BT002',date:'2024-12-10',type:'Cost',category:'Procurement',amount:1700000,notes:'DOC 8,500 x N200'},{id:'FIN004',batchId:'BT002',date:'2025-01-20',type:'Revenue',category:'Egg Sales',amount:520000,qty:400,notes:'400 crates'}],
  auditLog:[{id:'AL001',ts:new Date(Date.now()-7200000).toISOString(),user:'System',action:'PoultryOS initialized',entity:'System',entityId:'',prev:null,next:null}],
  settings:{orgName:'',location:'',currency:'NGN',currencySymbol:'N',weightUnit:'kg',defaultBatchType:'Broiler',mortalityThreshold:2.0,eggProductionThreshold:75,feedStockDaysThreshold:3,reminderDays:2,enableAlerts:true,enableVaxReminder:true},
};


// ══════════════════════════════════════════════════════════
//  POULTRY OS ENGINES
// ══════════════════════════════════════════════════════════

function CommandCenter({state,dispatch,dataMode}){
  const {batches,mortalityLogs,feedLogs,vaccinations,healthLogs,financialLogs,settings}=state;
  const today=todayStr();
  const active=batches.filter(b=>b.status==='Active');
  const quar=batches.filter(b=>b.status==='Quarantined');
  const totalBirds=active.reduce((s,b)=>s+(Number(b.currentCount)||0),0);
  const totalMort=mortalityLogs.reduce((s,m)=>s+m.count,0);
  const totalInitial=batches.reduce((s,b)=>s+(Number(b.initialCount)||0),0);
  const mortRate=totalInitial>0?pct(totalMort,totalInitial):'0.0';
  const overdueMort=parseFloat(mortRate)>=(settings.mortalityThreshold||2.0);
  const overdueVax=vaccinations.filter(v=>v.status!=='Done'&&v.dueDate<today);
  const dueVax=vaccinations.filter(v=>v.status!=='Done'&&v.dueDate>=today&&daysDiff(today,v.dueDate)<=2);
  const totalFeed=feedLogs.reduce((s,f)=>s+(f.qty||0),0);
  const totalRev=financialLogs.filter(f=>f.type==='Revenue').reduce((s,f)=>s+Number(f.amount),0);
  const totalCost=financialLogs.filter(f=>f.type==='Cost').reduce((s,f)=>s+Number(f.amount),0);
  const netPL=totalRev-totalCost;
  const layingBatches=batches.filter(b=>isLayingBatch(b));
  const eggSaleLogs=financialLogs.filter(f=>f.category==='Egg Sales'&&f.qty>0);
  const totalCrates=eggSaleLogs.reduce((s,f)=>s+(f.qty||0),0);
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      {dataMode==='demo'&&<div style={{background:T.warnBg,border:`1px solid ${T.warnLine}`,padding:'8px 14px',fontSize:12,color:T.warn,fontWeight:600}}>Demo Mode — sample data displayed</div>}
      {quar.length>0&&<div style={{background:T.errBg,border:`1px solid ${T.errLine}`,padding:'10px 14px',display:'flex',gap:10,alignItems:'center'}}><svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={T.err} strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter"><rect x="3" y="3" width="18" height="18"/><path d="M12 8V13M12 16H12.01"/></svg><span style={{fontSize:13,fontWeight:600,color:T.err}}>Quarantine Active: {quar.map(b=>b.name).join(', ')}</span></div>}
      {overdueMort&&<div style={{background:T.warnBg,border:`1px solid ${T.warnLine}`,padding:'10px 14px',fontSize:12,color:T.warn}}>Mortality rate {mortRate}% exceeds threshold {settings.mortalityThreshold||2.0}%</div>}
      {overdueVax.length>0&&<div style={{background:T.warnBg,border:`1px solid ${T.warnLine}`,padding:'10px 14px',fontSize:12,color:T.warn}}>{overdueVax.length} vaccination{overdueVax.length>1?'s':''} overdue</div>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10}}>
        <KPICard label="Active Batches" value={active.length} alert={quar.length>0}/>
        <KPICard label="Live Birds" value={fmtN(totalBirds)} alert={false}/>
        <KPICard label="Mortality Rate" value={mortRate+'%'} alert={overdueMort}/>
        <KPICard label="Total Feed (kg)" value={fmtN(totalFeed)}/>
        <KPICard label="Net P&L" value={ngn(Math.abs(netPL))} sub={netPL>=0?'Profit':'Loss'} alert={netPL<0}/>
        {layingBatches.length>0&&<KPICard label="Egg Crates" value={fmtN(totalCrates)} sub="all time"/>}
      </div>
      <div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'14px 16px'}}>
        <div style={{fontSize:12,fontWeight:700,color:T.ink4,textTransform:'uppercase',letterSpacing:.7,marginBottom:10}}>Active Batches</div>
        {active.length===0?<EmptyState title="No active batches" sub="Add a house and create your first batch"/>:
        active.map(b=>{const s=batchStats(b.id,state);return(
          <div key={b.id} style={{display:'flex',gap:12,alignItems:'center',padding:'10px 0',borderBottom:`1px solid ${T.line}`}}>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:T.ink}}>{b.name}</div>
              <div style={{fontSize:11,color:T.ink4}}>{b.breed} · {b.type} · Day {s.age}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div className="mono" style={{fontSize:14,fontWeight:700,color:T.ink}}>{fmtN(b.currentCount)}</div>
              <div style={{fontSize:11,color:T.ink4}}>birds</div>
            </div>
            <BatchPill batch={b}/>
          </div>
        );})}
      </div>
      {dueVax.length>0&&<div style={{background:T.bg0,border:`1px solid ${T.warnLine}`,padding:'14px 16px'}}>
        <div style={{fontSize:12,fontWeight:700,color:T.warn,textTransform:'uppercase',letterSpacing:.7,marginBottom:8}}>Vaccinations Due</div>
        {dueVax.slice(0,5).map(v=>(<div key={v.id} style={{fontSize:12,color:T.ink3,padding:'4px 0',borderBottom:`1px solid ${T.line}`}}>{v.vaccine} — {fmtDate(v.dueDate)} — {batches.find(b=>b.id===v.batchId)?.name||'Unknown'}</div>))}
      </div>}
    </div>
  );
}

function HouseBatchEngine({state,dispatch,licenseCapacity=0}){
  const {houses,batches}=state;
  const [tab,setTab]=useState('houses');
  const [showAddHouse,setShowAddHouse]=useState(false);
  const [showAddBatch,setShowAddBatch]=useState(false);
  const [editHouseId,setEditHouseId]=useState(null);
  const [editBatchId,setEditBatchId]=useState(null);
  const [selHouse,setSelHouse]=useState(null);
  const [houseForm,setHouseForm]=useState({name:'',type:'Broiler',capacity:'',notes:''});
  const [batchForm,setBatchForm]=useState({name:'',breed:'',source:'',type:'Broiler',initialCount:'',startDate:todayStr(),notes:''});
  const [houseErr,setHouseErr]=useState('');
  const [batchErr,setBatchErr]=useState('');

  // ── Capacity helpers ──
  const totalHouseCapacity=houses.reduce((s,h)=>s+(Number(h.capacity)||0),0);
  const licenseRemaining=Math.max(0,Number(licenseCapacity||0)-totalHouseCapacity);
  const houseOccupancy=(houseId,excludeBatchId=null)=>batches.filter(b=>b.houseId===houseId&&b.status==='Active'&&b.id!==excludeBatchId).reduce((s,b)=>s+(Number(b.initialCount)||0),0);
  const houseRemaining=(houseId)=>{const h=houses.find(x=>x.id===houseId);if(!h)return 0;return Math.max(0,Number(h.capacity||0)-houseOccupancy(houseId));};

  const saveHouse=()=>{
    setHouseErr('');
    if(!houseForm.name.trim()||!houseForm.capacity){setHouseErr('House name and capacity are required.');return;}
    const newCap=Number(houseForm.capacity);
    if(newCap<=0){setHouseErr('Capacity must be greater than zero.');return;}
    // For edits: exclude current house from total; also check that new capacity >= current occupancy
    const otherHousesCapacity=editHouseId?houses.filter(h=>h.id!==editHouseId).reduce((s,h)=>s+(Number(h.capacity)||0),0):totalHouseCapacity;
    if(Number(licenseCapacity)>0&&(otherHousesCapacity+newCap)>Number(licenseCapacity)){
      const avail=Math.max(0,Number(licenseCapacity)-otherHousesCapacity);
      setHouseErr(`Total house capacity (${fmtN(otherHousesCapacity+newCap)}) would exceed your licensed bird capacity (${fmtN(licenseCapacity)}). Available: ${fmtN(avail)} birds.`);
      return;
    }
    if(editHouseId){
      const occ=houseOccupancy(editHouseId);
      if(newCap<occ){
        setHouseErr(`New capacity (${fmtN(newCap)}) cannot be less than current in-use total (${fmtN(occ)} birds). Close or reduce active batches first.`);
        return;
      }
      const existing=houses.find(h=>h.id===editHouseId);
      dispatch({type:'UPDATE_HOUSE',p:{...existing,name:houseForm.name.trim(),type:houseForm.type,capacity:newCap,notes:houseForm.notes}});
      setEditHouseId(null);
    }else{
      const h={id:uid('H'),name:houseForm.name.trim(),type:houseForm.type,capacity:newCap,status:'Active',notes:houseForm.notes};
      dispatch({type:'ADD_HOUSE',p:h});
    }
    setHouseForm({name:'',type:'Broiler',capacity:'',notes:''});
    setShowAddHouse(false);
  };

  const saveBatch=()=>{
    setBatchErr('');
    if(!batchForm.name.trim()||!batchForm.initialCount||!selHouse){setBatchErr('Batch name, initial count, and a selected house are required.');return;}
    const newCount=Number(batchForm.initialCount);
    if(newCount<=0){setBatchErr('Initial count must be greater than zero.');return;}
    const h=houses.find(x=>x.id===selHouse);
    if(!h){setBatchErr('Selected house not found.');return;}
    const currentOccupancy=houseOccupancy(selHouse,editBatchId);
    if((currentOccupancy+newCount)>Number(h.capacity||0)){
      setBatchErr(`Batch size (${fmtN(newCount)}) would exceed ${h.name}'s capacity. Capacity: ${fmtN(h.capacity)} · In use (others): ${fmtN(currentOccupancy)} · Available: ${fmtN(Math.max(0,h.capacity-currentOccupancy))} birds.`);
      return;
    }
    if(editBatchId){
      const existing=batches.find(b=>b.id===editBatchId);
      if(!existing){setBatchErr('Batch not found.');return;}
      // Total mortalities recorded against this batch
      const totalMort=(state.mortalityLogs||[]).filter(m=>m.batchId===editBatchId).reduce((s,m)=>s+(Number(m.count)||0),0);
      const minimumViable=Math.max(0,(Number(existing.currentCount)||0)+totalMort);
      if(newCount<minimumViable){
        setBatchErr(`Initial count (${fmtN(newCount)}) cannot be less than birds already accounted for: current ${fmtN(existing.currentCount)} + ${fmtN(totalMort)} recorded mortalities = ${fmtN(minimumViable)} birds.`);
        return;
      }
      const delta=newCount-(Number(existing.initialCount)||0);
      const newCurrent=Math.max(0,(Number(existing.currentCount)||0)+delta);
      dispatch({type:'UPDATE_BATCH',p:{...existing,name:batchForm.name.trim(),breed:batchForm.breed,source:batchForm.source,type:batchForm.type,initialCount:newCount,currentCount:newCurrent,startDate:batchForm.startDate,notes:batchForm.notes}});
      setEditBatchId(null);
    }else{
      const b={id:uid('BT'),houseId:selHouse,name:batchForm.name.trim(),breed:batchForm.breed,source:batchForm.source,type:batchForm.type,initialCount:newCount,currentCount:newCount,startDate:batchForm.startDate,status:'Active',notes:batchForm.notes};
      dispatch({type:'ADD_BATCH',p:b});
    }
    setBatchForm({name:'',breed:'',source:'',type:'Broiler',initialCount:'',startDate:todayStr(),notes:''});
    setShowAddBatch(false);
  };

  const openAddHouse=()=>{setHouseErr('');setEditHouseId(null);setHouseForm({name:'',type:'Broiler',capacity:'',notes:''});setShowAddHouse(true);};
  const openEditHouse=(h)=>{setHouseErr('');setEditHouseId(h.id);setHouseForm({name:h.name,type:h.type,capacity:String(h.capacity),notes:h.notes||''});setShowAddHouse(true);};
  const openAddBatch=()=>{setBatchErr('');setEditBatchId(null);setBatchForm({name:'',breed:'',source:'',type:'Broiler',initialCount:'',startDate:todayStr(),notes:''});if(selHouse)setShowAddBatch(true);};
  const openEditBatch=(b)=>{setBatchErr('');setEditBatchId(b.id);setSelHouse(b.houseId);setBatchForm({name:b.name,breed:b.breed||'',source:b.source||'',type:b.type,initialCount:String(b.initialCount),startDate:b.startDate,notes:b.notes||''});setShowAddBatch(true);};
  const closeHouseModal=()=>{setShowAddHouse(false);setHouseErr('');setEditHouseId(null);};
  const closeBatchModal=()=>{setShowAddBatch(false);setBatchErr('');setEditBatchId(null);};

  return(
    <div>
      <TabBar tabs={[{id:'houses',label:'Houses'},{id:'batches',label:'Batches'}]} active={tab} onChange={setTab}/>
      {tab==='houses'&&(<>
        {Number(licenseCapacity)>0&&<div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'10px 14px',marginBottom:12,fontSize:12,color:T.ink3,display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
          <span>Licensed capacity: <strong style={{color:T.ink}}>{fmtN(licenseCapacity)} birds</strong></span>
          <span>Allocated to houses: <strong style={{color:T.ink}}>{fmtN(totalHouseCapacity)}</strong></span>
          <span>Available: <strong style={{color:licenseRemaining>0?T.ok:T.err}}>{fmtN(licenseRemaining)}</strong></span>
        </div>}
        <div style={{marginBottom:12}}><Btn onClick={openAddHouse} size="sm">+ Add House</Btn></div>
        {showAddHouse&&<Modal title={editHouseId?"Edit House":"Add House"} onClose={closeHouseModal}><div style={{display:'flex',flexDirection:'column',gap:12}}>
          {Number(licenseCapacity)>0&&!editHouseId&&<Notice type="info" message={`Available licensed capacity: ${fmtN(licenseRemaining)} birds.`}/>}
          {editHouseId&&(()=>{const occ=houseOccupancy(editHouseId);const otherCap=houses.filter(h=>h.id!==editHouseId).reduce((s,h)=>s+(Number(h.capacity)||0),0);const avail=Math.max(0,Number(licenseCapacity||0)-otherCap);return(<Notice type="info" message={`Current in-use: ${fmtN(occ)} birds. Max capacity available: ${fmtN(avail)} birds.`}/>);})()}
          <Inp label="House Name *" value={houseForm.name} onChange={v=>setHouseForm(f=>({...f,name:v}))}/>
          <Sel label="Bird Type" value={houseForm.type} onChange={v=>setHouseForm(f=>({...f,type:v}))} options={['Broiler','Layer','Pullet','Breeder']}/>
          <Inp label="Capacity (birds)" type="number" value={houseForm.capacity} onChange={v=>setHouseForm(f=>({...f,capacity:v}))}/>
          {houseErr&&<Notice type="error" message={houseErr}/>}
          <Btn onClick={saveHouse} full>{editHouseId?"Save Changes":"Save House"}</Btn>
        </div></Modal>}
        {houses.length===0?<EmptyState title="No houses yet" sub="Add your first poultry house to get started"/>:
        houses.map(h=>{
          const occ=houseOccupancy(h.id);
          const rem=Math.max(0,Number(h.capacity||0)-occ);
          return(<div key={h.id} style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'14px 16px',marginBottom:8}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div><div style={{fontSize:14,fontWeight:600,color:T.ink}}>{h.name}</div><div style={{fontSize:12,color:T.ink4}}>{h.type} · Capacity: {fmtN(h.capacity)} · In use: {fmtN(occ)} · Available: {fmtN(rem)}</div></div>
              <div style={{display:'flex',gap:6}}>
                <Btn size="sm" variant="secondary" onClick={()=>openEditHouse(h)}>Edit</Btn>
                <Btn size="sm" variant="secondary" onClick={()=>{setSelHouse(h.id);setTab('batches');}}>View Batches</Btn>
              </div>
            </div>
            <div style={{fontSize:12,color:T.ink4,marginTop:6}}>Active batches: {batches.filter(b=>b.houseId===h.id&&b.status==='Active').length}</div>
          </div>);
        })}
      </>)}
      {tab==='batches'&&(<>
        {selHouse&&(()=>{const h=houses.find(x=>x.id===selHouse);if(!h)return null;const occ=houseOccupancy(selHouse);const rem=Math.max(0,Number(h.capacity||0)-occ);return(<div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'10px 14px',marginBottom:12,fontSize:12,color:T.ink3,display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
          <span>{h.name} capacity: <strong style={{color:T.ink}}>{fmtN(h.capacity)}</strong></span>
          <span>In use: <strong style={{color:T.ink}}>{fmtN(occ)}</strong></span>
          <span>Available: <strong style={{color:rem>0?T.ok:T.err}}>{fmtN(rem)} birds</strong></span>
        </div>);})()}
        <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center'}}>
          <Sel label="" value={selHouse||''} onChange={v=>setSelHouse(v||null)} options={[{value:'',label:'All Houses'},...houses.map(h=>({value:h.id,label:h.name}))]}/>
          <Btn onClick={openAddBatch} size="sm">+ New Batch</Btn>
        </div>
        {showAddBatch&&<Modal title={editBatchId?"Edit Batch":"New Batch"} onClose={closeBatchModal}><div style={{display:'flex',flexDirection:'column',gap:12}}>
          {selHouse&&(()=>{const h=houses.find(x=>x.id===selHouse);if(!h)return null;const otherOcc=houseOccupancy(selHouse,editBatchId);const avail=Math.max(0,Number(h.capacity||0)-otherOcc);return(<Notice type="info" message={`${h.name} has ${fmtN(avail)} birds of capacity available${editBatchId?' (excluding this batch)':''}.`}/>);})()}
          <Inp label="Batch Name *" value={batchForm.name} onChange={v=>setBatchForm(f=>({...f,name:v}))}/>
          <Sel label="Type" value={batchForm.type} onChange={v=>setBatchForm(f=>({...f,type:v}))} options={['Broiler','Layer','Pullet','Breeder']}/>
          <Inp label="Breed" value={batchForm.breed} onChange={v=>setBatchForm(f=>({...f,breed:v}))} placeholder="e.g. Ross 308"/>
          <Inp label="Source/Hatchery" value={batchForm.source} onChange={v=>setBatchForm(f=>({...f,source:v}))}/>
          <Inp label="Initial Count *" type="number" value={batchForm.initialCount} onChange={v=>setBatchForm(f=>({...f,initialCount:v}))}/>
          <Inp label="Start Date" type="date" value={batchForm.startDate} onChange={v=>setBatchForm(f=>({...f,startDate:v}))}/>
          {batchErr&&<Notice type="error" message={batchErr}/>}
          <Btn onClick={saveBatch} full>{editBatchId?"Save Changes":"Save Batch"}</Btn>
        </div></Modal>}
        {(selHouse?batches.filter(b=>b.houseId===selHouse):batches).length===0?<EmptyState title="No batches" sub="Select a house and add a batch"/>:
        (selHouse?batches.filter(b=>b.houseId===selHouse):batches).map(b=>(<div key={b.id} style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'14px 16px',marginBottom:8}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div><div style={{fontSize:14,fontWeight:600,color:T.ink}}>{b.name}</div><div style={{fontSize:12,color:T.ink4}}>{b.breed} · {b.type} · Started {fmtDate(b.startDate)}</div></div>
            <BatchPill batch={b}/>
          </div>
          <div style={{display:'flex',gap:16,marginTop:8}}>
            <div><div style={{fontSize:10,color:T.ink4}}>Initial</div><div className="mono" style={{fontSize:13,fontWeight:600,color:T.ink}}>{fmtN(b.initialCount)}</div></div>
            <div><div style={{fontSize:10,color:T.ink4}}>Current</div><div className="mono" style={{fontSize:13,fontWeight:600,color:T.ok}}>{fmtN(b.currentCount)}</div></div>
            <div><div style={{fontSize:10,color:T.ink4}}>Age</div><div className="mono" style={{fontSize:13,fontWeight:600,color:T.ink}}>{daysDiff(b.startDate)}d</div></div>
          </div>
          {b.status==='Quarantined'&&<div style={{marginTop:8}}><Btn size="sm" variant="danger" onClick={()=>dispatch({type:'LIFT_QUARANTINE',p:b.id})}>Lift Quarantine</Btn></div>}
          {b.status==='Active'&&<div style={{marginTop:8,display:'flex',gap:8,flexWrap:'wrap'}}><Btn size="sm" variant="secondary" onClick={()=>openEditBatch(b)}>Edit</Btn><Btn size="sm" variant="secondary" onClick={()=>dispatch({type:'UPDATE_BATCH',p:{...b,status:'Sold'}})}>Mark Sold</Btn><Btn size="sm" variant="secondary" onClick={()=>dispatch({type:'UPDATE_BATCH',p:{...b,status:'Closed'}})}>Close Batch</Btn></div>}
        </div>))}
      </>)}
    </div>
  );
}

function VaccinationEngine({state,dispatch,pendingAction,onActionConsumed}){
  const {batches,vaccinations}=state;
  const today=todayStr();
  const [showAdd,setShowAdd]=useState(false);
  const [showTemplate,setShowTemplate]=useState(false);
  const [form,setForm]=useState({batchId:'',vaccine:'',method:'Drinking Water',dueDate:today,dosePerBird:1,notes:''});
  const [tmplBatch,setTmplBatch]=useState('');
  const activeBatches=batches.filter(b=>b.status==='Active');
  // Deep-link: open the add modal or auto-mark a specific vaccination done
  useEffect(()=>{
    if(!pendingAction||!pendingAction.type)return;
    const ctx=pendingAction.context||{};
    if(pendingAction.type==='addVaccination'){
      if(ctx.vaxId){
        const v=vaccinations.find(x=>x.id===ctx.vaxId);
        if(v) setForm(f=>({...f,batchId:v.batchId,vaccine:v.vaccine,dueDate:v.dueDate}));
      }
      setShowAdd(true);
    } else if(pendingAction.type==='markVaccination'){
      if(ctx.vaxId){
        const v=vaccinations.find(x=>x.id===ctx.vaxId);
        if(v) dispatch({type:'UPDATE_VAX',p:{...v,status:'Done',adminDate:today}});
      }
    }
    if(onActionConsumed)onActionConsumed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[pendingAction]);
  const saveVax=()=>{if(!form.batchId||!form.vaccine)return;dispatch({type:'ADD_VAX',p:{id:uid('V'),batchId:form.batchId,vaccine:form.vaccine,method:form.method,dueDate:form.dueDate,status:'Pending',adminDate:'',dosePerBird:Number(form.dosePerBird)||1,notes:form.notes}});setShowAdd(false);};
  const markDone=(v)=>dispatch({type:'UPDATE_VAX',p:{...v,status:'Done',adminDate:today}});
  const applyTemplate=()=>{
    if(!tmplBatch)return;
    const b=batches.find(x=>x.id===tmplBatch);if(!b)return;
    const tmpl=VAX_TEMPLATES[b.type]||VAX_TEMPLATES.Broiler;
    const vaxList=tmpl.map(t=>{const due=new Date(b.startDate);due.setDate(due.getDate()+t.day);return{id:uid('V'),batchId:b.id,vaccine:t.vaccine,method:t.method,dueDate:due.toISOString().split('T')[0],status:t.day===0?'Done':'Pending',adminDate:t.day===0?b.startDate:'',dosePerBird:1,notes:t.note};});
    dispatch({type:'ADD_VAX_BATCH',p:vaxList,batchId:b.id});
    setShowTemplate(false);
  };
  const sorted=[...vaccinations].sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
  return(
    <div>
      <div style={{display:'flex',gap:8,marginBottom:14}}><Btn size="sm" onClick={()=>setShowAdd(true)}>+ Add Vaccine</Btn><Btn size="sm" variant="secondary" onClick={()=>setShowTemplate(true)}>Apply Template</Btn></div>
      {showAdd&&<Modal title="Add Vaccination" onClose={()=>setShowAdd(false)}><div style={{display:'flex',flexDirection:'column',gap:12}}><Sel label="Batch *" value={form.batchId} onChange={v=>setForm(f=>({...f,batchId:v}))} options={[{value:'',label:'Select Batch'},...activeBatches.map(b=>({value:b.id,label:b.name}))]}/><Inp label="Vaccine Name *" value={form.vaccine} onChange={v=>setForm(f=>({...f,vaccine:v}))}/><Sel label="Method" value={form.method} onChange={v=>setForm(f=>({...f,method:v}))} options={['Drinking Water','Intra-Ocular','IM Injection','SQ Injection','Wing Web Stab','Spray']}/><Inp label="Due Date" type="date" value={form.dueDate} onChange={v=>setForm(f=>({...f,dueDate:v}))}/><Btn onClick={saveVax} full>Save</Btn></div></Modal>}
      {showTemplate&&<Modal title="Apply Vaccination Template" onClose={()=>setShowTemplate(false)}><div style={{display:'flex',flexDirection:'column',gap:12}}><Sel label="Select Batch" value={tmplBatch} onChange={setTmplBatch} options={[{value:'',label:'Select Batch'},...activeBatches.map(b=>({value:b.id,label:b.name+' ('+b.type+')'}))]}/><div style={{fontSize:12,color:T.ink4}}>Applies standard {tmplBatch?batches.find(b=>b.id===tmplBatch)?.type:''} vaccination schedule based on batch start date.</div><Btn onClick={applyTemplate} disabled={!tmplBatch} full>Apply Template</Btn></div></Modal>}
      {sorted.length===0?<EmptyState title="No vaccinations" sub="Add vaccinations or apply a breed template"/>:
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
        <thead><tr style={{background:T.bg2}}>{['Batch','Vaccine','Method','Due','Status','Action'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',fontWeight:600,color:T.ink4,fontSize:11}}>{h}</th>)}</tr></thead>
        <tbody>{sorted.map((v,i)=>{const b=batches.find(x=>x.id===v.batchId);const over=v.status!=='Done'&&v.dueDate<today;const due=v.status!=='Done'&&!over&&daysDiff(today,v.dueDate)<=2;return(<tr key={v.id} style={{background:i%2===0?T.bg0:T.bg1,borderBottom:`1px solid ${T.line}`}}>
          <td style={{padding:'9px 10px',color:T.ink}}>{b?.name||'—'}</td>
          <td style={{padding:'9px 10px',color:T.ink}}>{v.vaccine}</td>
          <td style={{padding:'9px 10px',color:T.ink3}}>{v.method}</td>
          <td style={{padding:'9px 10px',color:over?T.err:due?T.warn:T.ink3}}>{fmtDate(v.dueDate)}</td>
          <td style={{padding:'9px 10px'}}><span style={{fontSize:10,padding:'2px 6px',background:v.status==='Done'?T.okBg:over?T.errBg:T.warnBg,color:v.status==='Done'?T.ok:over?T.err:T.warn,fontWeight:600}}>{v.status==='Done'?'Done':over?'OVERDUE':'Pending'}</span></td>
          <td style={{padding:'9px 12px'}}>{v.status!=='Done'?<Btn size="sm" onClick={()=>markDone(v)}>Done</Btn>:<span style={{fontSize:12,color:T.ok}}>Done {fmtDate(v.adminDate)}</span>}</td>
        </tr>);})}
        </tbody>
      </table></div>}
    </div>
  );
}

function FeedEngine({state,dispatch,pendingAction,onActionConsumed}){
  const {batches,feedLogs,feedTypes}=state;
  const [showAdd,setShowAdd]=useState(false);
  const [form,setForm]=useState({batchId:'',feedType:'Broiler Starter',qty:'',costPerKg:'',date:todayStr(),notes:''});
  const activeBatches=batches.filter(b=>b.status==='Active');
  // Deep-link: open the log-feed modal preselected to the batch
  useEffect(()=>{
    if(!pendingAction||!pendingAction.type)return;
    if(pendingAction.type==='logFeed'){
      const ctx=pendingAction.context||{};
      if(ctx.batchId) setForm(f=>({...f,batchId:ctx.batchId}));
      setShowAdd(true);
    }
    if(onActionConsumed)onActionConsumed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[pendingAction]);
  const save=()=>{if(!form.batchId||!form.qty)return;dispatch({type:'LOG_FEED',p:{id:uid('FL'),batchId:form.batchId,date:form.date,feedType:form.feedType,qty:Number(form.qty),costPerKg:Number(form.costPerKg)||0,notes:form.notes}});setShowAdd(false);};
  return(
    <div>
      <div style={{marginBottom:14}}><Btn size="sm" onClick={()=>setShowAdd(true)}>+ Log Feed</Btn></div>
      {showAdd&&<Modal title="Log Feed Consumption" onClose={()=>setShowAdd(false)}><div style={{display:'flex',flexDirection:'column',gap:12}}><Sel label="Batch *" value={form.batchId} onChange={v=>setForm(f=>({...f,batchId:v}))} options={[{value:'',label:'Select Batch'},...activeBatches.map(b=>({value:b.id,label:b.name}))]}/><Sel label="Feed Type" value={form.feedType} onChange={v=>setForm(f=>({...f,feedType:v}))} options={feedTypes}/><Inp label="Quantity (kg) *" type="number" value={form.qty} onChange={v=>setForm(f=>({...f,qty:v}))}/><Inp label="Cost per kg (₦)" type="number" value={form.costPerKg} onChange={v=>setForm(f=>({...f,costPerKg:v}))}/><Inp label="Date" type="date" value={form.date} onChange={v=>setForm(f=>({...f,date:v}))}/><Btn onClick={save} full>Log Feed</Btn></div></Modal>}
      {feedLogs.length===0?<EmptyState title="No feed logs" sub="Log daily feed consumption per batch"/>:
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
        <thead><tr style={{background:T.bg2}}>{['Date','Batch','Feed Type','Qty (kg)','Cost/kg','Total'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',fontWeight:600,color:T.ink4,fontSize:11}}>{h}</th>)}</tr></thead>
        <tbody>{[...feedLogs].sort((a,b)=>b.date.localeCompare(a.date)).map((f,i)=><tr key={f.id} style={{background:i%2===0?T.bg0:T.bg1,borderBottom:`1px solid ${T.line}`}}>
          <td style={{padding:'9px 10px',color:T.ink3}}>{fmtDate(f.date)}</td>
          <td style={{padding:'9px 10px',color:T.ink}}>{batches.find(b=>b.id===f.batchId)?.name||'—'}</td>
          <td style={{padding:'9px 10px',color:T.ink3}}>{f.feedType}</td>
          <td style={{padding:'9px 10px'}} className="mono">{fmtN(f.qty)}</td>
          <td style={{padding:'9px 10px'}} className="mono">{f.costPerKg?ngn(f.costPerKg):'—'}</td>
          <td style={{padding:'9px 10px'}} className="mono">{f.costPerKg?ngn(f.qty*f.costPerKg):'—'}</td>
        </tr>)}
        </tbody>
      </table></div>}
    </div>
  );
}

function HealthEngine({state,dispatch,pendingAction,onActionConsumed}){
  const {batches,healthLogs,mortalityLogs}=state;
  const [tab,setTab]=useState('health');
  const [showAddHealth,setShowAddHealth]=useState(false);
  const [showAddMort,setShowAddMort]=useState(false);
  const [hForm,setHForm]=useState({batchId:'',date:todayStr(),symptom:'',severity:'Mild',treatment:'',quarantine:false,notes:''});
  const [mForm,setMForm]=useState({batchId:'',date:todayStr(),count:'',cause:'Natural',notes:''});
  const activeBatches=batches.filter(b=>['Active','Quarantined'].includes(b.status));
  // Deep-link: open the right modal/tab if a notification asked for it
  useEffect(()=>{
    if(!pendingAction||!pendingAction.type)return;
    const ctx=pendingAction.context||{};
    if(pendingAction.type==='logMortality'){
      setTab('mortality');
      if(ctx.batchId) setMForm(f=>({...f,batchId:ctx.batchId}));
      setShowAddMort(true);
    } else if(pendingAction.type==='viewHealth'){
      setTab('health');
      if(ctx.batchId) setHForm(f=>({...f,batchId:ctx.batchId}));
      setShowAddHealth(true);
    }
    if(onActionConsumed)onActionConsumed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[pendingAction]);
  const saveHealth=()=>{if(!hForm.batchId||!hForm.symptom)return;dispatch({type:'LOG_HEALTH',p:{id:uid('HL'),batchId:hForm.batchId,date:hForm.date,symptom:hForm.symptom,severity:hForm.severity,treatment:hForm.treatment,status:'Open',quarantine:hForm.quarantine,notes:hForm.notes}});setShowAddHealth(false);};
  const saveMort=()=>{if(!mForm.batchId||!mForm.count)return;dispatch({type:'LOG_MORT',p:{id:uid('M'),batchId:mForm.batchId,date:mForm.date,count:Number(mForm.count),cause:mForm.cause,notes:mForm.notes}});setShowAddMort(false);};
  return(
    <div>
      <TabBar tabs={[{id:'health',label:'Health Events'},{id:'mortality',label:'Mortality Log'}]} active={tab} onChange={setTab}/>
      {tab==='health'&&(<>
        <div style={{marginBottom:12}}><Btn size="sm" onClick={()=>setShowAddHealth(true)}>+ Log Health Event</Btn></div>
        {showAddHealth&&<Modal title="Log Health Event" onClose={()=>setShowAddHealth(false)}><div style={{display:'flex',flexDirection:'column',gap:12}}><Sel label="Batch *" value={hForm.batchId} onChange={v=>setHForm(f=>({...f,batchId:v}))} options={[{value:'',label:'Select Batch'},...activeBatches.map(b=>({value:b.id,label:b.name}))]}/><Inp label="Symptom / Observation *" value={hForm.symptom} onChange={v=>setHForm(f=>({...f,symptom:v}))}/><Sel label="Severity" value={hForm.severity} onChange={v=>setHForm(f=>({...f,severity:v}))} options={['Mild','Moderate','Severe','Critical']}/><Inp label="Treatment Administered" value={hForm.treatment} onChange={v=>setHForm(f=>({...f,treatment:v}))}/><Inp label="Date" type="date" value={hForm.date} onChange={v=>setHForm(f=>({...f,date:v}))}/><div style={{display:'flex',gap:8,alignItems:'center',cursor:'pointer'}} onClick={()=>setHForm(f=>({...f,quarantine:!f.quarantine}))}><div style={{width:18,height:18,border:`2px solid ${hForm.quarantine?T.err:T.line}`,background:hForm.quarantine?T.err:T.bg0,display:'flex',alignItems:'center',justifyContent:'center'}}>{hForm.quarantine&&<IcoCheck size={10} color="#fff"/>}</div><span style={{fontSize:13,color:T.ink}}>Quarantine this batch</span></div><Btn onClick={saveHealth} full>Log Event</Btn></div></Modal>}
        {healthLogs.length===0?<EmptyState title="No health events" sub="Log disease observations and treatments"/>:
        healthLogs.map((h,i)=><div key={h.id} style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'14px 16px',marginBottom:8}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div><div style={{fontSize:13,fontWeight:600,color:T.ink}}>{h.symptom}</div><div style={{fontSize:11,color:T.ink4}}>{batches.find(b=>b.id===h.batchId)?.name} · {fmtDate(h.date)}</div></div>
            <span style={{fontSize:10,padding:'2px 6px',background:{Mild:T.bg2,Moderate:T.warnBg,Severe:T.errBg,Critical:T.errBg}[h.severity]||T.bg2,color:{Mild:T.ink3,Moderate:T.warn,Severe:T.err,Critical:T.err}[h.severity]||T.ink3,fontWeight:600}}>{h.severity}</span>
          </div>
          {h.treatment&&<div style={{fontSize:12,color:T.ink3,marginTop:6}}>Treatment: {h.treatment}</div>}
          {h.status==='Open'&&<div style={{marginTop:8}}><Btn size="sm" variant="secondary" onClick={()=>dispatch({type:'UPDATE_HEALTH',p:{...h,status:'Resolved'}})}>Resolve</Btn></div>}
        </div>)}
      </>)}
      {tab==='mortality'&&(<>
        <div style={{marginBottom:12}}><Btn size="sm" onClick={()=>setShowAddMort(true)}>+ Log Mortality</Btn></div>
        {showAddMort&&<Modal title="Log Mortality" onClose={()=>setShowAddMort(false)}><div style={{display:'flex',flexDirection:'column',gap:12}}><Sel label="Batch *" value={mForm.batchId} onChange={v=>setMForm(f=>({...f,batchId:v}))} options={[{value:'',label:'Select Batch'},...activeBatches.map(b=>({value:b.id,label:b.name}))]}/><Inp label="Bird Count *" type="number" value={mForm.count} onChange={v=>setMForm(f=>({...f,count:v}))}/><Sel label="Cause of Death" value={mForm.cause} onChange={v=>setMForm(f=>({...f,cause:v}))} options={['Natural','Disease','Heat Stress','Cold Stress','Injury','Culling','Unknown']}/><Inp label="Date" type="date" value={mForm.date} onChange={v=>setMForm(f=>({...f,date:v}))}/><Btn onClick={saveMort} full>Log Mortality</Btn></div></Modal>}
        {mortalityLogs.length===0?<EmptyState title="No mortality records" sub="Log bird deaths to track mortality rate"/>:
        <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead><tr style={{background:T.bg2}}>{['Date','Batch','Count','Cause'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',fontWeight:600,color:T.ink4,fontSize:11}}>{h}</th>)}</tr></thead>
          <tbody>{[...mortalityLogs].sort((a,b)=>b.date.localeCompare(a.date)).map((m,i)=><tr key={m.id} style={{background:i%2===0?T.bg0:T.bg1,borderBottom:`1px solid ${T.line}`}}>
            <td style={{padding:'9px 10px',color:T.ink3}}>{fmtDate(m.date)}</td>
            <td style={{padding:'9px 10px',color:T.ink}}>{batches.find(b=>b.id===m.batchId)?.name||'—'}</td>
            <td style={{padding:'9px 10px',color:T.err}} className="mono">{m.count}</td>
            <td style={{padding:'9px 10px',color:T.ink3}}>{m.cause}</td>
          </tr>)}
          </tbody>
        </table></div>}
      </>)}
    </div>
  );
}

function FinancialsEngine({state,dispatch}){
  const {batches,financialLogs}=state;
  const [showAdd,setShowAdd]=useState(false);
  const [form,setForm]=useState({batchId:'',date:todayStr(),type:'Cost',category:'Procurement',amount:'',notes:''});
  const costCats=['Procurement','Feed','Medication','Labor','Utilities','Maintenance','Other'];
  const revCats=['Bird Sales','Egg Sales','Manure Sales','Other'];
  const save=()=>{if(!form.batchId||!form.amount)return;dispatch({type:'ADD_FIN',p:{id:uid('FIN'),batchId:form.batchId,date:form.date,type:form.type,category:form.category,amount:Number(form.amount),notes:form.notes}});setShowAdd(false);};
  const totalRev=financialLogs.filter(f=>f.type==='Revenue').reduce((s,f)=>s+Number(f.amount),0);
  const totalCost=financialLogs.filter(f=>f.type==='Cost').reduce((s,f)=>s+Number(f.amount),0);
  return(
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
        <KPICard label="Total Revenue" value={ngn(totalRev)}/>
        <KPICard label="Total Cost" value={ngn(totalCost)}/>
        <KPICard label="Net P&L" value={ngn(Math.abs(totalRev-totalCost))} sub={totalRev>=totalCost?'Profit':'Loss'} alert={totalRev<totalCost}/>
      </div>
      <div style={{marginBottom:12}}><Btn size="sm" onClick={()=>setShowAdd(true)}>+ Add Entry</Btn></div>
      {showAdd&&<Modal title="Financial Entry" onClose={()=>setShowAdd(false)}><div style={{display:'flex',flexDirection:'column',gap:12}}>
        <Sel label="Batch *" value={form.batchId} onChange={v=>setForm(f=>({...f,batchId:v}))} options={[{value:'',label:'Select Batch'},...batches.map(b=>({value:b.id,label:b.name}))]}/>
        <Sel label="Type" value={form.type} onChange={v=>setForm(f=>({...f,type:v,category:v==='Cost'?costCats[0]:revCats[0]}))} options={['Cost','Revenue']}/>
        <Sel label="Category" value={form.category} onChange={v=>setForm(f=>({...f,category:v}))} options={form.type==='Cost'?costCats:revCats}/>
        <Inp label="Amount (₦) *" type="number" value={form.amount} onChange={v=>setForm(f=>({...f,amount:v}))}/>
        <Inp label="Date" type="date" value={form.date} onChange={v=>setForm(f=>({...f,date:v}))}/>
        <Inp label="Notes" value={form.notes} onChange={v=>setForm(f=>({...f,notes:v}))}/>
        <Btn onClick={save} full>Save Entry</Btn>
      </div></Modal>}
      {financialLogs.length===0?<EmptyState title="No financial entries" sub="Log costs and revenues per batch"/>:
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
        <thead><tr style={{background:T.bg2}}>{['Date','Batch','Type','Category','Amount'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',fontWeight:600,color:T.ink4,fontSize:11}}>{h}</th>)}</tr></thead>
        <tbody>{[...financialLogs].sort((a,b)=>b.date.localeCompare(a.date)).map((f,i)=><tr key={f.id} style={{background:i%2===0?T.bg0:T.bg1,borderBottom:`1px solid ${T.line}`}}>
          <td style={{padding:'9px 10px',color:T.ink3}}>{fmtDate(f.date)}</td>
          <td style={{padding:'9px 10px',color:T.ink}}>{batches.find(b=>b.id===f.batchId)?.name||'—'}</td>
          <td style={{padding:'9px 10px'}}><span style={{fontSize:10,padding:'2px 6px',background:f.type==='Revenue'?T.okBg:T.errBg,color:f.type==='Revenue'?T.ok:T.err,fontWeight:600}}>{f.type}</span></td>
          <td style={{padding:'9px 10px',color:T.ink3}}>{f.category}</td>
          <td style={{padding:'9px 10px',color:f.type==='Revenue'?T.ok:T.err}} className="mono">{ngn(f.amount)}</td>
        </tr>)}
        </tbody>
      </table></div>}
    </div>
  );
}

function AuditEngine({state}){
  const {auditLog}=state;
  return(
    <div>
      {auditLog.length===0?<EmptyState title="No audit records" sub="All system actions will appear here"/>:
      auditLog.map((a,i)=><div key={a.id||i} style={{display:'flex',gap:12,padding:'10px 0',borderBottom:`1px solid ${T.line}`,alignItems:'flex-start'}}>
        <div style={{fontSize:10,color:T.ink4,fontFamily:'monospace',minWidth:110,flexShrink:0,marginTop:1}}>{new Date(a.ts).toLocaleString('en-NG',{hour12:false,month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
        <div><div style={{fontSize:12,color:T.ink}}>{a.action}</div><div style={{fontSize:11,color:T.ink4}}>{a.entity} · {a.user}</div></div>
      </div>)}
    </div>
  );
}

function EggProductionEngine({state,dispatch}){
  const {batches,financialLogs}=state;
  const [showAdd,setShowAdd]=useState(false);
  const [form,setForm]=useState({batchId:'',date:todayStr(),crates:'',eggs:'',gradeA:'',gradeB:'',broken:'',pricePerCrate:'',notes:''});
  const layingBatches=batches.filter(b=>isLayingBatch(b));
  const eggLogs=financialLogs.filter(f=>f.category==='Egg Sales');
  const save=()=>{
    if(!form.batchId)return;
    const crates=form.crates?Number(form.crates):form.eggs?Math.floor(Number(form.eggs)/30):0;
    if(crates<=0)return;
    const price=Number(form.pricePerCrate)||0;
    dispatch({type:'ADD_FIN',p:{id:uid('EGG'),batchId:form.batchId,date:form.date,type:'Revenue',category:'Egg Sales',amount:price*crates,qty:crates,notes:`${crates} crates · ${form.notes}`}});
    setShowAdd(false);
    setForm({batchId:'',date:todayStr(),crates:'',eggs:'',gradeA:'',gradeB:'',broken:'',pricePerCrate:'',notes:''});
  };
  const totalCrates=eggLogs.reduce((s,f)=>s+(f.qty||0),0);
  const totalRev=eggLogs.reduce((s,f)=>s+Number(f.amount),0);
  return(
    <div>
      {layingBatches.length===0&&<Notice type="info" message="Egg Production is available for Layer batches aged 140+ days."/>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,marginBottom:14,marginTop:10}}>
        <KPICard label="Total Crates" value={fmtN(totalCrates)}/>
        <KPICard label="Egg Revenue" value={ngn(totalRev)}/>
      </div>
      {layingBatches.length>0&&<div style={{marginBottom:12}}><Btn size="sm" onClick={()=>setShowAdd(true)}>+ Log Collection</Btn></div>}
      {showAdd&&<Modal title="Log Egg Collection" onClose={()=>setShowAdd(false)}><div style={{display:'flex',flexDirection:'column',gap:12}}>
        <Sel label="Batch *" value={form.batchId} onChange={v=>setForm(f=>({...f,batchId:v}))} options={[{value:'',label:'Select Batch'},...layingBatches.map(b=>({value:b.id,label:b.name}))]}/>
        <Inp label="Crates (1 crate = 30 eggs)" type="number" value={form.crates} onChange={v=>setForm(f=>({...f,crates:v,eggs:String(Number(v)*30)}))}/>
        <Inp label="Or Total Eggs" type="number" value={form.eggs} onChange={v=>setForm(f=>({...f,eggs:v,crates:String(Math.floor(Number(v)/30))}))}/>
        <Inp label="Price per Crate (₦)" type="number" value={form.pricePerCrate} onChange={v=>setForm(f=>({...f,pricePerCrate:v}))}/>
        <Inp label="Date" type="date" value={form.date} onChange={v=>setForm(f=>({...f,date:v}))}/>
        <Btn onClick={save} full>Save Collection</Btn>
      </div></Modal>}
      {eggLogs.length===0?<EmptyState title="No egg records" sub="Log daily collections for laying batches"/>:
      eggLogs.slice(0,30).map((f,i)=><div key={f.id} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:`1px solid ${T.line}`}}>
        <div><div style={{fontSize:13,color:T.ink}}>{batches.find(b=>b.id===f.batchId)?.name}</div><div style={{fontSize:11,color:T.ink4}}>{fmtDate(f.date)} · {f.qty||0} crates</div></div>
        <div className="mono" style={{fontSize:14,fontWeight:600,color:T.ok}}>{ngn(f.amount)}</div>
      </div>)}
    </div>
  );
}

function DailyLogEngine({state,dispatch}){
  const {batches,vaccinations,financialLogs}=state;
  const today=todayStr();
  const [tab,setTab]=useState('mort');
  const [mForm,setMForm]=useState({batchId:'',count:'',cause:'Natural'});
  const [mPhoto,setMPhoto]=useState(null);
  const [fForm,setFFform]=useState({batchId:'',feedType:'Broiler Starter',qty:'',costPerKg:''});
  const [eForm,setEForm]=useState({batchId:'',crates:'',eggs:'',cracked:'',pricePerCrate:'',date:today});
  const [qForm,setQForm]=useState({batchId:'',resolution:'died',diedCount:'',notes:''});
  const activeBatches=batches.filter(b=>['Active','Quarantined'].includes(b.status));
  const layingBatches=batches.filter(b=>isLayingBatch(b));
  const quarantinedBatches=batches.filter(b=>b.status==='Quarantined');
  const overdueVax=vaccinations.filter(v=>v.status!=='Done'&&v.dueDate<=today);
  const handleMPhoto=(e)=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=(ev)=>setMPhoto({name:f.name,data:ev.target.result});r.readAsDataURL(f);};
  const logMort=()=>{if(!mForm.batchId||!mForm.count)return;dispatch({type:'LOG_MORT',p:{id:uid('M'),batchId:mForm.batchId,date:today,count:Number(mForm.count),cause:mForm.cause,notes:'',photo:mPhoto?mPhoto.data:null}});setMForm({batchId:'',count:'',cause:'Natural'});setMPhoto(null);};
  const logFeed=()=>{if(!fForm.batchId||!fForm.qty)return;dispatch({type:'LOG_FEED',p:{id:uid('FL'),batchId:fForm.batchId,date:today,feedType:fForm.feedType,qty:Number(fForm.qty),costPerKg:Number(fForm.costPerKg)||0,notes:''}});setFFform({batchId:'',feedType:'Broiler Starter',qty:'',costPerKg:''});};
  const logEggs=()=>{
    if(!eForm.batchId)return;
    const goodCrates=eForm.crates?Number(eForm.crates):eForm.eggs?Math.floor(Number(eForm.eggs)/30):0;
    const crackedCount=Number(eForm.cracked)||0;
    if(goodCrates<=0&&crackedCount<=0)return;
    const price=Number(eForm.pricePerCrate)||0;
    if(goodCrates>0)dispatch({type:'ADD_FIN',p:{id:uid('EGG'),batchId:eForm.batchId,date:eForm.date,type:'Revenue',category:'Egg Sales',amount:price*goodCrates,qty:goodCrates,cracked:crackedCount,notes:goodCrates+' crates good'+(crackedCount?' · '+crackedCount+' cracked':'') }});
    else if(crackedCount>0)dispatch({type:'ADD_FIN',p:{id:uid('CRK'),batchId:eForm.batchId,date:eForm.date,type:'Cost',category:'Cracked Eggs',amount:0,qty:0,cracked:crackedCount,notes:crackedCount+' cracked eggs — loss recorded'}});
    setEForm({batchId:'',crates:'',eggs:'',cracked:'',pricePerCrate:'',date:today});
  };
  const resolveQuarantine=(resolution,batchId,diedCount,notes)=>{
    const b=batches.find(x=>x.id===batchId);
    if(!b)return;
    if(resolution==='died'){
      const n=Number(diedCount)||0;
      if(n>0)dispatch({type:'LOG_MORT',p:{id:uid('M'),batchId,date:today,count:n,cause:'Disease/Quarantine',notes:'Quarantine resolution: '+notes}});
      dispatch({type:'UPDATE_BATCH',p:{...b,status:'Active',currentCount:Math.max(0,b.currentCount-Number(diedCount||0))}});
    }else if(resolution==='culled'){
      const n=Number(diedCount)||0;
      if(n>0)dispatch({type:'LOG_MORT',p:{id:uid('M'),batchId,date:today,count:n,cause:'Culling',notes:'Quarantine resolution — culled: '+notes}});
      dispatch({type:'UPDATE_BATCH',p:{...b,status:'Closed'}});
    }else{
      // return to batch — just lift quarantine
      dispatch({type:'LIFT_QUARANTINE',p:batchId});
    }
    setQForm({batchId:'',resolution:'died',diedCount:'',notes:''});
  };
  const eggLogs=financialLogs.filter(f=>f.category==='Egg Sales'||f.category==='Cracked Eggs').slice(0,5);
  const showQuar=quarantinedBatches.length>0;
  const tabs=[{id:'mort',label:'Mortality'},{id:'feed',label:'Feed'},{id:'eggs',label:'Eggs'},{id:'vax',label:'Vaccines'}];
  if(showQuar)tabs.splice(2,0,{id:'quar',label:`Quarantine (${quarantinedBatches.length})`});
  return(
    <div>
      <div style={{fontSize:12,fontWeight:600,color:T.ink4,marginBottom:12}}>Daily Log — {fmtDate(today)}</div>
      <TabBar tabs={tabs} active={tab} onChange={setTab}/>
      {tab==='mort'&&<div style={{display:'flex',flexDirection:'column',gap:12}}>
        <Sel label="Batch" value={mForm.batchId} onChange={v=>setMForm(f=>({...f,batchId:v}))} options={[{value:'',label:'Select Batch'},...activeBatches.map(b=>({value:b.id,label:b.name+' ('+b.status+')'}))]}/>
        <Inp label="Bird Count" type="number" value={mForm.count} onChange={v=>setMForm(f=>({...f,count:v}))}/>
        <Sel label="Cause" value={mForm.cause} onChange={v=>setMForm(f=>({...f,cause:v}))} options={['Natural','Disease','Heat Stress','Cold Stress','Injury','Culling','Unknown']}/>
        <div>
          <div style={{fontSize:11,fontWeight:600,color:T.ink3,marginBottom:6,letterSpacing:0.3,textTransform:'uppercase'}}>Photo Evidence (optional)</div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <label style={{flex:1}}>
              <input type='file' accept='image/*' capture='environment' onChange={handleMPhoto} style={{display:'none'}}/>
              <span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'9px 14px',border:`1px solid ${T.line}`,background:T.bg1,cursor:'pointer',fontSize:13,color:T.ink3,minHeight:44}}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={T.ink3} strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter"><rect x="2" y="6" width="20" height="15"/><path d="M16 6l-2-3H10L8 6"/><circle cx="12" cy="13" r="3"/></svg>
                {mPhoto?mPhoto.name:'Take Photo / Upload'}
              </span>
            </label>
            {mPhoto&&<button onClick={()=>setMPhoto(null)} style={{background:'none',border:`1px solid ${T.line}`,cursor:'pointer',padding:'9px 12px',color:T.ink4,minHeight:44,fontSize:12}}>Clear</button>}
          </div>
          {mPhoto&&<img src={mPhoto.data} alt="mortality evidence" style={{marginTop:8,width:'100%',maxHeight:160,objectFit:'cover',border:`1px solid ${T.line}`}}/>}
        </div>
        <Btn onClick={logMort} disabled={!mForm.batchId||!mForm.count} full>Log Mortality</Btn>
      </div>}
      {tab==='quar'&&<div style={{display:'flex',flexDirection:'column',gap:14}}>
        <Notice type="warn" message="Quarantined batches require resolution. Choose how each batch was resolved."/>
        {quarantinedBatches.map(b=>(
          <div key={b.id} style={{background:T.bg0,border:`1px solid ${T.warnLine}`,padding:'16px'}}>
            <div style={{fontSize:13,fontWeight:700,color:T.ink,marginBottom:12}}>{b.name} <span style={{fontSize:11,color:T.warn,fontWeight:600}}>Quarantined</span></div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <Sel label="Resolution" value={qForm.batchId===b.id?qForm.resolution:'died'} onChange={v=>setQForm({batchId:b.id,resolution:v,diedCount:'',notes:''})} options={[
                {value:'return',label:'Return to Active — birds recovered'},
                {value:'died',label:'Died — record deaths, return survivors'},
                {value:'culled',label:'Culled — all birds disposed, close batch'},
              ]}/>
              {(qForm.batchId!==b.id?true:qForm.resolution!=='return')&&(
                <Inp label="Number of birds that died" type="number" value={qForm.batchId===b.id?qForm.diedCount:''} onChange={v=>setQForm({batchId:b.id,resolution:qForm.batchId===b.id?qForm.resolution:'died',diedCount:v,notes:qForm.batchId===b.id?qForm.notes:''})}/>
              )}
              <Inp label="Notes" value={qForm.batchId===b.id?qForm.notes:''} onChange={v=>setQForm(f=>({...f,batchId:b.id,notes:v}))} placeholder="Optional notes on outcome"/>
              <div style={{display:'flex',gap:8}}>
                <Btn size="sm" variant="secondary" onClick={()=>resolveQuarantine('return',b.id,0,'Recovered')}>Return to Active</Btn>
                <Btn size="sm" variant="danger" onClick={()=>resolveQuarantine(qForm.batchId===b.id?qForm.resolution:'died',b.id,qForm.batchId===b.id?qForm.diedCount:0,qForm.batchId===b.id?qForm.notes:'')}>Resolve</Btn>
              </div>
            </div>
          </div>
        ))}
        {quarantinedBatches.length===0&&<EmptyState title="No quarantined batches" sub="All batches are healthy"/>}
      </div>}
      {tab==='feed'&&<div style={{display:'flex',flexDirection:'column',gap:12}}>
        <Sel label="Batch" value={fForm.batchId} onChange={v=>setFFform(f=>({...f,batchId:v}))} options={[{value:'',label:'Select Batch'},...activeBatches.map(b=>({value:b.id,label:b.name}))]}/>
        <Sel label="Feed Type" value={fForm.feedType} onChange={v=>setFFform(f=>({...f,feedType:v}))} options={state.feedTypes||[]}/>
        <Inp label="Quantity (kg)" type="number" value={fForm.qty} onChange={v=>setFFform(f=>({...f,qty:v}))}/>
        <Inp label="Cost per kg (₦)" type="number" value={fForm.costPerKg} onChange={v=>setFFform(f=>({...f,costPerKg:v}))}/>
        <Btn onClick={logFeed} disabled={!fForm.batchId||!fForm.qty} full>Log Feed</Btn>
      </div>}
      {tab==='eggs'&&<div style={{display:'flex',flexDirection:'column',gap:12}}>
        {layingBatches.length===0
          ?<Notice type="info" message="No eligible batches. Layer batches aged 140+ days qualify."/>
          :<>
            <Sel label="Batch" value={eForm.batchId} onChange={v=>setEForm(f=>({...f,batchId:v}))} options={[{value:'',label:'Select Laying Batch'},...layingBatches.map(b=>({value:b.id,label:b.name}))]}/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <Inp label="Good Crates" type="number" value={eForm.crates} onChange={v=>setEForm(f=>({...f,crates:v,eggs:String(Number(v)*30)}))} hint="1 crate = 30 eggs"/>
              <Inp label="Or Total Eggs" type="number" value={eForm.eggs} onChange={v=>setEForm(f=>({...f,eggs:v,crates:String(Math.floor(Number(v)/30))}))}/>
            </div>
            <Inp label="Cracked / Broken Eggs" type="number" value={eForm.cracked} onChange={v=>setEForm(f=>({...f,cracked:v}))} hint="Recorded as loss — not included in revenue"/>
            <Inp label="Price per crate (₦)" type="number" value={eForm.pricePerCrate} onChange={v=>setEForm(f=>({...f,pricePerCrate:v}))}/>
            <Inp label="Date" type="date" value={eForm.date} onChange={v=>setEForm(f=>({...f,date:v}))}/>
            <Btn onClick={logEggs} disabled={!eForm.batchId||!(Number(eForm.crates)||Number(eForm.eggs)||Number(eForm.cracked))} full>Log Collection</Btn>
            {eggLogs.length>0&&<div style={{marginTop:4}}>
              <div style={{fontSize:11,fontWeight:600,color:T.ink4,textTransform:'uppercase',letterSpacing:.7,marginBottom:6}}>Recent collections</div>
              {eggLogs.map((f)=><div key={f.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:`1px solid ${T.line}`,fontSize:12}}>
                <div>
                  <span style={{color:T.ink3}}>{fmtDate(f.date)} · {batches.find(b=>b.id===f.batchId)?.name}</span>
                  {f.cracked>0&&<span style={{color:T.warn,marginLeft:8,fontSize:11}}>{f.cracked} cracked</span>}
                </div>
                <span style={{color:f.category==='Cracked Eggs'?T.warn:T.ink}}>{f.qty||0} crates {f.amount>0&&<span style={{color:T.ok}}>· {ngn(f.amount)}</span>}</span>
              </div>)}
            </div>}
          </>}
      </div>}
      {tab==='vax'&&<div>
        {overdueVax.length===0?<div style={{padding:'20px 0',textAlign:'center',color:T.ink4,fontSize:13}}>No overdue vaccinations today.</div>:
        overdueVax.map(v=><div key={v.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0',borderBottom:`1px solid ${T.line}`}}>
          <div><div style={{fontSize:13,color:T.ink}}>{v.vaccine}</div><div style={{fontSize:11,color:T.ink4}}>{batches.find(b=>b.id===v.batchId)?.name} · Due {fmtDate(v.dueDate)}</div></div>
          <Btn size="sm" onClick={()=>dispatch({type:'UPDATE_VAX',p:{...v,status:'Done',adminDate:today}})}>Done</Btn>
        </div>)}
      </div>}
    </div>
  );
}

function SettingsEngine({state,dispatch,dataMode,onSwitchToLive,onRestoreTraining,license,activeUser,onUpdateLicense}){
  const [tab,setTab]=useState('settings');
  const {settings}=state;
  const [form,setForm]=useState({...settings});
  const [restErr,setRestErr]=useState('');
  const [restOk,setRestOk]=useState(false);
  const save=()=>dispatch({type:'UPDATE_SETTINGS',p:form});
  const exportData=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='PoultryOS_Backup_'+todayStr()+'.json';document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);};
  const isValidPSBackup=(d)=>d&&typeof d==='object'&&Array.isArray(d.houses)&&Array.isArray(d.batches)&&Array.isArray(d.mortalityLogs)&&Array.isArray(d.vaccinations)&&Array.isArray(d.financialLogs)&&Array.isArray(d.auditLog);
  const importData=(e)=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=(ev)=>{try{const d=JSON.parse(ev.target.result);if(!isValidPSBackup(d)){setRestErr('This file does not appear to be a valid PoultryOS backup. Expected a JSON file exported from PoultryOS.');setRestOk(false);return;}if(!window.confirm('This will REPLACE all current PoultryOS data with the contents of the backup file. Current data will be lost unless you have exported your own backup. Continue?')){setRestErr('');setRestOk(false);return;}dispatch({type:'RESTORE',p:d});setRestOk(true);setRestErr('');}catch(err){setRestErr('Invalid backup file. The file could not be parsed as JSON.');setRestOk(false);}};r.readAsText(file);e.target.value='';};
  const fileInputRef=useRef(null);
  const canViewUsers=can(activeUser?.role,'users','view');
  const tabs=[{id:'settings',label:'Settings'},{id:'backup',label:'Backup & Data'}];
  if(canViewUsers)tabs.push({id:'users',label:'Users & Roles'});
  tabs.push({id:'live',label:'Live Mode'});
  tabs.push({id:'legal',label:'Legal'});
  return(
    <div>
      <TabBar tabs={tabs} active={tab} onChange={setTab}/>
      {tab==='settings'&&<div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'16px 18px'}}>
          <div style={{fontSize:13,fontWeight:700,color:T.ink,marginBottom:12}}>Poultry Identity</div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <Inp label="Farm Name" value={form.orgName||''} onChange={v=>setForm(f=>({...f,orgName:v}))} placeholder="Your farm name"/>
            <Inp label="Location" value={form.location||''} onChange={v=>setForm(f=>({...f,location:v}))} placeholder="City, State, Country"/>
          </div>
        </div>
        <div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'16px 18px'}}>
          <div style={{fontSize:13,fontWeight:700,color:T.ink,marginBottom:12}}>Performance Targets</div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <Inp label="Mortality Alert Threshold (%)" type="number" value={form.mortalityThreshold} onChange={v=>setForm(f=>({...f,mortalityThreshold:Number(v)}))} hint="Alert when mortality exceeds this percentage"/>
            <Inp label="Egg Production Threshold (% laying rate)" type="number" value={form.eggProductionThreshold||75} onChange={v=>setForm(f=>({...f,eggProductionThreshold:Number(v)}))} hint="Alert when 7-day laying rate falls below this percentage"/>
            <Inp label="Feed Stock Alert (days)" type="number" value={form.feedStockDaysThreshold||3} onChange={v=>setForm(f=>({...f,feedStockDaysThreshold:Number(v)}))} hint="Alert when no feed log recorded for an active batch within this many days"/>
          </div>
        </div>
        <Btn onClick={save} full>Save Settings</Btn>
      </div>}
      {tab==='backup'&&(<>
        <Notice type="info" message="Data stored in-memory. Export regularly to prevent loss on page refresh."/>
        <div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'16px 18px'}}>
          <div style={{fontSize:13,fontWeight:700,color:T.ink,marginBottom:6}}>Export Backup</div>
          <div style={{fontSize:13,color:T.ink3,marginBottom:12}}>Download a complete JSON backup of all PoultryOS data.</div>
          <Btn onClick={exportData} full>Download PoultryOS Backup</Btn>
        </div>
        <div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'16px 18px'}}>
          <div style={{fontSize:13,fontWeight:700,color:T.ink,marginBottom:6}}>Restore from Backup</div>
          {restErr&&<div style={{marginBottom:8}}><Notice type="error" message={restErr}/></div>}
          {restOk&&<div style={{marginBottom:8}}><Notice type="success" message="Restored successfully."/></div>}
          <input ref={fileInputRef} type='file' accept='.json' onChange={importData} style={{display:'none'}}/>
          <button onClick={()=>fileInputRef.current?.click()} style={{display:'block',width:'100%',padding:'10px 18px',background:T.btnBg,color:'#fff',fontSize:14,fontWeight:600,textAlign:'center',cursor:'pointer',minHeight:44,lineHeight:'24px',boxSizing:'border-box',border:`1px solid ${T.btnBorder}`,fontFamily:'inherit',outline:'none',WebkitTapHighlightColor:'transparent',WebkitAppearance:'none'}}>Import Backup File</button>
        </div>
      </>)}
      {tab==='users'&&canViewUsers&&<UserManagementPanel license={license} activeUser={activeUser} onUpdateLicense={onUpdateLicense}/>}
      {tab==='live'&&<LiveModePanel dataMode={dataMode} onSwitchToLive={onSwitchToLive} onRestoreTraining={onRestoreTraining}/>}
      {tab==='legal'&&<LegalSettingsPanel/>}
    </div>
  );
}

// ─── PERSISTENT ENGINE NAVIGATION ─────────────────────────
// Used by PoultryModule / HatcheryModule / FeedMillModule for a clean
// unified left navigation. No card borders, no per-item dividers; just
// subtle spacing and a clear active state. The nav is always visible —
// even while inside an engine — so users keep their bearings.
function EngineNav({moduleName,moduleSubtitle,engines,activeEngine,onSelect,badgeFn,readOnlyFn,IconComp=EngineIcon}){
  return(
    <nav aria-label={`${moduleName} engines`} style={{display:'flex',flexDirection:'column',gap:0,padding:'4px 6px',minWidth:0}}>
      <div style={{padding:'14px 10px 16px'}}>
        <div style={{fontSize:15,fontWeight:700,color:T.ink,letterSpacing:-0.2,lineHeight:1.2}}>{moduleName}</div>
        {moduleSubtitle&&<div style={{fontSize:11,color:T.ink4,marginTop:3,lineHeight:1.4}}>{moduleSubtitle}</div>}
      </div>
      {engines.length===0&&<div style={{padding:'18px 12px',fontSize:12,color:T.ink4,lineHeight:1.5}}>Your role doesn't have access to any engines in this module.</div>}
      {engines.map(e=>{
        const isActive=e.id===activeEngine;
        const b=badgeFn?badgeFn(e.id):0;
        const ro=readOnlyFn?readOnlyFn(e.id):false;
        return(
          <button key={e.id} onClick={()=>onSelect(e.id)}
            aria-current={isActive?'page':undefined}
            style={{display:'flex',alignItems:'center',gap:10,padding:'9px 10px',border:'none',background:isActive?T.accentBg:'transparent',cursor:'pointer',fontFamily:'inherit',textAlign:'left',color:isActive?T.accentDark:T.ink2,borderLeft:`2px solid ${isActive?T.accent:'transparent'}`,minHeight:38,transition:'background 0.12s,color 0.12s'}}
            onMouseEnter={ev=>{if(!isActive)ev.currentTarget.style.background=T.bg2;}}
            onMouseLeave={ev=>{if(!isActive)ev.currentTarget.style.background='transparent';}}>
            <IconComp id={e.icon} size={16} color={isActive?T.accent:T.ink3}/>
            <span style={{fontSize:13,fontWeight:isActive?600:500,flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.label}</span>
            {ro&&<span style={{fontSize:9,fontWeight:600,color:T.ink4,padding:'2px 5px',background:T.bg3,letterSpacing:0.5}}>RO</span>}
            {b>0&&<span style={{minWidth:18,height:18,background:T.err,color:'#fff',fontSize:10,fontWeight:700,display:'inline-flex',alignItems:'center',justifyContent:'center',padding:'0 5px'}}>{b}</span>}
          </button>
        );
      })}
    </nav>
  );
}

// Breadcrumb shown above the engine content area
function EngineBreadcrumb({moduleName,engineLabel,onHome}){
  return(
    <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 0 14px',fontSize:12,color:T.ink3}}>
      <button onClick={onHome} style={{background:'none',border:'none',cursor:'pointer',padding:0,color:T.ink3,fontFamily:'inherit',fontSize:12,fontWeight:500}}
        onMouseEnter={e=>e.currentTarget.style.color=T.ink} onMouseLeave={e=>e.currentTarget.style.color=T.ink3}>
        {moduleName}
      </button>
      {engineLabel&&<>
        <span style={{color:T.lineMid}}>/</span>
        <span style={{color:T.ink,fontWeight:600}}>{engineLabel}</span>
      </>}
    </div>
  );
}

function PoultryModule({capacity,license,tier,activeUser,onUpdateLicense,initialSeed,dataMode,onSwitchToLive,onRestoreTraining}){
  const [ps,dispatch]=useReducer(psReducer,initialSeed||PS_SEED);
  const [engine,setEngine]=useState(null);
  useEffect(()=>{if(typeof window!=="undefined"){if(!window.__psState)window.__psState={};window.__psState.poultry=ps;}},[ps]);
  const role=activeUser?.role||'Owner / Director';

  const ALL_ENGINES=[
    {id:'cmd',label:'Command Center',icon:'cmd'},
    {id:'daily',label:'Daily Log',icon:'daily'},
    {id:'house',label:'Houses & Batches',icon:'house'},
    {id:'vax',label:'Vaccinations',icon:'vax'},
    {id:'feed',label:'Feed Tracking',icon:'feed'},
    {id:'health',label:'Health & Mortality',icon:'health'},
    {id:'finance',label:'Financials',icon:'finance'},
    {id:'audit',label:'Audit Log',icon:'audit'},
    {id:'settings',label:'Settings & Backup',icon:'settings'},
    {id:'help',label:'Help & Docs',icon:'help'},
  ];
  const ENGINES=ALL_ENGINES.filter(e=>can(role,POULTRY_ENGINE_RES[e.id],'view'));

  const today=todayStr();
  const quarCount=ps.batches.filter(b=>b.status==='Quarantined').length;
  const vacOverdue=ps.vaccinations.filter(v=>v.status!=='Done'&&v.dueDate<today).length;
  const badge=(id)=>{if(id==='health'&&quarCount>0)return quarCount;if(id==='vax'&&vacOverdue>0)return vacOverdue;return 0;};

  const renderEngine=(id)=>{
    const resource=POULTRY_ENGINE_RES[id];
    const ro=resource?!can(role,resource,'write'):false;
    // Pass pending action only to the engine it targets, then engines call
    // consumePendingAction once they've opened the modal.
    const actionFor=(eng)=>pendingAction&&pendingAction.type&&matchesEngine(pendingAction.type,eng)?pendingAction:null;
    let content=null;
    if(id==='cmd')     content=<CommandCenter        state={ps} dispatch={dispatch} dataMode={dataMode}/>;
    else if(id==='daily')   content=<DailyLogEngine       state={ps} dispatch={dispatch}/>;
    else if(id==='house')   content=<HouseBatchEngine     state={ps} dispatch={dispatch} licenseCapacity={capacity}/>;
    else if(id==='vax')     content=<VaccinationEngine    state={ps} dispatch={dispatch} pendingAction={actionFor('vax')} onActionConsumed={consumePendingAction}/>;
    else if(id==='feed')    content=<FeedEngine           state={ps} dispatch={dispatch} pendingAction={actionFor('feed')} onActionConsumed={consumePendingAction}/>;
    else if(id==='health')  content=<HealthEngine         state={ps} dispatch={dispatch} pendingAction={actionFor('health')} onActionConsumed={consumePendingAction}/>;
    else if(id==='finance') content=<FinancialsEngine     state={ps} dispatch={dispatch}/>;
    else if(id==='audit')   content=<AuditEngine          state={ps}/>;
    else if(id==='help')    content=<HelpDocEngine        module='poultry'/>;
    else if(id==='settings')content=<SettingsEngine       state={ps} dispatch={dispatch} dataMode={dataMode} onSwitchToLive={onSwitchToLive} onRestoreTraining={onRestoreTraining} license={license} activeUser={activeUser} onUpdateLicense={onUpdateLicense}/>;
    if(!content)return null;
    return(<>{ro&&<ReadOnlyBanner role={role}/>}<fieldset disabled={ro} style={{border:'none',padding:0,margin:0,minWidth:0}}>{content}</fieldset></>);
  };

  const activeLabel=ENGINES.find(e=>e.id===engine)?.label||'';

  // Deep-link reader: when a notification triggered a module switch with a
  // pending engine + action, open that engine on mount and queue the action
  // so the engine can open its modal once it renders.
  const [pendingAction,setPendingAction]=useState(null);
  useEffect(()=>{
    try{
      const p=window.__psPendingEngine;
      if(p&&p.module==='poultry'&&p.engine){
        const target=ENGINES.find(e=>e.id===p.engine);
        if(target){
          setEngine(p.engine);
          if(p.action){
            setPendingAction({type:p.action,context:p.context||null,ts:p.ts});
          }
        }
        window.__psPendingEngine=null;
      }
    }catch(_){}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const consumePendingAction=useCallback(()=>setPendingAction(null),[]);

  return(
    <div style={{display:'grid',gridTemplateColumns:'minmax(220px,260px) 1fr',gap:0,minHeight:500,background:T.bg0,border:`1px solid ${T.line}`}}>
      <div style={{borderRight:`1px solid ${T.line}`,background:T.bg1,display:'flex',flexDirection:'column',minWidth:0}}>
        <EngineNav
          moduleName="PoultryOS"
          moduleSubtitle="Poultry Farm Operating System"
          engines={ENGINES}
          activeEngine={engine}
          onSelect={setEngine}
          badgeFn={badge}
          readOnlyFn={(id)=>!can(role,POULTRY_ENGINE_RES[id],'write')}
        />
        <div style={{marginTop:'auto'}}><AppFooter/></div>
      </div>
      <div style={{padding:'16px 24px 28px',minWidth:0,display:'flex',flexDirection:'column'}}>
        {engine?(<>
          <EngineBreadcrumb moduleName="PoultryOS" engineLabel={activeLabel} onHome={()=>setEngine(null)}/>
          <div className="au" key={engine} style={{minWidth:0}}>{renderEngine(engine)}</div>
        </>):(
          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start',justifyContent:'center',minHeight:300,padding:'24px 4px'}}>
            <div style={{fontSize:11,fontWeight:700,color:T.ink4,letterSpacing:2,textTransform:'uppercase',marginBottom:10}}>PoultryOS</div>
            <div style={{fontSize:22,fontWeight:700,color:T.ink,letterSpacing:-0.3,lineHeight:1.25,marginBottom:8}}>Choose an engine to get started</div>
            <div style={{fontSize:13,color:T.ink3,lineHeight:1.6,maxWidth:480}}>Select one of the engines on the left to view its dashboard, record activity, or run reports. The navigation stays visible so you can move between engines without losing your place.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Dashboard// ═══════════════════════════════════════════════════════
//  HATCHERY OS — Full Implementation
// ═══════════════════════════════════════════════════════
const huid=(p='H')=>`${p}-${Date.now().toString(36).toUpperCase().slice(-5)}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;
const hToday=()=>new Date().toISOString().split('T')[0];
const hFmtDate=d=>d?new Date(d).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'}):'--';
const hDaysDiff=(a,b=Date.now())=>Math.max(0,Math.floor((new Date(b)-new Date(a))/86400000));
const hPct=(a,b)=>b>0?((a/b)*100).toFixed(1):'0.0';
const hNgn=n=>`\u20a6${Number(n||0).toLocaleString('en-NG')}`;
const hFmt=n=>Number(n||0).toLocaleString('en-NG');


function hBatchStats(ebId,state){
  const candle=state.candlingRecords.filter(c=>c.eggBatchId===ebId);
  const hatch=state.hatchRecords.filter(h=>h.eggBatchId===ebId);
  const fin=state.financialLogs.filter(f=>f.eggBatchId===ebId);
  const eb=state.eggBatches.find(e=>e.id===ebId)||{};
  const proc=state.processingRecords.filter(p=>p.eggBatchId===ebId);
  const lastCandle=candle[0]||{};
  const fertilityRate=lastCandle.totalCandled?hPct(lastCandle.fertile,lastCandle.totalCandled):'--';
  const eggsSet=eb.graded||0;
  const totalHatched=hatch.reduce((s,h)=>s+h.totalHatched,0);
  const hatchability=eggsSet>0?hPct(totalHatched,eggsSet):'--';
  const totalCost=fin.filter(f=>f.type==='Cost').reduce((s,f)=>s+Number(f.amount),0);
  const totalRev=fin.filter(f=>f.type==='Revenue').reduce((s,f)=>s+Number(f.amount),0);
  const profit=totalRev-totalCost;
  const totalChicksOut=proc.reduce((s,p)=>s+p.packed,0);
  return{fertilityRate,hatchability,totalHatched,totalCost,totalRev,profit,lastCandle,eggsSet,totalChicksOut};
}

function HModal({title,onClose,children,width=520}){
  React.useEffect(()=>{
    const handleEsc=(e)=>{if(e.key==='Escape')onClose();};
    document.addEventListener('keydown',handleEsc);
    return()=>document.removeEventListener('keydown',handleEsc);
  },[onClose]);
  return(<div style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:9000,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}><div style={{background:T.bg0,width:'100%',maxWidth:width,maxHeight:'90vh',display:'flex',flexDirection:'column',WebkitOverflowScrolling:'touch',boxShadow:'0 24px 64px rgba(0,0,0,0.35)',position:'relative'}} onClick={e=>e.stopPropagation()}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 14px 14px 20px',borderBottom:`1px solid ${T.line}`,background:T.bg0,flexShrink:0,gap:12}}><span style={{fontSize:16,fontWeight:700,color:T.ink,flex:1,minWidth:0}}>{title}</span><button onClick={onClose} type="button" aria-label="Close" style={{background:'#DC2626',border:'none',cursor:'pointer',color:'#fff',width:36,height:36,minHeight:36,minWidth:36,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,lineHeight:1,fontWeight:700,padding:0,borderRadius:0,flexShrink:0}}>×</button></div><div style={{padding:'18px 20px',overflowY:'auto',flex:1}}>{children}</div></div></div>);
}
function HEmpty({icon,title,sub}){
  return(<div style={{textAlign:'center',padding:'36px 20px',color:T.ink4}}>
    <div style={{width:38,height:38,border:`1px solid ${T.line}`,display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:12}}>
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={T.ink4} strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8M8 12h8"/></svg>
    </div>
    <div style={{fontSize:13,fontWeight:600,color:T.ink3,marginBottom:3}}>{title}</div>
    <div style={{fontSize:12,color:T.ink4,lineHeight:1.5}}>{sub}</div>
  </div>);
}
function HKPI({label,value,unit,sub,alert,green}){
  const c=alert?T.err:green?T.ok:T.ink;const bg=alert?T.errBg:green?T.okBg:'#fff';const bord=alert?T.errLine:green?T.okLine:T.line;
  return(<div style={{background:bg,border:`1px solid ${bord}`,padding:'13px 15px'}}><div style={{fontSize:10,fontWeight:600,color:T.ink4,textTransform:'uppercase',letterSpacing:.7,marginBottom:4}}>{label}</div><div className="mono" style={{fontSize:24,fontWeight:700,color:c,lineHeight:1}}>{value}{unit&&<span style={{fontSize:11,color:T.ink4,marginLeft:3,fontWeight:400}}>{unit}</span>}</div>{sub&&<div style={{fontSize:11,color:T.ink4,marginTop:2}}>{sub}</div>}</div>);
}
function HBadge({status}){
  const map={'Received':{bg:T.accentBg,c:T.accentDark},'Incubating':{bg:'#FFFBEB',c:'#F59E0B'},'Candling':{bg:'#FFFBEB',c:'#F59E0B'},'Transfer':{bg:'#ECFDF5',c:'#10B981'},'Hatched':{bg:T.okBg,c:T.ok},'Cancelled':{bg:T.errBg,c:T.err},'Completed':{bg:T.okBg,c:T.ok},'Hatching':{bg:'#ECFDF5',c:'#10B981'}};
  const {bg,c}=map[status]||{bg:T.bg2,c:T.ink3};
  return <span style={{fontSize:11,padding:'2px 9px',background:bg,color:c,fontWeight:600,letterSpacing:.4}}>{status}</span>;
}

function HCmdCenter({state,dataMode}){
  const {eggBatches,candlingRecords,hatchRecords,processingRecords,settings,financialLogs}=state;
  const active=eggBatches.filter(e=>['Received','Incubating','Candling','Transfer','Hatching'].includes(e.status));
  const totalSet=eggBatches.reduce((s,e)=>s+e.graded,0);
  const totalHatched=hatchRecords.reduce((s,h)=>s+h.totalHatched,0);
  const totalDOC=processingRecords.reduce((s,p)=>s+p.packed,0);
  const latestCandles=eggBatches.map(eb=>{const c=candlingRecords.filter(r=>r.eggBatchId===eb.id);return c.length?c[0]:null;}).filter(Boolean);
  const totalCandled=latestCandles.reduce((s,c)=>s+c.totalCandled,0);
  const totalFertile=latestCandles.reduce((s,c)=>s+c.fertile,0);
  const globalFertility=totalCandled>0?hPct(totalFertile,totalCandled):'--';
  const globalHatch=totalSet>0?hPct(totalHatched,totalSet):'--';
  const fertAlert=parseFloat(globalFertility)<(settings.targetFertility||90)&&totalCandled>0;
  const hatchAlert=parseFloat(globalHatch)<(settings.targetHatchability||85)&&totalSet>0;
  const totalRev=financialLogs.filter(f=>f.type==='Revenue').reduce((s,f)=>s+Number(f.amount),0);
  const totalCostAll=financialLogs.filter(f=>f.type==='Cost').reduce((s,f)=>s+Number(f.amount),0);
  const lowInv=state.inventory.filter(i=>i.status!=='OK');
  return(
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      {(fertAlert||hatchAlert||lowInv.length>0)&&(<div style={{display:'flex',flexDirection:'column',gap:8}}>
        {fertAlert&&<Notice type="warn" message={`Fertility ${globalFertility}% below target ${settings.targetFertility}%`}/>}
        {hatchAlert&&<Notice type="warn" message={`Hatchability ${globalHatch}% below target ${settings.targetHatchability}%`}/>}
        {lowInv.length>0&&<Notice type="warn" message={`Stock alert: ${lowInv.map(i=>`${i.item} (${i.status})`).join(', ')}`}/>}
      </div>)}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10}}>
        <HKPI label="Active Cycles" value={active.length} sub={`${eggBatches.length} total batches`}/>
        <HKPI label="Eggs in System" value={hFmt(active.reduce((s,e)=>s+e.graded,0))} unit="eggs"/>
        <HKPI label="Fertility Rate" value={globalFertility} unit={globalFertility!=='--'?'%':''} green={!fertAlert&&totalCandled>0} alert={fertAlert}/>
        <HKPI label="Hatchability" value={globalHatch} unit={globalHatch!=='--'?'%':''} green={!hatchAlert&&totalSet>0} alert={hatchAlert}/>
        <HKPI label="DOC Output" value={hFmt(totalDOC)} unit="chicks"/>
        <HKPI label="Net P&L" value={hNgn(totalRev-totalCostAll)} green={totalRev>totalCostAll} alert={totalRev<totalCostAll&&totalRev>0}/>
      </div>
      <div style={{background:T.bg0,border:`1px solid ${T.line}`,overflow:'hidden'}}>
        <div style={{padding:'11px 16px',borderBottom:`1px solid ${T.line}`,fontSize:13,fontWeight:700,color:T.ink}}>Active Batch Pipeline</div>
        {active.length===0?<HEmpty icon="egg" title="No active batches" sub="Receive egg batches to begin"/>:
          <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:500}}>
            <thead><tr style={{background:T.bg2}}>{['Batch','Breed','Eggs Set','Status','Fertility','Hatchability'].map(h=><th key={h} style={{padding:'8px 12px',textAlign:'left',fontSize:11,fontWeight:600,color:T.ink4,textTransform:'uppercase',letterSpacing:.4,whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
            <tbody>{active.map((eb,i)=>{const s=hBatchStats(eb.id,state);return(
              <tr key={eb.id} style={{borderTop:`1px solid ${T.line}`,background:i%2===0?'#fff':T.bg1}}>
                <td style={{padding:'10px 12px'}}><div style={{fontWeight:600,fontSize:13,color:T.ink}}>{eb.batchNo}</div><div style={{fontSize:11,color:T.ink4}}>{eb.source}</div></td>
                <td style={{padding:'10px 12px',fontSize:13,color:T.ink3}}>{eb.breed}</td>
                <td style={{padding:'10px 12px'}}><span className="mono">{hFmt(eb.graded)}</span></td>
                <td style={{padding:'10px 12px'}}><HBadge status={eb.status}/></td>
                <td style={{padding:'10px 12px'}}><span className="mono" style={{color:s.fertilityRate==='--'?T.ink4:parseFloat(s.fertilityRate)>=90?T.ok:T.warn}}>{s.fertilityRate}{s.fertilityRate!=='--'?'%':''}</span></td>
                <td style={{padding:'10px 12px'}}><span className="mono">{s.hatchability}{s.hatchability!=='--'?'%':''}</span></td>
              </tr>);})}
            </tbody>
          </table></div>}
      </div>
    </div>
  );
}

function HEggIntake({state,dispatch,licenseCapacity=0}){
  const {eggBatches}=state;
  const [showForm,setShowForm]=useState(false);
  const [err,setErr]=useState('');
  const BREEDS=['Ross 308','Cobb 500','Isa Brown','Lohmann Brown','Hubbard Flex','Marshall Broiler','SASSO','Arbor Acres'];
  const [f,setF]=useState({batchNo:'',source:'',farm:'',breed:'',dateReceived:hToday(),qty:'',graded:'',rejected:'',notes:''});
  const fld=(k,v)=>setF(p=>({...p,[k]:v}));
  const autoNo=()=>`HEB-${new Date().getFullYear()}-${String(eggBatches.length+1).padStart(3,'0')}`;

  // ── Monthly throughput cap ──
  const monthKey=(d)=>(d||'').slice(0,7);
  const targetMonth=monthKey(f.dateReceived||hToday());
  const usedThisMonth=eggBatches.filter(e=>monthKey(e.dateReceived)===targetMonth).reduce((s,e)=>s+(Number(e.qty)||0),0);
  const remaining=Math.max(0,Number(licenseCapacity||0)-usedThisMonth);
  const monthLabel=(()=>{if(!targetMonth)return'';const [y,m]=targetMonth.split('-');return new Date(Number(y),Number(m)-1,1).toLocaleDateString('en-NG',{month:'long',year:'numeric'});})();

  const save=()=>{
    setErr('');
    if(!f.source.trim()||!f.qty){setErr('Source and quantity are required.');return;}
    const qty=parseInt(f.qty)||0,rej=parseInt(f.rejected)||0;
    if(qty<=0){setErr('Quantity must be greater than zero.');return;}
    if(Number(licenseCapacity)>0&&(usedThisMonth+qty)>Number(licenseCapacity)){
      setErr(`This intake (${hFmt(qty)} eggs) would exceed your licensed throughput for ${monthLabel}. Licensed: ${hFmt(licenseCapacity)} eggs/mo · Used: ${hFmt(usedThisMonth)} · Available: ${hFmt(remaining)} eggs.`);
      return;
    }
    dispatch({type:'ADD_EGG_BATCH',p:{id:huid('EB'),batchNo:f.batchNo||autoNo(),source:f.source.trim(),farm:f.farm,breed:f.breed,dateReceived:f.dateReceived,qty,graded:f.graded?parseInt(f.graded):qty-rej,rejected:rej,status:'Received',notes:f.notes}});
    setF({batchNo:'',source:'',farm:'',breed:'',dateReceived:hToday(),qty:'',graded:'',rejected:'',notes:''});setShowForm(false);
  };

  const openForm=()=>{setErr('');setShowForm(true);};

  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}><span style={{fontSize:16,fontWeight:700,color:T.ink}}>Egg Intake & Batch Register</span><Btn size="sm" onClick={openForm}>+ Record Intake</Btn></div>
      {Number(licenseCapacity)>0&&<div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'10px 14px',fontSize:12,color:T.ink3,display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
        <span>Licensed: <strong style={{color:T.ink}}>{hFmt(licenseCapacity)} eggs/mo</strong></span>
        <span>Used in {monthLabel}: <strong style={{color:T.ink}}>{hFmt(usedThisMonth)}</strong></span>
        <span>Available: <strong style={{color:remaining>0?T.ok:T.err}}>{hFmt(remaining)} eggs</strong></span>
      </div>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:8}}>
        {[['Total Batches',eggBatches.length],['Active',eggBatches.filter(e=>['Received','Incubating','Candling','Transfer','Hatching'].includes(e.status)).length],['Total Eggs',hFmt(eggBatches.reduce((s,e)=>s+e.qty,0))],['Graded',hFmt(eggBatches.reduce((s,e)=>s+e.graded,0))]].map(([l,v])=>(
          <div key={l} style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'12px 14px'}}><div style={{fontSize:10,color:T.ink4,textTransform:'uppercase',letterSpacing:.5,marginBottom:3}}>{l}</div><div className="mono" style={{fontSize:18,fontWeight:700,color:T.ink}}>{v}</div></div>
        ))}
      </div>
      {eggBatches.length===0?<HEmpty icon="egg" title="No egg batches" sub="Record your first intake to begin lifecycle tracking"/>:
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {eggBatches.map(eb=>{
            const s=hBatchStats(eb.id,state);
            return(<div key={eb.id} style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'14px 16px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                <div><div style={{display:'flex',gap:8,alignItems:'center',marginBottom:3}}><span style={{fontSize:14,fontWeight:700,color:T.ink}}>{eb.batchNo}</span><HBadge status={eb.status}/></div><div style={{fontSize:12,color:T.ink4}}>{eb.source} · {eb.breed||'--'} · {hFmtDate(eb.dateReceived)}</div></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))',gap:7}}>
                {[['Received',hFmt(eb.qty)],['Graded',hFmt(eb.graded)],['Rejected',hFmt(eb.rejected)],['Fertility',s.fertilityRate==='--'?'--':`${s.fertilityRate}%`],['Hatchability',s.hatchability==='--'?'--':`${s.hatchability}%`],['DOC Out',hFmt(s.totalChicksOut)]].map(([l,v])=>(
                  <div key={l} style={{background:T.bg1,padding:'7px 9px'}}><div style={{fontSize:9,color:T.ink4,textTransform:'uppercase',letterSpacing:.4,marginBottom:2}}>{l}</div><div className="mono" style={{fontSize:12,fontWeight:600,color:T.ink}}>{v}</div></div>
                ))}
              </div>
              {eb.notes&&<div style={{marginTop:8,fontSize:12,color:T.ink4,fontStyle:'italic'}}>{eb.notes}</div>}
            </div>);
          })}
        </div>
      }
      {showForm&&(<HModal title="Record Egg Intake" onClose={()=>{setShowForm(false);setErr('');}}>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {Number(licenseCapacity)>0&&<Notice type="info" message={`${hFmt(remaining)} eggs available for ${monthLabel}.`}/>}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><Inp label="Batch No." value={f.batchNo} onChange={v=>fld('batchNo',v)} placeholder={autoNo()}/><Inp label="Date Received *" type="date" value={f.dateReceived} onChange={v=>fld('dateReceived',v)}/></div>
          <Inp label="Source Farm / Breeder *" value={f.source} onChange={v=>fld('source',v)} placeholder="e.g. Crown Breeder Farm"/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><Inp label="Farm / Company" value={f.farm} onChange={v=>fld('farm',v)} placeholder="Company name"/><Sel label="Breed" value={f.breed} onChange={v=>fld('breed',v)} options={[{value:'',label:'Select breed'},...BREEDS]}/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}><Inp label="Total Qty *" type="number" value={f.qty} onChange={v=>fld('qty',v)} placeholder="Eggs received"/><Inp label="Graded (Good)" type="number" value={f.graded} onChange={v=>fld('graded',v)} placeholder="Auto"/><Inp label="Rejected" type="number" value={f.rejected} onChange={v=>fld('rejected',v)} placeholder="0"/></div>
          {f.qty&&f.rejected&&<Notice type="info" message={`Graded for incubation: ${hFmt(parseInt(f.qty||0)-parseInt(f.rejected||0))} eggs`}/>}
          <Inp label="Notes" value={f.notes} onChange={v=>fld('notes',v)} placeholder="Quality observations..."/>
          {err&&<Notice type="error" message={err}/>}
          <div style={{display:'flex',gap:8}}><Btn onClick={save} disabled={!f.source.trim()||!f.qty}>Record Intake</Btn><Btn variant="secondary" onClick={()=>{setShowForm(false);setErr('');}}>Cancel</Btn></div>
        </div>
      </HModal>)}
    </div>
  );
}

function HIncubation({state,dispatch}){
  const {eggBatches,incubationRecords,settings}=state;
  const [showForm,setShowForm]=useState(false);
  const [f,setF]=useState({eggBatchId:'',setterId:'',setDate:hToday(),tempC:37.8,humidity:55,notes:''});
  const fld=(k,v)=>setF(p=>({...p,[k]:v}));
  const SETTERS=['SET-A','SET-B','SET-C','SET-D','Setter 1','Setter 2','Hatcher 1','Hatcher 2'];
  const availBatches=eggBatches.filter(eb=>eb.status==='Received'||eb.status==='Incubating');
  const incDays=settings.incubationDays||21;
  const save=()=>{
    if(!f.eggBatchId||!f.setterId)return;
    const hatchDate=new Date(new Date(f.setDate).getTime()+incDays*86400000).toISOString().split('T')[0];
    dispatch({type:'ADD_INCUBATION',p:{id:huid('IR'),eggBatchId:f.eggBatchId,setterId:f.setterId,setDate:f.setDate,transferDate:'',hatchDate,stage:'Incubating',tempC:parseFloat(f.tempC)||37.8,humidity:parseFloat(f.humidity)||55,notes:f.notes}});
    setF({eggBatchId:'',setterId:'',setDate:hToday(),tempC:37.8,humidity:55,notes:''});setShowForm(false);
  };
  const updateStage=(rec,stage)=>{
    const eb=eggBatches.find(e=>e.id===rec.eggBatchId);
    dispatch({type:'UPDATE_INCUBATION',p:{...rec,stage,transferDate:stage==='Transfer'?hToday():rec.transferDate}});
    if(stage==='Transfer'&&eb) dispatch({type:'UPDATE_EGG_BATCH',p:{...eb,status:'Transfer'}});
    if(stage==='Completed'&&eb) dispatch({type:'UPDATE_EGG_BATCH',p:{...eb,status:'Hatched'}});
  };
  const activeRecs=incubationRecords.filter(r=>r.stage!=='Completed');
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}><span style={{fontSize:16,fontWeight:700,color:T.ink}}>Incubation Management</span><Btn size="sm" onClick={()=>setShowForm(true)}>+ Set Batch</Btn></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:8}}>
        {[['Active Cycles',activeRecs.length],['Completed',incubationRecords.filter(r=>r.stage==='Completed').length],['Incub. Period',`${incDays}d`],['Candle Day',`Day ${settings.candleDay||7}`],['Transfer Day',`Day ${settings.transferDay||18}`]].map(([l,v])=>(
          <div key={l} style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'11px 13px'}}><div style={{fontSize:10,color:T.ink4,textTransform:'uppercase',letterSpacing:.4,marginBottom:3}}>{l}</div><div className="mono" style={{fontSize:16,fontWeight:700,color:T.ink}}>{v}</div></div>
        ))}
      </div>
      {activeRecs.length===0?<HEmpty icon="temp" title="No active incubation" sub="Set a batch to begin incubation tracking"/>:
        activeRecs.map(rec=>{
          const eb=eggBatches.find(e=>e.id===rec.eggBatchId);
          const dayIn=rec.setDate?hDaysDiff(rec.setDate):0;
          const pct=Math.min(100,Math.round((dayIn/incDays)*100));
          const candleDay=settings.candleDay||7;
          const transferDay=settings.transferDay||18;
          return(<div key={rec.id} style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'14px 16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
              <div><div style={{display:'flex',gap:8,alignItems:'center',marginBottom:3}}><span style={{fontSize:14,fontWeight:700,color:T.ink}}>{eb?.batchNo||'--'}</span><HBadge status={rec.stage}/></div><div style={{fontSize:12,color:T.ink4}}>{rec.setterId} · Set {hFmtDate(rec.setDate)} · {hFmt(eb?.graded||0)} eggs</div></div>
              <div style={{textAlign:'right'}}><div className="mono" style={{fontSize:24,fontWeight:700,color:T.ink}}>D{dayIn}</div><div style={{fontSize:11,color:T.ink4}}>of {incDays}d</div></div>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{height:6,background:T.bg2,position:'relative',overflow:'visible',marginBottom:6}}>
                <div style={{width:`${pct}%`,height:'100%',background:T.ink,transition:'width .5s'}}/>
                <div style={{position:'absolute',left:`${Math.round((candleDay/incDays)*100)}%`,top:-3,width:2,height:12,background:T.warn}}/>
                <div style={{position:'absolute',left:`${Math.round((transferDay/incDays)*100)}%`,top:-3,width:2,height:12,background:T.info}}/>
              </div>
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <span style={{fontSize:9,color:T.ink4}}>Set D0</span><span style={{fontSize:9,color:T.warn}}>Candle D{candleDay}</span><span style={{fontSize:9,color:T.info}}>Transfer D{transferDay}</span><span style={{fontSize:9,color:T.ink4}}>Hatch D{incDays}</span>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:10}}>
              {[['Temp',`${rec.tempC}C`],['Humidity',`${rec.humidity}%`],['Expected Hatch',hFmtDate(rec.hatchDate)]].map(([l,v])=>(
                <div key={l} style={{background:T.bg1,padding:'7px 9px'}}><div style={{fontSize:9,color:T.ink4,textTransform:'uppercase',letterSpacing:.4,marginBottom:1}}>{l}</div><div className="mono" style={{fontSize:12,fontWeight:600,color:T.ink}}>{v}</div></div>
              ))}
            </div>
            <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
              {rec.stage==='Incubating'&&dayIn>=candleDay&&<Btn size="sm" onClick={()=>updateStage(rec,'Candling')}>Mark Candling</Btn>}
              {rec.stage==='Candling'&&dayIn>=transferDay&&<Btn size="sm" onClick={()=>updateStage(rec,'Transfer')}>Transfer to Hatcher</Btn>}
              {rec.stage==='Transfer'&&<Btn size="sm" onClick={()=>updateStage(rec,'Hatching')}>Hatching</Btn>}
              {rec.stage==='Hatching'&&<Btn size="sm" onClick={()=>updateStage(rec,'Completed')}>Mark Completed</Btn>}
            </div>
          </div>);
        })
      }
      {showForm&&(<HModal title="Set Batch for Incubation" onClose={()=>setShowForm(false)}>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <Sel label="Egg Batch *" value={f.eggBatchId} onChange={v=>fld('eggBatchId',v)} options={[{value:'',label:'Select egg batch'},...availBatches.map(e=>({value:e.id,label:`${e.batchNo} -- ${hFmt(e.graded)} eggs`}))]}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><Sel label="Setter *" value={f.setterId} onChange={v=>fld('setterId',v)} options={[{value:'',label:'Select setter'},...SETTERS]}/><Inp label="Set Date *" type="date" value={f.setDate} onChange={v=>fld('setDate',v)}/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><Inp label="Temperature (C)" type="number" value={f.tempC} onChange={v=>fld('tempC',v)} placeholder="37.8"/><Inp label="Humidity (%)" type="number" value={f.humidity} onChange={v=>fld('humidity',v)} placeholder="55"/></div>
          {f.setDate&&<Notice type="info" message={`Expected hatch: ${hFmtDate(new Date(new Date(f.setDate).getTime()+incDays*86400000).toISOString().split('T')[0])}`}/>}
          <div style={{display:'flex',gap:8}}><Btn onClick={save} disabled={!f.eggBatchId||!f.setterId}>Start Incubation</Btn><Btn variant="secondary" onClick={()=>setShowForm(false)}>Cancel</Btn></div>
        </div>
      </HModal>)}
    </div>
  );
}

function HCandling({state,dispatch,pendingAction,onActionConsumed}){
  const {eggBatches,candlingRecords,settings}=state;
  const [showForm,setShowForm]=useState(false);
  const [f,setF]=useState({eggBatchId:'',candleDate:hToday(),totalCandled:'',fertile:'',infertile:'',earlyDead:'',lateDead:'',candledBy:'',notes:''});
  const fld=(k,v)=>setF(p=>({...p,[k]:v}));
  const candleBatches=eggBatches.filter(e=>['Incubating','Candling','Transfer'].includes(e.status));
  // Deep-link: open candling form for the batch flagged by a low-fertility notification
  useEffect(()=>{
    if(!pendingAction||!pendingAction.type)return;
    if(pendingAction.type==='viewCandling'){
      const ctx=pendingAction.context||{};
      if(ctx.batchId) setF(p=>({...p,eggBatchId:ctx.batchId}));
      setShowForm(true);
    }
    if(onActionConsumed)onActionConsumed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[pendingAction]);
  const autoFertile=f.totalCandled&&(f.infertile||f.earlyDead||f.lateDead)?Math.max(0,parseInt(f.totalCandled||0)-parseInt(f.infertile||0)-parseInt(f.earlyDead||0)-parseInt(f.lateDead||0)):null;
  const save=()=>{
    if(!f.eggBatchId||!f.totalCandled)return;
    const tot=parseInt(f.totalCandled)||0,inf=parseInt(f.infertile)||0,ed=parseInt(f.earlyDead)||0,ld=parseInt(f.lateDead)||0;
    const fertile=f.fertile?parseInt(f.fertile):Math.max(0,tot-inf-ed-ld);
    dispatch({type:'ADD_CANDLE',p:{id:huid('CR'),eggBatchId:f.eggBatchId,candleDate:f.candleDate,totalCandled:tot,fertile,infertile:inf,earlyDead:ed,lateDead:ld,candledBy:f.candledBy,notes:f.notes}});
    setF({eggBatchId:'',candleDate:hToday(),totalCandled:'',fertile:'',infertile:'',earlyDead:'',lateDead:'',candledBy:'',notes:''});setShowForm(false);
  };
  const totalCandled=candlingRecords.reduce((s,c)=>s+c.totalCandled,0);
  const totalFertile=candlingRecords.reduce((s,c)=>s+c.fertile,0);
  const avgFertility=totalCandled>0?hPct(totalFertile,totalCandled):'--';
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}><span style={{fontSize:16,fontWeight:700,color:T.ink}}>Candling & Fertility Analysis</span><Btn size="sm" onClick={()=>setShowForm(true)}>+ Record Candling</Btn></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:8}}>
        <HKPI label="Avg Fertility" value={avgFertility} unit={avgFertility!=='--'?'%':''} green={parseFloat(avgFertility)>=(settings.targetFertility||90)&&totalCandled>0}/>
        <HKPI label="Total Candled" value={hFmt(totalCandled)} unit="eggs"/>
        <HKPI label="Fertile" value={hFmt(totalFertile)} unit="eggs"/>
        <HKPI label="Infertile" value={hFmt(candlingRecords.reduce((s,c)=>s+c.infertile,0))} unit="eggs"/>
      </div>
      {candlingRecords.length===0?<HEmpty icon="candle" title="No candling records" sub="Record candling to assess fertility per batch"/>:
        candlingRecords.map(cr=>{
          const eb=eggBatches.find(e=>e.id===cr.eggBatchId);
          const fertility=hPct(cr.fertile,cr.totalCandled);
          const fertAlert=parseFloat(fertility)<(settings.targetFertility||90);
          return(<div key={cr.id} style={{background:fertAlert?T.errBg:'#fff',border:`1px solid ${fertAlert?T.errLine:T.line}`,padding:'14px 16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
              <div><div style={{fontSize:14,fontWeight:700,color:T.ink,marginBottom:3}}>{eb?.batchNo||'--'}</div><div style={{fontSize:12,color:T.ink4}}>Candled {hFmtDate(cr.candleDate)} · By {cr.candledBy||'Unknown'}</div></div>
              <div style={{textAlign:'right'}}><div className="mono" style={{fontSize:24,fontWeight:700,color:fertAlert?T.err:T.ok}}>{fertility}%</div><div style={{fontSize:11,color:T.ink4}}>fertility</div></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:7}}>
              {[['Candled',hFmt(cr.totalCandled)],['Fertile',hFmt(cr.fertile)],['Infertile',hFmt(cr.infertile)],['Early Dead',hFmt(cr.earlyDead)],['Late Dead',hFmt(cr.lateDead)]].map(([l,v])=>(
                <div key={l} style={{background:'rgba(0,0,0,0.04)',padding:'6px 8px'}}><div style={{fontSize:9,color:T.ink4,textTransform:'uppercase',letterSpacing:.4,marginBottom:2}}>{l}</div><div className="mono" style={{fontSize:12,fontWeight:600,color:T.ink}}>{v}</div></div>
              ))}
            </div>
            <div style={{marginTop:8,height:4,background:T.bg2,overflow:'hidden'}}><div style={{width:`${fertility}%`,height:'100%',background:fertAlert?T.err:T.ok}}/></div>
          </div>);
        })
      }
      {showForm&&(<HModal title="Record Candling Results" onClose={()=>setShowForm(false)}>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <Sel label="Egg Batch *" value={f.eggBatchId} onChange={v=>fld('eggBatchId',v)} options={[{value:'',label:'Select batch'},...candleBatches.map(e=>({value:e.id,label:e.batchNo}))]}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><Inp label="Candle Date *" type="date" value={f.candleDate} onChange={v=>fld('candleDate',v)}/><Inp label="Candled By" value={f.candledBy} onChange={v=>fld('candledBy',v)} placeholder="Staff name"/></div>
          <Inp label="Total Candled *" type="number" value={f.totalCandled} onChange={v=>fld('totalCandled',v)} placeholder="No. of eggs"/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}><Inp label="Infertile" type="number" value={f.infertile} onChange={v=>fld('infertile',v)} placeholder="0"/><Inp label="Early Dead" type="number" value={f.earlyDead} onChange={v=>fld('earlyDead',v)} placeholder="0"/><Inp label="Late Dead" type="number" value={f.lateDead} onChange={v=>fld('lateDead',v)} placeholder="0"/></div>
          {autoFertile!==null&&<Notice type="info" message={`Auto-calculated fertile: ${hFmt(autoFertile)} eggs (${hPct(autoFertile,parseInt(f.totalCandled||1))}%)`}/>}
          <Inp label="Fertile (override)" type="number" value={f.fertile} onChange={v=>fld('fertile',v)} placeholder={autoFertile!==null?String(autoFertile):'Enter manually'}/>
          <div style={{display:'flex',gap:8}}><Btn onClick={save} disabled={!f.eggBatchId||!f.totalCandled}>Save Candling</Btn><Btn variant="secondary" onClick={()=>setShowForm(false)}>Cancel</Btn></div>
        </div>
      </HModal>)}
    </div>
  );
}

function HHatch({state,dispatch,pendingAction,onActionConsumed}){
  const {eggBatches,hatchRecords,candlingRecords,settings}=state;
  const [showForm,setShowForm]=useState(false);
  const [f,setF]=useState({eggBatchId:'',hatchDate:hToday(),eggsSet:'',totalHatched:'',culls:'',defects:'',sexed:false,maleCount:'',femaleCount:'',notes:''});
  const fld=(k,v)=>setF(p=>({...p,[k]:v}));
  const hatchBatches=eggBatches.filter(e=>!['Received','Hatched','Cancelled'].includes(e.status));
  // Deep-link: open hatch form for the batch flagged by a low-hatchability notification
  useEffect(()=>{
    if(!pendingAction||!pendingAction.type)return;
    if(pendingAction.type==='viewHatch'){
      const ctx=pendingAction.context||{};
      if(ctx.batchId) setF(p=>({...p,eggBatchId:ctx.batchId}));
      setShowForm(true);
    }
    if(onActionConsumed)onActionConsumed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[pendingAction]);
  const save=()=>{
    if(!f.eggBatchId||!f.totalHatched)return;
    const eb=eggBatches.find(e=>e.id===f.eggBatchId);
    dispatch({type:'ADD_HATCH',p:{id:huid('HR'),eggBatchId:f.eggBatchId,hatchDate:f.hatchDate,eggsSet:parseInt(f.eggsSet)||eb?.graded||0,totalHatched:parseInt(f.totalHatched)||0,culls:parseInt(f.culls)||0,defects:parseInt(f.defects)||0,sexed:f.sexed,maleCount:parseInt(f.maleCount)||0,femaleCount:parseInt(f.femaleCount)||0,notes:f.notes}});
    setF({eggBatchId:'',hatchDate:hToday(),eggsSet:'',totalHatched:'',culls:'',defects:'',sexed:false,maleCount:'',femaleCount:'',notes:''});setShowForm(false);
  };
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}><span style={{fontSize:16,fontWeight:700,color:T.ink}}>Hatch & Chick Output</span><Btn size="sm" onClick={()=>setShowForm(true)}>+ Record Hatch</Btn></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:8}}>
        <HKPI label="Hatch Cycles" value={hatchRecords.length}/>
        <HKPI label="Total Hatched" value={hFmt(hatchRecords.reduce((s,h)=>s+h.totalHatched,0))} unit="chicks"/>
        <HKPI label="Avg Hatchability" value={hatchRecords.length>0?(hatchRecords.reduce((s,h)=>s+(h.eggsSet>0?h.totalHatched/h.eggsSet:0),0)/hatchRecords.length*100).toFixed(1):'--'} unit={hatchRecords.length>0?'%':''} green={hatchRecords.length>0}/>
        <HKPI label="Total Culls" value={hFmt(hatchRecords.reduce((s,h)=>s+h.culls,0))} unit="chicks"/>
      </div>
      {hatchRecords.length===0?<HEmpty icon="hatch" title="No hatch records" sub="Record hatch results when batches complete"/>:
        hatchRecords.map(hr=>{
          const eb=eggBatches.find(e=>e.id===hr.eggBatchId);
          const hatchability=hr.eggsSet>0?hPct(hr.totalHatched,hr.eggsSet):'--';
          return(<div key={hr.id} style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'14px 16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
              <div><div style={{fontSize:14,fontWeight:700,color:T.ink,marginBottom:3}}>{eb?.batchNo||'--'}</div><div style={{fontSize:12,color:T.ink4}}>{eb?.breed||''} · {hFmtDate(hr.hatchDate)}</div></div>
              <div style={{textAlign:'right'}}><div className="mono" style={{fontSize:24,fontWeight:700,color:T.ok}}>{hatchability}{hatchability!=='--'?'%':''}</div><div style={{fontSize:11,color:T.ink4}}>hatchability</div></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(90px,1fr))',gap:7}}>
              {[['Eggs Set',hFmt(hr.eggsSet)],['Hatched',hFmt(hr.totalHatched)],['Culls',hFmt(hr.culls)],['Defects',hFmt(hr.defects)],...(hr.sexed?[['Males',hFmt(hr.maleCount)],['Females',hFmt(hr.femaleCount)]]:[] )].map(([l,v])=>(
                <div key={l} style={{background:T.bg1,padding:'7px 9px'}}><div style={{fontSize:9,color:T.ink4,textTransform:'uppercase',letterSpacing:.4,marginBottom:1}}>{l}</div><div className="mono" style={{fontSize:12,fontWeight:600,color:T.ink}}>{v}</div></div>
              ))}
            </div>
          </div>);
        })
      }
      {showForm&&(<HModal title="Record Hatch Results" onClose={()=>setShowForm(false)}>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <Sel label="Egg Batch *" value={f.eggBatchId} onChange={v=>{const eb=eggBatches.find(e=>e.id===v);setF(p=>({...p,eggBatchId:v,eggsSet:String(eb?.graded||'')}));}} options={[{value:'',label:'Select batch'},...hatchBatches.map(e=>({value:e.id,label:e.batchNo}))]}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><Inp label="Hatch Date *" type="date" value={f.hatchDate} onChange={v=>fld('hatchDate',v)}/><Inp label="Eggs Set" type="number" value={f.eggsSet} onChange={v=>fld('eggsSet',v)}/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}><Inp label="Total Hatched *" type="number" value={f.totalHatched} onChange={v=>fld('totalHatched',v)}/><Inp label="Culls" type="number" value={f.culls} onChange={v=>fld('culls',v)} placeholder="0"/><Inp label="Defects" type="number" value={f.defects} onChange={v=>fld('defects',v)} placeholder="0"/></div>
          {f.totalHatched&&f.eggsSet&&<Notice type="info" message={`Hatchability: ${hPct(parseInt(f.totalHatched||0),parseInt(f.eggsSet||1))}%`}/>}
          <div style={{display:'flex',alignItems:'center',gap:10}}><input type="checkbox" id="hSexed" checked={f.sexed} onChange={e=>fld('sexed',e.target.checked)} style={{width:16,height:16,cursor:'pointer'}}/><label htmlFor="hSexed" style={{fontSize:13,color:T.ink,cursor:'pointer'}}>Chicks were sexed</label></div>
          {f.sexed&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><Inp label="Males" type="number" value={f.maleCount} onChange={v=>fld('maleCount',v)}/><Inp label="Females" type="number" value={f.femaleCount} onChange={v=>fld('femaleCount',v)}/></div>}
          <Inp label="Notes" value={f.notes} onChange={v=>fld('notes',v)} placeholder="Hatch observations"/>
          <div style={{display:'flex',gap:8}}><Btn onClick={save} disabled={!f.eggBatchId||!f.totalHatched}>Record Hatch</Btn><Btn variant="secondary" onClick={()=>setShowForm(false)}>Cancel</Btn></div>
        </div>
      </HModal>)}
    </div>
  );
}

function HInventory({state,dispatch,pendingAction,onActionConsumed}){
  const {inventory}=state;
  const [showForm,setShowForm]=useState(false);
  const [f,setF]=useState({item:'',category:'Vaccine',unit:'dose',stock:'',reorder:'',cost:'',notes:''});
  const [restockTarget,setRestockTarget]=useState(null); // {item, delta}
  const fld=(k,v)=>setF(p=>({...p,[k]:v}));
  const CATS=['Vaccine','Equipment','Disinfectant','Packaging','PPE','Consumable','Other'];
  const scMap={OK:T.ok,Low:T.warn,Out:T.err,Critical:T.err};
  // Deep-link: a low-stock or depleted notification routes here. Highlight the
  // item by opening a quick-restock dialog preselected to it.
  useEffect(()=>{
    if(!pendingAction||!pendingAction.type)return;
    if(pendingAction.type==='restockInventory'){
      const ctx=pendingAction.context||{};
      const item=inventory.find(i=>i.id===ctx.itemId);
      if(item)setRestockTarget({item,delta:Math.max(item.reorder*2,1)});
    }
    if(onActionConsumed)onActionConsumed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[pendingAction]);
  const save=()=>{
    if(!f.item.trim()||!f.stock)return;
    const stock=parseFloat(f.stock)||0,reorder=parseFloat(f.reorder)||0;
    dispatch({type:'ADD_INVENTORY',p:{id:huid('INV'),item:f.item.trim(),category:f.category,unit:f.unit,stock,reorder,cost:parseFloat(f.cost)||0,status:stock<=0?'Out':stock<=reorder?'Low':'OK',notes:f.notes}});
    setF({item:'',category:'Vaccine',unit:'dose',stock:'',reorder:'',cost:'',notes:''});setShowForm(false);
  };
  const adjustStock=(inv,delta)=>{const ns=Math.max(0,inv.stock+delta);dispatch({type:'UPDATE_INVENTORY',p:{...inv,stock:ns,status:ns<=0?'Out':ns<=inv.reorder?'Low':'OK'}});};
  const lowItems=inventory.filter(i=>i.status!=='OK');
  const cats=[...new Set(inventory.map(i=>i.category))];
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}><span style={{fontSize:16,fontWeight:700,color:T.ink}}>Inventory & Consumables</span><Btn size="sm" onClick={()=>setShowForm(true)}>+ Add Item</Btn></div>
      {restockTarget&&<Modal title={`Restock: ${restockTarget.item.item}`} onClose={()=>setRestockTarget(null)}><div style={{display:'flex',flexDirection:'column',gap:12}}>
        <div style={{padding:'10px 12px',background:T.warnBg,border:`1px solid ${T.warn}`,fontSize:12,color:T.ink2,lineHeight:1.5}}>Current stock: <strong>{restockTarget.item.stock} {restockTarget.item.unit}</strong> · Reorder level: <strong>{restockTarget.item.reorder} {restockTarget.item.unit}</strong></div>
        <Inp label={`Quantity to add (${restockTarget.item.unit})`} type="number" value={restockTarget.delta} onChange={v=>setRestockTarget(rt=>({...rt,delta:Number(v)||0}))}/>
        <Btn onClick={()=>{
          if(restockTarget.delta>0){adjustStock(restockTarget.item,restockTarget.delta);}
          setRestockTarget(null);
        }} full>Confirm Restock (+{restockTarget.delta} {restockTarget.item.unit})</Btn>
      </div></Modal>}
      {lowItems.length>0&&<Notice type={lowItems.some(i=>i.status==='Out')?'error':'warn'} message={`Stock alert: ${lowItems.map(i=>`${i.item} (${i.status})`).join(', ')}`}/>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:8}}>
        {[['Total Items',inventory.length],['Low / Out',lowItems.length],['Stock Value',hNgn(inventory.reduce((s,i)=>s+(i.stock*i.cost),0))]].map(([l,v])=>(
          <div key={l} style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'11px 13px'}}><div style={{fontSize:10,color:T.ink4,textTransform:'uppercase',letterSpacing:.4,marginBottom:3}}>{l}</div><div className="mono" style={{fontSize:16,fontWeight:700,color:T.ink}}>{v}</div></div>
        ))}
      </div>
      {cats.map(cat=>(
        <div key={cat} style={{background:T.bg0,border:`1px solid ${T.line}`,overflow:'hidden'}}>
          <div style={{padding:'9px 16px',borderBottom:`1px solid ${T.line}`,fontSize:11,fontWeight:700,color:T.ink4,textTransform:'uppercase',letterSpacing:.8}}>{cat}</div>
          {inventory.filter(i=>i.category===cat).map((inv,idx)=>{
            const pct=inv.reorder>0?Math.min(100,Math.round((inv.stock/(inv.reorder*2))*100)):50;
            const sc=scMap[inv.status]||T.ink3;
            return(<div key={inv.id} style={{padding:'11px 16px',borderTop:idx>0?`1px solid ${T.line}`:'none'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <div><div style={{fontSize:13,fontWeight:500,color:T.ink}}>{inv.item}</div><div style={{fontSize:11,color:T.ink4}}>Reorder at {inv.reorder} {inv.unit} · {hNgn(inv.cost)}/{inv.unit}</div></div>
                <div style={{display:'flex',gap:7,alignItems:'center'}}>
                  <button onClick={()=>adjustStock(inv,-1)} style={{width:28,height:28,border:`1px solid ${T.line}`,background:T.bg0,cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',color:T.ink3}}>-</button>
                  <span className="mono" style={{fontSize:13,fontWeight:600,color:sc,minWidth:70,textAlign:'center'}}>{inv.stock} {inv.unit}</span>
                  <button onClick={()=>adjustStock(inv,1)} style={{width:28,height:28,border:`1px solid ${T.line}`,background:T.bg0,cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',color:T.ink3}}>+</button>
                  <span style={{fontSize:10,padding:'2px 7px',background:`${sc}18`,color:sc,fontWeight:600}}>{inv.status}</span>
                </div>
              </div>
              <div style={{height:3,background:T.bg2,overflow:'hidden'}}><div style={{width:`${pct}%`,height:'100%',background:sc,transition:'width .4s'}}/></div>
            </div>);
          })}
        </div>
      ))}
      {inventory.length===0&&<HEmpty icon="inv" title="No inventory items" sub="Add vaccines, equipment and consumables"/>}
      {showForm&&(<HModal title="Add Inventory Item" onClose={()=>setShowForm(false)}>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <Inp label="Item Name *" value={f.item} onChange={v=>fld('item',v)} placeholder="e.g. Marek's Vaccine"/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><Sel label="Category *" value={f.category} onChange={v=>fld('category',v)} options={CATS}/><Inp label="Unit" value={f.unit} onChange={v=>fld('unit',v)} placeholder="dose, kg, box"/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}><Inp label="Current Stock *" type="number" value={f.stock} onChange={v=>fld('stock',v)}/><Inp label="Reorder Level" type="number" value={f.reorder} onChange={v=>fld('reorder',v)}/><Inp label="Cost/Unit (N)" type="number" value={f.cost} onChange={v=>fld('cost',v)}/></div>
          <div style={{display:'flex',gap:8}}><Btn onClick={save} disabled={!f.item.trim()||!f.stock}>Add Item</Btn><Btn variant="secondary" onClick={()=>setShowForm(false)}>Cancel</Btn></div>
        </div>
      </HModal>)}
    </div>
  );
}

function HFinancials({state,dispatch}){
  const {eggBatches,financialLogs}=state;
  const [showForm,setShowForm]=useState(false);
  const [selBatch,setSelBatch]=useState('');
  const [f,setF]=useState({eggBatchId:'',type:'Cost',category:'Egg Procurement',amount:'',date:hToday(),notes:''});
  const fld=(k,v)=>setF(p=>({...p,[k]:v}));
  const COST_CATS=['Egg Procurement','Incubation','Labor','Utilities','Vaccination','Packaging','Transport','Other'];
  const REV_CATS=['Chick Sales','Infertile Egg Sales','Culled Chick Sales','Other'];
  const save=()=>{
    if(!f.eggBatchId||!f.amount)return;
    dispatch({type:'ADD_FIN',p:{id:huid('HF'),eggBatchId:f.eggBatchId,type:f.type,category:f.category,amount:parseFloat(f.amount)||0,date:f.date,notes:f.notes}});
    setF(p=>({...p,amount:'',notes:''}));setShowForm(false);
  };
  const displayLogs=selBatch?financialLogs.filter(f=>f.eggBatchId===selBatch):financialLogs;
  const tC=displayLogs.filter(f=>f.type==='Cost').reduce((s,f)=>s+Number(f.amount),0);
  const tR=displayLogs.filter(f=>f.type==='Revenue').reduce((s,f)=>s+Number(f.amount),0);
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}><span style={{fontSize:16,fontWeight:700,color:T.ink}}>Financials</span><Btn size="sm" onClick={()=>setShowForm(true)}>+ Add Entry</Btn></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
        <HKPI label="Revenue" value={hNgn(tR)} green={tR>0}/>
        <HKPI label="Cost" value={hNgn(tC)}/>
        <HKPI label="Net P&L" value={hNgn(tR-tC)} green={tR>tC} alert={tR<tC&&tR>0}/>
      </div>
      <Sel label="Filter by Batch" value={selBatch} onChange={setSelBatch} options={[{value:'',label:'All Batches'},...eggBatches.map(e=>({value:e.id,label:e.batchNo}))]}/>
      <div style={{background:T.bg0,border:`1px solid ${T.line}`,overflow:'hidden'}}>
        <div style={{padding:'11px 16px',borderBottom:`1px solid ${T.line}`,fontSize:13,fontWeight:700,color:T.ink}}>Transaction Ledger</div>
        {displayLogs.length===0?<HEmpty icon="fin" title="No transactions" sub="Log costs and revenues per batch"/>:
          <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:480}}>
            <thead><tr style={{background:T.bg2}}>{['Date','Batch','Type','Category','Amount'].map(h=><th key={h} style={{padding:'8px 12px',textAlign:'left',fontSize:11,fontWeight:600,color:T.ink4,textTransform:'uppercase',letterSpacing:.4,whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
            <tbody>{[...displayLogs].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,40).map((f,i)=>{const eb=eggBatches.find(e=>e.id===f.eggBatchId);return(
              <tr key={f.id} style={{borderTop:`1px solid ${T.line}`,background:i%2===0?'#fff':T.bg1}}>
                <td style={{padding:'8px 12px'}}><span className="mono" style={{fontSize:11,color:T.ink4}}>{hFmtDate(f.date)}</span></td>
                <td style={{padding:'8px 12px',fontSize:12,color:T.ink3}}>{eb?.batchNo||'--'}</td>
                <td style={{padding:'8px 12px'}}><span style={{fontSize:11,padding:'2px 7px',background:f.type==='Revenue'?T.okBg:T.errBg,color:f.type==='Revenue'?T.ok:T.err,fontWeight:600}}>{f.type}</span></td>
                <td style={{padding:'8px 12px',fontSize:13,color:T.ink}}>{f.category}</td>
                <td style={{padding:'8px 12px'}}><span className="mono" style={{fontSize:13,fontWeight:600,color:f.type==='Revenue'?T.ok:T.err}}>{hNgn(f.amount)}</span></td>
              </tr>);})}
            </tbody>
          </table></div>}
      </div>
      {showForm&&(<HModal title="Add Financial Entry" onClose={()=>setShowForm(false)}>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <Sel label="Egg Batch *" value={f.eggBatchId} onChange={v=>fld('eggBatchId',v)} options={[{value:'',label:'Select batch'},...eggBatches.map(e=>({value:e.id,label:e.batchNo}))]}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><Sel label="Type *" value={f.type} onChange={v=>{fld('type',v);fld('category',v==='Cost'?COST_CATS[0]:REV_CATS[0]);}} options={['Cost','Revenue']}/><Sel label="Category *" value={f.category} onChange={v=>fld('category',v)} options={f.type==='Cost'?COST_CATS:REV_CATS}/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><Inp label="Amount (N) *" type="number" value={f.amount} onChange={v=>fld('amount',v)}/><Inp label="Date *" type="date" value={f.date} onChange={v=>fld('date',v)}/></div>
          <Inp label="Notes" value={f.notes} onChange={v=>fld('notes',v)} placeholder="Description"/>
          <div style={{display:'flex',gap:8}}><Btn onClick={save} disabled={!f.eggBatchId||!f.amount}>Save Entry</Btn><Btn variant="secondary" onClick={()=>setShowForm(false)}>Cancel</Btn></div>
        </div>
      </HModal>)}
    </div>
  );
}

function HAudit({state}){
  const {auditLog}=state;
  const [q,setQ]=useState('');
  const filtered=q?auditLog.filter(e=>e.action.toLowerCase().includes(q.toLowerCase())):auditLog;
  return(
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{fontSize:16,fontWeight:700,color:T.ink,marginBottom:8}}>Audit & Event Log</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
        {[['Events',auditLog.length],['Entities',[...new Set(auditLog.map(e=>e.entity))].length],['Today',auditLog.filter(e=>e.ts&&e.ts.startsWith(hToday())).length]].map(([l,v])=>(
          <div key={l} style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'10px 13px'}}><div style={{fontSize:10,color:T.ink4,textTransform:'uppercase',letterSpacing:.5,marginBottom:2}}>{l}</div><div className="mono" style={{fontSize:18,fontWeight:700,color:T.ink}}>{v}</div></div>
        ))}
      </div>
      <Inp label="" value={q} onChange={setQ} placeholder="Search audit log..."/>
      <div style={{background:T.bg0,border:`1px solid ${T.line}`,overflow:'hidden'}}>
        {filtered.length===0?<HEmpty icon="audit" title="No events found" sub="All operations recorded here"/>:
          filtered.slice(0,80).map((e,i)=>(
            <div key={e.id||i} style={{display:'flex',gap:10,padding:'10px 14px',borderTop:i>0?`1px solid ${T.line}`:'none',alignItems:'flex-start',background:i%2===0?'#fff':T.bg1}}>
              <div style={{flexShrink:0,width:44}}><div className="mono" style={{fontSize:9,color:T.ink4}}>{new Date(e.ts).toLocaleTimeString('en-NG',{hour:'2-digit',minute:'2-digit'})}</div><div className="mono" style={{fontSize:9,color:T.ink4}}>{new Date(e.ts).toLocaleDateString('en-NG',{day:'numeric',month:'short'})}</div></div>
              <span style={{fontSize:10,padding:'1px 6px',background:`${T.accentBg}`,color:T.accentDark,fontWeight:600,flexShrink:0,alignSelf:'flex-start',marginTop:1}}>{e.entity}</span>
              <div style={{flex:1,fontSize:12,color:T.ink,lineHeight:1.4}}>{e.action}</div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

function HSettingsBackup({state,dispatch,dataMode,onSwitchToLive,onRestoreTraining,license,activeUser,onUpdateLicense}){
  const {settings}=state;
  const [tab,setTab]=useState('settings');
  const [sf,setSf]=useState({...settings});
  const sfF=(k,v)=>setSf(p=>({...p,[k]:v}));
  const [restErr,setRestErr]=useState(''),[restOk,setRestOk]=useState(false);
  const changed=JSON.stringify(sf)!==JSON.stringify(settings);
  const expData=()=>{const pl=JSON.stringify({...state,_exportedAt:new Date().toISOString(),_app:'HatcheryOS',_v:'1.0'},null,2);const b=new Blob([pl],{type:'application/json'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=`HatcheryOS_${hToday()}.json`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);};
  const isValidHSBackup=(d)=>d&&typeof d==='object'&&Array.isArray(d.eggBatches)&&Array.isArray(d.incubationRecords)&&Array.isArray(d.hatchRecords)&&(d._app==='HatcheryOS'||!d._app);
  const impData=(e)=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=(ev)=>{try{const d=JSON.parse(ev.target.result);if(!isValidHSBackup(d)){setRestErr('This file does not appear to be a valid HatcheryOS backup.');setRestOk(false);return;}if(!window.confirm('This will REPLACE all current HatcheryOS data with the backup file. Continue?')){setRestErr('');setRestOk(false);return;}dispatch({type:'RESTORE',p:d});setRestOk(true);setRestErr('');}catch(err){setRestErr(`Restore failed: ${err.message}`);setRestOk(false);}};r.readAsText(file);e.target.value='';};
  const fileInputRef=useRef(null);
  const canViewUsers=can(activeUser?.role,'users','view');
  const tabs=[{id:'settings',label:'Settings'},{id:'backup',label:'Backup & Data'}];
  if(canViewUsers)tabs.push({id:'users',label:'Users & Roles'});
  tabs.push({id:'live',label:'Live Mode'});
  tabs.push({id:'legal',label:'Legal'});
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{fontSize:16,fontWeight:700,color:T.ink,marginBottom:8}}>Settings & Backup</div>
      <TabBar tabs={tabs} active={tab} onChange={setTab}/>
      {tab==='settings'&&(<>
        <div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'16px 18px'}}>
          <div style={{fontSize:13,fontWeight:700,color:T.ink,marginBottom:12}}>Hatchery Identity</div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <Inp label="Hatchery Name" value={sf.hatcheryName} onChange={v=>sfF('hatcheryName',v)} placeholder="Your hatchery name"/>
            <Inp label="Location" value={sf.location} onChange={v=>sfF('location',v)} placeholder="City, State, Country"/>
          </div>
        </div>
        <div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'16px 18px'}}>
          <div style={{fontSize:13,fontWeight:700,color:T.ink,marginBottom:12}}>Incubation Defaults</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
            <Inp label="Incubation Days" type="number" value={sf.incubationDays} onChange={v=>sfF('incubationDays',parseInt(v)||21)} hint="Default: 21"/>
            <Inp label="Candle Day" type="number" value={sf.candleDay} onChange={v=>sfF('candleDay',parseInt(v)||7)} hint="Default: Day 7"/>
            <Inp label="Transfer Day" type="number" value={sf.transferDay} onChange={v=>sfF('transferDay',parseInt(v)||18)} hint="Default: Day 18"/>
          </div>
        </div>
        <div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'16px 18px'}}>
          <div style={{fontSize:13,fontWeight:700,color:T.ink,marginBottom:12}}>Performance Targets</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <Inp label="Target Fertility (%)" type="number" value={sf.targetFertility} onChange={v=>sfF('targetFertility',parseFloat(v)||90)}/>
            <Inp label="Target Hatchability (%)" type="number" value={sf.targetHatchability} onChange={v=>sfF('targetHatchability',parseFloat(v)||85)}/>
          </div>
        </div>
        {changed&&<div style={{display:'flex',gap:8}}><Btn onClick={()=>dispatch({type:'UPDATE_SETTINGS',p:sf})}>Save Settings</Btn><Btn variant="secondary" onClick={()=>setSf({...settings})}>Revert</Btn></div>}
        {!changed&&<Notice type="success" message="All settings saved."/>}
      </>)}
      {tab==='backup'&&(<>
        <Notice type="info" message="Data stored in-memory. Export regularly to prevent loss on refresh."/>
        <div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'16px 18px'}}>
          <div style={{fontSize:13,fontWeight:700,color:T.ink,marginBottom:6}}>Export Backup</div>
          <div style={{fontSize:13,color:T.ink3,marginBottom:12}}>Download complete JSON backup of all HatcheryOS data.</div>
          <Btn onClick={expData}>Download HatcheryOS Backup</Btn>
        </div>
        <div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'16px 18px'}}>
          <div style={{fontSize:13,fontWeight:700,color:T.ink,marginBottom:6}}>Restore from Backup</div>
          {restErr&&<div style={{marginBottom:8}}><Notice type="error" message={restErr}/></div>}
          {restOk&&<div style={{marginBottom:8}}><Notice type="success" message="Restored successfully."/></div>}
          <input ref={fileInputRef} type="file" accept=".json" onChange={impData} style={{display:'none'}}/>
          <button onClick={()=>fileInputRef.current?.click()} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'10px 18px',background:T.btnBg,border:`1px solid ${T.btnBorder}`,fontSize:13,fontWeight:600,color:T.btnText,cursor:'pointer',fontFamily:'inherit',outline:'none',WebkitTapHighlightColor:'transparent',WebkitAppearance:'none'}}>Import Backup File</button>
        </div>
      </>)}
      {tab==='users'&&canViewUsers&&<UserManagementPanel license={license} activeUser={activeUser} onUpdateLicense={onUpdateLicense}/>}
      {tab==='live'&&<LiveModePanel dataMode={dataMode} onSwitchToLive={onSwitchToLive} onRestoreTraining={onRestoreTraining}/>}
      {tab==='legal'&&<LegalSettingsPanel/>}
    </div>
  );
}


function HVaccineProc({state,dispatch}){
  const {eggBatches,hatchRecords,processingRecords}=state;
  const [showForm,setShowForm]=useState(false);
  const [vaccines,setVaccines]=useState([{name:"Marek's Disease",method:'SQ Injection',dosePerChick:0.2}]);
  const [f,setF]=useState({eggBatchId:'',hatchRecordId:'',processDate:hToday(),graded:'',packed:'',culledPost:'',notes:''});
  const fld=(k,v)=>setF(p=>({...p,[k]:v}));
  const addVax=()=>setVaccines(v=>[...v,{name:'',method:'SQ Injection',dosePerChick:1}]);
  const setVax=(i,k,v)=>setVaccines(vs=>vs.map((x,j)=>j===i?{...x,[k]:v}:x));
  const METHODS=['SQ Injection','IM Injection','Eye Drop','Drinking Water','Spray','Wing Web'];
  const procBatches=eggBatches.filter(e=>e.status==='Hatched');
  const save=()=>{
    if(!f.eggBatchId||!f.graded)return;
    dispatch({type:'ADD_PROCESSING',p:{id:huid('PR'),eggBatchId:f.eggBatchId,hatchRecordId:f.hatchRecordId,processDate:f.processDate,vaccines:vaccines.filter(v=>v.name.trim()),graded:parseInt(f.graded)||0,packed:parseInt(f.packed)||0,culledPost:parseInt(f.culledPost)||0,notes:f.notes}});
    setF({eggBatchId:'',hatchRecordId:'',processDate:hToday(),graded:'',packed:'',culledPost:'',notes:''});
    setVaccines([{name:"Marek's Disease",method:'SQ Injection',dosePerChick:0.2}]);setShowForm(false);
  };
  const totalPacked=processingRecords.reduce((s,p)=>s+p.packed,0);
  return(
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <SectionHeader title="Vaccination & Processing" action={<Btn size="sm" onClick={()=>setShowForm(true)}>+ Record Processing</Btn>}/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10}}>
        {[['Sessions',processingRecords.length],['Total Graded',hFmt(processingRecords.reduce((s,p)=>s+p.graded,0))],['DOC Packed',hFmt(totalPacked)],['Post Culls',hFmt(processingRecords.reduce((s,p)=>s+p.culledPost,0))]].map(([l,v])=>(
          <div key={l} style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'12px 14px'}}><div style={{fontSize:10,color:T.ink4,textTransform:'uppercase',letterSpacing:.4,marginBottom:3}}>{l}</div><div className="mono" style={{fontSize:18,fontWeight:700,color:T.ink}}>{v}</div></div>
        ))}
      </div>
      {processingRecords.length===0?<HEmpty icon="proc" title="No processing records" sub="Record chick grading, vaccination, and packaging"/>:
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {processingRecords.map(pr=>{const eb=eggBatches.find(e=>e.id===pr.eggBatchId);return(
            <div key={pr.id} style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'16px 18px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                <div><div style={{fontSize:14,fontWeight:700,color:T.ink,marginBottom:3}}>{eb?.batchNo||'—'}</div><div style={{fontSize:12,color:T.ink4}}>Processed {hFmtDate(pr.processDate)}</div></div>
                <div className="mono" style={{fontSize:24,fontWeight:700,color:T.ink}}>{hFmt(pr.packed)}<span style={{fontSize:11,color:T.ink4,marginLeft:4}}>DOC</span></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:10}}>
                {[['Graded',hFmt(pr.graded)],['Packed',hFmt(pr.packed)],['Post Culls',hFmt(pr.culledPost)]].map(([l,v])=>(
                  <div key={l} style={{background:T.bg1,padding:'8px 10px'}}><div style={{fontSize:10,color:T.ink4,textTransform:'uppercase',letterSpacing:.4,marginBottom:2}}>{l}</div><div className="mono" style={{fontSize:13,fontWeight:600,color:T.ink}}>{v}</div></div>
                ))}
              </div>
              {pr.vaccines.length>0&&<div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{pr.vaccines.map((v,i)=><Tag key={i} label={`${v.name} · ${v.method}`}/>)}</div>}
            </div>
          );})}
        </div>
      }
      {showForm&&(<HModal title="Record Chick Processing" onClose={()=>setShowForm(false)} width={560}>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <Sel label="Egg Batch *" value={f.eggBatchId} onChange={v=>{const hr=hatchRecords.find(h=>h.eggBatchId===v);setF(p=>({...p,eggBatchId:v,hatchRecordId:hr?.id||'',graded:String(hr?hr.totalHatched-hr.culls:'')}));}} options={[{value:'',label:'Select batch'},...procBatches.map(e=>({value:e.id,label:e.batchNo}))]}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><Inp label="Processing Date *" type="date" value={f.processDate} onChange={v=>fld('processDate',v)}/><Inp label="Chicks Graded *" type="number" value={f.graded} onChange={v=>fld('graded',v)}/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><Inp label="Packed for Delivery" type="number" value={f.packed} onChange={v=>fld('packed',v)}/><Inp label="Post Culls" type="number" value={f.culledPost} onChange={v=>fld('culledPost',v)} placeholder="0"/></div>
          <div style={{borderTop:`1px solid ${T.line}`,paddingTop:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><span style={{fontSize:13,fontWeight:600,color:T.ink}}>Vaccines Administered</span><Btn size="sm" variant="secondary" onClick={addVax}>+ Add</Btn></div>
            {vaccines.map((vx,i)=>(
              <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:10,marginBottom:8,alignItems:'end'}}>
                <Inp label={i===0?'Vaccine Name':''} value={vx.name} onChange={v=>setVax(i,'name',v)} placeholder="Marek's Disease"/>
                <Sel label={i===0?'Method':''} value={vx.method} onChange={v=>setVax(i,'method',v)} options={METHODS}/>
                <button onClick={()=>setVaccines(v=>v.filter((_,j)=>j!==i))} style={{background:T.errBg,border:`1px solid ${T.errLine}`,color:T.err,cursor:'pointer',padding:'10px 12px',minHeight:44,fontFamily:'inherit',fontSize:13}}>x</button>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:8}}><Btn onClick={save} disabled={!f.eggBatchId||!f.graded}>Save Processing</Btn><Btn variant="secondary" onClick={()=>setShowForm(false)}>Cancel</Btn></div>
        </div>
      </HModal>)}
    </div>
  );
}

const HS_SEED={
  eggBatches:[{id:'HEB001',batchNo:'HEB-2025-001',sourceFarm:'Crown Breeder Farm',breed:'Ross 308',dateReceived:'2025-01-20',totalQty:15000,rejected:450,graded:14550,status:'Hatched',notes:''},{id:'HEB002',batchNo:'HEB-2025-002',sourceFarm:'Gold Breeder Farm',breed:'Isa Brown',dateReceived:'2025-01-25',totalQty:12000,rejected:360,graded:11640,status:'Incubating',notes:''}],
  incubationRecords:[{id:'INC001',batchId:'HEB001',machineId:'SET-A',setDate:'2025-01-20',expectedHatch:'2025-02-10',temperature:37.8,humidity:58,status:'Complete'},{id:'INC002',batchId:'HEB002',machineId:'SET-B',setDate:'2025-01-25',expectedHatch:'2025-02-15',temperature:37.7,humidity:57,status:'Active'}],
  candlingRecords:[{id:'CND001',batchId:'HEB001',date:'2025-01-27',totalCandled:14550,fertile:13200,infertile:900,earlyDead:280,lateDead:170,notes:'Good fertility'}],
  hatchRecords:[{id:'HCH001',batchId:'HEB001',hatchDate:'2025-02-10',eggsSet:14550,totalHatched:12800,culls:320,defects:140,sexed:false,males:0,females:0,notes:''}],
  processingRecords:[{id:'PRC001',batchId:'HEB001',date:'2025-02-10',chicksGraded:12800,packed:12340,postCulls:120,vaccines:[{vaccine:"Marek's Disease",method:'SQ Injection',dose:0.2,unit:'ml/chick',batchNo:'MRK-2025-01'}],notes:''}],
  inventory:[{id:'INV001',name:"Marek's Vaccine",category:'Vaccine',unit:'dose',stock:50000,reorderLevel:10000,costPerUnit:8,status:'OK',notes:''},{id:'INV002',name:'Chick Boxes',category:'Packaging',unit:'box',stock:800,reorderLevel:200,costPerUnit:350,status:'OK',notes:''}],
  financialLogs:[{id:'HF001',batchId:'HEB001',date:'2025-01-20',type:'Cost',category:'Egg Procurement',amount:2182500,notes:'14550 eggs x N150'},{id:'HF002',batchId:'HEB001',date:'2025-02-10',type:'Revenue',category:'Chick Sales',amount:6170000,notes:'12340 DOC x N500'}],
  auditLog:[{id:'HAL001',ts:new Date(Date.now()-3600000).toISOString(),user:'System',action:'HatcheryOS initialized',entity:'System',entityId:'',prev:null,next:null}],
  settings:{orgName:'',currency:'NGN',mortalityThreshold:2,targetFertility:90,targetHatchability:85,targetHatchRate:80,incubationDays:21,candleDay:7,transferDay:18,enableAlerts:true},
};

function HatcheryModule({capacity,license,activeUser,onUpdateLicense,dataMode,onSwitchToLive,onRestoreTraining,initialSeed}){
  const [hs,dispatch]=useReducer(hsReducer,initialSeed||HS_SEED);
  const [engine,setEngine]=useState(null);
  useEffect(()=>{if(typeof window!=='undefined'){if(!window.__psState)window.__psState={};window.__psState.hatchery=hs;}},[hs]);
  const role=activeUser?.role||'Owner / Director';

  const ALL_ENGINES=[
    {id:'cmd',label:'Command Center',icon:'cmd'},
    {id:'intake',label:'Egg Intake',icon:'intake'},
    {id:'incubation',label:'Incubation',icon:'incubation'},
    {id:'candling',label:'Candling',icon:'candling'},
    {id:'hatch',label:'Hatch Output',icon:'hatch'},
    {id:'vaccine',label:'Vaccination & Processing',icon:'vaccine'},
    {id:'inventory',label:'Inventory',icon:'inventory'},
    {id:'finance',label:'Financials',icon:'finance'},
    {id:'audit',label:'Audit Log',icon:'audit'},
    {id:'settings',label:'Settings & Backup',icon:'settings'},
    {id:'help',label:'Help & Docs',icon:'help'},
  ];
  const ENGINES=ALL_ENGINES.filter(e=>can(role,HATCHERY_ENGINE_RES[e.id],'view'));

  // Deep-link action state — set when a notification routes here with a specific
  // modal to open (e.g. restock a low-inventory item). Engines consume it on mount.
  const [pendingAction,setPendingAction]=useState(null);
  const consumePendingAction=useCallback(()=>setPendingAction(null),[]);

  const renderEngine=(id)=>{
    const resource=HATCHERY_ENGINE_RES[id];
    const ro=resource?!can(role,resource,'write'):false;
    const actionFor=(eng)=>pendingAction&&pendingAction.type&&matchesEngine(pendingAction.type,eng)?pendingAction:null;
    let content=null;
    if(id==='cmd')      content=<HCmdCenter       state={hs}/>;
    else if(id==='intake')   content=<HEggIntake        state={hs} dispatch={dispatch} licenseCapacity={capacity}/>;
    else if(id==='incubation')content=<HIncubation      state={hs} dispatch={dispatch}/>;
    else if(id==='candling') content=<HCandling         state={hs} dispatch={dispatch} pendingAction={actionFor('candling')} onActionConsumed={consumePendingAction}/>;
    else if(id==='hatch')    content=<HHatch            state={hs} dispatch={dispatch} pendingAction={actionFor('hatch')} onActionConsumed={consumePendingAction}/>;
    else if(id==='vaccine')  content=<HVaccineProc      state={hs} dispatch={dispatch}/>;
    else if(id==='inventory')content=<HInventory        state={hs} dispatch={dispatch} pendingAction={actionFor('inventory')} onActionConsumed={consumePendingAction}/>;
    else if(id==='finance')  content=<HFinancials       state={hs} dispatch={dispatch}/>;
    else if(id==='audit')    content=<HAudit            state={hs}/>;
    else if(id==='help')     content=<HelpDocEngine     module='hatchery'/>;
    else if(id==='settings') content=<HSettingsBackup   state={hs} dispatch={dispatch} dataMode={dataMode} onSwitchToLive={onSwitchToLive} onRestoreTraining={onRestoreTraining} license={license} activeUser={activeUser} onUpdateLicense={onUpdateLicense}/>;
    if(!content)return null;
    return(<>{ro&&<ReadOnlyBanner role={role}/>}<fieldset disabled={ro} style={{border:'none',padding:0,margin:0,minWidth:0}}>{content}</fieldset></>);
  };

  const lowInv=hs.inventory.filter(i=>i.status!=='OK').length;
  const badge=(id)=>(id==='inventory'&&lowInv>0)?lowInv:0;
  const activeLabel=ENGINES.find(e=>e.id===engine)?.label||'';

  // Deep-link reader (notification → engine + optional action)
  useEffect(()=>{
    try{
      const p=window.__psPendingEngine;
      if(p&&p.module==='hatchery'&&p.engine){
        const target=ENGINES.find(e=>e.id===p.engine);
        if(target){
          setEngine(p.engine);
          if(p.action) setPendingAction({type:p.action,context:p.context||null,ts:p.ts});
        }
        window.__psPendingEngine=null;
      }
    }catch(_){}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  return(
    <div style={{display:'grid',gridTemplateColumns:'minmax(220px,260px) 1fr',gap:0,minHeight:500,background:T.bg0,border:`1px solid ${T.line}`}}>
      <div style={{borderRight:`1px solid ${T.line}`,background:T.bg1,display:'flex',flexDirection:'column',minWidth:0}}>
        <EngineNav
          moduleName="HatcheryOS"
          moduleSubtitle="Chick Production Operating System"
          engines={ENGINES}
          activeEngine={engine}
          onSelect={setEngine}
          badgeFn={badge}
          readOnlyFn={(id)=>!can(role,HATCHERY_ENGINE_RES[id],'write')}
          IconComp={HIcon}
        />
        <div style={{marginTop:'auto'}}><AppFooter/></div>
      </div>
      <div style={{padding:'16px 24px 28px',minWidth:0,display:'flex',flexDirection:'column'}}>
        {engine?(<>
          <EngineBreadcrumb moduleName="HatcheryOS" engineLabel={activeLabel} onHome={()=>setEngine(null)}/>
          <div className="au" key={engine} style={{minWidth:0}}>{renderEngine(engine)}</div>
        </>):(
          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start',justifyContent:'center',minHeight:300,padding:'24px 4px'}}>
            <div style={{fontSize:11,fontWeight:700,color:T.ink4,letterSpacing:2,textTransform:'uppercase',marginBottom:10}}>HatcheryOS</div>
            <div style={{fontSize:22,fontWeight:700,color:T.ink,letterSpacing:-0.3,lineHeight:1.25,marginBottom:8}}>Choose an engine to get started</div>
            <div style={{fontSize:13,color:T.ink3,lineHeight:1.6,maxWidth:480}}>Select one of the engines on the left to view its dashboard, record activity, or run reports. The navigation stays visible so you can move between engines without losing your place.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  FEEDMILL OS — Full Implementation
// ═══════════════════════════════════════════════════════
const fmuid=(p='FM')=>`${p}-${Date.now().toString(36).toUpperCase().slice(-5)}-${Math.random().toString(36).slice(2,5).toUpperCase()}`;
const fmToday=()=>new Date().toISOString().split('T')[0];
const fmFmtDate=d=>d?new Date(d).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'}):'--';
const fmNgn=n=>`\u20a6${Number(n||0).toLocaleString('en-NG')}`;
const fmFmt=n=>Number(n||0).toLocaleString('en-NG');
const fmPct=(a,b)=>b>0?((a/b)*100).toFixed(1):'0.0';

function FMBadge({status}){
  const m={'Completed':{bg:T.okBg,c:T.ok},'In Progress':{bg:'#FFFBEB',c:'#F59E0B'},'Cancelled':{bg:T.errBg,c:T.err},'Available':{bg:T.okBg,c:T.ok},'Partial':{bg:'#FFFBEB',c:'#F59E0B'},'Depleted':{bg:T.bg2,c:T.ink4},'Delivered':{bg:T.okBg,c:T.ok},'Pass':{bg:T.okBg,c:T.ok},'Fail':{bg:T.errBg,c:T.err},'Active':{bg:T.bg2,c:T.ink3},'Archived':{bg:T.bg2,c:T.ink4},'OK':{bg:T.okBg,c:T.ok},'Low':{bg:'#FFFBEB',c:T.warn},'Critical':{bg:T.errBg,c:T.err}};
  const {bg,c}=m[status]||{bg:T.bg2,c:T.ink3};
  return <span style={{fontSize:11,padding:'2px 9px',background:bg,color:c,fontWeight:600,letterSpacing:.4}}>{status}</span>;
}
function FMKPI({label,value,unit,sub,alert,green}){
  const c=alert?T.err:green?T.ok:T.ink;const bg=alert?T.errBg:green?T.okBg:'#fff';const bord=alert?T.errLine:green?T.okLine:T.line;
  return(<div style={{background:bg,border:`1px solid ${bord}`,padding:'13px 15px'}}><div style={{fontSize:10,fontWeight:600,color:T.ink4,textTransform:'uppercase',letterSpacing:.7,marginBottom:4}}>{label}</div><div className="mono" style={{fontSize:24,fontWeight:700,color:c,lineHeight:1}}>{value}{unit&&<span style={{fontSize:11,color:T.ink4,marginLeft:3,fontWeight:400}}>{unit}</span>}</div>{sub&&<div style={{fontSize:11,color:T.ink4,marginTop:2}}>{sub}</div>}</div>);
}
function FMModal({title,onClose,children,width=520}){
  React.useEffect(()=>{
    const handleEsc=(e)=>{if(e.key==='Escape')onClose();};
    document.addEventListener('keydown',handleEsc);
    return()=>document.removeEventListener('keydown',handleEsc);
  },[onClose]);
  return(<div style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:9000,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={onClose}><div style={{background:T.bg0,width:'100%',maxWidth:width,maxHeight:'90vh',display:'flex',flexDirection:'column',WebkitOverflowScrolling:'touch',boxShadow:'0 24px 64px rgba(0,0,0,0.35)',position:'relative'}} onClick={e=>e.stopPropagation()}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 14px 14px 20px',borderBottom:`1px solid ${T.line}`,background:T.bg0,flexShrink:0,gap:12}}><span style={{fontSize:16,fontWeight:700,color:T.ink,flex:1,minWidth:0}}>{title}</span><button onClick={onClose} type="button" aria-label="Close" style={{background:'#DC2626',border:'none',cursor:'pointer',color:'#fff',width:36,height:36,minHeight:36,minWidth:36,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,lineHeight:1,fontWeight:700,padding:0,borderRadius:0,flexShrink:0}}>×</button></div><div style={{padding:'18px 20px',overflowY:'auto',flex:1}}>{children}</div></div></div>);
}
function FMEmpty({icon,title,sub}){
  return(<div style={{textAlign:'center',padding:'36px 20px',color:T.ink4}}>
    <div style={{width:38,height:38,border:`1px solid ${T.line}`,display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:12}}>
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={T.ink4} strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8M8 12h8"/></svg>
    </div>
    <div style={{fontSize:13,fontWeight:600,color:T.ink3,marginBottom:3}}>{title}</div>
    <div style={{fontSize:12,color:T.ink4,lineHeight:1.5}}>{sub}</div>
  </div>);
}

const FM_SEED={
  recipes:[
    {id:'RC001',name:'Broiler Starter',type:'Broiler',version:'v2.1',targetCP:22,targetME:3050,status:'Active',ingredients:[{material:'Maize',pct:55,purpose:'Energy'},{material:'Soybean Meal',pct:28,purpose:'Protein'},{material:'Fish Meal',pct:5,purpose:'Protein'},{material:'Palm Oil',pct:3,purpose:'Energy'},{material:'Dicalcium Phosphate',pct:2,purpose:'Mineral'},{material:'Limestone',pct:1.5,purpose:'Mineral'},{material:'Salt',pct:0.3,purpose:'Mineral'},{material:'Broiler Premix',pct:0.25,purpose:'Additive'},{material:'Lysine',pct:0.2,purpose:'AA'},{material:'Methionine',pct:0.15,purpose:'AA'},{material:'Toxin Binder',pct:0.1,purpose:'Additive'},{material:'Moisture',pct:4.5,purpose:'Other'}],notes:'Standard commercial broiler starter'},
    {id:'RC002',name:'Layer Mash',type:'Layer',version:'v3.0',targetCP:16,targetME:2750,status:'Active',ingredients:[{material:'Maize',pct:58,purpose:'Energy'},{material:'Soybean Meal',pct:18,purpose:'Protein'},{material:'Fish Meal',pct:2,purpose:'Protein'},{material:'Limestone',pct:8,purpose:'Mineral'},{material:'Dicalcium Phosphate',pct:2,purpose:'Mineral'},{material:'Palm Oil',pct:2,purpose:'Energy'},{material:'Salt',pct:0.3,purpose:'Mineral'},{material:'Layer Premix',pct:0.25,purpose:'Additive'},{material:'Lysine',pct:0.1,purpose:'AA'},{material:'Methionine',pct:0.1,purpose:'AA'},{material:'Toxin Binder',pct:0.1,purpose:'Additive'},{material:'Moisture',pct:9.15,purpose:'Other'}],notes:'High calcium layer formulation'},
  ],
  rawMaterials:[
    {id:'RM001',name:'Maize',category:'Grain',supplier:'Agro Dealers Ltd',unit:'kg',stock:48200,reorder:15000,costPerUnit:250,dateReceived:'2025-01-20',qualityGrade:'A',moisture:13.2,status:'OK',notes:''},
    {id:'RM002',name:'Soybean Meal',category:'Protein',supplier:'SoyMill Nigeria',unit:'kg',stock:22800,reorder:8000,costPerUnit:520,dateReceived:'2025-01-18',qualityGrade:'A',moisture:11.0,status:'OK',notes:''},
    {id:'RM003',name:'Fish Meal',category:'Protein',supplier:'Atlantic Fish Co',unit:'kg',stock:6100,reorder:3000,costPerUnit:980,dateReceived:'2025-01-15',qualityGrade:'B',moisture:10.5,status:'OK',notes:''},
    {id:'RM004',name:'Palm Oil',category:'Fat',supplier:'Okomu Oil',unit:'litre',stock:3400,reorder:1500,costPerUnit:1100,dateReceived:'2025-01-22',qualityGrade:'A',moisture:0,status:'OK',notes:''},
    {id:'RM005',name:'Limestone',category:'Mineral',supplier:'Rock Minerals Ltd',unit:'kg',stock:9500,reorder:4000,costPerUnit:85,dateReceived:'2025-01-10',qualityGrade:'A',moisture:0,status:'OK',notes:''},
    {id:'RM006',name:'Broiler Premix',category:'Premix',supplier:'Elanco Nigeria',unit:'kg',stock:380,reorder:200,costPerUnit:4500,dateReceived:'2025-01-25',qualityGrade:'A',moisture:0,status:'OK',notes:''},
    {id:'RM007',name:'Toxin Binder',category:'Additive',supplier:'Biomin Nigeria',unit:'kg',stock:95,reorder:50,costPerUnit:2800,dateReceived:'2025-01-12',qualityGrade:'A',moisture:0,status:'Low',notes:'Order pending'},
  ],
  productionBatches:[
    {id:'PB001',batchNo:'FMB-2025-001',recipeId:'RC001',recipeName:'Broiler Starter',targetQty:5000,actualQty:4980,unit:'kg',startDate:'2025-01-20',endDate:'2025-01-20',status:'Completed',operator:'Emeka O.',millId:'MILL-A',notes:'Excellent run'},
    {id:'PB002',batchNo:'FMB-2025-002',recipeId:'RC002',recipeName:'Layer Mash',targetQty:6000,actualQty:0,unit:'kg',startDate:'2025-01-28',endDate:'',status:'In Progress',operator:'Chidi A.',millId:'MILL-A',notes:''},
  ],
  qcRecords:[{id:'QC001',batchId:'PB001',date:'2025-01-20',moisture:12.1,pelletDurability:94.2,uniformity:'Good',contaminants:'None',result:'Pass',notes:''}],
  finishedInventory:[{id:'FI001',batchId:'PB001',recipeName:'Broiler Starter',qty:2980,unit:'kg',dateProduced:'2025-01-20',expiryDate:'2025-04-20',location:'Store A',status:'Partial'}],
  distributions:[{id:'DS001',finishedInventoryId:'FI001',date:'2025-01-21',destination:'Sunrise Farm',destinationType:'Internal (PoultryOS)',qty:2000,unit:'kg',status:'Delivered',notes:''}],
  financialLogs:[
    {id:'FF001',batchId:'PB001',date:'2025-01-20',type:'Cost',category:'Raw Materials',amount:1050000,notes:''},
    {id:'FF002',batchId:'PB001',date:'2025-01-20',type:'Cost',category:'Labor',amount:85000,notes:''},
    {id:'FF003',batchId:'PB001',date:'2025-01-20',type:'Cost',category:'Energy',amount:62000,notes:''},
    {id:'FF004',batchId:'PB001',date:'2025-01-21',type:'Revenue',category:'Feed Sales',amount:1692000,notes:'2,000kg'},
  ],
  auditLog:[{id:'FMA001',ts:new Date(Date.now()-7200000).toISOString(),user:'System',action:'FeedMillOS initialized',entity:'System',prev:null,next:null}],
  settings:{millName:'',location:'',currency:'NGN',weightUnit:'kg',defaultMillId:'MILL-A',targetEfficiency:95,stockAlertDays:7,alertsEnabled:true},
};


// ── Empty seeds for Live Mode (no demo data)
const PS_EMPTY={houses:[],batches:[],mortalityLogs:[],feedLogs:[],feedTypes:['Broiler Starter','Broiler Grower','Broiler Finisher','Layer Mash','Layer Concentrate','Chick Mash','Pre-Starter'],vaccinations:[],healthLogs:[],financialLogs:[],auditLog:[{id:'AL-LIVE-001',ts:new Date().toISOString(),user:'System',action:'Switched to Live Mode — clean environment initialized',entity:'System',entityId:'',prev:null,next:null}],settings:{orgName:'',location:'',currency:'NGN',currencySymbol:'N',weightUnit:'kg',defaultBatchType:'Broiler',mortalityThreshold:2.0,eggProductionThreshold:75,feedStockDaysThreshold:3,reminderDays:2,enableAlerts:true,enableVaxReminder:true}};
const HS_EMPTY={eggBatches:[],incubationRecords:[],candlingRecords:[],hatchRecords:[],processingRecords:[],inventory:[],financialLogs:[],auditLog:[{id:'HAL-LIVE-001',ts:new Date().toISOString(),user:'System',action:'Switched to Live Mode — clean environment initialized',entity:'System',prev:null,next:null}],settings:{hatcheryName:'',location:'',currency:'NGN',symbol:'N',incubationDays:21,candleDay:7,transferDay:18,targetFertility:90,targetHatchability:85,targetHatchRate:80,alertsEnabled:true}};
const FM_EMPTY={recipes:[],rawMaterials:[],productionBatches:[],qcRecords:[],finishedInventory:[],distributions:[],financialLogs:[],auditLog:[{id:'FMA-LIVE-001',ts:new Date().toISOString(),user:'System',action:'Switched to Live Mode — clean environment initialized',entity:'System',prev:null,next:null}],settings:{millName:'',location:'',currency:'NGN',weightUnit:'kg',defaultMillId:'MILL-A',targetEfficiency:95,stockAlertDays:7,alertsEnabled:true}};

// ── Data mode storage helpers


function FMCmdCenter({state,dataMode}){
  const {productionBatches,rawMaterials,finishedInventory,financialLogs}=state;
  const completed=productionBatches.filter(b=>b.status==='Completed');
  const inProg=productionBatches.filter(b=>b.status==='In Progress');
  const totalRev=financialLogs.filter(f=>f.type==='Revenue').reduce((s,f)=>s+Number(f.amount),0);
  const totalCost=financialLogs.filter(f=>f.type==='Cost').reduce((s,f)=>s+Number(f.amount),0);
  const lowStock=rawMaterials.filter(r=>r.status!=='OK');
  const finStock=finishedInventory.filter(f=>f.status!=='Depleted').reduce((s,f)=>s+f.qty,0);
  const avgEff=completed.length&&completed.reduce((s,b)=>s+b.targetQty,0)>0?fmPct(completed.reduce((s,b)=>s+b.actualQty,0),completed.reduce((s,b)=>s+b.targetQty,0)):'--';
  if(dataMode==='live'&&state.recipes.length===0&&productionBatches.length===0){
    return <LiveModeWelcome module="feedmill"/>;
  }
  return(
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      {lowStock.length>0&&<Notice type={lowStock.some(r=>r.status==='Critical')?'error':'warn'} message={`Stock alert: ${lowStock.map(r=>`${r.name} (${r.status})`).join(', ')}`}/>}
      {inProg.length>0&&<Notice type="info" message={`${inProg.length} batch${inProg.length>1?'es':''} in progress`}/>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:10}}>
        <FMKPI label="Total Batches" value={productionBatches.length} sub={`${inProg.length} running`}/>
        <FMKPI label="Total Produced" value={fmFmt(completed.reduce((s,b)=>s+b.actualQty,0))} unit="kg"/>
        <FMKPI label="Avg Efficiency" value={avgEff} unit={avgEff!=='--'?'%':''} green={parseFloat(avgEff)>=(state.settings.targetEfficiency||95)&&completed.length>0}/>
        <FMKPI label="Finished Stock" value={fmFmt(finStock)} unit="kg" green={finStock>0}/>
        <FMKPI label="Net P&L" value={fmNgn(totalRev-totalCost)} green={totalRev>totalCost} alert={totalRev<totalCost&&totalRev>0}/>
      </div>
      <div style={{background:T.bg0,border:`1px solid ${T.line}`,overflow:'hidden'}}>
        <div style={{padding:'11px 16px',borderBottom:`1px solid ${T.line}`,fontSize:13,fontWeight:700,color:T.ink}}>Recent Production Batches</div>
        {productionBatches.length===0?<FMEmpty icon="feed" title="No batches yet" sub="Start a production run"/>:
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{background:T.bg2}}>{['Batch','Recipe','Target','Produced','Eff%','Status'].map(h=><th key={h} style={{padding:'7px 12px',textAlign:'left',fontSize:11,fontWeight:600,color:T.ink4,textTransform:'uppercase',letterSpacing:.4,whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
            <tbody>{productionBatches.slice(0,8).map((b,i)=>{const eff=b.targetQty>0&&b.actualQty>0?fmPct(b.actualQty,b.targetQty):'--';return(
              <tr key={b.id} style={{borderTop:`1px solid ${T.line}`,background:i%2===0?'#fff':T.bg1}}>
                <td style={{padding:'9px 12px'}}><div style={{fontWeight:600,fontSize:13}}>{b.batchNo}</div><div style={{fontSize:11,color:T.ink4}}>{fmFmtDate(b.startDate)}</div></td>
                <td style={{padding:'9px 12px',fontSize:12,color:T.ink3}}>{b.recipeName}</td>
                <td style={{padding:'9px 12px'}}><span className="mono" style={{fontSize:12}}>{fmFmt(b.targetQty)}kg</span></td>
                <td style={{padding:'9px 12px'}}><span className="mono" style={{fontSize:12}}>{b.actualQty>0?fmFmt(b.actualQty)+'kg':'--'}</span></td>
                <td style={{padding:'9px 12px'}}><span className="mono" style={{fontSize:12,color:parseFloat(eff)>=95?T.ok:eff!=='--'?T.warn:T.ink4}}>{eff}{eff!=='--'?'%':''}</span></td>
                <td style={{padding:'9px 12px'}}><FMBadge status={b.status}/></td>
              </tr>);})}
            </tbody>
          </table>
        }
      </div>
      <div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'13px 16px'}}>
        <div style={{fontSize:13,fontWeight:700,color:T.ink,marginBottom:10}}>Raw Material Status</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:8}}>
          {rawMaterials.slice(0,6).map(rm=>{const pct=rm.reorder>0?Math.min(100,Math.round((rm.stock/(rm.reorder*2.5))*100)):60;const sc=rm.status==='OK'?T.ok:rm.status==='Low'?T.warn:T.err;return(
            <div key={rm.id} style={{background:T.bg1,padding:'9px 11px'}}>
              <div style={{fontSize:11,fontWeight:600,color:T.ink,marginBottom:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{rm.name}</div>
              <div className="mono" style={{fontSize:13,fontWeight:700,color:sc,marginBottom:3}}>{fmFmt(rm.stock)}<span style={{fontSize:9,color:T.ink4,marginLeft:2}}>{rm.unit}</span></div>
              <div style={{height:3,background:T.bg2,overflow:'hidden'}}><div style={{width:`${pct}%`,height:'100%',background:sc}}/></div>
            </div>
          );})}
        </div>
      </div>
    </div>
  );
}

function FMRecipe({state,dispatch}){
  const {recipes}=state;
  const [showForm,setShowForm]=useState(false);
  const [sel,setSel]=useState(null);
  const FTYPES=['Broiler','Layer','Grower','Finisher','Starter','Chick Mash','Concentrates','Custom'];
  const PURP=['Energy','Protein','Mineral','Vitamin','AA','Additive','Fat','Other'];
  const emptyI=()=>({material:'',pct:'',purpose:'Energy'});
  const [f,setF]=useState({name:'',type:'Broiler',version:'v1.0',targetCP:'',targetME:'',notes:'',ings:[emptyI(),emptyI(),emptyI()]});
  const fld=(k,v)=>setF(p=>({...p,[k]:v}));
  const ingF=(i,k,v)=>setF(p=>({...p,ings:p.ings.map((x,j)=>j===i?{...x,[k]:v}:x)}));
  const tot=f.ings.reduce((s,x)=>s+parseFloat(x.pct||0),0);
  const save=()=>{
    if(!f.name.trim())return;
    dispatch({type:'ADD_RECIPE',p:{id:fmuid('RC'),name:f.name.trim(),type:f.type,version:f.version,targetCP:parseFloat(f.targetCP)||0,targetME:parseFloat(f.targetME)||0,status:'Active',ingredients:f.ings.filter(x=>x.material.trim()&&x.pct),notes:f.notes}});
    setF({name:'',type:'Broiler',version:'v1.0',targetCP:'',targetME:'',notes:'',ings:[emptyI(),emptyI(),emptyI()]});setShowForm(false);
  };
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}><span style={{fontSize:16,fontWeight:700,color:T.ink}}>Formulation & Recipes</span><Btn size="sm" onClick={()=>setShowForm(true)}>+ New Recipe</Btn></div>
      {recipes.length===0?<FMEmpty icon="recipe" title="No recipes defined" sub="Create feed formulations to use in production"/>:
        recipes.map(rc=>(
          <div key={rc.id} style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'13px 16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
              <div><div style={{display:'flex',gap:7,alignItems:'center',marginBottom:3}}><span style={{fontSize:14,fontWeight:700,color:T.ink}}>{rc.name}</span><FMBadge status={rc.status}/><span style={{fontSize:10,background:T.bg2,padding:'1px 6px',color:T.ink4}}>{rc.version}</span></div><div style={{fontSize:11,color:T.ink4}}>{rc.type} · CP: {rc.targetCP}% · ME: {rc.targetME} kcal/kg</div></div>
              <button onClick={()=>setSel(sel===rc.id?null:rc.id)} style={{background:'none',border:`1px solid ${T.line}`,fontSize:11,color:T.ink3,cursor:'pointer',padding:'4px 10px',minHeight:32,fontFamily:'inherit'}}>{sel===rc.id?'Hide':'View'}</button>
            </div>
            {sel===rc.id&&(<div style={{borderTop:`1px solid ${T.line}`,paddingTop:10}}>
              {rc.ingredients.map((ing,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                  <span style={{fontSize:12,color:T.ink,width:130,flexShrink:0}}>{ing.material}</span>
                  <div style={{flex:1,height:4,background:T.bg2,overflow:'hidden'}}><div style={{width:`${Math.min(100,parseFloat(ing.pct)||0)}%`,height:'100%',background:T.ink}}/></div>
                  <span className="mono" style={{fontSize:12,fontWeight:600,width:38,textAlign:'right'}}>{ing.pct}%</span>
                  <span style={{fontSize:10,color:T.ink4,width:60}}>{ing.purpose}</span>
                </div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between',marginTop:6,paddingTop:6,borderTop:`1px solid ${T.line}`}}>
                <span className="mono" style={{fontSize:12,fontWeight:700}}>Total: {rc.ingredients.reduce((s,x)=>s+parseFloat(x.pct||0),0).toFixed(1)}%</span>
                <Btn size="sm" variant="secondary" onClick={()=>dispatch({type:'UPDATE_RECIPE',p:{...rc,status:rc.status==='Active'?'Archived':'Active'}})}>{rc.status==='Active'?'Archive':'Restore'}</Btn>
              </div>
            </div>)}
          </div>
        ))
      }
      {showForm&&(<FMModal title="New Feed Recipe" onClose={()=>setShowForm(false)} width={580}>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><Inp label="Recipe Name *" value={f.name} onChange={v=>fld('name',v)} placeholder="e.g. Broiler Starter"/><Sel label="Feed Type *" value={f.type} onChange={v=>fld('type',v)} options={FTYPES}/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}><Inp label="Version" value={f.version} onChange={v=>fld('version',v)} placeholder="v1.0"/><Inp label="Target CP (%)" type="number" value={f.targetCP} onChange={v=>fld('targetCP',v)} placeholder="22"/><Inp label="Target ME (kcal/kg)" type="number" value={f.targetME} onChange={v=>fld('targetME',v)} placeholder="3050"/></div>
          <div style={{borderTop:`1px solid ${T.line}`,paddingTop:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <span style={{fontSize:13,fontWeight:600,color:T.ink}}>Ingredients</span>
              <div style={{display:'flex',gap:8,alignItems:'center'}}><span className="mono" style={{fontSize:11,color:Math.abs(tot-100)<0.1?T.ok:T.warn,fontWeight:600}}>{tot.toFixed(1)}%</span><Btn size="sm" variant="secondary" onClick={()=>setF(p=>({...p,ings:[...p.ings,emptyI()]}))}>+ Row</Btn></div>
            </div>
            {f.ings.map((ing,i)=>(
              <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 70px 90px auto',gap:6,marginBottom:6,alignItems:'end'}}>
                <Inp label={i===0?'Ingredient':''} value={ing.material} onChange={v=>ingF(i,'material',v)} placeholder="Maize"/>
                <Inp label={i===0?'%':''} type="number" value={ing.pct} onChange={v=>ingF(i,'pct',v)} placeholder="0"/>
                <Sel label={i===0?'Purpose':''} value={ing.purpose} onChange={v=>ingF(i,'purpose',v)} options={PURP}/>
                <button onClick={()=>setF(p=>({...p,ings:p.ings.filter((_,j)=>j!==i)}))} style={{background:T.errBg,border:`1px solid ${T.errLine}`,color:T.err,cursor:'pointer',padding:'9px',minHeight:42,fontSize:13}}>x</button>
              </div>
            ))}
            {Math.abs(tot-100)>0.1&&f.ings.some(x=>x.pct)&&<Notice type={tot>100?'error':'warn'} message={`Total: ${tot.toFixed(1)}% -- must equal 100%`}/>}
          </div>
          <div style={{display:'flex',gap:8}}><Btn onClick={save} disabled={!f.name.trim()}>Save Recipe</Btn><Btn variant="secondary" onClick={()=>setShowForm(false)}>Cancel</Btn></div>
        </div>
      </FMModal>)}
    </div>
  );
}

function FMRawMaterial({state,dispatch,pendingAction,onActionConsumed}){
  const {rawMaterials}=state;
  const [showForm,setShowForm]=useState(false);
  const [f,setF]=useState({name:'',category:'Grain',supplier:'',unit:'kg',stock:'',reorder:'',costPerUnit:'',qualityGrade:'A',moisture:'',notes:''});
  const [restockTarget,setRestockTarget]=useState(null);
  const fld=(k,v)=>setF(p=>({...p,[k]:v}));
  const CATS=['Grain','Protein','Fat','Mineral','Premix','Amino Acid','Additive','Vitamin','Other'];
  // Deep-link: low-material notification routes here. Open restock dialog
  // preset to the flagged material so the user takes one step to act.
  useEffect(()=>{
    if(!pendingAction||!pendingAction.type)return;
    if(pendingAction.type==='restockMaterial'){
      const ctx=pendingAction.context||{};
      const item=rawMaterials.find(r=>r.id===ctx.itemId);
      if(item)setRestockTarget({item,delta:Math.max(item.reorder*2,1)});
    }
    if(onActionConsumed)onActionConsumed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[pendingAction]);
  const save=()=>{
    if(!f.name.trim()||!f.stock)return;
    const stock=parseFloat(f.stock)||0,reorder=parseFloat(f.reorder)||0;
    dispatch({type:'ADD_RM',p:{id:fmuid('RM'),name:f.name.trim(),category:f.category,supplier:f.supplier,unit:f.unit,stock,reorder,costPerUnit:parseFloat(f.costPerUnit)||0,dateReceived:fmToday(),qualityGrade:f.qualityGrade,moisture:parseFloat(f.moisture)||0,status:stock<=0?'Critical':stock<=reorder?'Low':'OK',notes:f.notes}});
    setF({name:'',category:'Grain',supplier:'',unit:'kg',stock:'',reorder:'',costPerUnit:'',qualityGrade:'A',moisture:'',notes:''});setShowForm(false);
  };
  const adj=(rm,d)=>{const ns=Math.max(0,rm.stock+d);dispatch({type:'UPDATE_RM',p:{...rm,stock:ns,status:ns<=0?'Critical':ns<=rm.reorder?'Low':'OK'}});};
  const low=rawMaterials.filter(r=>r.status!=='OK');
  const cats=[...new Set(rawMaterials.map(r=>r.category))];
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}><span style={{fontSize:16,fontWeight:700,color:T.ink}}>Raw Material Inventory</span><Btn size="sm" onClick={()=>setShowForm(true)}>+ Record Intake</Btn></div>
      {restockTarget&&<FMModal title={`Restock: ${restockTarget.item.name}`} onClose={()=>setRestockTarget(null)} width={420}><div style={{display:'flex',flexDirection:'column',gap:12}}>
        <div style={{padding:'10px 12px',background:T.warnBg,border:`1px solid ${T.warn}`,fontSize:12,color:T.ink2,lineHeight:1.5}}>Current stock: <strong>{restockTarget.item.stock.toLocaleString()} {restockTarget.item.unit}</strong> · Reorder level: <strong>{restockTarget.item.reorder.toLocaleString()} {restockTarget.item.unit}</strong></div>
        <Inp label={`Quantity to add (${restockTarget.item.unit})`} type="number" value={restockTarget.delta} onChange={v=>setRestockTarget(rt=>({...rt,delta:Number(v)||0}))}/>
        <Btn onClick={()=>{
          if(restockTarget.delta>0){adj(restockTarget.item,restockTarget.delta);}
          setRestockTarget(null);
        }} full>Confirm Restock (+{restockTarget.delta} {restockTarget.item.unit})</Btn>
      </div></FMModal>}
      {low.length>0&&<Notice type={low.some(r=>r.status==='Critical')?'error':'warn'} message={`Stock alert: ${low.map(r=>`${r.name} (${r.status})`).join(', ')}`}/>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:8}}>
        {[['Materials',rawMaterials.length],['Low / Critical',low.length],['Stock Value',fmNgn(rawMaterials.reduce((s,r)=>s+(r.stock*r.costPerUnit),0))]].map(([l,v])=>(
          <div key={l} style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'11px 13px'}}><div style={{fontSize:10,color:T.ink4,textTransform:'uppercase',letterSpacing:.4,marginBottom:2}}>{l}</div><div className="mono" style={{fontSize:16,fontWeight:700,color:T.ink}}>{v}</div></div>
        ))}
      </div>
      {cats.map(cat=>(
        <div key={cat} style={{background:T.bg0,border:`1px solid ${T.line}`,overflow:'hidden'}}>
          <div style={{padding:'8px 16px',borderBottom:`1px solid ${T.line}`,fontSize:11,fontWeight:700,color:T.ink4,textTransform:'uppercase',letterSpacing:.8}}>{cat}</div>
          {rawMaterials.filter(r=>r.category===cat).map((rm,idx)=>{
            const pct=rm.reorder>0?Math.min(100,Math.round((rm.stock/(rm.reorder*2.5))*100)):60;
            const sc=rm.status==='OK'?T.ok:rm.status==='Low'?T.warn:T.err;
            return(<div key={rm.id} style={{padding:'10px 16px',borderTop:idx>0?`1px solid ${T.line}`:'none'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
                <div><div style={{fontSize:13,fontWeight:600,color:T.ink}}>{rm.name} <span style={{fontSize:10,color:T.ink4}}>Grade {rm.qualityGrade}</span></div><div style={{fontSize:11,color:T.ink4}}>{rm.supplier||'--'} · Reorder at {fmFmt(rm.reorder)} {rm.unit}</div></div>
                <div style={{display:'flex',gap:5,alignItems:'center'}}>
                  <button onClick={()=>adj(rm,-100)} style={{width:26,height:26,border:`1px solid ${T.line}`,background:T.bg0,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',color:T.ink3}}>-</button>
                  <div style={{textAlign:'center',minWidth:68}}><div className="mono" style={{fontSize:13,fontWeight:700,color:sc}}>{fmFmt(rm.stock)}</div><div style={{fontSize:9,color:T.ink4}}>{rm.unit}</div></div>
                  <button onClick={()=>adj(rm,100)} style={{width:26,height:26,border:`1px solid ${T.line}`,background:T.bg0,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',color:T.ink3}}>+</button>
                  <FMBadge status={rm.status}/>
                </div>
              </div>
              <div style={{height:3,background:T.bg2,overflow:'hidden'}}><div style={{width:`${pct}%`,height:'100%',background:sc}}/></div>
            </div>);
          })}
        </div>
      ))}
      {rawMaterials.length===0&&<FMEmpty icon="grain" title="No raw materials" sub="Record material intake"/>}
      {showForm&&(<FMModal title="Record Raw Material Intake" onClose={()=>setShowForm(false)}>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><Inp label="Material Name *" value={f.name} onChange={v=>fld('name',v)} placeholder="e.g. Maize"/><Sel label="Category *" value={f.category} onChange={v=>fld('category',v)} options={CATS}/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><Inp label="Supplier" value={f.supplier} onChange={v=>fld('supplier',v)} placeholder="Supplier name"/><Inp label="Unit" value={f.unit} onChange={v=>fld('unit',v)} placeholder="kg, litre"/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}><Inp label="Qty Received *" type="number" value={f.stock} onChange={v=>fld('stock',v)} placeholder="0"/><Inp label="Reorder Level" type="number" value={f.reorder} onChange={v=>fld('reorder',v)} placeholder="0"/><Inp label="Cost/Unit (N)" type="number" value={f.costPerUnit} onChange={v=>fld('costPerUnit',v)} placeholder="0"/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><Sel label="Quality Grade" value={f.qualityGrade} onChange={v=>fld('qualityGrade',v)} options={['A','B','C','Rejected']}/><Inp label="Moisture (%)" type="number" value={f.moisture} onChange={v=>fld('moisture',v)} placeholder="0"/></div>
          {f.stock&&f.costPerUnit&&<Notice type="info" message={`Intake value: ${fmNgn(parseFloat(f.stock||0)*parseFloat(f.costPerUnit||0))}`}/>}
          <div style={{display:'flex',gap:8}}><Btn onClick={save} disabled={!f.name.trim()||!f.stock}>Record Intake</Btn><Btn variant="secondary" onClick={()=>setShowForm(false)}>Cancel</Btn></div>
        </div>
      </FMModal>)}
    </div>
  );
}

function FMBatchEngine({state,dispatch,licenseCapacity=0,pendingAction,onActionConsumed}){
  const {productionBatches,recipes}=state;
  const [showForm,setShowForm]=useState(false);
  const [actQtys,setActQtys]=useState({});
  const [err,setErr]=useState('');
  // Deep-link: low-efficiency notification routes here. No modal to open — the
  // batch list is the focus — but we still consume the action so it doesn't leak.
  useEffect(()=>{
    if(!pendingAction||!pendingAction.type)return;
    if(onActionConsumed)onActionConsumed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[pendingAction]);
  const [f,setF]=useState({recipeId:'',targetQty:'',millId:'MILL-A',operator:'',notes:''});
  const fld=(k,v)=>setF(p=>({...p,[k]:v}));
  const active=recipes.filter(r=>r.status==='Active');
  const autoNo=()=>`FMB-${new Date().getFullYear()}-${String(productionBatches.length+1).padStart(3,'0')}`;

  // ── Monthly throughput cap (license is in tons/mo; production stored in kg → cap kg = capacity * 1000) ──
  const capKg=Number(licenseCapacity||0)*1000;
  const monthKey=(d)=>(d||'').slice(0,7);
  const targetMonth=monthKey(fmToday());
  const usedKgThisMonth=productionBatches.filter(b=>monthKey(b.startDate)===targetMonth&&b.status!=='Cancelled').reduce((s,b)=>s+(b.status==='Completed'?(Number(b.actualQty)||0):(Number(b.targetQty)||0)),0);
  const remainingKg=Math.max(0,capKg-usedKgThisMonth);
  const monthLabel=(()=>{const [y,m]=targetMonth.split('-');return new Date(Number(y),Number(m)-1,1).toLocaleDateString('en-NG',{month:'long',year:'numeric'});})();

  const save=()=>{
    setErr('');
    if(!f.recipeId||!f.targetQty){setErr('Recipe and target quantity are required.');return;}
    const rc=recipes.find(r=>r.id===f.recipeId);
    const tgt=parseFloat(f.targetQty)||0;
    if(tgt<=0){setErr('Target quantity must be greater than zero.');return;}
    if(capKg>0&&(usedKgThisMonth+tgt)>capKg){
      setErr(`This batch (${fmFmt(tgt)} kg) would exceed your licensed throughput for ${monthLabel}. Licensed: ${fmFmt(capKg)} kg/mo (${fmFmt(licenseCapacity)} tons) · Used: ${fmFmt(usedKgThisMonth)} kg · Available: ${fmFmt(remainingKg)} kg.`);
      return;
    }
    dispatch({type:'ADD_BATCH',p:{id:fmuid('PB'),batchNo:autoNo(),recipeId:f.recipeId,recipeName:rc?.name||'',targetQty:tgt,actualQty:0,unit:'kg',startDate:fmToday(),endDate:'',status:'In Progress',operator:f.operator,millId:f.millId,notes:f.notes}});
    setF({recipeId:'',targetQty:'',millId:'MILL-A',operator:'',notes:''});setShowForm(false);
  };
  const [completeErrs,setCompleteErrs]=useState({});
  const complete=(b)=>{
    const qty=parseFloat(actQtys[b.id])||b.targetQty;
    setCompleteErrs(p=>{const n={...p};delete n[b.id];return n;});
    if(qty<=0){
      setCompleteErrs(p=>({...p,[b.id]:'Actual quantity must be greater than zero.'}));
      return;
    }
    // Recompute cap excluding this batch's currently-counted target, then add actual
    if(capKg>0){
      const usedExcludingThis=productionBatches.filter(x=>monthKey(x.startDate)===monthKey(b.startDate)&&x.status!=='Cancelled'&&x.id!==b.id).reduce((s,x)=>s+(x.status==='Completed'?(Number(x.actualQty)||0):(Number(x.targetQty)||0)),0);
      if((usedExcludingThis+qty)>capKg){
        const avail=Math.max(0,capKg-usedExcludingThis);
        setCompleteErrs(p=>({...p,[b.id]:`Actual qty (${fmFmt(qty)} kg) would exceed your licensed throughput for ${monthLabel}. Available (excluding this batch): ${fmFmt(avail)} kg. Reduce actual or cancel this batch.`}));
        return;
      }
    }
    dispatch({type:'UPDATE_BATCH',p:{...b,actualQty:qty,status:'Completed',endDate:fmToday()}});
    dispatch({type:'ADD_FI',p:{id:fmuid('FI'),batchId:b.id,recipeName:b.recipeName,qty,unit:'kg',dateProduced:fmToday(),expiryDate:new Date(Date.now()+90*86400000).toISOString().split('T')[0],location:'Store A',status:'Available'}});
  };
  const openForm=()=>{setErr('');setShowForm(true);};
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}><span style={{fontSize:16,fontWeight:700,color:T.ink}}>Production Batches</span><Btn size="sm" onClick={openForm}>+ Start Batch</Btn></div>
      {Number(licenseCapacity)>0&&<div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'10px 14px',fontSize:12,color:T.ink3,display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
        <span>Licensed: <strong style={{color:T.ink}}>{fmFmt(licenseCapacity)} tons/mo</strong></span>
        <span>Used in {monthLabel}: <strong style={{color:T.ink}}>{fmFmt(usedKgThisMonth/1000)} tons</strong></span>
        <span>Available: <strong style={{color:remainingKg>0?T.ok:T.err}}>{fmFmt(remainingKg/1000)} tons</strong></span>
      </div>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))',gap:8}}>
        {[['Total',productionBatches.length],['Running',productionBatches.filter(b=>b.status==='In Progress').length],['Done',productionBatches.filter(b=>b.status==='Completed').length],['Output',`${fmFmt(productionBatches.reduce((s,b)=>s+(b.actualQty||0),0))}kg`]].map(([l,v])=>(
          <div key={l} style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'10px 13px'}}><div style={{fontSize:10,color:T.ink4,textTransform:'uppercase',letterSpacing:.4,marginBottom:2}}>{l}</div><div className="mono" style={{fontSize:14,fontWeight:700,color:T.ink}}>{v}</div></div>
        ))}
      </div>
      {productionBatches.length===0?<FMEmpty icon="mill" title="No production batches" sub="Start a batch to begin tracking"/>:
        productionBatches.map(b=>{const eff=b.targetQty>0&&b.actualQty>0?fmPct(b.actualQty,b.targetQty):'--';return(
          <div key={b.id} style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'13px 16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
              <div><div style={{display:'flex',gap:7,alignItems:'center',marginBottom:2}}><span style={{fontSize:13,fontWeight:700,color:T.ink}}>{b.batchNo}</span><FMBadge status={b.status}/></div><div style={{fontSize:11,color:T.ink4}}>{b.recipeName} · {b.millId}{b.operator?` · ${b.operator}`:''}</div></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(90px,1fr))',gap:7,marginBottom:b.status==='In Progress'?10:0}}>
              {[['Target',`${fmFmt(b.targetQty)}kg`],['Produced',b.actualQty>0?`${fmFmt(b.actualQty)}kg`:'--'],['Eff%',eff!=='--'?`${eff}%`:'--'],['Started',fmFmtDate(b.startDate)]].map(([l,v])=>(
                <div key={l} style={{background:T.bg1,padding:'7px 9px'}}><div style={{fontSize:9,color:T.ink4,textTransform:'uppercase',letterSpacing:.4,marginBottom:1}}>{l}</div><div className="mono" style={{fontSize:12,fontWeight:600,color:T.ink}}>{v}</div></div>
              ))}
            </div>
            {b.status==='In Progress'&&(<div style={{display:'flex',gap:7,alignItems:'flex-end',paddingTop:9,borderTop:`1px solid ${T.line}`}}>
              <div style={{flex:1}}><Inp label="Actual Qty (kg)" type="number" value={actQtys[b.id]||''} onChange={v=>setActQtys(p=>({...p,[b.id]:v}))} placeholder={String(b.targetQty)}/></div>
              <Btn size="sm" onClick={()=>complete(b)}>Complete</Btn>
              <Btn size="sm" variant="danger" onClick={()=>dispatch({type:'UPDATE_BATCH',p:{...b,status:'Cancelled'}})}>Cancel</Btn>
            </div>)}
            {completeErrs[b.id]&&<div style={{marginTop:8}}><Notice type="error" message={completeErrs[b.id]}/></div>}
          </div>
        );})}
      {showForm&&(<FMModal title="Start Production Batch" onClose={()=>{setShowForm(false);setErr('');}}>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {Number(licenseCapacity)>0&&<Notice type="info" message={`${fmFmt(remainingKg)} kg (${fmFmt(remainingKg/1000)} tons) available for ${monthLabel}.`}/>}
          <Sel label="Feed Recipe *" value={f.recipeId} onChange={v=>fld('recipeId',v)} options={[{value:'',label:'Select recipe'},...active.map(r=>({value:r.id,label:`${r.name} (${r.version})`}))]}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><Inp label="Target Qty (kg) *" type="number" value={f.targetQty} onChange={v=>fld('targetQty',v)} placeholder="5000"/><Sel label="Mill / Line" value={f.millId} onChange={v=>fld('millId',v)} options={['MILL-A','MILL-B','MILL-C','Mill 1','Mill 2']}/></div>
          <Inp label="Operator" value={f.operator} onChange={v=>fld('operator',v)} placeholder="Lead operator"/>
          {f.recipeId&&f.targetQty&&(()=>{const rc=recipes.find(r=>r.id===f.recipeId);return rc?<Notice type="info" message={`${rc.name} · CP: ${rc.targetCP}% · ME: ${rc.targetME} kcal/kg`}/>:null;})()}
          {err&&<Notice type="error" message={err}/>}
          <div style={{display:'flex',gap:8}}><Btn onClick={save} disabled={!f.recipeId||!f.targetQty}>Start Production</Btn><Btn variant="secondary" onClick={()=>{setShowForm(false);setErr('');}}>Cancel</Btn></div>
        </div>
      </FMModal>)}
    </div>
  );
}

function FMQualityControl({state,dispatch,pendingAction,onActionConsumed}){
  const {productionBatches,qcRecords}=state;
  const [showForm,setShowForm]=useState(false);
  const [f,setF]=useState({batchId:'',moisture:'',pelletDurability:'',uniformity:'Good',contaminants:'None',notes:''});
  const fld=(k,v)=>setF(p=>({...p,[k]:v}));
  // Deep-link: QC-fail notification routes here. Open the form preset to the
  // failed batch so the user can record corrective QC data.
  useEffect(()=>{
    if(!pendingAction||!pendingAction.type)return;
    if(pendingAction.type==='viewQC'){
      const ctx=pendingAction.context||{};
      if(ctx.batchId) setF(p=>({...p,batchId:ctx.batchId}));
      setShowForm(true);
    }
    if(onActionConsumed)onActionConsumed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[pendingAction]);
  const save=()=>{
    if(!f.batchId)return;
    const m=parseFloat(f.moisture)||0,pd=parseFloat(f.pelletDurability)||0;
    dispatch({type:'ADD_QC',p:{id:fmuid('QC'),batchId:f.batchId,date:fmToday(),moisture:m,pelletDurability:pd,uniformity:f.uniformity,contaminants:f.contaminants||'None',result:m>14||pd<88?'Fail':'Pass',notes:f.notes}});
    setF({batchId:'',moisture:'',pelletDurability:'',uniformity:'Good',contaminants:'None',notes:''});setShowForm(false);
  };
  const pr=qcRecords.length?fmPct(qcRecords.filter(q=>q.result==='Pass').length,qcRecords.length):'--';
  const qcBatches=productionBatches.filter(b=>['In Progress','Completed'].includes(b.status));
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}><span style={{fontSize:16,fontWeight:700,color:T.ink}}>Quality Control</span><Btn size="sm" onClick={()=>setShowForm(true)}>+ Record QC</Btn></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))',gap:8}}>
        <FMKPI label="Sessions" value={qcRecords.length}/>
        <FMKPI label="Pass Rate" value={pr} unit={pr!=='--'?'%':''} green={parseFloat(pr)>=95&&qcRecords.length>0}/>
        <FMKPI label="Passes" value={qcRecords.filter(q=>q.result==='Pass').length}/>
        <FMKPI label="Failures" value={qcRecords.filter(q=>q.result==='Fail').length} alert={qcRecords.some(q=>q.result==='Fail')}/>
      </div>
      <div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'12px 16px'}}>
        <div style={{fontSize:11,fontWeight:700,color:T.ink,marginBottom:8,textTransform:'uppercase',letterSpacing:.5}}>Pass Standards</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
          {[['Moisture','<=14%'],['PDI','>=88%'],['Uniformity','Good+']].map(([p,spec])=>(
            <div key={p} style={{background:T.bg1,padding:'7px 10px'}}><div style={{fontSize:10,fontWeight:600,color:T.ink}}>{p}</div><div className="mono" style={{fontSize:13,fontWeight:700,color:T.ok}}>{spec}</div></div>
          ))}
        </div>
      </div>
      {qcRecords.length===0?<FMEmpty icon="qc" title="No QC records" sub="Record quality checks after each batch"/>:
        qcRecords.map(qc=>{const b=productionBatches.find(x=>x.id===qc.batchId);return(
          <div key={qc.id} style={{background:qc.result==='Fail'?T.errBg:'#fff',border:`1px solid ${qc.result==='Fail'?T.errLine:T.line}`,padding:'13px 16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}><div><div style={{fontSize:13,fontWeight:700,color:T.ink}}>{b?.batchNo||'--'} -- {b?.recipeName||'--'}</div><div style={{fontSize:11,color:T.ink4}}>{fmFmtDate(qc.date)}</div></div><FMBadge status={qc.result}/></div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:7}}>
              {[['Moisture',`${qc.moisture}%`,qc.moisture>14],['PDI',`${qc.pelletDurability}%`,qc.pelletDurability<88&&qc.pelletDurability>0],['Uniformity',qc.uniformity,false],['Contaminants',qc.contaminants,qc.contaminants!=='None']].map(([l,v,a])=>(
                <div key={l} style={{background:a?T.errBg:'rgba(0,0,0,0.03)',padding:'6px 8px',border:a?`1px solid ${T.errLine}`:'none'}}><div style={{fontSize:9,color:T.ink4,textTransform:'uppercase',letterSpacing:.3,marginBottom:1}}>{l}</div><div className="mono" style={{fontSize:12,fontWeight:600,color:a?T.err:T.ink}}>{v}</div></div>
              ))}
            </div>
          </div>
        );})}
      {showForm&&(<FMModal title="Record Quality Check" onClose={()=>setShowForm(false)}>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <Sel label="Production Batch *" value={f.batchId} onChange={v=>fld('batchId',v)} options={[{value:'',label:'Select batch'},...qcBatches.map(b=>({value:b.id,label:`${b.batchNo} -- ${b.recipeName}`}))]}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><Inp label="Moisture (%)" type="number" value={f.moisture} onChange={v=>fld('moisture',v)} placeholder="12.5" hint="Pass <=14%"/><Inp label="PDI (%)" type="number" value={f.pelletDurability} onChange={v=>fld('pelletDurability',v)} placeholder="94.2" hint="Pass >=88%"/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><Sel label="Uniformity" value={f.uniformity} onChange={v=>fld('uniformity',v)} options={['Excellent','Good','Fair','Poor']}/><Inp label="Contaminants" value={f.contaminants} onChange={v=>fld('contaminants',v)} placeholder="None"/></div>
          {f.moisture&&f.pelletDurability&&<Notice type={parseFloat(f.moisture)>14||parseFloat(f.pelletDurability)<88?'error':'success'} message={parseFloat(f.moisture)>14||parseFloat(f.pelletDurability)<88?'Would FAIL QC':'Would PASS QC'}/>}
          <div style={{display:'flex',gap:8}}><Btn onClick={save} disabled={!f.batchId}>Save QC</Btn><Btn variant="secondary" onClick={()=>setShowForm(false)}>Cancel</Btn></div>
        </div>
      </FMModal>)}
    </div>
  );
}

function FMFinishedInventory({state,pendingAction,onActionConsumed}){
  const {finishedInventory,productionBatches}=state;
  const avail=finishedInventory.filter(f=>f.status!=='Depleted').reduce((s,f)=>s+f.qty,0);
  // Deep-link: expiry notification routes here. No modal; the list itself is
  // the focus. Consume the action so it doesn't get re-applied.
  useEffect(()=>{
    if(!pendingAction||!pendingAction.type)return;
    if(onActionConsumed)onActionConsumed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[pendingAction]);
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{fontSize:16,fontWeight:700,color:T.ink,marginBottom:10}}>Finished Feed Inventory</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))',gap:8}}>
        <FMKPI label="Lines" value={finishedInventory.length}/>
        <FMKPI label="Available" value={fmFmt(avail)} unit="kg" green={avail>0}/>
        <FMKPI label="Depleted" value={finishedInventory.filter(f=>f.status==='Depleted').length}/>
        <FMKPI label="Products" value={[...new Set(finishedInventory.map(f=>f.recipeName))].length}/>
      </div>
      {finishedInventory.length>0&&<Notice type="info" message="FIFO basis -- oldest batches dispatched first."/>}
      {finishedInventory.length===0?<FMEmpty icon="inv" title="No finished feed inventory" sub="Complete production batches to populate"/>:
        [...finishedInventory].sort((a,b)=>a.dateProduced.localeCompare(b.dateProduced)).map(fi=>{
          const de=fi.expiryDate?Math.ceil((new Date(fi.expiryDate)-new Date())/86400000):null;
          const ea=de!==null&&de<14;
          return(<div key={fi.id} style={{background:fi.status==='Depleted'?T.bg1:'#fff',border:`1px solid ${ea?T.warnLine:T.line}`,padding:'12px 16px',opacity:fi.status==='Depleted'?0.55:1}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div><div style={{display:'flex',gap:7,alignItems:'center',marginBottom:3}}><span style={{fontSize:13,fontWeight:700,color:T.ink}}>{fi.recipeName}</span><FMBadge status={fi.status}/></div><div style={{fontSize:11,color:T.ink4}}>{fi.location} · {fmFmtDate(fi.dateProduced)}</div>{ea&&<div style={{marginTop:4,fontSize:11,color:T.warn,fontWeight:500}}>Expires in {de}d ({fmFmtDate(fi.expiryDate)})</div>}</div>
              <div style={{textAlign:'right'}}><div className="mono" style={{fontSize:18,fontWeight:700,color:fi.status==='Depleted'?T.ink4:T.ok}}>{fmFmt(fi.qty)}</div><div style={{fontSize:10,color:T.ink4}}>{fi.unit}</div></div>
            </div>
          </div>);
        })
      }
    </div>
  );
}

function FMDistribution({state,dispatch}){
  const {distributions,finishedInventory}=state;
  const [showForm,setShowForm]=useState(false);
  const [f,setF]=useState({finishedInventoryId:'',date:fmToday(),destination:'',destinationType:'Internal (PoultryOS)',qty:'',notes:''});
  const fld=(k,v)=>setF(p=>({...p,[k]:v}));
  const avFI=finishedInventory.filter(fi=>fi.status!=='Depleted'&&fi.qty>0);
  const save=()=>{
    if(!f.finishedInventoryId||!f.destination.trim()||!f.qty)return;
    const fi=finishedInventory.find(x=>x.id===f.finishedInventoryId);
    if(parseFloat(f.qty)>(fi?.qty||0))return;
    dispatch({type:'ADD_DIST',p:{id:fmuid('DS'),finishedInventoryId:f.finishedInventoryId,date:f.date,destination:f.destination.trim(),destinationType:f.destinationType,qty:parseFloat(f.qty)||0,unit:'kg',status:'Delivered',notes:f.notes}});
    setF({finishedInventoryId:'',date:fmToday(),destination:'',destinationType:'Internal (PoultryOS)',qty:'',notes:''});setShowForm(false);
  };
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}><span style={{fontSize:16,fontWeight:700,color:T.ink}}>Distribution & Transfer</span><Btn size="sm" onClick={()=>setShowForm(true)}>+ Record Dispatch</Btn></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(100px,1fr))',gap:8}}>
        {[['Dispatches',distributions.length],['Dispatched',`${fmFmt(distributions.reduce((s,d)=>s+d.qty,0))}kg`],['Internal',distributions.filter(d=>d.destinationType.includes('Internal')).length],['External',distributions.filter(d=>!d.destinationType.includes('Internal')).length]].map(([l,v])=>(
          <div key={l} style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'10px 12px'}}><div style={{fontSize:10,color:T.ink4,textTransform:'uppercase',letterSpacing:.4,marginBottom:2}}>{l}</div><div className="mono" style={{fontSize:13,fontWeight:700,color:T.ink}}>{v}</div></div>
        ))}
      </div>
      {distributions.length===0?<FMEmpty icon="truck" title="No dispatches recorded" sub="Record feed distribution"/>:
        <div style={{background:T.bg0,border:`1px solid ${T.line}`,overflow:'hidden'}}>
          <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:440}}>
            <thead><tr style={{background:T.bg2}}>{['Date','Product','Destination','Qty','Status'].map(h=><th key={h} style={{padding:'7px 12px',textAlign:'left',fontSize:11,fontWeight:600,color:T.ink4,textTransform:'uppercase',letterSpacing:.4,whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
            <tbody>{[...distributions].sort((a,b)=>b.date.localeCompare(a.date)).map((d,i)=>{const fi=finishedInventory.find(f=>f.id===d.finishedInventoryId);return(
              <tr key={d.id} style={{borderTop:`1px solid ${T.line}`,background:i%2===0?'#fff':T.bg1}}>
                <td style={{padding:'8px 12px'}}><span className="mono" style={{fontSize:11,color:T.ink4}}>{fmFmtDate(d.date)}</span></td>
                <td style={{padding:'8px 12px',fontSize:12,fontWeight:500}}>{fi?.recipeName||'--'}</td>
                <td style={{padding:'8px 12px',fontSize:12}}>{d.destination}</td>
                <td style={{padding:'8px 12px'}}><span className="mono" style={{fontSize:12,fontWeight:600}}>{fmFmt(d.qty)}kg</span></td>
                <td style={{padding:'8px 12px'}}><FMBadge status={d.status}/></td>
              </tr>);})}
            </tbody>
          </table></div>
        </div>
      }
      {showForm&&(<FMModal title="Record Feed Dispatch" onClose={()=>setShowForm(false)}>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <Sel label="Feed Stock (FIFO) *" value={f.finishedInventoryId} onChange={v=>fld('finishedInventoryId',v)} options={[{value:'',label:'Select feed stock'},...avFI.map(fi=>({value:fi.id,label:`${fi.recipeName} -- ${fmFmt(fi.qty)}kg (${fmFmtDate(fi.dateProduced)})`}))]}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><Inp label="Date *" type="date" value={f.date} onChange={v=>fld('date',v)}/><Inp label="Quantity (kg) *" type="number" value={f.qty} onChange={v=>fld('qty',v)} placeholder="kg to dispatch"/></div>
          <Inp label="Destination *" value={f.destination} onChange={v=>fld('destination',v)} placeholder="Farm name or customer"/>
          <Sel label="Destination Type" value={f.destinationType} onChange={v=>fld('destinationType',v)} options={['Internal (PoultryOS)','External Customer','Inter-Mill Transfer','Quarantine/Hold']}/>
          {f.finishedInventoryId&&f.qty&&(()=>{const fi=avFI.find(x=>x.id===f.finishedInventoryId);const rem=Math.max(0,(fi?.qty||0)-parseFloat(f.qty||0));const over=parseFloat(f.qty||0)>(fi?.qty||0);return <Notice type={over?'error':'info'} message={over?`Insufficient -- only ${fmFmt(fi?.qty)}kg available`:`Remaining after dispatch: ${fmFmt(rem)}kg`}/>;})()}
          <div style={{display:'flex',gap:8}}><Btn onClick={save} disabled={!f.finishedInventoryId||!f.destination.trim()||!f.qty}>Record Dispatch</Btn><Btn variant="secondary" onClick={()=>setShowForm(false)}>Cancel</Btn></div>
        </div>
      </FMModal>)}
    </div>
  );
}

function FMFinancials({state,dispatch}){
  const {productionBatches,financialLogs}=state;
  const [showForm,setShowForm]=useState(false);
  const [selBatch,setSelBatch]=useState('');
  const [f,setF]=useState({batchId:'',type:'Cost',category:'Raw Materials',amount:'',date:fmToday(),notes:''});
  const fld=(k,v)=>setF(p=>({...p,[k]:v}));
  const CC=['Raw Materials','Labor','Energy','Overhead','Maintenance','Transport','Packaging','Other'];
  const RC=['Feed Sales','Waste Recovery','Other'];
  const save=()=>{if(!f.batchId||!f.amount)return;dispatch({type:'ADD_FIN',p:{id:fmuid('FF'),batchId:f.batchId,date:f.date,type:f.type,category:f.category,amount:parseFloat(f.amount)||0,notes:f.notes}});setF(p=>({...p,amount:'',notes:''}));setShowForm(false);};
  const dl=selBatch?financialLogs.filter(f=>f.batchId===selBatch):financialLogs;
  const tC=dl.filter(f=>f.type==='Cost').reduce((s,f)=>s+Number(f.amount),0);
  const tR=dl.filter(f=>f.type==='Revenue').reduce((s,f)=>s+Number(f.amount),0);
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}><span style={{fontSize:16,fontWeight:700,color:T.ink}}>Financials</span><Btn size="sm" onClick={()=>setShowForm(true)}>+ Add Entry</Btn></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
        <FMKPI label="Revenue" value={fmNgn(tR)} green={tR>0}/>
        <FMKPI label="Cost" value={fmNgn(tC)}/>
        <FMKPI label="Net P&L" value={fmNgn(tR-tC)} green={tR>tC} alert={tR<tC&&tR>0}/>
      </div>
      <Sel label="Filter by Batch" value={selBatch} onChange={setSelBatch} options={[{value:'',label:'All Batches'},...productionBatches.map(b=>({value:b.id,label:b.batchNo}))]}/>
      <div style={{background:T.bg0,border:`1px solid ${T.line}`,overflow:'hidden'}}>
        <div style={{padding:'11px 16px',borderBottom:`1px solid ${T.line}`,fontSize:13,fontWeight:700,color:T.ink}}>Transaction Ledger</div>
        {dl.length===0?<FMEmpty icon="fin" title="No transactions" sub="Log costs and revenues per batch"/>:
          <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:480}}>
            <thead><tr style={{background:T.bg2}}>{['Date','Batch','Type','Category','Amount'].map(h=><th key={h} style={{padding:'8px 12px',textAlign:'left',fontSize:11,fontWeight:600,color:T.ink4,textTransform:'uppercase',letterSpacing:.4,whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
            <tbody>{[...dl].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,40).map((f,i)=>{const b=productionBatches.find(x=>x.id===f.batchId);return(
              <tr key={f.id} style={{borderTop:`1px solid ${T.line}`,background:i%2===0?'#fff':T.bg1}}>
                <td style={{padding:'8px 12px'}}><span className="mono" style={{fontSize:11,color:T.ink4}}>{fmFmtDate(f.date)}</span></td>
                <td style={{padding:'8px 12px',fontSize:12,color:T.ink3}}>{b?.batchNo||'--'}</td>
                <td style={{padding:'8px 12px'}}><span style={{fontSize:11,padding:'2px 7px',background:f.type==='Revenue'?T.okBg:T.errBg,color:f.type==='Revenue'?T.ok:T.err,fontWeight:600}}>{f.type}</span></td>
                <td style={{padding:'8px 12px',fontSize:13,color:T.ink}}>{f.category}</td>
                <td style={{padding:'8px 12px'}}><span className="mono" style={{fontSize:13,fontWeight:600,color:f.type==='Revenue'?T.ok:T.err}}>{fmNgn(f.amount)}</span></td>
              </tr>);})}
            </tbody>
          </table></div>}
      </div>
      {showForm&&(<FMModal title="Add Financial Entry" onClose={()=>setShowForm(false)}>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <Sel label="Production Batch *" value={f.batchId} onChange={v=>fld('batchId',v)} options={[{value:'',label:'Select batch'},...productionBatches.map(b=>({value:b.id,label:b.batchNo}))]}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><Sel label="Type *" value={f.type} onChange={v=>{fld('type',v);fld('category',v==='Cost'?CC[0]:RC[0]);}} options={['Cost','Revenue']}/><Sel label="Category *" value={f.category} onChange={v=>fld('category',v)} options={f.type==='Cost'?CC:RC}/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><Inp label="Amount (N) *" type="number" value={f.amount} onChange={v=>fld('amount',v)}/><Inp label="Date *" type="date" value={f.date} onChange={v=>fld('date',v)}/></div>
          <Inp label="Notes" value={f.notes} onChange={v=>fld('notes',v)} placeholder="Description"/>
          <div style={{display:'flex',gap:8}}><Btn onClick={save} disabled={!f.batchId||!f.amount}>Save Entry</Btn><Btn variant="secondary" onClick={()=>setShowForm(false)}>Cancel</Btn></div>
        </div>
      </FMModal>)}
    </div>
  );
}

function FMAudit({state}){
  const [q,setQ]=useState('');
  const al=state.auditLog;
  const filtered=q?al.filter(e=>e.action.toLowerCase().includes(q.toLowerCase())):al;
  return(
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{fontSize:16,fontWeight:700,color:T.ink,marginBottom:8}}>Audit & Event Log</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
        {[['Events',al.length],['Entities',[...new Set(al.map(e=>e.entity))].length],['Today',al.filter(e=>e.ts&&e.ts.startsWith(fmToday())).length]].map(([l,v])=>(
          <div key={l} style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'10px 13px'}}><div style={{fontSize:10,color:T.ink4,textTransform:'uppercase',letterSpacing:.5,marginBottom:2}}>{l}</div><div className="mono" style={{fontSize:18,fontWeight:700,color:T.ink}}>{v}</div></div>
        ))}
      </div>
      <Inp label="" value={q} onChange={setQ} placeholder="Search audit log..."/>
      <div style={{background:T.bg0,border:`1px solid ${T.line}`,overflow:'hidden'}}>
        {filtered.length===0?<FMEmpty icon="audit" title="No events found" sub="All operations recorded here"/>:
          filtered.slice(0,80).map((e,i)=>(
            <div key={e.id||i} style={{display:'flex',gap:10,padding:'10px 14px',borderTop:i>0?`1px solid ${T.line}`:'none',alignItems:'flex-start',background:i%2===0?'#fff':T.bg1}}>
              <div style={{flexShrink:0,width:44}}><div className="mono" style={{fontSize:9,color:T.ink4}}>{new Date(e.ts).toLocaleTimeString('en-NG',{hour:'2-digit',minute:'2-digit'})}</div><div className="mono" style={{fontSize:9,color:T.ink4}}>{new Date(e.ts).toLocaleDateString('en-NG',{day:'numeric',month:'short'})}</div></div>
              <span style={{fontSize:10,padding:'1px 6px',background:T.accentBg,color:T.accentDark,fontWeight:600,flexShrink:0,alignSelf:'flex-start',marginTop:1}}>{e.entity}</span>
              <div style={{flex:1,fontSize:12,color:T.ink,lineHeight:1.4}}>{e.action}</div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

function FMSettingsBackup({state,dispatch,dataMode,onSwitchToLive,onRestoreTraining,license,activeUser,onUpdateLicense}){
  const {settings}=state;
  const [tab,setTab]=useState('settings');
  const [sf,setSf]=useState({...settings});
  const sfF=(k,v)=>setSf(p=>({...p,[k]:v}));
  const [restErr,setRestErr]=useState(''),[restOk,setRestOk]=useState(false);
  const changed=JSON.stringify(sf)!==JSON.stringify(settings);
  const expData=()=>{const pl=JSON.stringify({...state,_exportedAt:new Date().toISOString(),_app:'FeedMillOS',_v:'1.0'},null,2);const b=new Blob([pl],{type:'application/json'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=`FeedMillOS_${fmToday()}.json`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);};
  const isValidFMBackup=(d)=>d&&typeof d==='object'&&Array.isArray(d.recipes)&&Array.isArray(d.rawMaterials)&&Array.isArray(d.productionBatches)&&(d._app==='FeedMillOS'||!d._app);
  const impData=(e)=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=(ev)=>{try{const d=JSON.parse(ev.target.result);if(!isValidFMBackup(d)){setRestErr('This file does not appear to be a valid FeedMillOS backup.');setRestOk(false);return;}if(!window.confirm('This will REPLACE all current FeedMillOS data with the backup file. Continue?')){setRestErr('');setRestOk(false);return;}dispatch({type:'RESTORE',p:d});setRestOk(true);setRestErr('');}catch(err){setRestErr(`Restore failed: ${err.message}`);setRestOk(false);}};r.readAsText(file);e.target.value='';};
  const fileInputRef=useRef(null);
  const canViewUsers=can(activeUser?.role,'users','view');
  const tabs=[{id:'settings',label:'Settings'},{id:'backup',label:'Backup & Data'}];
  if(canViewUsers)tabs.push({id:'users',label:'Users & Roles'});
  tabs.push({id:'live',label:'Live Mode'});
  tabs.push({id:'legal',label:'Legal'});
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{fontSize:16,fontWeight:700,color:T.ink,marginBottom:8}}>Settings & Backup</div>
      <TabBar tabs={tabs} active={tab} onChange={setTab}/>
      {tab==='settings'&&(<>
        <div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'16px 18px'}}>
          <div style={{fontSize:13,fontWeight:700,color:T.ink,marginBottom:12}}>Mill Identity</div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <Inp label="Feed Mill Name" value={sf.millName} onChange={v=>sfF('millName',v)} placeholder="Your mill name"/>
            <Inp label="Location" value={sf.location} onChange={v=>sfF('location',v)} placeholder="City, State, Country"/>
          </div>
        </div>
        <div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'16px 18px'}}>
          <div style={{fontSize:13,fontWeight:700,color:T.ink,marginBottom:12}}>Production Targets</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <Inp label="Target Efficiency (%)" type="number" value={sf.targetEfficiency} onChange={v=>sfF('targetEfficiency',parseFloat(v)||95)} hint="Alert when below this"/>
            <Inp label="Stock Alert (days)" type="number" value={sf.stockAlertDays} onChange={v=>sfF('stockAlertDays',parseInt(v)||7)} hint="Days of supply warning"/>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginTop:12}}><input type="checkbox" checked={sf.alertsEnabled} onChange={e=>sfF('alertsEnabled',e.target.checked)} style={{width:15,height:15,cursor:'pointer'}}/><span style={{fontSize:13,color:T.ink}}>Enable production and stock alerts</span></div>
        </div>
        {changed&&<div style={{display:'flex',gap:8}}><Btn onClick={()=>dispatch({type:'UPDATE_SETTINGS',p:sf})}>Save Settings</Btn><Btn variant="secondary" onClick={()=>setSf({...settings})}>Revert</Btn></div>}
        {!changed&&<Notice type="success" message="All settings saved."/>}
      </>)}
      {tab==='backup'&&(<>
        <Notice type="info" message="Data stored in-memory. Export regularly to prevent loss on refresh."/>
        <div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'16px 18px'}}>
          <div style={{fontSize:13,fontWeight:700,color:T.ink,marginBottom:6}}>Export Backup</div>
          <div style={{fontSize:13,color:T.ink3,marginBottom:12}}>Download complete JSON backup of all FeedMillOS data.</div>
          <Btn onClick={expData}>Download FeedMillOS Backup</Btn>
        </div>
        <div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'16px 18px'}}>
          <div style={{fontSize:13,fontWeight:700,color:T.ink,marginBottom:6}}>Restore from Backup</div>
          {restErr&&<div style={{marginBottom:8}}><Notice type="error" message={restErr}/></div>}
          {restOk&&<div style={{marginBottom:8}}><Notice type="success" message="Restored successfully."/></div>}
          <input ref={fileInputRef} type="file" accept=".json" onChange={impData} style={{display:'none'}}/>
          <button onClick={()=>fileInputRef.current?.click()} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'10px 18px',background:T.btnBg,border:`1px solid ${T.btnBorder}`,fontSize:13,fontWeight:600,color:T.btnText,cursor:'pointer',fontFamily:'inherit',outline:'none',WebkitTapHighlightColor:'transparent',WebkitAppearance:'none'}}>Import Backup File</button>
        </div>
      </>)}
      {tab==='users'&&canViewUsers&&<UserManagementPanel license={license} activeUser={activeUser} onUpdateLicense={onUpdateLicense}/>}
      {tab==='live'&&<LiveModePanel dataMode={dataMode} onSwitchToLive={onSwitchToLive} onRestoreTraining={onRestoreTraining}/>}
      {tab==='legal'&&<LegalSettingsPanel/>}
    </div>
  );
}

function FeedMillModule({capacity,license,activeUser,onUpdateLicense,dataMode,onSwitchToLive,onRestoreTraining,initialSeed}){
  const [fm,dispatch]=useReducer(fmReducer,initialSeed||FM_SEED);
  const [engine,setEngine]=useState(null);
  useEffect(()=>{if(typeof window!=='undefined'){if(!window.__psState)window.__psState={};window.__psState.feedmill=fm;}},[fm]);
  const role=activeUser?.role||'Owner / Director';

  const ALL_ENGINES=[
    {id:'cmd',label:'Command Center',icon:'cmd'},
    {id:'recipe',label:'Formulation & Recipe',icon:'recipe'},
    {id:'intake',label:'Raw Materials',icon:'intake'},
    {id:'batch',label:'Production Batch',icon:'batch'},
    {id:'qc',label:'Quality Control',icon:'qc'},
    {id:'stock',label:'Finished Inventory',icon:'stock'},
    {id:'distrib',label:'Distribution',icon:'distrib'},
    {id:'finance',label:'Financials',icon:'finance'},
    {id:'audit',label:'Audit Log',icon:'audit'},
    {id:'settings',label:'Settings & Backup',icon:'settings'},
    {id:'help',label:'Help & Docs',icon:'help'},
  ];
  const ENGINES=ALL_ENGINES.filter(e=>can(role,FEEDMILL_ENGINE_RES[e.id],'view'));

  // Deep-link action state
  const [pendingAction,setPendingAction]=useState(null);
  const consumePendingAction=useCallback(()=>setPendingAction(null),[]);

  const renderEngine=(id)=>{
    const resource=FEEDMILL_ENGINE_RES[id];
    const ro=resource?!can(role,resource,'write'):false;
    const actionFor=(eng)=>pendingAction&&pendingAction.type&&matchesEngine(pendingAction.type,eng)?pendingAction:null;
    let content=null;
    if(id==='cmd')     content=<FMCmdCenter         state={fm} dataMode={dataMode}/>;
    else if(id==='recipe')  content=<FMRecipe            state={fm} dispatch={dispatch}/>;
    else if(id==='intake')  content=<FMRawMaterial       state={fm} dispatch={dispatch} pendingAction={actionFor('intake')} onActionConsumed={consumePendingAction}/>;
    else if(id==='batch')   content=<FMBatchEngine       state={fm} dispatch={dispatch} licenseCapacity={capacity} pendingAction={actionFor('batch')} onActionConsumed={consumePendingAction}/>;
    else if(id==='qc')      content=<FMQualityControl    state={fm} dispatch={dispatch} pendingAction={actionFor('qc')} onActionConsumed={consumePendingAction}/>;
    else if(id==='stock')   content=<FMFinishedInventory state={fm} pendingAction={actionFor('stock')} onActionConsumed={consumePendingAction}/>;
    else if(id==='distrib') content=<FMDistribution      state={fm} dispatch={dispatch}/>;
    else if(id==='finance') content=<FMFinancials        state={fm} dispatch={dispatch}/>;
    else if(id==='audit')   content=<FMAudit             state={fm}/>;
    else if(id==='help')    content=<HelpDocEngine       module='feedmill'/>;
    else if(id==='settings')content=<FMSettingsBackup    state={fm} dispatch={dispatch} dataMode={dataMode} onSwitchToLive={onSwitchToLive} onRestoreTraining={onRestoreTraining} license={license} activeUser={activeUser} onUpdateLicense={onUpdateLicense}/>;
    if(!content)return null;
    return(<>{ro&&<ReadOnlyBanner role={role}/>}<fieldset disabled={ro} style={{border:'none',padding:0,margin:0,minWidth:0}}>{content}</fieldset></>);
  };

  const lowRM=fm.rawMaterials.filter(r=>r.status!=='OK').length;
  const failedQC=fm.qcRecords.filter(q=>q.result==='Fail').length;
  const badge=(id)=>{if(id==='intake'&&lowRM>0)return lowRM;if(id==='qc'&&failedQC>0)return failedQC;return 0;};
  const activeLabel=ENGINES.find(e=>e.id===engine)?.label||'';

  // Deep-link reader (notification → engine + optional action)
  useEffect(()=>{
    try{
      const p=window.__psPendingEngine;
      if(p&&p.module==='feedmill'&&p.engine){
        const target=ENGINES.find(e=>e.id===p.engine);
        if(target){
          setEngine(p.engine);
          if(p.action) setPendingAction({type:p.action,context:p.context||null,ts:p.ts});
        }
        window.__psPendingEngine=null;
      }
    }catch(_){}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  return(
    <div style={{display:'grid',gridTemplateColumns:'minmax(220px,260px) 1fr',gap:0,minHeight:500,background:T.bg0,border:`1px solid ${T.line}`}}>
      <div style={{borderRight:`1px solid ${T.line}`,background:T.bg1,display:'flex',flexDirection:'column',minWidth:0}}>
        <EngineNav
          moduleName="FeedMillOS"
          moduleSubtitle="Feed Production Operating System"
          engines={ENGINES}
          activeEngine={engine}
          onSelect={setEngine}
          badgeFn={badge}
          readOnlyFn={(id)=>!can(role,FEEDMILL_ENGINE_RES[id],'write')}
          IconComp={FMIcon}
        />
        <div style={{marginTop:'auto'}}><AppFooter/></div>
      </div>
      <div style={{padding:'16px 24px 28px',minWidth:0,display:'flex',flexDirection:'column'}}>
        {engine?(<>
          <EngineBreadcrumb moduleName="FeedMillOS" engineLabel={activeLabel} onHome={()=>setEngine(null)}/>
          <div className="au" key={engine} style={{minWidth:0}}>{renderEngine(engine)}</div>
        </>):(
          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start',justifyContent:'center',minHeight:300,padding:'24px 4px'}}>
            <div style={{fontSize:11,fontWeight:700,color:T.ink4,letterSpacing:2,textTransform:'uppercase',marginBottom:10}}>FeedMillOS</div>
            <div style={{fontSize:22,fontWeight:700,color:T.ink,letterSpacing:-0.3,lineHeight:1.25,marginBottom:8}}>Choose an engine to get started</div>
            <div style={{fontSize:13,color:T.ink3,lineHeight:1.6,maxWidth:480}}>Select one of the engines on the left to view its dashboard, record activity, or run reports. The navigation stays visible so you can move between engines without losing your place.</div>
          </div>
        )}
      </div>
    </div>
  );
}


function Dashboard({license,activeUser,onLogout,addAudit,auditLog,dataMode,onSwitchToLive,onRestoreTraining,switchKey,onUpdateLicense,demoRec}){
  const role=activeUser?.role||'Owner / Director';
  // Subscribe to currency changes so every ngn()/fmtN() call across the tree
  // re-renders when the user switches currency.
  const [, _bumpCurrency] = useState(0);
  useEffect(() => {
    const onChange = () => _bumpCurrency((v) => v + 1);
    window.addEventListener('psa:currencychange', onChange);
    return () => window.removeEventListener('psa:currencychange', onChange);
  }, []);
  // Filter enabled modules by view permission
  const visibleMods=license.enabledModules.filter(m=>canSeeModule(role,m));
  const [activeId,setActiveId]=useState(visibleMods[0]||(can(role,'module.core','view')&&TIER_DEF[license.tier].hasCore?'core':'license'));
  const [notifOpen,setNotifOpen]=useState(false);
  const tier=TIER_DEF[license.tier],profile=license.profile;
  // When the user is currently on the free demo, the dashboard, expiry banner,
  // and License Info screen must all reflect the demo countdown (not the paid
  // license's far-future expiry). Once a paid license is activated, demoRec
  // either no longer exists or has been superseded.
  const demoActive=demoRec&&isDemoActive(demoRec)&&!license.paid;
  const demoLeft=demoActive?demoDaysLeft(demoRec):0;
  const paidLeft=Math.max(0,Math.ceil((new Date(license.expiry)-new Date())/86400000));
  const daysLeft=demoActive?demoLeft:paidLeft;
  const navMods=visibleMods.map(m=>({...MODULE_DEF[m],type:'module'}));
  if(tier.hasCore&&can(role,'module.core','view'))navMods.push({id:'core',name:'Core Engine',Icon:IcoCore,type:'core'});
  const canViewLicense=can(role,'license','view');
  useEffect(()=>{addAudit(`Viewed ${activeId==='core'?'Core Engine':activeId==='license'?'License':(MODULE_DEF[activeId]&&MODULE_DEF[activeId].name)||activeId}`,activeUser?.name||'User');},[activeId]);

  const allNotifs=(()=>{
    const ps=(typeof window!=='undefined'&&window.__psState)||{};
    return generateNotifications(ps.poultry||null,ps.hatchery||null,ps.feedmill||null,{mortalityThreshold:2.0,targetFertility:90,targetHatchability:85,targetEfficiency:95,eggProductionThreshold:75,feedStockDaysThreshold:3});
  })();

  return(
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:T.bg1,overflow:'hidden',fontFamily:'inherit'}}>
      <div style={{background:T.bg0,borderBottom:`1px solid ${T.line}`,flexShrink:0}}>
        <div style={{height:56,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 16px'}}>
          <div style={{display:'flex',alignItems:'flex-start',gap:10,minWidth:0}}>
            <div style={{marginTop:1}}><LogoBadge size={26}/></div>
            <div style={{minWidth:0}}>
              <div style={{fontSize:13,lineHeight:1,letterSpacing:-0.2}}>
                <span style={{color:T.ink,fontWeight:800,letterSpacing:-0.3}}>PoultrySuite</span><span style={{color:T.ink3,fontWeight:300}}> Africa</span>
              </div>
              <div style={{fontSize:10,color:T.ink4,marginTop:1,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{profile.farmName}</div>
            </div>
          </div>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            {activeUser&&<div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:2,marginRight:4}}>
              <span style={{fontSize:11,fontWeight:600,color:T.ink,lineHeight:1,maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{activeUser.name}</span>
              <RoleChip role={activeUser.role}/>
            </div>}
            {daysLeft<30&&<div style={{fontSize:11,fontWeight:600,color:T.warn,background:T.warnBg,border:`1px solid ${T.warnLine}`,padding:'3px 9px'}}>{daysLeft}d left</div>}
            {dataMode!=='live'&&<div style={{fontSize:10,fontWeight:700,padding:'3px 9px',background:T.warnBg,color:T.warn,letterSpacing:.8,border:`1px solid ${T.warnLine}`,display:'flex',alignItems:'center',gap:5}}><span style={{width:6,height:6,background:T.warn,borderRadius:'50%',display:'inline-block'}}/> DEMO</div>}
            <CurrencySwitcher/>
            <NotificationBell notifs={allNotifs} onOpen={()=>setNotifOpen(true)}/>
            <button onClick={()=>{addAudit('User signed out',activeUser?.name||'User');onLogout();}}
              style={{background:'none',border:`1px solid ${T.line}`,fontSize:12,color:T.ink3,cursor:'pointer',padding:'7px 13px',fontFamily:'inherit',fontWeight:500,minHeight:36,lineHeight:1,transition:'background 0.12s'}}
              onMouseEnter={e=>e.currentTarget.style.background=T.bg1} onMouseLeave={e=>e.currentTarget.style.background='none'}>
              Sign out
            </button>
          </div>
        </div>
        <div style={{display:'flex',gap:0,overflowX:'auto',borderTop:`1px solid ${T.line}`,WebkitOverflowScrolling:'touch'}}>
          {navMods.map(item=>{const a=activeId===item.id,MI=item.Icon;return(
            <button key={item.id} onClick={()=>setActiveId(item.id)}
              style={{display:'flex',alignItems:'center',gap:6,padding:'9px 14px',border:'none',borderBottom:`2px solid ${a?T.accent:'transparent'}`,background:a?T.accentBg:'transparent',cursor:'pointer',whiteSpace:'nowrap',fontFamily:'inherit',color:a?T.accent:T.ink3,fontWeight:a?600:400,fontSize:12,transition:'color 0.12s,background 0.12s',flexShrink:0,marginBottom:-1}}>
              <MI size={13} color={a?T.accent:T.ink4}/>
              {item.name}
              
            </button>
          );})}
          {canViewLicense&&<button onClick={()=>setActiveId('license')}
            style={{display:'flex',alignItems:'center',gap:6,padding:'9px 14px',border:'none',borderBottom:`2px solid ${activeId==='license'?T.accent:'transparent'}`,background:activeId==='license'?T.accentBg:'transparent',cursor:'pointer',whiteSpace:'nowrap',fontFamily:'inherit',color:activeId==='license'?T.accent:T.ink3,fontWeight:activeId==='license'?600:400,fontSize:12,flexShrink:0,marginLeft:'auto',transition:'color 0.12s,background 0.12s',marginBottom:-1}}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={activeId==='license'?T.accent:T.ink4} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="14" r="4"/><path d="M10 11L20 1"/><path d="M16 5L19 8"/><path d="M18 3L21 6"/></svg>
            License
          </button>}
        </div>
      </div>
      <main style={{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch',paddingLeft:'var(--ps-gutter-x)',paddingRight:'var(--ps-gutter-x)',paddingTop:'var(--ps-gutter-y)',paddingBottom:'var(--ps-gutter-y)'}} key={activeId} className="au"><div style={{maxWidth:'var(--ps-max-width)',marginLeft:'auto',marginRight:'auto',width:'100%'}}>
        {activeId==='poultry'&&license.enabledModules.includes('poultry')&&canSeeModule(role,'poultry')&&<PoultryModule capacity={license.capacity.poultry||0} license={license} tier={tier} activeUser={activeUser} onUpdateLicense={onUpdateLicense} key={switchKey+'_'+dataMode} initialSeed={dataMode==='live'?PS_EMPTY:undefined} dataMode={dataMode} onSwitchToLive={onSwitchToLive} onRestoreTraining={onRestoreTraining}/>}
        {activeId==='hatchery'&&license.enabledModules.includes('hatchery')&&canSeeModule(role,'hatchery')&&<HatcheryModule capacity={license.capacity.hatchery||0} license={license} activeUser={activeUser} onUpdateLicense={onUpdateLicense} key={switchKey+'_'+dataMode} initialSeed={dataMode==='live'?HS_EMPTY:undefined} dataMode={dataMode} onSwitchToLive={onSwitchToLive} onRestoreTraining={onRestoreTraining}/>}
        {activeId==='feedmill'&&license.enabledModules.includes('feedmill')&&canSeeModule(role,'feedmill')&&<FeedMillModule capacity={license.capacity.feedmill||0} license={license} activeUser={activeUser} onUpdateLicense={onUpdateLicense} key={switchKey+'_'+dataMode} initialSeed={dataMode==='live'?FM_EMPTY:undefined} dataMode={dataMode} onSwitchToLive={onSwitchToLive} onRestoreTraining={onRestoreTraining}/>}
        {activeId==='core'&&tier.hasCore&&can(role,'module.core','view')&&(
          <div style={{maxWidth:700,margin:'0 auto',display:'flex',flexDirection:'column',gap:16}}>
            {/* Core Engine Header */}
            <div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'20px 22px'}}>
              <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
                <div style={{width:38,height:38,background:T.bg2,border:`1px solid ${T.line}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <IcoCore size={22} color={T.ink3}/>
                </div>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:T.ink,letterSpacing:-0.2,marginBottom:3}}>Core Engine</div>
                  <div style={{fontSize:12,color:T.ink3,lineHeight:1.6}}>Cross-module intelligence hub. Aggregated summaries from your enabled modules — {license.enabledModules.map(m=>MODULE_DEF[m]?.name).filter(Boolean).join(', ')}.</div>
                </div>
              </div>
            </div>
            {/* License status row */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10}}>
              {[['License Tier',tier.label],['Modules Active',license.enabledModules.length],['Days to Expiry',daysLeft+'d'],['Status',daysLeft>30?'Active':daysLeft>0?'Expiring Soon':'Expired']].map(([l,v])=>(
                <div key={l} style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'14px 16px'}}>
                  <div style={{fontSize:10,fontWeight:600,color:T.ink4,textTransform:'uppercase',letterSpacing:.7,marginBottom:4}}>{l}</div>
                  <div className="mono" style={{fontSize:16,fontWeight:700,color:T.ink,lineHeight:1}}>{v}</div>
                </div>
              ))}
            </div>
            {/* Cross-module summaries — only from enabled modules via __psState */}
            {(()=>{
              const ps = (typeof window!=='undefined'&&window.__psState)||{};
              const sections=[];
              if(license.enabledModules.includes('poultry')&&ps.poultry){
                const p=ps.poultry;
                const active=p.batches.filter(b=>b.status==='Active');
                const totalBirds=active.reduce((s,b)=>s+(Number(b.currentCount)||0),0);
                const totalMort=p.mortalityLogs.reduce((s,m)=>s+(Number(m.count)||0),0);
                const totalInitial=p.batches.reduce((s,b)=>s+(Number(b.initialCount)||0),0);
                const mortRate=totalInitial>0?((totalMort/totalInitial)*100).toFixed(1):'0.0';
                const pendingVax=p.vaccinations.filter(v=>v.status!=='Done'&&v.dueDate<new Date().toISOString().split('T')[0]).length;
                const totalRev=p.financialLogs.filter(f=>f.type==='Revenue').reduce((s,f)=>s+Number(f.amount),0);
                const totalCost=p.financialLogs.filter(f=>f.type==='Cost').reduce((s,f)=>s+Number(f.amount),0);
                sections.push(
                  <div key="poultry" style={{background:T.bg0,border:`1px solid ${T.line}`,overflow:'hidden'}}>
                    <div style={{padding:'11px 16px',borderBottom:`1px solid ${T.line}`,display:'flex',alignItems:'center',gap:8,background:T.bg1}}>
                      <IcoPoultry size={18} color={T.ink3}/><span style={{fontSize:11,fontWeight:700,color:T.ink,textTransform:'uppercase',letterSpacing:.7}}>PoultryOS</span>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:0}}>
                      {[['Active Batches',active.length],['Live Birds',totalBirds.toLocaleString('en-NG')],['Mortality Rate',mortRate+'%'],['Overdue Vax',pendingVax],['Net P&L',`${totalRev>=totalCost?'+':''}${(totalRev-totalCost>=0?'+':'')}${ngn(Math.abs(totalRev-totalCost))}`]].map(([l,v],i)=>(
                        <div key={l} style={{padding:'12px 14px',borderLeft:i>0?`1px solid ${T.line}`:'none'}}>
                          <div style={{fontSize:10,color:T.ink4,textTransform:'uppercase',letterSpacing:.5,marginBottom:3}}>{l}</div>
                          <div className="mono" style={{fontSize:14,fontWeight:700,color:T.ink}}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              } else if(license.enabledModules.includes('poultry')) {
                sections.push(<div key="poultry" style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'16px 18px',display:'flex',gap:10,alignItems:'center'}}><IcoPoultry size={18} color={T.ink4}/><span style={{fontSize:12,color:T.ink4}}>PoultryOS — navigate to this module to load data.</span></div>);
              }
              if(license.enabledModules.includes('hatchery')&&ps.hatchery){
                const h=ps.hatchery;
                const active=h.eggBatches.filter(e=>['Received','Incubating','Candling','Transfer'].includes(e.status));
                const totalDOC=h.processingRecords.reduce((s,p)=>s+p.packed,0);
                const totalHatched=h.hatchRecords.reduce((s,r)=>s+r.totalHatched,0);
                const totalSet=h.eggBatches.reduce((s,e)=>s+e.graded,0);
                const hatchPct=totalSet>0?((totalHatched/totalSet)*100).toFixed(1):'—';
                const hRev=h.financialLogs.filter(f=>f.type==='Revenue').reduce((s,f)=>s+Number(f.amount),0);
                const hCost=h.financialLogs.filter(f=>f.type==='Cost').reduce((s,f)=>s+Number(f.amount),0);
                sections.push(
                  <div key="hatchery" style={{background:T.bg0,border:`1px solid ${T.line}`,overflow:'hidden'}}>
                    <div style={{padding:'11px 16px',borderBottom:`1px solid ${T.line}`,display:'flex',alignItems:'center',gap:8,background:T.bg1}}>
                      <IcoHatchery size={18} color={T.ink3}/><span style={{fontSize:11,fontWeight:700,color:T.ink,textTransform:'uppercase',letterSpacing:.7}}>HatcheryOS</span>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:0}}>
                      {[['Active Cycles',active.length],['DOC Output',totalDOC.toLocaleString('en-NG')],['Hatchability',hatchPct!=='—'?hatchPct+'%':'—'],['Net P&L',`${ngn(hRev-hCost)}`]].map(([l,v],i)=>(
                        <div key={l} style={{padding:'12px 14px',borderLeft:i>0?`1px solid ${T.line}`:'none'}}>
                          <div style={{fontSize:10,color:T.ink4,textTransform:'uppercase',letterSpacing:.5,marginBottom:3}}>{l}</div>
                          <div className="mono" style={{fontSize:14,fontWeight:700,color:T.ink}}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              } else if(license.enabledModules.includes('hatchery')) {
                sections.push(<div key="hatchery" style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'16px 18px',display:'flex',gap:10,alignItems:'center'}}><IcoHatchery size={18} color={T.ink4}/><span style={{fontSize:12,color:T.ink4}}>HatcheryOS — navigate to this module to load data.</span></div>);
              }
              if(license.enabledModules.includes('feedmill')&&ps.feedmill){
                const fm=ps.feedmill;
                const completed=fm.productionBatches.filter(b=>b.status==='Completed');
                const totalProd=completed.reduce((s,b)=>s+b.actualQty,0);
                const lowRM=fm.rawMaterials.filter(r=>r.status!=='OK').length;
                const finStock=fm.finishedInventory.filter(f=>f.status!=='Depleted').reduce((s,f)=>s+f.qty,0);
                const fmRev=fm.financialLogs.filter(f=>f.type==='Revenue').reduce((s,f)=>s+Number(f.amount),0);
                const fmCost=fm.financialLogs.filter(f=>f.type==='Cost').reduce((s,f)=>s+Number(f.amount),0);
                sections.push(
                  <div key="feedmill" style={{background:T.bg0,border:`1px solid ${T.line}`,overflow:'hidden'}}>
                    <div style={{padding:'11px 16px',borderBottom:`1px solid ${T.line}`,display:'flex',alignItems:'center',gap:8,background:T.bg1}}>
                      <IcoFeedmill size={18} color={T.ink3}/><span style={{fontSize:11,fontWeight:700,color:T.ink,textTransform:'uppercase',letterSpacing:.7}}>FeedMillOS</span>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:0}}>
                      {[['Batches Done',completed.length],['Total Produced',totalProd.toLocaleString('en-NG')+'kg'],['Finished Stock',finStock.toLocaleString('en-NG')+'kg'],['RM Alerts',lowRM],['Net P&L',ngn(fmRev-fmCost)]].map(([l,v],i)=>(
                        <div key={l} style={{padding:'12px 14px',borderLeft:i>0?`1px solid ${T.line}`:'none'}}>
                          <div style={{fontSize:10,color:T.ink4,textTransform:'uppercase',letterSpacing:.5,marginBottom:3}}>{l}</div>
                          <div className="mono" style={{fontSize:14,fontWeight:700,color:T.ink}}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              } else if(license.enabledModules.includes('feedmill')) {
                sections.push(<div key="feedmill" style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'16px 18px',display:'flex',gap:10,alignItems:'center'}}><IcoFeedmill size={18} color={T.ink4}/><span style={{fontSize:12,color:T.ink4}}>FeedMillOS — navigate to this module to load data.</span></div>);
              }
              return sections;
            })()}
            <div style={{background:T.bg2,border:`1px solid ${T.line}`,padding:'11px 14px',display:'flex',gap:9,alignItems:'flex-start'}}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={T.ink4} strokeWidth="1.75" strokeLinecap="square" style={{flexShrink:0,marginTop:1}}><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
              <span style={{fontSize:11,color:T.ink4,lineHeight:1.6}}>Core Engine reads live data from active module sessions. Navigate into each module and return here to refresh summaries.</span>
            </div>
          </div>
        )}
        {activeId==='core'&&!tier.hasCore&&(<div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'60vh',gap:12}}><IcoLock size={26} color={T.ink4}/><div style={{fontSize:24,fontWeight:700,color:T.ink3,letterSpacing:-0.2}}>Core Engine Locked</div><div style={{fontSize:14,color:T.ink4}}>Upgrade to Professional or Enterprise to unlock.</div></div>)}
        {activeId==='license'&&canViewLicense&&(<div style={{maxWidth:640,margin:'0 auto',display:'flex',flexDirection:'column',gap:16}}>
          <div style={{background:T.bg1,border:`1px solid ${T.line}`,padding:'22px 22px 20px',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div><div style={{fontSize:10,fontWeight:600,color:T.accentDark,letterSpacing:2,textTransform:'uppercase',marginBottom:6}}>License Certificate</div><div style={{fontSize:24,fontWeight:700,color:'#1F2937',letterSpacing:-0.4,lineHeight:1.1}}>{license.profile?.farmName||'—'}</div><div style={{fontSize:12,color:T.accentDark,marginTop:5}}>{[license.profile?.city,license.profile?.location,license.profile?.lga,license.profile?.state,license.profile?.country].filter(Boolean).join(', ')}</div></div>
            <div style={{textAlign:'right'}}><div style={{fontSize:9,fontWeight:700,padding:'3px 9px',background:T.accentLine,color:T.accentDark,letterSpacing:1,textTransform:'uppercase'}}>{tier.label}</div><div className="mono" style={{fontSize:9,color:T.ink4,marginTop:8}}>#{license.id}</div></div>
          </div>
          <div style={{background:T.bg0,border:`1px solid ${T.line}`,overflow:'hidden'}}>
            {[['Licensee',license.profile?.farmName],['Contact',license.profile?.contactName],['City',license.profile?.city||'—'],['Role',license.profile?.role],['Email',license.profile?.email||'—'],['Phone',license.profile?.phone||'—'],['Tier',tier.label],['Status',demoActive?`Demo (${demoLeft}d remaining)`:(license.paid?'Active paid license':'Pending activation')],['Issued',license.issued],['Expires',demoActive?'Awaiting activation':license.expiry],['Days Remaining',`${daysLeft}d`],['Annual Fee',ngn(license.costBreakdown?.total||0)]].map(([k,v],i)=>(<div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',borderTop:i>0?`1px solid ${T.line}`:'none'}}><span style={{fontSize:13,color:T.ink3}}>{k}</span><span className="mono" style={{fontSize:13,fontWeight:600,color:T.ink,textAlign:'right',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis'}}>{v}</span></div>))}
          </div>
        </div>)}
      </div></main>
      {notifOpen&&<NotificationPanel notifs={allNotifs} onClose={()=>setNotifOpen(false)} onNavigate={(mod,engine,action,context)=>{
        // Deep-link: switch the active module tab and queue the engine to open
        // inside it. The optional `action` token signals to the target engine
        // that a specific modal should be opened (e.g., 'logMortality').
        // `context` carries record ids so the engine can preselect the right batch.
        if(engine){
          try{window.__psPendingEngine={module:mod,engine,action:action||null,context:context||null,ts:Date.now()};}catch(_){}
        }
        setActiveId(mod);
      }}/>}
    </div>
  );
}

// ── ROOT APP
function PoultrySuiteAfricaCore(){
  useEffect(()=>{const el=document.createElement('style');el.textContent=GCSS;document.head.appendChild(el);const ps=document.createElement('script');ps.src='https://js.paystack.co/v1/inline.js';ps.async=true;document.head.appendChild(ps);return()=>{try{document.head.removeChild(el);document.head.removeChild(ps);}catch(_){}};},[]);
  const [screen,setScreen]=useState('splash');
  const [tier,setTier]=useState(null);
  const [modules,setModules]=useState([]);
  const [license,setLicense]=useState(null);
  const [activeUser,setActiveUser]=useState(null);
  const [auditLog,setAuditLog]=useState([]);
  const [deviceId,setDeviceId]=useState(null);
  const [demoRec,setDemoRec]=useState(null);
  const [loading,setLoading]=useState(true);
  const [dataMode,setDataModeState]=useState('demo');
  const [switchKey,setSwitchKey]=useState(0);
  const [tcAccepted,setTcAccepted]=useState(false);
  const addAudit=useCallback((action,user='User')=>{setAuditLog(l=>[{ts:new Date().toISOString(),user,action},...l].slice(0,200));},[]);

  useEffect(()=>{
    let mounted=true;
    (async()=>{
      try{
        const [did,storedLicRaw,demo,setup,dm,tc]=await Promise.all([getDeviceId(),getStoredLicense(),getDemoRecord(),getStoredSetup(),getDataMode(),getTCAccepted()]);
        const storedLic=storedLicRaw?migrateLicense(storedLicRaw):null;
        if(mounted){setDataModeState(dm||'demo');if(tc)setTcAccepted(true);}
        if(!mounted)return;
        setDeviceId(did);setDemoRec(demo);
        if(storedLic&&isLicenseValid(storedLic)){setLicense(storedLic);setTier(storedLic.tier);setModules(storedLic.enabledModules||[]);}
        else if(demo&&!isDemoActive(demo)&&setup){if(setup.license)setLicense(migrateLicense(setup.license));if(setup.tier)setTier(setup.tier);if(setup.modules)setModules(setup.modules);}
        else if(demo&&isDemoActive(demo)&&setup?.license){setLicense(migrateLicense(setup.license));setTier(setup.tier||demo.tier);setModules(setup.modules||[]); }
      }catch(e){console.warn("PoultrySuite boot error:",e);}finally{if(mounted)setLoading(false);}
    })();
  },[]);

  useEffect(()=>{
    if(screen!=='splash'||loading)return;
    const decide=async()=>{
      try{
        const [storedLic,demo,setup]=await Promise.all([getStoredLicense(),getDemoRecord(),getStoredSetup()]);
        const tca=await getTCAccepted();
        if(!tca){setScreen('termsGate');return;}
        if(storedLic&&isLicenseValid(storedLic)){setScreen('login');return;}
        if(demo&&!isDemoActive(demo)&&setup){setScreen('expired');return;}
        if(demo&&isDemoActive(demo)&&setup?.license){setScreen('login');return;}
        setScreen('tierSelect');
      }catch(e){console.warn('decide error:',e);setScreen('tierSelect');}
    };
    const t=setTimeout(decide,2600);return()=>clearTimeout(t);
  },[screen,loading]);

  const handleTCAccept=()=>{setTcAccepted(true);setScreen('tierSelect');};
  const handleTierSelect=(t)=>{setTier(t);if(t==='enterprise'){setModules(['poultry','hatchery','feedmill']);setScreen('profileReg');}else setScreen('moduleSelect');};
  const handleModuleSelect=(mods)=>{setModules(mods);setScreen('profileReg');};
  const handleProfileComplete=async(form)=>{try{const lic=buildLicense(tier,modules,form.capacity,form,form.pin);setLicense(lic);const setup={tier,modules,license:lic,pin:form.pin};await storeSetup(setup);addAudit('Profile registered','System');}catch(e){console.warn('profile err',e);}setScreen('paymentGate');};
  const handleStartDemo=async()=>{try{const rec=await startDemo(tier);setDemoRec(rec);addAudit('Demo started','System');}catch(e){console.warn('demo err',e);}setScreen('licenseView');};
  const handleActivateKey=async(paidLic)=>{const lic=migrateLicense(paidLic);await storeLicense(lic);const setup=await getStoredSetup();await storeSetup({...setup,license:lic});setLicense(lic);addAudit('Paid license activated','System');setScreen('licenseView');};
  const handleActivate=()=>{addAudit('System activated','System');setScreen('dashboard');};
  const handleLoginSuccess=(user)=>{setActiveUser(user);addAudit('Authenticated via role PIN',user?.name||'User');setScreen('dashboard');};
  const handleLogout=()=>{addAudit('User signed out',activeUser?.name||'User');setActiveUser(null);setScreen('login');};
  const handleUpdateLicense=useCallback(async(newLic)=>{
    try{
      const lic=migrateLicense(newLic);
      await storeLicense(lic);
      const setup=await getStoredSetup();
      if(setup)await storeSetup({...setup,license:lic});
      setLicense(lic);
      // Refresh active user reference if they were edited
      if(activeUser){const updated=(lic.users||[]).find(u=>u.id===activeUser.id);if(updated)setActiveUser(updated);else setActiveUser(null);}
      addAudit('License updated',activeUser?.name||'User');
    }catch(e){console.warn('license update err',e);}
  },[activeUser,addAudit]);
  const handleSwitchToLive=async()=>{
    await setDataMode('live');
    setDataModeState('live');
    setSwitchKey(k=>k+1);
  };
  const handleRestoreTrainingData=async()=>{
    await setDataMode('demo');
    setDataModeState('demo');
    setSwitchKey(k=>k+1);
  };
  const handleRenew=()=>setScreen('paymentGate');
  const handleResetSetup=async()=>{try{await window.storage.delete('psa:demo');await window.storage.delete('psa:setup');await window.storage.delete('psa:license');}catch(_){}setDemoRec(null);setLicense(null);setActiveUser(null);setTier(null);setModules([]);setScreen('tierSelect');};

  // ─── PRODUCTION FEATURES INTEGRATION ──────────────────
  const isOnline=useNetworkStatus();
  
  // Session timeout - only active when logged in
  const handleSessionTimeout=useCallback(()=>{
    if(screen==='dashboard'){
      addAudit('Session timeout - auto logout','System');
      setActiveUser(null);
      setScreen('login');
    }
  },[screen,addAudit]);
  
  const{showWarning:showSessionWarning,secondsLeft,resetTimer:resetSessionTimer}=useSessionTimeout(
    15, // 15 minutes
    handleSessionTimeout,
    screen==='dashboard'&&!!activeUser
  );
  
  // Auto-backup check on dashboard
  useEffect(()=>{
    if(screen!=='dashboard'||!license)return;
    const checkBackup=async()=>{
      if(shouldAutoBackup()){
        try{
          // Get all module data for backup
          const backupData={license,activeUser:activeUser?.name,timestamp:new Date().toISOString()};
          if(performAutoBackup(backupData,'PoultrySuite')){
            addAudit('Auto-backup completed','System');
            sendNotification('✅ Auto-Backup Complete',{
              body:'Your data has been automatically backed up.',
              tag:'autobackup',
              silent:true,
              duration:5000
            });
          }
        }catch(e){console.warn('Auto-backup error:',e);}
      }
    };
    checkBackup();
    const interval=setInterval(checkBackup,3600000); // Check every hour
    return()=>clearInterval(interval);
  },[screen,license,activeUser,addAudit]);
  
  // Request notification permission on login
  useEffect(()=>{
    if(screen==='dashboard'&&activeUser){
      requestNotificationPermission();
    }
  },[screen,activeUser]);

  return(<>
    <OfflineBanner isOnline={isOnline}/>
    {showSessionWarning&&<SessionTimeoutWarning secondsLeft={secondsLeft} onContinue={resetSessionTimer} onLogout={handleSessionTimeout}/>}
    {screen==='dashboard'&&demoRec&&isDemoActive(demoRec)&&<DemoBanner demoRec={demoRec} onUpgrade={handleRenew}/>}
    {screen==='dashboard'&&license?.paid&&<LicenseExpiryBanner license={license} onRenew={handleRenew}/>}
    {screen==='splash'        &&<SplashScreen/>}
    {screen==='termsGate'     &&<TermsAcceptanceScreen onAccept={handleTCAccept}/>}
    {screen==='tierSelect'    &&<TierSelectScreen onSelect={handleTierSelect}/>}
    {screen==='moduleSelect'  &&<ModuleSelectScreen tier={tier} onSelect={handleModuleSelect}/>}
    {screen==='profileReg'    &&<ProfileRegScreen tier={tier} modules={modules} onComplete={handleProfileComplete}/>}
    {screen==='paymentGate'   &&license&&<PaymentGateScreen tier={tier} modules={modules} license={license} deviceId={deviceId} demoRec={demoRec} onDemo={handleStartDemo} onActivateKey={handleActivateKey} onBack={()=>setScreen('profileReg')}/>}
    {screen==='licenseView'   &&license&&<LicenseViewScreen license={license} onActivate={handleActivate}/>}
    {screen==='login'         &&<PinLoginScreen storedPin={license?.pin} license={license} onSuccess={handleLoginSuccess}/>}
    {screen==='expired'       &&<ExpiredScreen type={demoRec&&!isDemoActive(demoRec)?'demo':'paid'} tier={tier||'single'} onRenew={handleRenew} onResetDemo={handleResetSetup}/>}
    {screen==='dashboard'     &&license&&<Dashboard license={license} activeUser={activeUser} onLogout={handleLogout} addAudit={addAudit} auditLog={auditLog} dataMode={dataMode} onSwitchToLive={handleSwitchToLive} onRestoreTraining={handleRestoreTrainingData} switchKey={switchKey} onUpdateLicense={handleUpdateLicense} demoRec={demoRec}/>}
  </>);
}

// ─── EXPORT WITH ERROR BOUNDARY ───────────────────────────
export default function PoultrySuiteAfrica(){
  return React.createElement(ErrorBoundary,null,React.createElement(PoultrySuiteAfricaCore));
}
