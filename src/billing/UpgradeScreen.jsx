import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { loadPlans, createPaymentIntent, openPaystack, pollSubscription, isBillingConfigured } from './billingService.js';

const C = {
  ink:'#1F2937', ink2:'#374151', ink3:'#6B7280', ink4:'#9CA3AF', line:'#E5E7EB',
  bg:'#F9FAFB', card:'#FFFFFF', accent:'#0f5540', accentBg:'#E7F2EE', accentLine:'#BFE0D4',
  ok:'#15803D', okBg:'#F0FDF4', err:'#B91C1C', errBg:'#FEF2F2',
};

function naira(minor) {
  return '₦' + (minor / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 });
}

const FEATURES = {
  starter:['Up to 2 devices','Core PoultryOS','Houses, batches & mortality','Feed & vaccination tracking','Offline-capable, cloud-synced'],
  professional:['Up to 5 devices','Everything in Starter','HatcheryOS module','Advanced analytics','Priority email support'],
  enterprise:['Up to 15 devices','Everything in Professional','FeedMillOS module','Multi-branch ready','Dedicated support'],
};

export default function UpgradeScreen({ onClose }) {
  const { activeFarm, role, refreshContext } = useAuth();
  const [plans, setPlans] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [loadingPlans, setLoadingPlans] = useState(true);

  useEffect(() => {
    (async () => {
      const { plans, error } = await loadPlans();
      if (error) setMsg({ kind: 'err', text: error });
      else setPlans(plans);
      setLoadingPlans(false);
    })();
  }, []);

  const isOwner = role === 'farm_owner' || role === 'super_admin';

  const buy = async (tier) => {
    setMsg(null);
    if (!isBillingConfigured) { setMsg({ kind:'err', text:'Billing is not configured yet. Please try again later.' }); return; }
    if (!isOwner) { setMsg({ kind:'err', text:'Only the farm owner can purchase a subscription.' }); return; }
    setBusy(true);
    try {
      const intent = await createPaymentIntent(tier);
      if (intent.error) { setMsg({ kind:'err', text:intent.error }); setBusy(false); return; }
      const result = await openPaystack({ email: intent.email, amountMinor: intent.amount, reference: intent.reference });
      if (result.status === 'success') {
        setMsg({ kind:'ok', text:'Payment received — activating your plan…' });
        const sub = await pollSubscription(activeFarm?.id);
        if (sub) {
          setMsg({ kind:'ok', text:'Your plan is now active. Thank you!' });
          refreshContext && refreshContext();
        } else {
          setMsg({ kind:'ok', text:'Payment received. Your plan will activate shortly — you can refresh in a moment.' });
        }
      } else {
        setMsg({ kind:'err', text:'Checkout cancelled. No payment was made.' });
      }
    } catch (err) {
      setMsg({ kind:'err', text: String(err?.message || err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:C.ink, letterSpacing:-0.3 }}>Choose your plan</div>
          <div style={{ fontSize:13, color:C.ink3, marginTop:4, lineHeight:1.5 }}>Annual subscription, billed once a year. Upgrade anytime as your farm grows.</div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background:'transparent', border:`1px solid ${C.line}`, color:C.ink3, padding:'8px 14px', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Close</button>
        )}
      </div>

      {msg && (
        <div style={{ padding:'10px 14px', fontSize:13, lineHeight:1.5, background: msg.kind==='ok'?C.okBg:C.errBg, color: msg.kind==='ok'?C.ok:C.err, border:`1px solid ${msg.kind==='ok'?'#BBF7D0':'#FECACA'}` }}>{msg.text}</div>
      )}

      {/* Temporary diagnostic */}
      <div style={{background:'#F3F4F6',border:'1px solid #E5E7EB',padding:'10px 12px',fontSize:11,fontFamily:'monospace',color:'#374151',lineHeight:1.7,wordBreak:'break-word'}}>
        <div style={{fontWeight:700,marginBottom:4}}>Billing diagnostic:</div>
        <div>role: <b>{JSON.stringify(role)}</b> (isOwner: <b>{String(isOwner)}</b>)</div>
        <div>activeFarm.id: <b>{JSON.stringify(activeFarm?.id)}</b></div>
        <div>isBillingConfigured: <b>{String(isBillingConfigured)}</b></div>
        <div>plans loaded: <b>{plans.length}</b></div>
      </div>

      {loadingPlans ? (
        <div style={{ padding:'40px', textAlign:'center', color:C.ink4, fontSize:14 }}>Loading plans…</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:14 }}>
          {plans.map((p) => {
            const featured = p.tier === 'professional';
            return (
              <div key={p.id} style={{ display:'flex', flexDirection:'column', background:C.card, border:`${featured?2:1}px solid ${featured?C.accent:C.line}`, padding:'22px 20px', position:'relative' }}>
                {featured && (
                  <div style={{ position:'absolute', top:-11, left:20, background:C.accent, color:'#fff', fontSize:10, fontWeight:700, padding:'3px 10px', textTransform:'uppercase', letterSpacing:0.8 }}>Most popular</div>
                )}
                <div style={{ fontSize:15, fontWeight:800, color:C.ink, marginBottom:4 }}>{p.name}</div>
                <div style={{ fontSize:12, color:C.ink4, lineHeight:1.5, marginBottom:16, minHeight:34 }}>{p.description}</div>
                <div style={{ display:'flex', alignItems:'baseline', gap:5, marginBottom:18 }}>
                  <span style={{ fontSize:26, fontWeight:800, color:C.ink, letterSpacing:-0.5 }}>{naira(p.annual_price_minor)}</span>
                  <span style={{ fontSize:12, color:C.ink4 }}>/year</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
                  {(FEATURES[p.tier] || []).map((f,i) => (
                    <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', fontSize:12.5, color:C.ink2, lineHeight:1.45 }}>
                      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0, marginTop:1 }}><path d="M20 6L9 17l-5-5"/></svg>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => buy(p.tier)} disabled={busy || !isOwner}
                  style={{ marginTop:'auto', background: featured?C.accent:'transparent', color: featured?'#fff':C.accent, border:`1.5px solid ${C.accent}`, padding:'11px 16px', fontSize:13, fontWeight:700, cursor: (busy||!isOwner)?'not-allowed':'pointer', fontFamily:'inherit', minHeight:44, opacity:(busy||!isOwner)?0.55:1 }}>
                  {busy ? 'Please wait…' : `Choose ${p.name}`}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!isOwner && (
        <div style={{ fontSize:12, color:C.ink4, textAlign:'center' }}>Only the farm owner can purchase or change the subscription.</div>
      )}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontSize:11, color:C.ink4, marginTop:4 }}>
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={C.ink4} strokeWidth="1.75" strokeLinecap="square"><rect x="3" y="11" width="18" height="11" rx="0"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Secure payment by Paystack · cards, bank transfer & USSD
      </div>
    </div>
  );
}
