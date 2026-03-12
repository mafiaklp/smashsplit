import { useState, useEffect, useCallback, useRef } from "react";

// ─── Version ──────────────────────────────────────────────────────────────────
const APP_VERSION = "v4.1.0";
// Changelog:
// v4.1.0 (2026-03-12) — รหัสแอดมิน 6 หลัก, เช็คอินได้ก่อน 15 นาที, ListView sections + emoji status,
//                        ปุ่มแชร์สรุปรอบ 🏆, multi-admin promote/demote
// v4.0.x            — identity system (ชื่อ+PIN+เบอร์), กู้บัญชี, share/reminder text, QR โอนเงิน

// ─── Storage ──────────────────────────────────────────────────────────────────
const SESSIONS_KEY = "badminton-sessions-v3";
const ADMIN_PIN = "123456";
const SETTINGS_KEY = "badminton-settings";
const ADMINS_KEY = "badminton-admins";
async function loadAdmins() { try { const r = await window.storage.get(ADMINS_KEY,true); return r ? JSON.parse(r.value) : []; } catch { return []; } }
async function saveAdmins(data) { try { await window.storage.set(ADMINS_KEY, JSON.stringify(data), true); } catch {} }

function loadSettings() { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}"); } catch { return {}; } }
function saveSettings(s) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {} }
async function loadSessions() { try { const r = await window.storage.get(SESSIONS_KEY,true); return r ? JSON.parse(r.value) : []; } catch { return []; } }
async function saveSessions(data) { try { await window.storage.set(SESSIONS_KEY, JSON.stringify(data), true); } catch {} }
function loadIdentity() { try { return JSON.parse(localStorage.getItem("badminton-identity")||"null"); } catch { return null; } }
function saveIdentity(id) {
  try {
    localStorage.setItem("badminton-identity", JSON.stringify(id));
    window.storage.set("identity:"+id.name.toLowerCase().replace(/\s+/g,"_"), JSON.stringify(id), true);
    if (id.phone) window.storage.set("identity_phone:"+id.phone, JSON.stringify(id), true);
  } catch {}
}
function clearIdentity() { try { localStorage.removeItem("badminton-identity"); } catch {} }
async function findIdentityByPhone(phone) {
  try {
    const clean = phone.replace(/\D/g,"");
    // ลองหาจาก phone key ก่อน (สำหรับบัญชีใหม่)
    const r = await window.storage.get("identity_phone:"+clean, true);
    if (r) return JSON.parse(r.value);
    // fallback: scan จาก identity: key โดยเทียบเบอร์ (สำหรับบัญชีเก่า)
    const list = await window.storage.list("identity:", true);
    if (!list || !list.keys) return null;
    for (const key of list.keys) {
      try {
        const item = await window.storage.get(key, true);
        if (!item) continue;
        const id = JSON.parse(item.value);
        if (id.phone && id.phone.replace(/\D/g,"") === clean) return id;
      } catch {}
    }
    return null;
  } catch { return null; }
}
function genId() { return Math.random().toString(36).slice(2,9); }

// ─── Date helpers ─────────────────────────────────────────────────────────────
const DAYS_SHORT = ["อา","จ","อ","พ","พฤ","ศ","ส"];
const DAYS_FULL  = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];
const MONTHS     = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
function fmtTime(ts) { return new Date(ts).toLocaleTimeString("th",{hour:"2-digit",minute:"2-digit"}); }
function fmtDate(d) { const dt=new Date(d+"T00:00:00"); return `${DAYS_SHORT[dt.getDay()]} ${dt.getDate()} ${MONTHS[dt.getMonth()]}`; }
function autoSessionName(d) { const dt=new Date(d+"T00:00:00"); return `ก๊วนวัน${DAYS_FULL[dt.getDay()]}ที่ ${dt.getDate()} ${MONTHS[dt.getMonth()]}`; }
function addDays(dateStr, n) {
  const d = new Date(dateStr+"T00:00:00"); d.setDate(d.getDate()+n);
  return d.toISOString().slice(0,10);
}
function nextWeekDate(dateStr) { return addDays(dateStr, 7); }

// ─── Theme — warm coral/peach with deep navy ──────────────────────────────────
const C = {
  bg:       "#0f0e17",
  surface:  "#1a1826",
  up:       "#231f35",
  border:   "#2d2845",
  borderHi: "#433c6e",
  // Brand
  accent:   "#ff6b6b",   // coral red
  accentB:  "#ff8e53",   // orange gradient partner
  accentDim:"#2d1a1a",
  // Greens
  green:    "#06d6a0",
  greenDim: "#0a2e24",
  // Ambers
  amber:    "#ffd166",
  amberDim: "#2a2000",
  // Purple for paid
  purple:   "#c77dff",
  purpleDim:"#1e0a2e",
  // Neutrals
  red:      "#ef233c",
  redDim:   "#2a0a0e",
  muted:    "#4a4570",
  text:     "#e2dff5",
  dim:      "#6b6490",
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ic = {
  shuttle: ()=><svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="15.5" r="2.8" fill="currentColor" opacity=".9"/><line x1="10" y1="12.7" x2="6.5" y2="3" stroke="currentColor" strokeWidth="1.3"/><line x1="10" y1="12.7" x2="10" y2="2.2" stroke="currentColor" strokeWidth="1.3"/><line x1="10" y1="12.7" x2="13.5" y2="3" stroke="currentColor" strokeWidth="1.3"/><path d="M6.5 3 Q10 5.5 13.5 3" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg>,
  plus:    ()=><svg width="13" height="13" viewBox="0 0 14 14" fill="none"><line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  check:   ()=><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 7L5 10L11 3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  trash:   ()=><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 4h9M5 4V2.5h3V4M4.5 4l.5 7h3l.5-7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  edit:    ()=><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M9 2l2 2L4 11H2V9L9 2z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  back:    ()=><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  user:    ()=><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M1.5 12.5c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  lock:    ()=><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="2.5" y="5.5" width="8" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.4"/><path d="M4.5 5.5V4a2 2 0 014 0v1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  copy:    ()=><svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="4" y="4" width="8" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M2 10V2.5A1.5 1.5 0 013.5 1H10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  repeat:  ()=><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7a5 5 0 019-3M12 7a5 5 0 01-9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M10 2l1 2-2 1M4 12l-1-2 2-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  history: ()=><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4"/><path d="M7 4v3.5l2 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  bell:    ()=><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1.5a4 4 0 014 4V9l1 1.5H2L3 9V5.5a4 4 0 014-4z" stroke="currentColor" strokeWidth="1.4"/><path d="M5.5 11.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  checkin: ()=><svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.5"/><path d="M4.5 7.5L6.5 9.5L10.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  wait:    ()=><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.4"/><path d="M6.5 3.5v3l2 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
};

// ─── Reusable UI ──────────────────────────────────────────────────────────────
function Toast({ msg }) {
  if (!msg) return null;
  return <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:`linear-gradient(90deg,${C.accent},${C.accentB})`, color:"#fff", padding:"11px 24px", borderRadius:99, fontSize:13, fontWeight:700, zIndex:9999, boxShadow:"0 4px 24px rgba(255,107,107,.4)", whiteSpace:"nowrap", pointerEvents:"none" }}>{msg}</div>;
}

function Modal({ title, children, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,14,23,.88)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:500, backdropFilter:"blur(6px)" }} onClick={onClose}>
      <div style={{ background:C.surface, border:`1px solid ${C.borderHi}`, borderRadius:"22px 22px 0 0", width:"100%", maxWidth:480, padding:"20px 20px 36px", boxSizing:"border-box" }} onClick={e=>e.stopPropagation()}>
        <div style={{ width:40, height:4, borderRadius:99, background:C.border, margin:"0 auto 18px" }} />
        {title && <div style={{ fontSize:17, fontWeight:800, color:C.text, marginBottom:16 }}>{title}</div>}
        {children}
      </div>
    </div>
  );
}

function PinDots({ value, length=4 }) {
  return (
    <div style={{ display:"flex", gap:14, justifyContent:"center", margin:"16px 0" }}>
      {Array.from({length}).map((_,i) => (
        <div key={i} style={{ width:15, height:15, borderRadius:"50%", border:`2px solid ${C.borderHi}`, background:i<value.length?C.accent:"transparent", transition:"background .1s", boxShadow:i<value.length?`0 0 8px ${C.accent}88`:undefined }} />
      ))}
    </div>
  );
}

function NumPad({ onDigit, onBack, onSubmit, label }) {
  const rows = [["1","2","3"],["4","5","6"],["7","8","9"],["","0","⌫"]];
  return (
    <div>
      {label && <div style={{ textAlign:"center", fontSize:13, color:C.dim, marginBottom:4 }}>{label}</div>}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:9, maxWidth:252, margin:"0 auto" }}>
        {rows.flat().map((d,i) => (
          <button key={i} style={{ padding:"14px 0", borderRadius:13, border:`1px solid ${d===""?"transparent":C.border}`, background:d===""?"transparent":C.up, color:C.text, fontSize:20, fontWeight:700, cursor:d===""?"default":"pointer", fontFamily:"inherit", opacity:d===""?0:1, transition:"background .12s" }}
            onClick={() => { if(d==="⌫") onBack(); else if(d) onDigit(d); }}>
            {d}
          </button>
        ))}
      </div>
      <button style={{ width:"100%", padding:"14px", borderRadius:13, border:"none", background:`linear-gradient(90deg,${C.accent},${C.accentB})`, color:"#fff", fontSize:16, fontWeight:800, cursor:"pointer", marginTop:12, fontFamily:"inherit", boxShadow:`0 4px 16px ${C.accent}44` }} onClick={onSubmit}>ยืนยัน</button>
    </div>
  );
}

function IdentitySetup({ onDone, onClose, existingNames=[] }) {
  const [step, setStep] = useState("name");
  const [name, setName] = useState(""); const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState(""); const [confirmPin, setConfirmPin] = useState("");
  const [err, setErr] = useState("");

  const isDupName = existingNames.includes(name.trim().toLowerCase());

  function proceedName() {
    if (!name.trim()) { setErr("กรอกชื่อด้วย"); return; }
    if (isDupName && !nickname.trim()) { setErr("ชื่อนี้มีในกลุ่มแล้ว ใส่ฉายาเพื่อแยกออกจากกันด้วยนะ"); return; }
    if (!phone.trim() || phone.replace(/\D/g,"").length < 9) { setErr("กรอกเบอร์มือถือด้วยนะ (ใช้กู้บัญชีถ้าเปลี่ยนเครื่อง)"); return; }
    setErr(""); setStep("pin");
  }
  function submitPin() { if (pin.length<4) { setErr("PIN ต้อง 4 หลัก"); return; } setErr(""); setConfirmPin(""); setStep("confirmPin"); }
  function submitConfirm() {
    if (confirmPin!==pin) { setErr("PIN ไม่ตรงกัน"); setConfirmPin(""); return; }
    onDone({ id:genId(), name:name.trim(), nickname:nickname.trim(), phone:phone.replace(/\D/g,""), pin });
  }
  return (
    <Modal title={step==="name"?"👤 ลงทะเบียนชื่อ":step==="pin"?"🔐 ตั้ง PIN 4 หลัก":"🔐 ยืนยัน PIN"} onClose={onClose}>
      {step==="name" && <>
        <p style={{ fontSize:13, color:C.dim, margin:"0 0 14px" }}>ลงทะเบียนครั้งเดียว ใช้ได้ทุกเครื่อง</p>
        <input autoFocus style={inputStyle} placeholder="ชื่อเล่นหรือชื่อจริง *" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&proceedName()} />
        <input style={{...inputStyle,marginTop:8}} placeholder={isDupName?"ฉายา * (ชื่อนี้มีคนใช้แล้ว ใส่ฉายาเพื่อแยกออกจากกัน)":"ฉายา (ไม่บังคับ) เช่น สาขา รุ่น ทีม"} value={nickname} onChange={e=>setNickname(e.target.value)} onKeyDown={e=>e.key==="Enter"&&proceedName()}
          style={{...inputStyle,marginTop:8,borderColor:isDupName&&!nickname.trim()?C.amber:C.borderHi}} />
        {isDupName && !nickname.trim() && <p style={{ fontSize:11, color:C.amber, margin:"4px 0 0" }}>มีเพื่อนชื่อเดียวกันในกลุ่ม ใส่ฉายาเพื่อแยกออกจากกันด้วยนะ เช่น "เมย์ (สาขา)" หรือ "เมย์ (รุ่นพี่)"</p>}
        <input style={{...inputStyle,marginTop:8}} placeholder="เบอร์มือถือ * (ใช้กู้บัญชีถ้าเปลี่ยนเครื่อง)" type="tel" value={phone} onChange={e=>setPhone(e.target.value)} onKeyDown={e=>e.key==="Enter"&&proceedName()} />
        {err && <p style={{ color:C.red, fontSize:12, margin:"8px 0 0" }}>{err}</p>}
        <button style={{...btnPrimary,marginTop:12}} onClick={proceedName}>ถัดไป →</button>
      </>}
      {step==="pin" && <>
        <p style={{ fontSize:13, color:C.dim, margin:"0 0 4px" }}>PIN ใช้ยืนยันตัวตนก่อนถอนชื่อหรือเช็คอิน</p>
        <PinDots value={pin} />
        {err && <p style={{ color:C.red, fontSize:12, margin:"-8px 0 8px", textAlign:"center" }}>{err}</p>}
        <NumPad onDigit={d=>{if(pin.length<4)setPin(v=>v+d)}} onBack={()=>setPin(v=>v.slice(0,-1))} onSubmit={submitPin} />
      </>}
      {step==="confirmPin" && <>
        <PinDots value={confirmPin} />
        {err && <p style={{ color:C.red, fontSize:12, margin:"-8px 0 8px", textAlign:"center" }}>{err}</p>}
        <NumPad onDigit={d=>{if(confirmPin.length<4)setConfirmPin(v=>v+d)}} onBack={()=>setConfirmPin(v=>v.slice(0,-1))} onSubmit={submitConfirm} label={`ยืนยัน PIN ของ "${name}"`} />
      </>}
    </Modal>
  );
}

// กู้บัญชีเมื่อเปลี่ยนเครื่อง
function RecoverAccount({ onDone, onClose }) {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState("info"); // info | pin
  const [err, setErr] = useState("");
  const [found, setFound] = useState(null);

  async function search() {
    if (phone.replace(/\D/g,"").length < 9) { setErr("กรอกเบอร์มือถือด้วย"); return; }
    const id = await findIdentityByPhone(phone);
    if (!id) { setErr("ไม่พบข้อมูล ลองตรวจสอบเบอร์อีกครั้ง"); return; }
    setFound(id); setErr(""); setStep("pin");
  }
  function confirm() {
    if (pin !== found.pin) { setErr("PIN ไม่ถูก"); setPin(""); return; }
    onDone(found);
  }
  return (
    <Modal title="🔄 กู้บัญชีคืน" onClose={onClose}>
      {step==="info" && <>
        <p style={{ fontSize:13, color:C.dim, margin:"0 0 14px" }}>ใส่เบอร์มือถือที่ลงทะเบียนไว้</p>
        <input autoFocus style={inputStyle} placeholder="เบอร์มือถือ" type="tel" value={phone} onChange={e=>setPhone(e.target.value)} />
        {err && <p style={{ color:C.red, fontSize:12, margin:"8px 0 0" }}>{err}</p>}
        <button style={{...btnPrimary,marginTop:12}} onClick={search}>ค้นหาบัญชี →</button>
      </>}
      {step==="pin" && <>
        <p style={{ fontSize:13, color:C.dim, margin:"0 0 4px", textAlign:"center" }}>เจอแล้ว! ใส่ PIN เพื่อยืนยัน</p>
        <PinDots value={pin} />
        {err && <p style={{ color:C.red, fontSize:12, margin:"-8px 0 8px", textAlign:"center" }}>{err}</p>}
        <NumPad onDigit={d=>{if(pin.length<4)setPin(v=>v+d)}} onBack={()=>setPin(v=>v.slice(0,-1))} onSubmit={confirm} />
      </>}
    </Modal>
  );
}

function PinVerify({ title, hint, storedPin, onSuccess, onClose }) {
  const [val, setVal] = useState(""); const [err, setErr] = useState("");
  const maxLen = storedPin ? storedPin.length : 4;
  function submit() { if (val===storedPin) onSuccess(); else { setErr("PIN ไม่ถูก"); setVal(""); } }
  return (
    <Modal title={title||"🔐 ยืนยันตัวตน"} onClose={onClose}>
      {hint && <p style={{ fontSize:13, color:C.dim, margin:"0 0 4px", textAlign:"center" }}>{hint}</p>}
      <PinDots value={val} total={maxLen} />
      {err && <p style={{ color:C.red, fontSize:12, margin:"-8px 0 8px", textAlign:"center" }}>{err}</p>}
      <NumPad onDigit={d=>{if(val.length<maxLen)setVal(v=>v+d)}} onBack={()=>setVal(v=>v.slice(0,-1))} onSubmit={submit} />
    </Modal>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [sessions, setSessions] = useState([]);
  const [admins, setAdmins] = useState([]); // list of userId
  const [loading, setLoading] = useState(true);
  const [identity, setIdentity] = useState(null);
  const [view, setView] = useState("list"); // list | session | create | counter | history
  const [selectedId, setSelectedId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const isSuperAdmin = isAdmin && admins.length === 0 || (isAdmin && identity && admins[0] === identity?.id);
  const [toast, setToast] = useState(null);
  const [settings, setSettings] = useState(()=>loadSettings());
  const [showSetup, setShowSetup] = useState(false);
  const [showRecover, setShowRecover] = useState(false);
  const [showAdminPin, setShowAdminPin] = useState(false);
  const [showPinVerify, setShowPinVerify] = useState(null);

  useEffect(() => {
    const id = loadIdentity(); if (id) setIdentity(id);
    loadSessions().then(s=>{setSessions(s);setLoading(false);});
    loadAdmins().then(a=>setAdmins(a));
  }, []);

  const toast_ = useCallback((msg) => { setToast(msg); setTimeout(()=>setToast(null),2500); }, []);
  const sessionsRef = useRef(sessions);
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);
  const persist = useCallback((next) => { setSessions(next); saveSessions(next); }, []);
  const selected = sessions.find(s=>s.id===selectedId);

  function handleIdentityDone(id) { saveIdentity(id); setIdentity(id); setShowSetup(false); toast_(`ยินดีต้อนรับ ${id.name}! 🎉`); }
  function handleRecoverDone(id) { saveIdentity(id); setIdentity(id); setShowRecover(false); toast_(`ยินดีต้อนรับกลับมา ${id.name}! 🎉`); }
  function handleLogout() { clearIdentity(); setIdentity(null); setIsAdmin(false); toast_("ออกจากระบบแล้ว"); }

  function doSignup(sessionId) {
    const me = identity; if (!me) { setShowSetup(true); return; }
    const s = sessionsRef.current.find(x=>x.id===sessionId); if (!s) return;
    if (s.signups.some(p=>p.userId===me.id)||s.waitlist.some(p=>p.userId===me.id)) { toast_("คุณลงชื่อแล้ว"); return; }
    const displayName = me.nickname ? `${me.name} (${me.nickname})` : me.name;
    const entry = { id:genId(), userId:me.id, name:displayName, time:Date.now(), checkedIn:false };
    let updated;
    if (s.signups.length < s.maxPlayers) { updated = {...s, signups:[...s.signups,entry]}; toast_(`${me.name} ลงชื่อสำเร็จ ✓`); }
    else { updated = {...s, waitlist:[...s.waitlist,entry]}; toast_(`${me.name} อยู่ในรายสำรอง`); }
    persist(sessionsRef.current.map(x=>x.id===sessionId?updated:x));
  }

  function doGuestSignup(sessionId, guestName) {
    if (!identity) return;
    const s = sessionsRef.current.find(x=>x.id===sessionId); if (!s) return;
    const trimmed = guestName.trim(); if (!trimmed) return;
    const entry = { id:genId(), userId:`guest_${genId()}`, name:trimmed, isGuest:true, invitedBy:identity.id, invitedByName:identity.name, time:Date.now(), checkedIn:false };
    let updated;
    if (s.signups.length < s.maxPlayers) { updated = {...s,signups:[...s.signups,entry]}; toast_(`${trimmed} ลงชื่อแล้ว ✓`); }
    else { updated = {...s,waitlist:[...s.waitlist,entry]}; toast_(`${trimmed} อยู่ในรายสำรอง`); }
    persist(sessionsRef.current.map(x=>x.id===sessionId?updated:x));
  }

  function requestWithdraw(sessionId, entry, isWait) {
    const me = loadIdentity()||identity;
    const isOwn = me && (entry.userId===me.id||entry.invitedBy===me.id);
    if (isAdmin) { doWithdraw(sessionId, entry.id, isWait); return; }
    if (!isOwn) { toast_("เฉพาะเจ้าตัว คนพามา หรือแอดมินเท่านั้น"); return; }
    setShowPinVerify({ title:"🔐 ยืนยันก่อนถอนชื่อ", hint:`ใส่ PIN ของ "${me.name}"`, pin:me.pin, onSuccess:()=>{ setShowPinVerify(null); doWithdraw(sessionId,entry.id,isWait); } });
  }

  function doWithdraw(sessionId, entryId, isWait) {
    const s = sessionsRef.current.find(x=>x.id===sessionId);
    let updated;
    if (isWait) { updated = {...s,waitlist:s.waitlist.filter(p=>p.id!==entryId)}; toast_("ถอนชื่อสำรองแล้ว"); }
    else {
      const removed = s.signups.find(p=>p.id===entryId);
      const newSignups = s.signups.filter(p=>p.id!==entryId);
      let newWait = [...s.waitlist];
      if (newWait.length > 0) { const promoted={...newWait.shift(),time:Date.now()}; newSignups.push(promoted); toast_(`${removed?.name} ถอน · ${promoted.name} ได้รับสิทธิ์`); }
      else toast_("ถอนชื่อแล้ว");
      updated = {...s,signups:newSignups,waitlist:newWait};
    }
    persist(sessionsRef.current.map(x=>x.id===sessionId?updated:x));
  }

  function requestCheckin(sessionId, entry) {
    const me = loadIdentity()||identity;
    const isSelf = me && entry.userId===me.id;
    const isInviter = me && entry.invitedBy===me.id;
    if (!me||(!isSelf&&!isInviter)) { toast_("เฉพาะเจ้าตัวหรือคนที่พามาเท่านั้น"); return; }
    if (entry.checkedIn) { toast_("เช็คอินแล้ว"); return; }
    // ล็อคเวลา — เช็คอินได้ 15 นาทีก่อนเริ่ม (แอดมินไม่ล็อค)
    if (!isAdmin) {
      const s = sessionsRef.current.find(x=>x.id===sessionId);
      if (s) {
        const sessionTime = new Date(s.date+"T"+s.time).getTime();
        const earliest = sessionTime - 15*60*1000;
        if (Date.now() < earliest) {
          const openAt = new Date(earliest).toLocaleTimeString("th",{hour:"2-digit",minute:"2-digit"});
          toast_(`เช็คอินได้ตั้งแต่ ${openAt} น. นะ ⏰`);
          return;
        }
      }
    }
    const label = isInviter&&!isSelf ? `"${entry.name}" (เพื่อนของคุณ)` : `"${me.name}"`;
    setShowPinVerify({ title:"✅ เช็คอิน", hint:`ยืนยันว่า ${label} มาถึงแล้ว`, pin:me.pin, onSuccess:()=>{ setShowPinVerify(null); doCheckin(sessionId,entry.id); } });
  }

  function doCheckin(sessionId, entryId) {
    const s = sessionsRef.current.find(x=>x.id===sessionId);
    const updated = {...s,signups:s.signups.map(p=>p.id===entryId?{...p,checkedIn:true,checkinTime:Date.now()}:p)};
    persist(sessionsRef.current.map(x=>x.id===sessionId?updated:x));
    toast_("เช็คอินเรียบร้อย 🎉");
  }

  function doPromote(sessionId, entryId) {
    if (!isAdmin) return;
    const s = sessionsRef.current.find(x=>x.id===sessionId);
    const person = s.waitlist.find(p=>p.id===entryId); if (!person) return;
    const updated = {...s,signups:[...s.signups,{...person,time:Date.now()}],waitlist:s.waitlist.filter(p=>p.id!==entryId)};
    persist(sessionsRef.current.map(x=>x.id===sessionId?updated:x));
    toast_(`${person.name} เลื่อนเป็นตัวจริง ✓`);
  }

  function createSession(data) {
    const s = {id:genId(),...data,maxPlayers:Number(data.maxPlayers)||12,signups:[],waitlist:[],shuttlesUsed:0,confirmedPresent:null,createdAt:Date.now()};
    persist([s,...sessionsRef.current]);
    toast_("สร้างรอบเล่นแล้ว ✓"); setView("list");
  }

  // Repeat session — create new from template, 1 week later
  function repeatSession(src) {
    const newDate = nextWeekDate(src.date);
    const s = {
      id:genId(), name:autoSessionName(newDate), venue:src.venue,
      date:newDate, time:src.time, courts:src.courts,
      courtFeeTotal:src.courtFeeTotal, shuttleFee:src.shuttleFee,
      maxPlayers:Number(src.maxPlayers)||12, note:src.note||"",
      signups:[], waitlist:[], shuttlesUsed:0, confirmedPresent:null, createdAt:Date.now()
    };
    persist([s,...sessionsRef.current]);
    toast_("สร้างรอบใหม่สัปดาห์หน้าแล้ว ✓");
    setSelectedId(s.id); setView("session");
  }

  function updateSession(id, patch) {
    if (patch._togglePaid) {
      const eid = patch._togglePaid;
      persist(sessionsRef.current.map(s=>s.id===id?{...s,signups:s.signups.map(p=>p.id===eid?{...p,paid:!p.paid}:p)}:s));
      return;
    }
    persist(sessionsRef.current.map(s=>s.id===id?{...s,...patch}:s));
  }
  function deleteSession(id) { persist(sessions.filter(s=>s.id!==id)); setView("list"); toast_("ลบแล้ว"); }

  function promoteAdmin(userId, name) {
    if (!isAdmin) return;
    const next = admins.includes(userId) ? admins : [...admins, userId];
    setAdmins(next); saveAdmins(next);
    toast_(`${name} เป็นแอดมินแล้ว ✓`);
  }
  function demoteAdmin(userId, name) {
    if (!isSuperAdmin) return;
    const next = admins.filter(id=>id!==userId);
    setAdmins(next); saveAdmins(next);
    toast_(`ถอด ${name} ออกจากแอดมินแล้ว`);
  }
  // Auto-set isAdmin if identity is in admins list
  useEffect(() => {
    if (identity && admins.includes(identity.id)) setIsAdmin(true);
  }, [identity, admins]);

  if (loading) return <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", color:C.muted, fontFamily:"sans-serif" }}>กำลังโหลด...</div>;

  const viewTitle = view==="create"?"สร้างรอบเล่น" : view==="counter"?"🧮 นับชื่อจากไลน์" : view==="history"?"📊 ประวัติการเล่น" : view==="session"&&selected?selected.name : "";

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'Noto Sans Thai','Sarabun',sans-serif", maxWidth:480, margin:"0 auto", paddingBottom:60 }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>

      <Header identity={identity} isAdmin={isAdmin}
        onLogin={()=>setShowSetup(true)} onLogout={handleLogout}
        onAdminToggle={()=>isAdmin?setIsAdmin(false):setShowAdminPin(true)}
        showBack={view!=="list"} onBack={()=>{setView("list");setSelectedId(null);}}
        viewTitle={viewTitle}
      />

      {view==="list" && <ListView sessions={sessions} identity={identity} isAdmin={isAdmin}
        onOpen={id=>{setSelectedId(id);setView("session");}}
        onCreate={()=>setView("create")}
        onCounter={()=>setView("counter")}
        onHistory={()=>setView("history")}
        onLogin={()=>setShowSetup(true)}
        onRecover={()=>setShowRecover(true)}
      />}
      {view==="counter" && <QuickCount />}
      {view==="history" && <HistoryView sessions={sessions} identity={identity} />}
      {view==="create" && isAdmin && <CreateView onSave={createSession} onCancel={()=>setView("list")} />}
      {view==="session" && selected && (
        <SessionView session={selected} identity={identity} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin}
          admins={admins}
          settings={settings}
          onSaveSettings={s=>{const next={...settings,...s};setSettings(next);saveSettings(next);}}
          onSignup={()=>doSignup(selected.id)}
          onGuestSignup={n=>doGuestSignup(selected.id,n)}
          onWithdraw={(e,w)=>requestWithdraw(selected.id,e,w)}
          onCheckin={e=>requestCheckin(selected.id,e)}
          onPromote={eid=>doPromote(selected.id,eid)}
          onUpdate={patch=>updateSession(selected.id,patch)}
          onDelete={()=>deleteSession(selected.id)}
          onRepeat={()=>repeatSession(selected)}
          onPromoteAdmin={promoteAdmin}
          onDemoteAdmin={demoteAdmin}
        />
      )}

      {showSetup && <IdentitySetup
        onDone={handleIdentityDone}
        onClose={()=>setShowSetup(false)}
        existingNames={sessions.flatMap(s=>[...s.signups,...s.waitlist]).map(p=>p.name.split(" (")[0].toLowerCase())}
      />}
      {showRecover && <RecoverAccount onDone={handleRecoverDone} onClose={()=>setShowRecover(false)} />}
      {showAdminPin && <PinVerify title="⚙️ แอดมิน" hint="ใส่ PIN แอดมิน" storedPin={ADMIN_PIN}
        onSuccess={()=>{setIsAdmin(true);setShowAdminPin(false);toast_("เข้าสู่โหมดแอดมิน ✓");}}
        onClose={()=>setShowAdminPin(false)} />}
      {showPinVerify && <PinVerify title={showPinVerify.title} hint={showPinVerify.hint} storedPin={showPinVerify.pin}
        onSuccess={showPinVerify.onSuccess} onClose={()=>setShowPinVerify(null)} />}
      <Toast msg={toast} />
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
function Header({ identity, isAdmin, onLogin, onLogout, onAdminToggle, showBack, onBack, viewTitle }) {
  return (
    <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"13px 16px", display:"flex", alignItems:"center", gap:10 }}>
      {showBack
        ? <button style={{ width:36, height:36, borderRadius:10, border:`1px solid ${C.border}`, background:"transparent", color:C.muted, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }} onClick={onBack}><Ic.back /></button>
        : <div style={{ width:38, height:38, borderRadius:12, background:`linear-gradient(135deg,${C.accent},${C.accentB})`, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", flexShrink:0, boxShadow:`0 4px 12px ${C.accent}44` }}><Ic.shuttle /></div>
      }
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:showBack?15:17, fontWeight:800, color:showBack?C.text:"#fff", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          {showBack ? viewTitle : "SmashSplit 🏸"}
        </div>
        {!showBack && <div style={{ fontSize:11, color:C.muted }}>จัดรอบ · ลงชื่อ · หารค่า <span style={{ opacity:.4 }}>· {APP_VERSION}</span></div>}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
        {isAdmin && <span style={{ background:C.amberDim, color:C.amber, fontSize:11, fontWeight:700, padding:"3px 8px", borderRadius:99 }}>ADMIN</span>}
        <button style={{ background:isAdmin?C.amberDim:C.up, border:`1px solid ${isAdmin?C.amber+"44":C.border}`, borderRadius:9, color:isAdmin?C.amber:C.muted, padding:"6px 10px", fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:4, fontFamily:"inherit" }}
          onClick={onAdminToggle}><Ic.lock />{isAdmin?"ON":"⚙️"}</button>
        {identity
          ? <button style={{ background:C.up, border:`1px solid ${C.border}`, borderRadius:9, color:C.text, padding:"6px 10px", fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:4, maxWidth:110, overflow:"hidden", fontFamily:"inherit" }}
              onClick={onLogout}><Ic.user /><span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{identity.nickname?`${identity.name} (${identity.nickname})`:identity.name}</span></button>
          : <button style={{ background:`linear-gradient(90deg,${C.accent},${C.accentB})`, border:"none", borderRadius:9, color:"#fff", padding:"7px 12px", fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}
              onClick={onLogin}>ลงทะเบียน</button>
        }
      </div>
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────
function ListView({ sessions, identity, isAdmin, onOpen, onCreate, onCounter, onHistory, onLogin, onRecover }) {
  const now = Date.now();
  const oneWeek = now + 7*24*60*60*1000;
  const sorted = [...sessions].sort((a,b)=>new Date(a.date+"T"+a.time)-new Date(b.date+"T"+b.time));
  const past = sorted.filter(s=>new Date(s.date+"T"+s.time).getTime()<=now-3*60*60*1000);
  const upcoming = sorted.filter(s=>new Date(s.date+"T"+s.time).getTime()>now-3*60*60*1000);
  const thisWeek = upcoming.filter(s=>new Date(s.date+"T"+s.time).getTime()<=oneWeek);
  const later = upcoming.filter(s=>new Date(s.date+"T"+s.time).getTime()>oneWeek);

  // Hot = 80%+ full, Urgent = <48hr away + still has spots
  function getStatus(s) {
    const filled=s.signups.length, max=Number(s.maxPlayers)||12;
    const full=filled>=max;
    const pct=filled/max;
    const hoursLeft=(new Date(s.date+"T"+s.time).getTime()-now)/(1000*60*60);
    const hasWait=s.waitlist.length>0;
    if (full && hasWait) return "👑"; // เต็ม + คิวรอ
    if (full) return "🔴"; // เต็ม
    if (pct>=0.8) return "🔥"; // ใกล้เต็ม
    if (hoursLeft>=0 && hoursLeft<=48 && !full) return "⚡"; // ด่วน ยังว่าง
    return "🟢"; // ปกติ
  }

  return (
    <div>
      {!identity && (
        <div style={{ margin:"14px 14px 0", background:`linear-gradient(135deg,${C.accent}22,${C.accentB}11)`, border:`1px solid ${C.accent}44`, borderRadius:14, padding:"14px 16px", display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ fontSize:30 }}>🏸</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:800, color:C.accent }}>ยังไม่ได้ลงทะเบียน</div>
            <div style={{ fontSize:12, color:C.dim, marginTop:2 }}>ลงทะเบียนครั้งเดียว กดลงชื่อได้เลยทุกรอบ</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6, flexShrink:0 }}>
            <button style={{ background:`linear-gradient(90deg,${C.accent},${C.accentB})`, border:"none", borderRadius:10, color:"#fff", padding:"9px 14px", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }} onClick={onLogin}>ลงทะเบียน</button>
            <button style={{ background:"transparent", border:`1px solid ${C.borderHi}`, borderRadius:10, color:C.dim, padding:"6px 14px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }} onClick={onRecover}>เข้าสู่ระบบ</button>
          </div>
        </div>
      )}
      <div style={{ padding:"14px 14px 0", display:"flex", flexDirection:"column", gap:8 }}>
        {isAdmin && <button style={{ width:"100%", padding:"13px", borderRadius:12, border:"none", background:`linear-gradient(90deg,${C.accent},${C.accentB})`, color:"#fff", fontSize:15, fontWeight:800, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7, fontFamily:"inherit", boxShadow:`0 4px 16px ${C.accent}33` }} onClick={onCreate}><Ic.plus /> สร้างรอบเล่นใหม่</button>}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          <button style={{ padding:"11px", borderRadius:12, border:`1px solid ${C.borderHi}`, background:C.up, color:C.text, fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6, fontFamily:"inherit" }} onClick={onCounter}>🧮 นับชื่อจากไลน์</button>
          <button style={{ padding:"11px", borderRadius:12, border:`1px solid ${C.borderHi}`, background:C.up, color:C.text, fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6, fontFamily:"inherit" }} onClick={onHistory}><Ic.history /> ประวัติ</button>
        </div>
      </div>
      {sessions.length===0 && <div style={{ textAlign:"center", padding:"60px 20px", color:C.muted, fontSize:14 }}><div style={{ fontSize:48, marginBottom:12 }}>🏸</div>{isAdmin?"กดสร้างรอบแรกได้เลย!":"ยังไม่มีรอบเล่น"}</div>}
      {thisWeek.length>0 && <><SectionLabel>📅 สัปดาห์นี้</SectionLabel>{thisWeek.map(s=><SessionCard key={s.id} s={s} identity={identity} status={getStatus(s)} onClick={()=>onOpen(s.id)} />)}</>}
      {later.length>0 && <><SectionLabel>🗓 รอบถัดไป</SectionLabel>{later.map(s=><SessionCard key={s.id} s={s} identity={identity} status={getStatus(s)} onClick={()=>onOpen(s.id)} />)}</>}
      {past.length>0 && <><SectionLabel style={{ marginTop:16 }}>✅ รอบที่ผ่านมา</SectionLabel>{past.map(s=><SessionCard key={s.id} s={s} identity={identity} dim status="✅" onClick={()=>onOpen(s.id)} />)}</>}
    </div>
  );
}

function SectionLabel({ children, style }) {
  return <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".1em", padding:"16px 16px 6px", ...style }}>{children}</div>;
}

function SessionCard({ s, identity, onClick, dim, status="🟢" }) {
  const filled=s.signups.length, max=Number(s.maxPlayers)||12, full=filled>=max;
  const myEntry=identity&&s.signups.find(p=>p.userId===identity.id);
  const myWait=identity&&s.waitlist.find(p=>p.userId===identity.id);
  const pct = Math.min((filled/max)*100,100);
  const isUrgent = status==="⚡";
  const isHot = status==="🔥" || status==="👑";
  const borderCol = isUrgent?C.accent+"88":isHot?C.amber+"66":full?C.borderHi:C.border;
  return (
    <div style={{ background:isUrgent?`linear-gradient(135deg,${C.accentDim},${C.surface})`:C.surface, border:`1px solid ${borderCol}`, borderRadius:16, margin:"10px 14px 0", overflow:"hidden", cursor:"pointer", opacity:dim?0.5:1, boxShadow:isUrgent?`0 0 16px ${C.accent}22`:isHot?`0 0 12px ${C.amber}15`:"none" }} onClick={onClick}>
      <div style={{ padding:"14px 16px 10px" }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}>
          <div style={{ fontSize:17, fontWeight:800, color:"#fff", lineHeight:1.3 }}>{status} {s.name}</div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}>
            {myEntry && <span style={{ background:myEntry.checkedIn?C.greenDim:C.accentDim, color:myEntry.checkedIn?C.green:C.accent, fontSize:11, fontWeight:700, padding:"3px 8px", borderRadius:99 }}>{myEntry.checkedIn?"✓ เช็คอิน":"✓ ลงชื่อ"}</span>}
            {myWait && <span style={{ background:C.amberDim, color:C.amber, fontSize:11, fontWeight:700, padding:"3px 8px", borderRadius:99 }}>⏳ สำรอง</span>}
          </div>
        </div>
        <div style={{ display:"flex", gap:14, fontSize:12, color:C.dim, marginTop:6, flexWrap:"wrap" }}>
          <span>📍 {s.venue}</span><span>🗓 {fmtDate(s.date)} {s.time}</span>
        </div>
      </div>
      <div style={{ padding:"0 16px 12px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.muted, marginBottom:5 }}>
          <span>{filled}/{max} คน{s.waitlist.length>0?` · สำรอง ${s.waitlist.length}`:""}</span>
          <span style={{ color:full?C.amber:C.green, fontWeight:700 }}>{full?"เต็ม":`ว่าง ${max-filled}`}</span>
        </div>
        <div style={{ height:5, borderRadius:99, background:C.border, overflow:"hidden" }}>
          <div style={{ height:"100%", borderRadius:99, width:`${pct}%`, background:full?`linear-gradient(90deg,${C.amber},#ff9f43)`:`linear-gradient(90deg,${C.green},#26d9b5)`, transition:"width .3s" }} />
        </div>
      </div>
    </div>
  );
}

// ─── History View ─────────────────────────────────────────────────────────────
function HistoryView({ sessions, identity }) {
  const past = [...sessions].sort((a,b)=>new Date(b.date)-new Date(a.date));

  // Per-person stats across all sessions
  const playerMap = {};
  for (const s of sessions) {
    for (const p of s.signups) {
      if (!p.userId || p.isGuest) continue;
      if (!playerMap[p.userId]) playerMap[p.userId] = { name:p.name, sessions:[], paid:0, unpaid:0 };
      const entry = playerMap[p.userId];
      entry.sessions.push({ sessionName:s.name, date:s.date, checkedIn:p.checkedIn, paid:p.paid, finalPerPerson:s.finalPerPerson });
      if (s.finalPerPerson > 0) { p.paid ? entry.paid++ : entry.unpaid++; }
    }
  }

  const myId = identity?.id;
  const myStats = myId && playerMap[myId];

  // Top players by attendance
  const topPlayers = Object.entries(playerMap)
    .map(([uid,d])=>({ uid, name:d.name, count:d.sessions.length, paid:d.paid, unpaid:d.unpaid }))
    .sort((a,b)=>b.count-a.count)
    .slice(0,8);

  return (
    <div style={{ paddingBottom:40 }}>
      {/* My stats */}
      {myStats && (
        <div style={{ margin:"14px 14px 0", background:`linear-gradient(135deg,${C.accent}22,${C.accentB}11)`, border:`1px solid ${C.accent}33`, borderRadius:16, padding:"16px" }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.accent, textTransform:"uppercase", letterSpacing:".08em", marginBottom:10 }}>📊 สถิติของคุณ</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            <StatBox label="เข้าร่วม" val={myStats.sessions.length} unit="ครั้ง" col={C.accent} />
            <StatBox label="โอนแล้ว" val={myStats.paid} unit="ครั้ง" col={C.green} />
            <StatBox label="ยังค้าง" val={myStats.unpaid} unit="ครั้ง" col={myStats.unpaid>0?C.red:C.muted} />
          </div>
          {myStats.unpaid > 0 && <div style={{ marginTop:10, fontSize:12, color:C.red, background:C.redDim, borderRadius:8, padding:"8px 12px" }}>⚠️ มีรอบที่ยังค้างจ่ายอยู่ {myStats.unpaid} รอบ โอนให้ครบด้วยนะ! 🙏</div>}
        </div>
      )}
      {!identity && <div style={{ margin:"14px 14px 0", background:C.up, border:`1px solid ${C.border}`, borderRadius:14, padding:"14px 16px", fontSize:13, color:C.dim }}>🔒 ล็อกอินเพื่อดูสถิติของตัวเอง</div>}

      {/* Leaderboard */}
      {topPlayers.length > 0 && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, margin:"10px 14px 0", overflow:"hidden" }}>
          <div style={{ padding:"12px 16px 10px", borderBottom:`1px solid ${C.border}`, fontSize:13, fontWeight:700, color:C.amber }}>🏆 มาบ่อยที่สุด</div>
          {topPlayers.map((p,i)=>(
            <div key={p.uid} style={{ padding:"10px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10, background:p.uid===myId?`${C.accent}11`:"transparent" }}>
              <div style={{ width:26, height:26, borderRadius:"50%", background:i===0?"linear-gradient(135deg,#ffd700,#ff8c00)":i===1?"linear-gradient(135deg,#c0c0c0,#909090)":i===2?"linear-gradient(135deg,#cd7f32,#a0522d)":C.up, color:i<3?"#fff":C.muted, fontSize:i<3?13:12, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{i<3?["🥇","🥈","🥉"][i]:i+1}</div>
              <div style={{ flex:1 }}><div style={{ fontSize:14, fontWeight:700 }}>{p.name}{p.uid===myId&&<span style={{ fontSize:11, color:C.accent, marginLeft:5 }}>(คุณ)</span>}</div></div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:14, fontWeight:800, color:C.accent }}>{p.count} ครั้ง</div>
                {p.unpaid>0 && <div style={{ fontSize:11, color:C.red }}>ค้าง {p.unpaid}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Session list with who played */}
      {past.length > 0 && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, margin:"10px 14px 0", overflow:"hidden" }}>
          <div style={{ padding:"12px 16px 10px", borderBottom:`1px solid ${C.border}`, fontSize:13, fontWeight:700, color:C.dim }}>📋 รอบที่ผ่านมา</div>
          {past.map(s=>{
            const myEntry = identity && s.signups.find(p=>p.userId===identity.id);
            return (
              <div key={s.id} style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, background:myEntry?`${C.accent}08`:"transparent" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:myEntry?C.accent:C.text }}>{s.name}</div>
                    <div style={{ fontSize:12, color:C.dim, marginTop:2 }}>{fmtDate(s.date)} · {s.signups.length} คน</div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    {s.finalPerPerson>0 && <div style={{ fontSize:13, fontWeight:800, color:C.green }}>{s.finalPerPerson.toLocaleString()}฿/คน</div>}
                    {myEntry && <div style={{ fontSize:11, marginTop:2, color:myEntry.paid?C.green:s.finalPerPerson>0?C.red:C.muted }}>{myEntry.paid?"💚 โอนแล้ว":s.finalPerPerson>0?"🔴 ยังค้าง":"✓ ร่วมเล่น"}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {past.length===0 && <div style={{ textAlign:"center", padding:"50px 20px", color:C.muted, fontSize:14 }}><div style={{ fontSize:44, marginBottom:10 }}>📊</div>ยังไม่มีรอบที่ผ่านมา</div>}
    </div>
  );
}

function StatBox({ label, val, unit, col }) {
  return (
    <div style={{ background:C.surface, borderRadius:12, padding:"12px", textAlign:"center" }}>
      <div style={{ fontSize:26, fontWeight:900, color:col, lineHeight:1 }}>{val}</div>
      <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>{unit}</div>
      <div style={{ fontSize:11, color:C.dim, marginTop:1 }}>{label}</div>
    </div>
  );
}

// ─── Session Detail ───────────────────────────────────────────────────────────
function SessionView({ session:s, identity, isAdmin, isSuperAdmin, admins=[], settings={}, onSaveSettings, onSignup, onGuestSignup, onWithdraw, onCheckin, onPromote, onUpdate, onDelete, onRepeat, onPromoteAdmin, onDemoteAdmin }) {
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({ name:s.name, venue:s.venue, maxPlayers:s.maxPlayers, courts:s.courts||"", courtFeeTotal:s.courtFeeTotal||"", shuttleFee:s.shuttleFee||"" });
  const [confirmWithdraw, setConfirmWithdraw] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  const filled=s.signups.length, max=Number(s.maxPlayers)||12, full=filled>=max;
  const mySignup=identity&&s.signups.find(p=>p.userId===identity.id);
  const myWait=identity&&s.waitlist.find(p=>p.userId===identity.id);
  const checkinCount=s.signups.filter(p=>p.checkedIn).length;
  const shuttlesUsed=s.shuttlesUsed||0;
  const presentCount=s.confirmedPresent??(checkinCount||filled);
  const totalCourt=Number(s.courtFeeTotal)||0;
  const totalShuttle=shuttlesUsed*(Number(s.shuttleFee)||0);
  const perPerson=presentCount>0?Math.ceil((totalCourt+totalShuttle)/presentCount):0;

  function saveEdit() { onUpdate({...editData}); setEditMode(false); }

  function buildReminderText() {
    const signedNames = s.signups.map((p,i)=>`${i+1}. ${p.name}`).join("\n");
    const spotsLeft = max - filled;
    return `🏸 แจ้งเตือนตี้ — ${s.name}

📅 ${fmtDate(s.date)} เวลา ${s.time} น.
📍 สนาม: ${s.venue}${s.courts?`\n🏟 ${s.courts} สนาม`:""}

👥 ลงชื่อแล้ว ${filled}/${max} คน${spotsLeft>0?` · ว่างอีก ${spotsLeft} ที่`:" · เต็มแล้ว!"}

✅ รายชื่อที่ลงไว้
${signedNames||"ยังไม่มีคนลงชื่อ"}
${s.waitlist.length>0?`\n⏳ สำรอง\n${s.waitlist.map((p,i)=>`${i+1}. ${p.name}`).join("\n")}`:""}

${spotsLeft>0?`ยังว่างอีก ${spotsLeft} ที่นะ ใครอยากมาเพิ่มลงชื่อได้เลย 🏸`:"สนามเต็มแล้ว ใครติดกระทันหันอย่าลืมเอาชื่อออกให้เพื่อนๆที่รออยู่ได้มาเล่นแทนด้วยนะ 🙏"}

แล้วเจอกัน! 💚
📲 ลงชื่อ/ถอนชื่อได้ที่: https://shorturl.at/u3NAN`;
  }

  function buildShareText() {
    const names=s.signups.map((p,i)=>`${i+1}. ${p.name}${p.checkedIn?" ✓":""}`).join("\n");
    const waitNames=s.waitlist.length>0?`\n\n⏳ รายสำรอง\n`+s.waitlist.map((p,i)=>`${i+1}. ${p.name}`).join("\n"):"";
    const costLine=s.finalPerPerson>0?`\n💸 คนละ: ${s.finalPerPerson.toLocaleString()} ฿`:"";
    return `🏸 SmashSplit — ${s.name}
📍 ${s.venue}
🗓 ${fmtDate(s.date)} เวลา ${s.time} น.${s.courts?`\n🏟 ${s.courts} สนาม`:""}
👥 ${filled}/${max} คน${costLine}

✅ รายชื่อตัวจริง
${names||"ยังไม่มีคนลงชื่อ"}${waitNames}

สวัสดีทุกคนน 🏸

มาตรงเวลาด้วยนะ รอกันอยู่เลย 🥰
ใครติดกระทันหันอย่าลืมเอาชื่อออกให้เพื่อนๆที่รออยู่ได้มาเล่นแทนด้วยนะ 🙏
ค่าสนาม ค่าลูก หารเท่ากันนะทุกคน 😊

แล้วเจอกัน! 💚
📲 ลงชื่อ/ถอนชื่อได้ที่: https://shorturl.at/u3NAN`;
  }

  function buildSummaryText() {
    const checkedIn = [...s.signups].filter(p=>p.checkedIn).sort((a,b)=>a.checkinTime-b.checkinTime);
    const top3 = checkedIn.slice(0,3);
    const medals = ["🥇","🥈","🥉"];
    const earlyBirds = top3.map((p,i)=>`${medals[i]} ${p.name}`).join("\n");
    const allNames = s.signups.map((p,i)=>`${i+1}. ${p.name}${p.checkedIn?" ✓":""}`).join("\n");
    return `🏸 สรุปรอบ — ${s.name}
📅 ${fmtDate(s.date)} · ${s.time} น.
📍 ${s.venue}

💸 คนละ ${s.finalPerPerson.toLocaleString()} ฿
👥 มาเล่น ${s.confirmedPresent||checkedIn.length} คน

${top3.length>0?`⚡ มาไวสุด
${earlyBirds}

`:""}✅ รายชื่อ
${allNames||"-"}

ขอบคุณทุกคนที่มาร่วมตี้กันนะ 🙏💚
สนุกมากเลยวันนี้! แล้วเจอกันรอบหน้านะ 🏸
📲 ลงชื่อรอบถัดไปได้ที่: https://shorturl.at/u3NAN`;
  }

  const taShareRef = useRef(null);
  const taReminderRef = useRef(null);
  const taSummaryRef = useRef(null);

  function copyAndClose(ref, setter) {
    if (ref.current) { ref.current.select(); document.execCommand("copy"); }
    setter(false); alert("คัดลอกแล้ว! วางในไลน์ได้เลย 🎉");
  }

  return (
    <div>
      {/* Info card */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, margin:"14px 14px 0", padding:"16px" }}>
        <div style={{ fontSize:22, fontWeight:900, color:"#fff", marginBottom:6 }}>{s.name}</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:10, fontSize:13, color:C.dim }}>
          <span>📍 {s.venue}</span><span>🗓 {fmtDate(s.date)} เวลา {s.time}</span>
        </div>
        {s.note && <div style={{ marginTop:10, fontSize:13, color:C.dim, background:C.bg, borderRadius:8, padding:"9px 12px" }}>{s.note}</div>}
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:10 }}>
          {s.courts && <Chip col="blue">🏟 {s.courts} สนาม</Chip>}
          <Chip col={full?"amber":"green"}>{filled}/{max} คน</Chip>
          {s.waitlist.length>0 && <Chip col="amber">สำรอง {s.waitlist.length}</Chip>}
        </div>
        {isAdmin && (
          <div style={{ display:"flex", gap:6, marginTop:12, flexWrap:"wrap" }}>
            <button style={btnOutline} onClick={()=>setEditMode(!editMode)}><Ic.edit />{editMode?"ยกเลิก":"แก้ไข"}</button>
            <button style={{...btnOutline,color:C.green,borderColor:C.green+"44"}} onClick={onRepeat}><Ic.repeat />รอบหน้า</button>
            {!confirmDelete
              ? <button style={{...btnOutline,color:C.red,borderColor:C.redDim}} onClick={()=>setConfirmDelete(true)}><Ic.trash />ลบรอบ</button>
              : <><button style={{ padding:"8px 12px", borderRadius:9, border:"none", background:C.red, color:"#fff", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }} onClick={onDelete}>ยืนยันลบ</button>
                  <button style={{...btnOutline}} onClick={()=>setConfirmDelete(false)}>ยกเลิก</button></>
            }
          </div>
        )}
        {editMode && isAdmin && (
          <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${C.border}` }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
              <div><div style={labelSt}>ชื่อตี้</div><input style={inlineSt} placeholder="TBA" value={editData.name} onChange={e=>setEditData(d=>({...d,name:e.target.value}))} /></div>
              <div><div style={labelSt}>สนาม</div><input style={inlineSt} placeholder="TBA" value={editData.venue} onChange={e=>setEditData(d=>({...d,venue:e.target.value}))} /></div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10, marginBottom:10 }}>
              <div><div style={labelSt}>คนสูงสุด</div><input style={{...inlineSt,color:C.accent,fontWeight:800}} type="number" min={1} value={editData.maxPlayers} onChange={e=>setEditData(d=>({...d,maxPlayers:Math.max(1,+e.target.value||1)}))} /></div>
              <div><div style={labelSt}>สนาม</div><input style={inlineSt} type="number" placeholder="2" value={editData.courts} onChange={e=>setEditData(d=>({...d,courts:e.target.value}))} /></div>
              <div><div style={labelSt}>ค่าสนาม</div><input style={inlineSt} type="number" placeholder="0" value={editData.courtFeeTotal} onChange={e=>setEditData(d=>({...d,courtFeeTotal:e.target.value}))} /></div>
              <div><div style={labelSt}>ค่าลูก/ลูก</div><input style={inlineSt} type="number" placeholder="0" value={editData.shuttleFee} onChange={e=>setEditData(d=>({...d,shuttleFee:e.target.value}))} /></div>
            </div>
            <button style={btnPrimary} onClick={saveEdit}>บันทึกการแก้ไข</button>
          </div>
        )}
      </div>

      {/* Admin management — super admin only */}
      {isSuperAdmin && s.signups.length > 0 && (
        <div style={{ background:C.surface, border:`1px solid ${C.amberDim}`, borderRadius:16, margin:"10px 14px 0", overflow:"hidden" }}>
          <div style={{ padding:"12px 16px 10px", borderBottom:`1px solid ${C.border}`, fontSize:13, fontWeight:700, color:C.amber }}>👑 จัดการแอดมิน</div>
          {s.signups.filter(p=>!p.isGuest).map(p=>{
            const isAdm = admins.includes(p.userId);
            return (
              <div key={p.id} style={{ padding:"10px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ flex:1, fontSize:14 }}>{p.name}{isAdm&&<span style={{ fontSize:11, color:C.amber, marginLeft:6 }}>⚙️ admin</span>}</div>
                {!isAdm
                  ? <button style={{...tinyBtn,color:C.green,borderColor:C.green+"44"}} onClick={()=>onPromoteAdmin(p.userId,p.name)}>ตั้งเป็น admin</button>
                  : <button style={{...tinyBtn,color:C.red,borderColor:C.red+"44"}} onClick={()=>onDemoteAdmin(p.userId,p.name)}>ถอด admin</button>
                }
              </div>
            );
          })}
        </div>
      )}

      {/* Cost result — public */}
      {s.finalPerPerson>0 && (
        <div style={{ margin:"10px 14px 0", background:"linear-gradient(135deg,#0a2e24,#052e1a)", border:`1.5px solid ${C.green}55`, borderRadius:16, padding:"18px 18px 14px" }}>
          <div style={{ fontSize:12, color:C.green, fontWeight:700, textTransform:"uppercase", letterSpacing:".07em", marginBottom:8 }}>💸 สรุปค่าใช้จ่ายรอบนี้</div>
          <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:4 }}>
            <span style={{ fontSize:46, fontWeight:900, color:C.green, lineHeight:1 }}>{s.finalPerPerson.toLocaleString()}</span>
            <span style={{ fontSize:19, color:C.green, fontWeight:700 }}>฿/คน</span>
          </div>
          <div style={{ fontSize:12, color:C.dim, marginBottom:settings.qrImage?16:0 }}>{s.finalNote||""}</div>
          {settings.qrImage && (
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:12, color:C.green, fontWeight:700, marginBottom:10 }}>📲 สแกน QR โอนเงินได้เลย</div>
              <img src={settings.qrImage} style={{ width:220, height:220, objectFit:"contain", borderRadius:12, border:"4px solid rgba(255,255,255,.15)", display:"block", margin:"0 auto" }} />
            </div>
          )}
        </div>
      )}

      {/* Admin cost calc */}
      {isAdmin && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, margin:"10px 14px 0", overflow:"hidden" }}>
          <div style={{ padding:"12px 16px 10px", borderBottom:`1px solid ${C.border}`, fontSize:13, fontWeight:700, color:C.accent }}>⚙️ คำนวณค่าหาร (admin)</div>
          <div style={{ padding:"12px 16px" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
              <div><div style={labelSt}>เช็คอินแล้ว</div><div style={{ fontSize:20, fontWeight:800, color:C.green }}>{checkinCount} คน</div></div>
              <div>
                <div style={labelSt}>คนที่มาจริง (หาร)</div>
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <SmallBtn onClick={()=>onUpdate({confirmedPresent:Math.max(0,presentCount-1)})}>−</SmallBtn>
                  <span style={{ fontWeight:800, color:C.accent, minWidth:28, textAlign:"center" }}>{presentCount}</span>
                  <SmallBtn onClick={()=>onUpdate({confirmedPresent:presentCount+1})}>+</SmallBtn>
                </div>
              </div>
              <div>
                <div style={labelSt}>ลูกที่ใช้</div>
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <SmallBtn onClick={()=>onUpdate({shuttlesUsed:Math.max(0,shuttlesUsed-1)})}>−</SmallBtn>
                  <span style={{ fontWeight:800, color:C.accent, minWidth:28, textAlign:"center" }}>{shuttlesUsed}</span>
                  <SmallBtn onClick={()=>onUpdate({shuttlesUsed:shuttlesUsed+1})}>+</SmallBtn>
                </div>
              </div>
            </div>
            <div style={{ background:C.bg, borderRadius:10, padding:"11px 13px", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:C.dim, marginBottom:4 }}><span>ค่าสนามรวม</span><span>{totalCourt.toLocaleString()} ฿</span></div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:C.dim, marginBottom:8 }}><span>ค่าลูก ({shuttlesUsed} × {s.shuttleFee||0}฿)</span><span>{totalShuttle.toLocaleString()} ฿</span></div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:20, fontWeight:900, color:C.accent, borderTop:`1px solid ${C.border}`, paddingTop:8 }}><span>คนละ</span><span>{perPerson.toLocaleString()} ฿</span></div>
            </div>
            <div style={{ marginBottom:10 }}>
              <div style={labelSt}>📲 QR โอนเงิน</div>
              {settings.qrImage
                ? <div style={{ position:"relative", display:"inline-block" }}>
                    <img src={settings.qrImage} style={{ width:150, height:150, objectFit:"contain", borderRadius:10, border:"3px solid rgba(255,255,255,.15)", display:"block" }} />
                    <button style={{ position:"absolute", top:-8, right:-8, width:22, height:22, borderRadius:"50%", border:"none", background:C.red, color:"#fff", fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900 }} onClick={()=>onSaveSettings({qrImage:null})}>×</button>
                  </div>
                : <label style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"12px", borderRadius:10, border:`2px dashed ${C.borderHi}`, cursor:"pointer", color:C.muted, fontSize:13 }}>
                    📷 เลือกรูป QR
                    <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{
                      const file=e.target.files[0]; if(!file) return;
                      const r=new FileReader(); r.onload=ev=>onSaveSettings({qrImage:ev.target.result}); r.readAsDataURL(file);
                    }} />
                  </label>
              }
            </div>
            <button style={{...btnPrimary,background:`linear-gradient(90deg,${C.green},#26d9b5)`,boxShadow:`0 4px 16px ${C.green}33`}}
              onClick={()=>onUpdate({finalPerPerson:perPerson,finalPresentCount:presentCount,finalNote:`${presentCount} คน · ค่าสนาม ${totalCourt.toLocaleString()}฿ + ค่าลูก ${totalShuttle.toLocaleString()}฿`})}>
              ✓ ประกาศยอดให้ทุกคนเห็น
            </button>
          </div>
        </div>
      )}

      {/* My action */}
      {identity && !mySignup && !myWait && (
        <div style={{ margin:"10px 14px 0", background:full?C.amberDim:C.greenDim, border:`1px solid ${full?C.amber+"33":C.green+"33"}`, borderRadius:14, padding:"14px 16px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
            <div style={{ fontSize:26 }}>{full?"⏳":"🏸"}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:700, color:full?C.amber:C.green }}>{full?"สนามเต็ม — ลงสำรองได้":`ยังว่าง ${max-filled} ที่`}</div>
              <div style={{ fontSize:12, color:C.dim, marginTop:1 }}>{full?"จะได้สิทธิ์เมื่อมีคนถอนชื่อ":"กดเพื่อลงชื่อเล่นรอบนี้"}</div>
            </div>
            <button style={{ background:full?C.amber:C.green, border:"none", borderRadius:10, color:C.bg, padding:"10px 16px", fontSize:14, fontWeight:800, cursor:"pointer", flexShrink:0, fontFamily:"inherit" }} onClick={onSignup}>{full?"ลงสำรอง":"ลงชื่อ"}</button>
          </div>
          <button style={{ width:"100%", padding:"8px", borderRadius:9, border:`1px dashed ${full?C.amber+"66":C.green+"66"}`, background:"transparent", color:full?C.amber:C.green, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }} onClick={()=>setShowGuestModal(true)}>+ พาเพื่อนนอกกลุ่มมาด้วย</button>
        </div>
      )}
      {identity && mySignup && (
        <div style={{ margin:"10px 14px 0" }}>
          <button style={{ width:"100%", padding:"10px", borderRadius:10, border:`1px dashed ${C.borderHi}`, background:"transparent", color:C.accent, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }} onClick={()=>setShowGuestModal(true)}>🤝 พาเพื่อนนอกกลุ่มมาด้วย</button>
        </div>
      )}
      {mySignup && !mySignup.checkedIn && (
        <div style={{ margin:"10px 14px 0", background:C.accentDim, border:`1px solid ${C.accent}33`, borderRadius:14, padding:"14px 16px", display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ fontSize:26 }}>📍</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:700, color:C.accent }}>มาถึงแล้ว? กดเช็คอิน</div>
            <div style={{ fontSize:12, color:C.dim }}>เช็คอินเพื่อยืนยันว่ามาเล่นจริง</div>
          </div>
          <button style={{ background:`linear-gradient(90deg,${C.accent},${C.accentB})`, border:"none", borderRadius:10, color:"#fff", padding:"10px 14px", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }} onClick={()=>onCheckin(mySignup)}>เช็คอิน ✓</button>
        </div>
      )}
      {mySignup?.checkedIn && (
        <div style={{ margin:"10px 14px 0", background:C.greenDim, border:`1px solid ${C.green}33`, borderRadius:12, padding:"12px 16px", display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:22 }}>✅</span>
          <div style={{ fontSize:14, fontWeight:700, color:C.green }}>เช็คอินแล้ว · {fmtTime(mySignup.checkinTime)}</div>
        </div>
      )}
      {myWait && (
        <div style={{ margin:"10px 14px 0", background:C.amberDim, border:`1px solid ${C.amber}33`, borderRadius:12, padding:"12px 16px", display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:22 }}>⏳</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:700, color:C.amber }}>คุณอยู่ในรายสำรอง ลำดับที่ {s.waitlist.findIndex(p=>p.userId===identity.id)+1}</div>
          </div>
          <button style={btnOutline} onClick={()=>setConfirmWithdraw({entry:myWait,isWait:true})}>ถอน</button>
        </div>
      )}

      {/* Signup list */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, margin:"10px 14px 0", overflow:"hidden" }}>
        <div style={{ padding:"12px 16px 10px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.accent }}>✅ ตัวจริง ({filled}/{max})</div>
          <div style={{ display:"flex", gap:10, fontSize:12 }}>
            <span style={{ color:C.green }}>เช็คอิน {checkinCount}</span>
            {s.finalPerPerson>0 && <span style={{ color:C.purple }}>💸 โอนแล้ว {s.signups.filter(p=>p.paid).length}/{filled}</span>}
          </div>
        </div>
        {s.signups.length===0 && <div style={{ padding:"16px", fontSize:13, color:C.muted, textAlign:"center" }}>ยังไม่มีคนลงชื่อ</div>}
        {s.signups.map((p,i)=>{
          const isMine=identity&&p.userId===identity.id;
          const isMyGuest=identity&&p.invitedBy===identity.id;
          const canCheckin=(isMine||isMyGuest)&&!p.checkedIn;
          const canTogglePaid=s.finalPerPerson>0&&(isMine||isMyGuest||isAdmin);
          return (
            <div key={p.id} style={{ padding:"10px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:8, background:p.paid?"#0a1a0e":isMine?`${C.accent}11`:isMyGuest?`${C.accentB}08`:"transparent" }}>
              <div style={{ width:26, height:26, borderRadius:"50%", background:p.checkedIn?C.greenDim:C.accentDim, color:p.checkedIn?C.green:C.accent, fontSize:12, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{p.checkedIn?<Ic.check />:i+1}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:15, fontWeight:600, display:"flex", alignItems:"center", gap:5, flexWrap:"wrap" }}>
                  {p.name}
                  {isMine && <span style={{ fontSize:11, color:C.accent }}>(คุณ)</span>}
                  {isMyGuest && <span style={{ fontSize:11, color:C.muted }}>👤 เพื่อนคุณ</span>}
                  {p.isGuest&&!isMyGuest && <span style={{ fontSize:11, color:C.muted }}>👤 {p.invitedByName}</span>}
                  {p.paid && <span style={{ fontSize:10, fontWeight:800, background:C.purpleDim, color:C.purple, padding:"2px 7px", borderRadius:99 }}>💸 โอนแล้ว</span>}
                </div>
                {p.checkedIn && <div style={{ fontSize:11, color:C.green }}>เช็คอิน {fmtTime(p.checkinTime)}</div>}
              </div>
              <span style={{ fontSize:11, color:C.muted, flexShrink:0 }}>{fmtTime(p.time)}</span>
              {canCheckin && <button style={tinyBtn} onClick={e=>{e.stopPropagation();onCheckin(p);}}>เช็คอิน</button>}
              {canTogglePaid && <button style={{...tinyBtn,background:p.paid?C.purpleDim:"transparent",color:p.paid?C.purple:"#c77dff99",borderColor:p.paid?"#c77dff55":"#c77dff33"}} onClick={e=>{e.stopPropagation();onUpdate({_togglePaid:p.id});}}>{p.paid?"✓ โอนแล้ว":"แจ้งโอน"}</button>}
              {(isAdmin||(identity&&(p.userId===identity.id||p.invitedBy===identity.id))) && <button style={{...tinyBtn}} onClick={e=>{e.stopPropagation();setConfirmWithdraw({entry:p,isWait:false});}}>ถอน</button>}
            </div>
          );
        })}
      </div>

      {/* Waitlist */}
      {(s.waitlist.length>0||full) && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, margin:"10px 14px 0", overflow:"hidden" }}>
          <div style={{ padding:"12px 16px 10px", borderBottom:`1px solid ${C.border}` }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.amber }}>⏳ รายสำรอง ({s.waitlist.length})</div>
          </div>
          {s.waitlist.length===0 && <div style={{ padding:"14px 16px", fontSize:13, color:C.muted, textAlign:"center" }}>ไม่มีคนสำรอง</div>}
          {s.waitlist.map((p,i)=>{
            const isMine=identity&&p.userId===identity.id;
            const isMyGuest=identity&&p.invitedBy===identity.id;
            return (
              <div key={p.id} style={{ padding:"10px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10, background:isMine?`${C.amber}11`:"transparent" }}>
                <div style={{ width:26, height:26, borderRadius:"50%", background:C.amberDim, color:C.amber, fontSize:12, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{i+1}</div>
                <div style={{ flex:1 }}><span style={{ fontSize:15, fontWeight:600 }}>{p.name}</span>{isMine&&<span style={{ fontSize:11, color:C.amber, marginLeft:5 }}>(คุณ)</span>}</div>
                {isAdmin && <button style={{...tinyBtn,color:C.green,borderColor:C.green+"44"}} onClick={e=>{e.stopPropagation();onPromote(p.id);}}>เลื่อน ↑</button>}
                {(isAdmin||(identity&&(p.userId===identity.id||p.invitedBy===identity.id))) && <button style={tinyBtn} onClick={e=>{e.stopPropagation();setConfirmWithdraw({entry:p,isWait:true});}}>ถอน</button>}
              </div>
            );
          })}
          <div style={{ padding:"8px 16px", fontSize:11, color:C.muted }}>เมื่อตัวจริงถอนชื่อ → ลำดับแรกในสำรองจะได้สิทธิ์ทันที</div>
        </div>
      )}

      {/* Action buttons row */}
      <div style={{ margin:"10px 14px 0", display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        <button style={{ padding:"12px", borderRadius:12, border:`1px solid ${C.borderHi}`, background:C.up, color:C.text, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}
          onClick={()=>setShowReminderModal(true)}><Ic.bell />แจ้งเตือนตี้</button>
        <button style={{ padding:"12px", borderRadius:12, border:`1px solid ${C.borderHi}`, background:C.up, color:C.text, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}
          onClick={()=>setShowShareModal(true)}>📤 แชร์รายชื่อ</button>
      </div>
      {s.finalPerPerson>0 && (
        <div style={{ margin:"8px 14px 0" }}>
          <button style={{ width:"100%", padding:"12px", borderRadius:12, border:`1px solid ${C.green}44`, background:C.greenDim, color:C.green, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}
            onClick={()=>setShowSummaryModal(true)}>🏆 แชร์สรุปรอบนี้</button>
        </div>
      )}

      <div style={{ height:28 }} />

      {/* Guest modal */}
      {showGuestModal && (
        <Modal title="🤝 พาเพื่อนนอกกลุ่ม" onClose={()=>{setShowGuestModal(false);setGuestName("");}}>
          <p style={{ fontSize:13, color:C.dim, margin:"0 0 12px" }}>ใส่ชื่อเพื่อนที่จะพามา</p>
          <input autoFocus style={inputStyle} placeholder="ชื่อเพื่อน" value={guestName} onChange={e=>setGuestName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(onGuestSignup(guestName),setGuestName(""),setShowGuestModal(false))} />
          <button style={{...btnPrimary,marginTop:12}} onClick={()=>{onGuestSignup(guestName);setGuestName("");setShowGuestModal(false);}}>+ ลงชื่อให้เพื่อน</button>
        </Modal>
      )}

      {/* Reminder modal */}
      {showReminderModal && (() => {
        const txt = buildReminderText();
        return (
          <Modal title="🔔 แจ้งเตือนก่อนตี้" onClose={()=>setShowReminderModal(false)}>
            <p style={{ fontSize:13, color:C.dim, margin:"0 0 10px" }}>คัดลอกแล้วส่งในไลน์กลุ่มได้เลย 📲</p>
            <textarea readOnly ref={taReminderRef} style={textareaStyle} value={txt} onFocus={e=>e.target.select()} onClick={e=>e.target.select()} onChange={()=>{}} />
            <button style={btnPrimary} onClick={()=>copyAndClose(taReminderRef,setShowReminderModal)}><Ic.copy /> คัดลอกข้อความ</button>
          </Modal>
        );
      })()}

      {/* Share modal */}
      {showShareModal && (() => {
        const txt = buildShareText();
        return (
          <Modal title="📤 แชร์ไปไลน์" onClose={()=>setShowShareModal(false)}>
            <p style={{ fontSize:13, color:C.dim, margin:"0 0 10px" }}>กดคัดลอกแล้วนำไปวางในไลน์ได้เลย 🎉</p>
            <textarea readOnly ref={taShareRef} style={textareaStyle} value={txt} onFocus={e=>e.target.select()} onClick={e=>e.target.select()} onChange={()=>{}} />
            <button style={btnPrimary} onClick={()=>copyAndClose(taShareRef,setShowShareModal)}><Ic.copy /> คัดลอกข้อความ</button>
          </Modal>
        );
      })()}

      {/* Summary modal */}
      {showSummaryModal && (() => {
        const txt = buildSummaryText();
        return (
          <Modal title="🏆 สรุปรอบนี้" onClose={()=>setShowSummaryModal(false)}>
            <p style={{ fontSize:13, color:C.dim, margin:"0 0 10px" }}>กดคัดลอกแล้วแชร์ในไลน์กลุ่มได้เลย 🎉</p>
            <textarea readOnly ref={taSummaryRef} style={textareaStyle} value={txt} onFocus={e=>e.target.select()} onClick={e=>e.target.select()} onChange={()=>{}} />
            <button style={{...btnPrimary,background:`linear-gradient(90deg,${C.green},#26d9b5)`,boxShadow:`0 4px 16px ${C.green}33`}} onClick={()=>copyAndClose(taSummaryRef,setShowSummaryModal)}><Ic.copy /> คัดลอกข้อความ</button>
          </Modal>
        );
      })()}

      {/* Confirm withdraw */}
      {confirmWithdraw && (
        <Modal title="ถอนชื่อ?" onClose={()=>setConfirmWithdraw(null)}>
          <p style={{ fontSize:14, color:C.dim, margin:"0 0 16px" }}>ต้องการถอนชื่อ <b style={{ color:C.text }}>{confirmWithdraw.entry.name}</b> ออกจาก{confirmWithdraw.isWait?"รายสำรอง":"รายตัวจริง"}?</p>
          <div style={{ display:"flex", gap:8 }}>
            <button style={{ flex:1, padding:"12px", borderRadius:11, border:"none", background:C.red, color:"#fff", fontSize:15, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }} onClick={()=>{onWithdraw(confirmWithdraw.entry,confirmWithdraw.isWait);setConfirmWithdraw(null);}}>ถอนชื่อ</button>
            <button style={{ flex:1, padding:"12px", borderRadius:11, border:`1px solid ${C.border}`, background:"transparent", color:C.muted, fontSize:15, cursor:"pointer", fontFamily:"inherit" }} onClick={()=>setConfirmWithdraw(null)}>ยกเลิก</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Quick Count ──────────────────────────────────────────────────────────────
function QuickCount() {
  const [rawText, setRawText] = useState("");
  const [names, setNames] = useState([]);
  const [courtFee, setCourtFee] = useState("");
  const [shuttleFee, setShuttleFee] = useState("");
  const [shuttles, setShuttles] = useState("");
  const [newName, setNewName] = useState("");
  const [parsed, setParsed] = useState(false);

  const total = (Number(courtFee)||0) + (Number(shuttleFee)||0)*(Number(shuttles)||0);
  const perPerson = names.length>0&&total>0 ? Math.ceil(total/names.length) : 0;

  function parseNames() {
    const lines = rawText.split("\n").map(l=>l.trim()).filter(Boolean);
    const found=[]; const seen=new Set();
    for (const line of lines) {
      if (/^\d{1,2}[\/:\-]\d{1,2}/.test(line)) continue;
      if (/^https?:\/\//.test(line)) continue;
      if (/^(เข้าร่วม|ออกจาก|เปลี่ยนชื่อ|ชวน)/.test(line)) continue;
      let m = line.match(/^\d+[\.\)\s]+(.+)/);
      if (m) { const n=m[1].trim(); if(n&&!seen.has(n)){seen.add(n);found.push(n);} continue; }
      m = line.match(/^[-•+*]\s*(.+)/);
      if (m) { const n=m[1].trim(); if(n&&!seen.has(n)){seen.add(n);found.push(n);} continue; }
      m = line.match(/^([ก-๙a-zA-Z][ก-๙\w\s]{1,30})$/);
      if (m) { const n=m[1].trim(); if(/ครับ|ค่ะ|คะ|นะ|ได้|ไม่|มี|เอา|ขอ|ว่า|แล้ว|มา|ไป/.test(n)) continue; if(n.length>=2&&n.length<=25&&!seen.has(n)){seen.add(n);found.push(n);} }
    }
    setNames(found); setParsed(true);
  }

  return (
    <div style={{ paddingBottom:40 }}>
      {!parsed ? (
        <div style={{ padding:"16px 14px 8px" }}>
          <div style={{ fontSize:14, color:C.dim, marginBottom:12, lineHeight:1.6 }}>
            วางข้อความแชทไลน์ที่มีรายชื่อ<br/>
            <span style={{ fontSize:12, color:C.muted }}>รองรับ: "1. ปอ", "- นิว", "• เม" หรือชื่อบรรทัดเดียว</span>
          </div>
          <textarea style={{...textareaStyle,height:220}} placeholder={"วางข้อความที่นี่...\n\nตัวอย่าง:\n1. ปอ\n2. นิว\n- แนน\n• ต้น"} value={rawText} onChange={e=>setRawText(e.target.value)} />
          <button style={{...btnPrimary,marginTop:10}} onClick={parseNames} disabled={!rawText.trim()}>🔍 แยกชื่อให้อัตโนมัติ</button>
        </div>
      ) : (
        <>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, margin:"14px 14px 0", overflow:"hidden" }}>
            <div style={{ padding:"12px 16px 10px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.accent }}>✅ รายชื่อ ({names.length} คน)</div>
              <button style={{ fontSize:12, color:C.muted, background:"transparent", border:"none", cursor:"pointer", fontFamily:"inherit" }} onClick={()=>setParsed(false)}>แก้ข้อความ</button>
            </div>
            {names.length===0 && <div style={{ padding:"16px", fontSize:13, color:C.muted, textAlign:"center" }}>ไม่พบชื่อ</div>}
            {names.map((n,i)=>(
              <div key={i} style={{ padding:"10px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:24, height:24, borderRadius:"50%", background:C.accentDim, color:C.accent, fontSize:11, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{i+1}</div>
                <span style={{ flex:1, fontSize:15, fontWeight:600 }}>{n}</span>
                <button style={{ background:"transparent", border:"none", color:C.red, fontSize:16, cursor:"pointer" }} onClick={()=>setNames(ns=>ns.filter((_,j)=>j!==i))}>✕</button>
              </div>
            ))}
            <div style={{ padding:"10px 16px", display:"flex", gap:8 }}>
              <input style={{ flex:1, background:C.bg, border:`1px solid ${C.borderHi}`, borderRadius:8, color:C.text, fontSize:14, padding:"8px 10px", outline:"none", fontFamily:"inherit" }}
                placeholder="+ เพิ่มชื่อ" value={newName} onChange={e=>setNewName(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&(setNames(p=>[...p,newName.trim()]),setNewName(""))} />
              <button style={{ padding:"8px 14px", borderRadius:8, border:"none", background:`linear-gradient(90deg,${C.accent},${C.accentB})`, color:"#fff", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}
                onClick={()=>{setNames(p=>[...p,newName.trim()]);setNewName("");}}>เพิ่ม</button>
            </div>
          </div>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, margin:"10px 14px 0", padding:"14px 16px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".08em", marginBottom:12 }}>💰 คำนวณค่าใช้จ่าย</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:12 }}>
              {[["ค่าสนามรวม (฿)",courtFee,setCourtFee],["ค่าลูก/ลูก (฿)",shuttleFee,setShuttleFee],["ลูกที่ใช้",shuttles,setShuttles]].map(([lbl,val,setter])=>(
                <div key={lbl}><div style={labelSt}>{lbl}</div><input style={{...inlineSt,textAlign:"center"}} type="number" placeholder="0" value={val} onChange={e=>setter(e.target.value)} /></div>
              ))}
            </div>
            {total>0 && (
              <div style={{ background:C.bg, borderRadius:10, padding:"14px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:C.dim, marginBottom:3 }}><span>ค่าสนาม</span><span>{(Number(courtFee)||0).toLocaleString()} ฿</span></div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:C.dim, marginBottom:10 }}><span>ค่าลูก ({Number(shuttles)||0} × {Number(shuttleFee)||0}฿)</span><span>{((Number(shuttleFee)||0)*(Number(shuttles)||0)).toLocaleString()} ฿</span></div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", borderTop:`1px solid ${C.border}`, paddingTop:10 }}>
                  <span style={{ fontSize:14, color:C.dim }}>{names.length} คน หาร {total.toLocaleString()} ฿</span>
                  <div><span style={{ fontSize:36, fontWeight:900, color:C.green }}>{perPerson.toLocaleString()}</span><span style={{ fontSize:16, fontWeight:700, color:C.green }}> ฿/คน</span></div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Create Session ───────────────────────────────────────────────────────────
function CreateView({ onSave, onCancel }) {
  const today = new Date().toISOString().slice(0,10);
  const [f, setF] = useState({ name:"", venue:"", date:today, time:"13:00", courts:"", courtFeeTotal:"", shuttleFee:"", maxPlayers:12, note:"" });
  const suggestedMax = f.courts ? Math.ceil(Number(f.courts) * 6 * 1.4) : 12;
  const set = (k,v) => setF(x=>({...x,[k]:v}));
  return (
    <div>
      <Sect label="ข้อมูลรอบเล่น">
        <FormRow label="ชื่อตี้"><Input placeholder="เว้นว่าง = ตั้งชื่ออัตโนมัติตามวัน" value={f.name} onChange={e=>set("name",e.target.value)} /></FormRow>
        <FormRow label="ชื่อสนาม"><Input placeholder="เว้นว่าง = TBA" value={f.venue} onChange={e=>set("venue",e.target.value)} /></FormRow>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <FormRow label="วันที่"><Input type="date" value={f.date} onChange={e=>set("date",e.target.value)} /></FormRow>
          <FormRow label="เวลา"><Input type="time" value={f.time} onChange={e=>set("time",e.target.value)} /></FormRow>
        </div>
        <FormRow label="หมายเหตุ"><Input placeholder="ข้อมูลเพิ่มเติม..." value={f.note} onChange={e=>set("note",e.target.value)} /></FormRow>
      </Sect>
      <Sect label="สนาม & ค่าใช้จ่าย">
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10 }}>
          <FormRow label="จำนวนสนาม"><Input type="number" min="1" placeholder="2" value={f.courts} onChange={e=>set("courts",e.target.value)} /></FormRow>
          <FormRow label="ค่าสนามรวม"><Input type="number" placeholder="0" value={f.courtFeeTotal} onChange={e=>set("courtFeeTotal",e.target.value)} /></FormRow>
          <FormRow label="ราคาลูก/ลูก"><Input type="number" placeholder="0" value={f.shuttleFee} onChange={e=>set("shuttleFee",e.target.value)} /></FormRow>
          <FormRow label="รับสูงสุด">
            <Input type="number" min="1" value={f.maxPlayers} onChange={e=>set("maxPlayers",Math.max(1,+e.target.value||1))} />
            {f.courts && <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>💡 {f.courts} สนาม แนะนำ ~{suggestedMax} คน <button style={{ background:"transparent", border:"none", color:C.accent, fontSize:11, cursor:"pointer", padding:0, fontFamily:"inherit" }} onClick={()=>set("maxPlayers",suggestedMax)}>ใช้ค่านี้</button></div>}
          </FormRow>
        </div>
      </Sect>
      <div style={{ padding:"14px 14px 0" }}>
        <button style={btnPrimary} onClick={()=>onSave({...f,name:f.name.trim()||autoSessionName(f.date),venue:f.venue.trim()||"TBA"})}>✓ สร้างรอบเล่น</button>
      </div>
      <div style={{ height:24 }} />
    </div>
  );
}

// ─── Shared micro-components ──────────────────────────────────────────────────
function Chip({ col, children }) {
  const bg=col==="green"?C.greenDim:col==="amber"?C.amberDim:col==="red"?C.redDim:C.accentDim;
  const fg=col==="green"?C.green:col==="amber"?C.amber:col==="red"?C.red:C.accent;
  return <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"3px 9px", borderRadius:99, fontSize:11, fontWeight:700, background:bg, color:fg }}>{children}</span>;
}
function SmallBtn({ children, onClick }) {
  return <button style={{ width:28, height:28, borderRadius:7, border:`1px solid ${C.borderHi}`, background:"transparent", color:C.accent, fontSize:16, cursor:"pointer" }} onClick={onClick}>{children}</button>;
}
function Sect({ label, children }) {
  return <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, margin:"14px 14px 0", padding:"14px 16px" }}><div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".08em", marginBottom:14 }}>{label}</div>{children}</div>;
}
function FormRow({ label, children }) {
  return <div style={{ marginBottom:12 }}><div style={{ fontSize:11, fontWeight:700, color:C.dim, textTransform:"uppercase", letterSpacing:".06em", marginBottom:5 }}>{label}</div>{children}</div>;
}
function Input(props) {
  return <input {...props} style={{ width:"100%", background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, color:C.text, fontSize:15, padding:"10px 12px", boxSizing:"border-box", outline:"none", fontFamily:"inherit", ...(props.style||{}) }} />;
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const inputStyle = { width:"100%", background:C.bg, border:`1px solid ${C.borderHi}`, borderRadius:11, color:C.text, fontSize:16, padding:"12px 14px", boxSizing:"border-box", outline:"none", fontFamily:"inherit" };
const inlineSt   = { width:"100%", background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, fontSize:14, padding:"7px 8px", boxSizing:"border-box", fontFamily:"inherit", outline:"none" };
const labelSt    = { fontSize:11, color:C.muted, marginBottom:4 };
const btnPrimary = { width:"100%", padding:"13px", borderRadius:12, border:"none", background:`linear-gradient(90deg,${C.accent},${C.accentB})`, color:"#fff", fontSize:15, fontWeight:800, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:6, boxShadow:`0 4px 16px ${C.accent}33` };
const btnOutline = { padding:"7px 12px", borderRadius:9, border:`1px solid ${C.border}`, background:"transparent", color:C.muted, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:5 };
const tinyBtn    = { padding:"5px 9px", borderRadius:7, border:`1px solid ${C.border}`, background:"transparent", color:C.muted, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", flexShrink:0 };
const textareaStyle = { width:"100%", height:260, background:C.bg, border:`1px solid ${C.borderHi}`, borderRadius:11, color:C.text, fontSize:12, lineHeight:1.7, padding:"12px 14px", boxSizing:"border-box", fontFamily:"inherit", resize:"none", outline:"none" };
