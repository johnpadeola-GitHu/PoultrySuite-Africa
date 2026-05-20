import React, { useState, useCallback } from 'react';

// ── Color tokens
const T = {
  bg0:'#FFFFFF', bg1:'#F8FAFC', bg2:'#F1F5F9',
  ink:'#1F2937', ink3:'#6B7280', ink4:'#9CA3AF',
  line:'#E5E7EB', accent:'#5B9BD5', accentBg:'#EFF6FF', accentLine:'#BFDBFE',
  ok:'#10B981', okBg:'#ECFDF5', okLine:'#A7F3D0',
  err:'#EF4444', errBg:'#FEF2F2', errLine:'#FECACA',
  warn:'#F59E0B', warnBg:'#FFFBEB',
};

// ── Pricing
const MODULE_BASE = { poultry:180000, hatchery:250000, feedmill:300000 };
const MODULE_LABEL = { poultry:'PoultryOS', hatchery:'HatcheryOS', feedmill:'FeedMillOS' };
const MODULE_CAP_LABEL = { poultry:'Birds', hatchery:'Eggs/Month', feedmill:'Tons/Month' };

const getCapFee = (mod, val) => {
  const v = Number(val)||0;
  if(mod==='poultry'){if(v<=5000)return 0;if(v<=20000)return 120000;if(v<=50000)return 250000;if(v<=100000)return 400000;return 600000;}
  if(mod==='hatchery'){if(v<=10000)return 0;if(v<=50000)return 200000;if(v<=150000)return 400000;return 700000;}
  if(mod==='feedmill'){if(v<=50)return 0;if(v<=200)return 250000;if(v<=500)return 500000;return 900000;}
  return 0;
};

const ngn = n => `₦${Number(n||0).toLocaleString('en-NG')}`;

// ── Key generation: PSA-XXXX-XXXX-XXXX-XXXX
// Shared encoding contract between generator and main app.
// All segments are DETERMINISTIC (no random) so the main app can verify.
//
// Seg1 [Tier+Modules]: [tierChar][modBitsChar][checksum1][checksum2]
//   tierChar: S/P/E
//   modBitsChar: charset[bits] where bits = poultry:1 + hatchery:2 + feedmill:4
//   checksum1+2: hash of (tier+bits)
//
// Seg2 [Capacity]: 4-char hash of canonical capacity string
// Seg3 [Expiry+Client]: 4-char hash of (expiryYYYY-MM | normalised client)
// Seg4 [Master checksum]: 4-char hash of seg1+seg2+seg3+full payload
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 chars, no 0/O/1/I

function hashStr(str, len) {
  // FNV-1a-ish; same output for same input across both apps
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let out = '';
  for (let i = 0; i < len; i++) {
    out += CHARS[h % 32];
    h = ((h >>> 5) ^ Math.imul(h, 2654435761)) >>> 0;
  }
  return out;
}

function normCap(cap) {
  return [
    (Number(cap.poultry) || 0),
    (Number(cap.hatchery) || 0),
    (Number(cap.feedmill) || 0),
  ].join('|');
}

function normClient(name, farm) {
  return ((name || '') + '|' + (farm || '')).toUpperCase().replace(/\s+/g, '');
}

function tierToChar(tier) {
  return ({ single: 'S', professional: 'P', enterprise: 'E' })[tier] || 'S';
}

function modsToBits(mods) {
  return mods.reduce((s, m) => s + ({ poultry: 1, hatchery: 2, feedmill: 4 }[m] || 0), 0);
}

function encodeTierMods(tier, mods) {
  const tChar = tierToChar(tier);
  const bits = modsToBits(mods);
  const bChar = CHARS[bits % 32];
  const ck = hashStr('TM|' + tChar + bChar, 2);
  return tChar + bChar + ck;
}

function encodeCapacity(tier, mods, cap) {
  return hashStr('CAP|' + tierToChar(tier) + '|' + modsToBits(mods) + '|' + normCap(cap), 4);
}

function encodeExpiry(expiry, clientName, farm) {
  const ym = (expiry || '').slice(0, 7); // YYYY-MM
  return hashStr('EXP|' + ym + '|' + normClient(clientName, farm), 4);
}

function encodeMaster(seg1, seg2, seg3, tier, mods, cap, expiry, clientName, farm) {
  const payload = [
    seg1, seg2, seg3,
    tierToChar(tier), modsToBits(mods),
    normCap(cap), (expiry || '').slice(0, 7),
    normClient(clientName, farm),
  ].join('~');
  return hashStr('MK|' + payload, 4);
}

function generateKey(tier, mods, cap, clientName, farm, expiry) {
  const seg1 = encodeTierMods(tier, mods);
  const seg2 = encodeCapacity(tier, mods, cap);
  const seg3 = encodeExpiry(expiry, clientName, farm);
  const seg4 = encodeMaster(seg1, seg2, seg3, tier, mods, cap, expiry, clientName, farm);
  return `PSA-${seg1}-${seg2}-${seg3}-${seg4}`;
}

// ── Validate key format (charset is the restricted 32-char set, not raw alphanumeric)
function validateKeyFormat(key) {
  return /^PSA-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test((key || '').trim().toUpperCase());
}

// ── UI helpers
function Label({children}){
  return <div style={{fontSize:12,fontWeight:600,color:T.ink3,marginBottom:5,letterSpacing:0.1}}>{children}</div>;
}
function Field({label,children}){
  return <div style={{display:'flex',flexDirection:'column',marginBottom:12}}><Label>{label}</Label>{children}</div>;
}
function Input({value,onChange,type='text',placeholder='',readOnly=false}){
  return <input value={value} onChange={e=>onChange(e.target.value)} type={type} placeholder={placeholder} readOnly={readOnly}
    style={{padding:'10px 12px',border:`1px solid ${T.line}`,background:readOnly?T.bg1:T.bg0,fontSize:14,color:T.ink,outline:'none',width:'100%',fontFamily:'inherit',cursor:readOnly?'default':'text'}}/>;
}
function Select({value,onChange,options}){
  return <div style={{position:'relative'}}>
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{width:'100%',padding:'10px 32px 10px 12px',border:`1px solid ${T.line}`,background:T.bg0,fontSize:14,color:T.ink,outline:'none',appearance:'none',WebkitAppearance:'none',fontFamily:'inherit',cursor:'pointer'}}>
      {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    <svg style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}} width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={T.ink4} strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter"><path d="M6 9L12 15L18 9"/></svg>
  </div>;
}
function Checkbox({checked,onChange,label}){
  return <div onClick={()=>onChange(!checked)} style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',padding:'6px 0'}}>
    <div style={{width:18,height:18,border:`2px solid ${checked?T.accent:T.line}`,background:checked?T.accent:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
      {checked&&<svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"><path d="M4 12L10 18L20 6"/></svg>}
    </div>
    <span style={{fontSize:13,color:T.ink,userSelect:'none'}}>{label}</span>
  </div>;
}
function Btn({children,onClick,disabled=false,variant='primary',full=false}){
  const bg = variant==='primary'?T.accent:T.bg1;
  const cl = variant==='primary'?'#fff':T.ink;
  const br = variant==='primary'?T.accent:T.line;
  return <button onClick={disabled?undefined:onClick} disabled={disabled}
    style={{padding:'10px 18px',background:bg,color:cl,border:`1px solid ${br}`,fontSize:13,fontWeight:600,cursor:disabled?'not-allowed':'pointer',opacity:disabled?.38:1,width:full?'100%':'auto',fontFamily:'inherit',minHeight:44,transition:'opacity .15s'}}>
    {children}
  </button>;
}
function Divider({label}){
  return <div style={{display:'flex',alignItems:'center',gap:10,margin:'18px 0'}}>
    <div style={{flex:1,height:1,background:T.line}}/>
    <span style={{fontSize:11,color:T.ink4,textTransform:'uppercase',letterSpacing:1}}>{label}</span>
    <div style={{flex:1,height:1,background:T.line}}/>
  </div>;
}

// ── Main generator
export default function KeyGenerator() {
  const today = new Date().toISOString().split('T')[0];
  const yearLater = new Date(Date.now()+365*86400000).toISOString().split('T')[0];

  const [tier, setTier] = useState('single');
  const [mods, setMods] = useState(['poultry']);
  const [cap, setCap] = useState({poultry:'',hatchery:'',feedmill:''});
  const [client, setClient] = useState({name:'',email:'',phone:'',farm:'',location:''});
  const [issued, setIssued] = useState(today);
  const [expiry, setExpiry] = useState(yearLater);

  const [keys, setKeys] = useState([]);
  const [copied, setCopied] = useState(null);

  // Validate key
  const [validateInput, setValidateInput] = useState('');
  const [validateResult, setValidateResult] = useState(null);

  const allMods = tier==='enterprise' ? ['poultry','hatchery','feedmill'] : mods;

  const feeBreakdown = allMods.map(m => {
    const base = MODULE_BASE[m];
    const capFee = getCapFee(m, cap[m]||0);
    return {m, name:MODULE_LABEL[m], base, capFee, total:base+capFee};
  });
  let totalFee = feeBreakdown.reduce((s,f)=>s+f.total, 0);
  if(tier==='enterprise') {
    const rawCap = feeBreakdown.reduce((s,f)=>s+f.capFee,0);
    totalFee = 600000 + Math.round(rawCap * 0.85);
  }

  const toggleMod = (m) => {
    if(tier==='enterprise') return;
    const maxN = tier==='single'?1:2;
    if(mods.includes(m)) { if(mods.length>1) setMods(mods.filter(x=>x!==m)); }
    else { if(mods.length<maxN) setMods([...mods,m]); }
  };

  const generate = useCallback(() => {
    const k = generateKey(tier, allMods, cap, client.name, client.farm, expiry);
    const entry = {
      key:k, tier, mods:allMods, cap:{...cap}, client:{...client},
      issued, expiry, totalFee,
      generatedAt: new Date().toISOString()
    };
    setKeys(prev => [entry, ...prev].slice(0,50));
  }, [tier, allMods, cap, client, issued, expiry, totalFee]);

  const copy = (text, id) => {
    navigator.clipboard.writeText(text).then(()=>{setCopied(id);setTimeout(()=>setCopied(null),2000);});
  };

  const exportCSV = () => {
    const header = 'Key,Tier,Modules,Client,Farm,Email,Phone,Location,Issued,Expiry,Fee';
    const rows = keys.map(k =>
      [k.key,k.tier,k.mods.join('+'),k.client.name,k.client.farm,k.client.email,k.client.phone,k.client.location,k.issued,k.expiry,k.totalFee].join(',')
    );
    const blob = new Blob([header+'\n'+rows.join('\n')], {type:'text/csv'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'PoultrySuite_Keys_'+today+'.csv'; a.click();
  };

  const doValidate = () => {
    const k = (validateInput||'').trim().toUpperCase();
    if(!k){setValidateResult({ok:false,msg:'Enter a key to validate.'});return;}
    if(!validateKeyFormat(k)){
      setValidateResult({ok:false,msg:'Invalid key format. Expected: PSA-XXXX-XXXX-XXXX-XXXX (32-char restricted set).'});
      return;
    }
    // Check if this key was generated in this session
    const match = keys.find(e=>e.key===k);
    if(match){
      // Re-derive segments and confirm integrity
      const expected = generateKey(match.tier, match.mods, match.cap, match.client.name, match.client.farm, match.expiry);
      if(expected===k){
        setValidateResult({ok:true,msg:`✓ Valid PSA key. Tier: ${match.tier.charAt(0).toUpperCase()+match.tier.slice(1)} · Client: ${match.client.name} · Expires: ${match.expiry}`});
      }else{
        setValidateResult({ok:false,msg:'Key found in session but checksum mismatch — possible corruption.'});
      }
      return;
    }
    // Format valid but key not generated here — show tier from segment, mark as external
    const tier_char = k[4];
    const tierMap = {S:'Single',P:'Professional',E:'Enterprise'};
    const detectedTier = tierMap[tier_char] || 'Unknown';
    setValidateResult({ok:true,msg:`Format valid · Tier letter: ${detectedTier} · Key not in current session (full verification requires the original tier/modules/capacity/client used at generation).`});
  };

  const modsOk = tier==='enterprise' || mods.length===(tier==='single'?1:2);

  return (
    <div style={{minHeight:'100vh',background:T.bg1,fontFamily:"Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",color:T.ink}}>
      {/* Header */}
      <div style={{background:T.bg0,borderBottom:`1px solid ${T.line}`,padding:'14px 20px',display:'flex',alignItems:'center',gap:12}}>
        <div style={{width:40,height:40,background:'#1F2937',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter">
            <rect x="2" y="7" width="20" height="14"/><path d="M16 7V5a2 2 0 00-4 0v2M8 7V5a2 2 0 00-4 0v2M2 11h20"/>
          </svg>
        </div>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:T.ink,lineHeight:1.1}}>PoultrySuite Africa</div>
          <div style={{fontSize:11,color:T.ink4,marginTop:2}}>License Key Generator · AgoroX Technologies</div>
        </div>
        <div style={{marginLeft:'auto',fontSize:11,color:T.ink4,background:T.bg2,padding:'4px 10px',border:`1px solid ${T.line}`}}>ADMIN ONLY</div>
      </div>

      <div style={{maxWidth:680,margin:'0 auto',padding:'20px 16px 40px'}}>
        {/* License Config */}
        <div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'20px',marginBottom:14}}>
          <div style={{fontSize:14,fontWeight:700,color:T.ink,marginBottom:16}}>1. License Configuration</div>

          <Field label="License Tier">
            <Select value={tier} onChange={v=>{setTier(v);if(v==='enterprise')setMods(['poultry','hatchery','feedmill']);else if(v==='single')setMods([mods[0]||'poultry']);else setMods(mods.slice(0,2));}} options={[{value:'single',label:'Single — 1 module'},{value:'professional',label:'Professional — 2 modules + Core Engine'},{value:'enterprise',label:'Enterprise — All 3 modules + Core Engine'}]}/>
          </Field>

          <div style={{marginBottom:12}}>
            <Label>Modules {tier!=='enterprise'&&`(select ${tier==='single'?1:2})`}</Label>
            {['poultry','hatchery','feedmill'].map(m=>(
              <Checkbox key={m} checked={allMods.includes(m)} onChange={()=>toggleMod(m)} label={MODULE_LABEL[m]+' — '+MODULE_CAP_LABEL[m]}/>
            ))}
            {tier!=='enterprise'&&!modsOk&&<div style={{fontSize:11,color:T.warn,marginTop:4}}>Select exactly {tier==='single'?1:2} module{tier==='professional'?'s':''}.</div>}
          </div>

          <div style={{marginBottom:12}}>
            <Label>Operational Capacity</Label>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {allMods.map(m=>(
                <div key={m} style={{display:'grid',gridTemplateColumns:'140px 1fr 120px',gap:10,alignItems:'center'}}>
                  <span style={{fontSize:12,color:T.ink3,fontWeight:500}}>{MODULE_LABEL[m]}</span>
                  <Input value={cap[m]||''} onChange={v=>setCap(c=>({...c,[m]:v}))} type="number" placeholder={`Enter ${MODULE_CAP_LABEL[m].toLowerCase()}`}/>
                  <span style={{fontSize:11,color:T.ink4,textAlign:'right'}}>{cap[m]?ngn(getCapFee(m,cap[m])):'+₦0'}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <Field label="Issue Date"><Input type="date" value={issued} onChange={v=>{setIssued(v);const d=new Date(v);d.setFullYear(d.getFullYear()+1);setExpiry(d.toISOString().split('T')[0]);}}/></Field>
            <Field label="Expiry Date"><Input type="date" value={expiry} onChange={setExpiry}/></Field>
          </div>

          {/* Fee summary */}
          <div style={{background:T.bg1,border:`1px solid ${T.line}`,padding:'12px 14px',marginTop:4}}>
            {feeBreakdown.map(f=>(
              <div key={f.m} style={{display:'flex',justifyContent:'space-between',fontSize:12,color:T.ink3,marginBottom:4}}>
                <span>{f.name} base</span><span>{ngn(f.base)}</span>
              </div>
            ))}
            {feeBreakdown.map(f=>f.capFee>0&&(
              <div key={f.m+'c'} style={{display:'flex',justifyContent:'space-between',fontSize:12,color:T.ink3,marginBottom:4}}>
                <span>{f.name} capacity</span><span>{ngn(f.capFee)}</span>
              </div>
            ))}
            {tier==='enterprise'&&<div style={{fontSize:11,color:T.ink4,marginBottom:4}}>Enterprise 15% capacity discount applied</div>}
            <div style={{display:'flex',justifyContent:'space-between',fontSize:14,fontWeight:700,color:T.ink,paddingTop:8,borderTop:`1px solid ${T.line}`,marginTop:4}}>
              <span>Total Annual Fee</span><span>{ngn(totalFee)}</span>
            </div>
          </div>
        </div>

        {/* Client Info */}
        <div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'20px',marginBottom:14}}>
          <div style={{fontSize:14,fontWeight:700,color:T.ink,marginBottom:16}}>2. Client Information</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <Field label="Contact Name *"><Input value={client.name} onChange={v=>setClient(c=>({...c,name:v}))} placeholder="Full name"/></Field>
            <Field label="Farm / Organisation"><Input value={client.farm} onChange={v=>setClient(c=>({...c,farm:v}))} placeholder="Farm name"/></Field>
            <Field label="Email"><Input value={client.email} onChange={v=>setClient(c=>({...c,email:v}))} placeholder="email@farm.com"/></Field>
            <Field label="Phone"><Input value={client.phone} onChange={v=>setClient(c=>({...c,phone:v}))} placeholder="08012345678"/></Field>
          </div>
          <Field label="Location"><Input value={client.location} onChange={v=>setClient(c=>({...c,location:v}))} placeholder="City, State, Country"/></Field>
        </div>

        {/* Generate */}
        <Btn onClick={generate} disabled={!client.name.trim()||!modsOk} full>
          Generate License Key
        </Btn>

        {/* Generated Keys */}
        {keys.length>0&&(<>
          <Divider label={`${keys.length} key${keys.length>1?'s':''} generated`}/>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
            <Btn onClick={exportCSV} variant="secondary">Export CSV</Btn>
          </div>
          {keys.map((entry,idx)=>(
            <div key={entry.key+idx} style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'16px',marginBottom:10}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                <div style={{flex:1,fontFamily:'monospace',fontSize:15,fontWeight:700,color:T.ink,letterSpacing:1.5,wordBreak:'break-all'}}>{entry.key}</div>
                <button onClick={()=>copy(entry.key,idx)} style={{padding:'6px 12px',background:copied===idx?T.okBg:T.bg1,border:`1px solid ${copied===idx?T.okLine:T.line}`,cursor:'pointer',fontSize:12,color:copied===idx?T.ok:T.ink3,fontFamily:'inherit',minHeight:36,flexShrink:0}}>
                  {copied===idx?'Copied!':'Copy'}
                </button>
              </div>
              <div style={{background:T.warnBg,border:`1px solid ${T.warn}`,padding:'8px 10px',marginBottom:10,fontSize:11,color:T.ink,lineHeight:1.5}}>
                <strong>Activation requirement:</strong> the customer must enter their tier ({entry.tier}), exact modules ({entry.mods.join(' + ')}), exact capacity values, contact name, and farm name <em>identically</em> to what's shown below. The key is cryptographically bound to these values.
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:8,fontSize:11}}>
                {[
                  ['Tier', entry.tier.charAt(0).toUpperCase()+entry.tier.slice(1)],
                  ['Modules', entry.mods.map(m=>m.charAt(0).toUpperCase()+m.slice(1)).join(', ')],
                  ['Client', entry.client.name],
                  ['Farm', entry.client.farm||'—'],
                  ['Issued', entry.issued],
                  ['Expiry', entry.expiry],
                  ['Fee', ngn(entry.totalFee)],
                ].map(([k,v])=>(
                  <div key={k} style={{background:T.bg1,padding:'8px 10px'}}>
                    <div style={{color:T.ink4,marginBottom:2,textTransform:'uppercase',letterSpacing:.5,fontSize:9,fontWeight:700}}>{k}</div>
                    <div style={{color:T.ink,fontWeight:500,fontSize:11}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>)}

        {/* Validator */}
        <Divider label="Key Validator"/>
        <div style={{background:T.bg0,border:`1px solid ${T.line}`,padding:'20px'}}>
          <div style={{fontSize:14,fontWeight:700,color:T.ink,marginBottom:12}}>Validate a License Key</div>
          <div style={{display:'flex',gap:8,marginBottom:10}}>
            <div style={{flex:1}}>
              <Input value={validateInput} onChange={v=>setValidateInput(v.toUpperCase())} placeholder="PSA-XXXX-XXXX-XXXX-XXXX"/>
            </div>
            <Btn onClick={doValidate}>Validate</Btn>
          </div>
          {validateResult&&(
            <div style={{padding:'10px 14px',background:validateResult.ok?T.okBg:T.errBg,border:`1px solid ${validateResult.ok?T.okLine:T.errLine}`,fontSize:13,color:validateResult.ok?T.ok:T.err}}>
              {validateResult.msg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{marginTop:24,textAlign:'center',fontSize:11,color:T.ink4,lineHeight:1.8}}>
          <div style={{fontWeight:600,color:T.ink3}}>PoultrySuite Africa — License Administration</div>
          <div>AgoroX Technologies · Ibadan, Nigeria</div>
          <div>© 2026 All Rights Reserved · admin@agorox.africa</div>
        </div>
      </div>
    </div>
  );
}
