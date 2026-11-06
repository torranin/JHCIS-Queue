'use client';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Activity, ArrowRight, Check, Database, FileText, LockKeyhole, Printer, Search, Settings, ListOrdered, X } from 'lucide-react';
import { flushSync } from 'react-dom';
import type { Config, Patient, PrintForm } from '@/lib/types';

function thaiDate(value:string|Date) { const d=new Date(value); return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Bangkok'}); }
function age(value:string) { const b=new Date(value); if(Number.isNaN(b.getTime()))return '—'; const n=new Date(); return n.getFullYear()-b.getFullYear()-(n.getMonth()<b.getMonth() || (n.getMonth()===b.getMonth() && n.getDate()<b.getDate())?1:0); }
async function api(url:string,body?:unknown) { const res=await fetch(url,{cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})}); const data=await res.json(); if(!res.ok)throw new Error(data.error||'เกิดข้อผิดพลาด'); return data; }

export default function Home() {
 const [printForm,setPrintForm]=useState<PrintForm>('services');
 const [hn,setHn]=useState(''); const [queueNumber,setQueueNumber]=useState<number|null>(null); const [printing,setPrinting]=useState(false); const pendingPrint=useRef<string|null>(null); const printLock=useRef(false); const [patient,setPatient]=useState<Patient|null>(null); const [hospital,setHospital]=useState('โรงพยาบาลแม่วาง'); const [demo,setDemo]=useState(true); const [loadedDemo,setLoadedDemo]=useState(false); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [time,setTime]=useState<Date|null>(null); const [settings,setSettings]=useState(false); const [queueEditor,setQueueEditor]=useState(false);
 async function status(){try { const d=await api('/api/status');setHospital(d.hospital);setDemo(d.demo);setPrintForm(d.printForm); }catch{setError('ไม่สามารถอ่านสถานะระบบได้');}}
 useEffect(()=>{void status();},[]);
 async function search(e:FormEvent){e.preventDefault();setBusy(true);setError('');setPatient(null);setQueueNumber(null);pendingPrint.current=null;try{const d=await api('/api/patients',{search:hn.trim()});setPatient(d.patient);setHospital(d.hospital);setLoadedDemo(d.demo);setPrintForm(d.printForm);setTime(new Date());}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function printSlip(){
  if(!patient || printLock.current)return;
  printLock.current=true;setPrinting(true);setError('');
  pendingPrint.current ??= crypto.randomUUID();
  try{
   const result=await api('/api/queue',{requestId:pendingPrint.current});
   flushSync(()=>{setQueueNumber(result.number);setTime(new Date());});
   pendingPrint.current=null;
   await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
   window.print();
  }catch(e){setError((e as Error).message);}finally{printLock.current=false;setPrinting(false);}
 }
 return <><div className="workspace">
 <div className="main"><main><div className="page-heading"><a className="brand" href="/"><span className="brand-icon"><Activity size={24}/></span><span>JHCIS <b>Queue</b><small>ระบบบริการผู้ป่วยนอก</small></span></a><h1>พิมพ์ใบนำทางผู้ป่วย {hospital}</h1><div className="header-actions"><button className="outline" disabled={busy||printing} onClick={()=>setQueueEditor(true)}><ListOrdered size={16}/> แก้ไขคิว</button><button className="outline settings-top" disabled={printing} onClick={()=>setSettings(true)}><Settings size={16}/> ตั้งค่าการเชื่อมต่อ</button></div></div>
 <div className="columns"><section className="control-column"><div className="card search-card"><div className="card-title"><span className="icon-tile"><Search size={20}/></span><div><h2>ค้นหาผู้ป่วย</h2><p>ค้นหาด้วย HN หรือเลขบัตรประชาชน</p></div></div><form onSubmit={search}><label htmlFor="hn">HN / เลขบัตรประชาชน <span>*</span></label><div className="input-wrap"><Search size={18}/><input id="hn" value={hn} onChange={e=>{setHn(e.target.value.replace(/\D/g,''));setPatient(null);setQueueNumber(null);pendingPrint.current=null;setError('');}} placeholder="HN หรือเลขบัตรประชาชน" maxLength={13} inputMode="numeric" pattern="([0-9]{1,8}|[0-9]{13})" title="HN 1–8 หลัก หรือเลขบัตรประชาชน 13 หลัก" disabled={busy||printing} autoComplete="off" required autoFocus/></div><p className="hint">HN 1–8 หลัก หรือเลขบัตรประชาชน 13 หลัก</p><button className="primary search-button" disabled={busy||printing||!hn.trim()}>{busy?'กำลังค้นหา...':<><Search size={17}/> ค้นหาผู้ป่วย <ArrowRight size={17}/></>}</button></form>{error&&<div className="error" role="alert">{error}</div>}<div className="mode"><span className={'dot '+(!demo?'green':'')}/>{demo?'โหมดข้อมูลตัวอย่าง':'โหมดฐานข้อมูล MySQL'}<span className="mode-tag">{demo?'DEMO':'MYSQL'}</span></div>{demo&&<p className="demo-help">ทดลองด้วย HN <button disabled={busy||printing} onClick={()=>{setHn('00001');setPatient(null);setQueueNumber(null);}}>00001</button><br/>เชื่อมต่อข้อมูลจริงได้ที่การตั้งค่า</p>}</div>
 <div className="card print-card"><h2><Printer size={19}/> การพิมพ์</h2><div className="paper-spec"><div className="paper-icon">A5</div><div><strong>ใบนำทางขนาด A5</strong><small>148 × 210 มม. • แนวตั้ง</small></div><Check size={17}/></div><button className="primary print-button" disabled={!patient||busy||printing} onClick={()=>void printSlip()}><Printer size={18}/> พิมพ์ใบนำทาง</button><p className="hint center">เลือก A5 · สเกล 100% · ปิดหัวและท้ายกระดาษ</p></div><div className="guide"><span>i</span><div><strong>ก่อนพิมพ์ทุกครั้ง</strong><p>ตรวจสอบชื่อและ HN ให้ตรงกับผู้ป่วย<br/>แล้วจึงกดพิมพ์ใบนำทาง</p></div></div></section>
 <section className="preview-panel"><div className="preview-header"><span><FileText size={17}/> ตัวอย่างก่อนพิมพ์</span><span className="a5-badge">A5 <span>PORTRAIT</span></span></div><FitPreview>{patient?<Slip patient={patient} hospital={hospital} time={time!} demo={loadedDemo} queueNumber={queueNumber} printForm={printForm}/>:<div className="empty-paper"><div className="empty-paper-top"><div/><div/><div/></div><div className="empty-content"><span><FileText size={36} strokeWidth={1.3}/></span><h3>ใบนำทางของคุณจะแสดงที่นี่</h3><p>ค้นหาผู้ป่วยด้วยหมายเลข HN<br/>เพื่อดูข้อมูลและตัวอย่างก่อนพิมพ์</p><div className="empty-pill">พร้อมสำหรับกระดาษ A5</div></div><div className="empty-lines"><i/><i/><i/><i/></div></div>}</FitPreview><div className="preview-footer"><span className="dot green"/>{patient?'ตรวจสอบข้อมูลก่อนสั่งพิมพ์':'รอค้นหาข้อมูลผู้ป่วย'}<span>ขนาดจริง 148 × 210 มม.</span></div></section></div><footer>JHCIS Queue <span>ระบบพิมพ์ใบนำทางสำหรับงานบริการผู้ป่วยนอก</span></footer></main></div></div>
 {queueEditor&&<QueueDialog close={()=>setQueueEditor(false)} saved={()=>{setQueueNumber(null);pendingPrint.current=null;}}/>}
 {settings&&<SettingsDialog close={()=>setSettings(false)} saved={()=>{setPatient(null);void status();}}/>}</>;
}
function FitPreview({children}:{children:ReactNode}) {
 const canvas=useRef<HTMLDivElement>(null);
 const sheet=useRef<HTMLDivElement>(null);
 const [scale,setScale]=useState(1);
 useEffect(()=>{
   const outer=canvas.current, inner=sheet.current;
   if(!outer || !inner)return;
   const fit=()=>{
     const style=getComputedStyle(outer);
     const width=outer.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
     const height=outer.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
     setScale(Math.min(1,width/inner.offsetWidth,height/inner.offsetHeight));
   };
   const observer=new ResizeObserver(fit);
   observer.observe(outer);observer.observe(inner);fit();
   return()=>observer.disconnect();
 },[]);
 return <div className="preview-canvas" ref={canvas}><div className="preview-sheet" ref={sheet} style={{zoom:scale}}>{children}</div></div>;
}
function Slip({patient:p,hospital,time,demo,queueNumber,printForm}:{patient:Patient;hospital:string;time:Date;demo:boolean;queueNumber:number|null;printForm:PrintForm}) {
 const isPcu=printForm==='pcu'||printForm==='pcu-v1';
 const address=p.address?.trim();
 const hasAddress=!!address && !/^[-–—\s]+$/.test(address);
 return <article className={`slip slip-${printForm}`} aria-label="ใบนำทางผู้ป่วย">
  <h2>{hospital}</h2>
  {demo&&<div className="demo-watermark">ข้อมูลตัวอย่าง — ไม่ใช่เอกสารผู้ป่วยจริง</div>}
  <div className="queue-row"><strong>{queueNumber===null?'Q —':`Q ${queueNumber}`}</strong></div>
  <div className="slip-date"><span>วันที่ {thaiDate(time)}</span><span className="slip-hn"><b>HN</b> <strong>{p.hn}</strong></span><span>{time.toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok',hour12:false})}</span></div>
  <div className="slip-detail">
   <p className="patient-name-row"><span><b>ชื่อ</b> {p.name}</span><span className="patient-cid"><b>CID</b> {p.cid||'—'}</span></p>
   <p><b>วันเกิด</b> {thaiDate(p.birthDate)} <b className="age">อายุ</b> {age(p.birthDate)} ปี <b className="age">เพศ</b> {p.sex||'—'}</p>
   <p className="rights"><b>สิทธิ</b> {p.rightName||'—'}</p>
   {hasAddress&&<p className="patient-address">{address}</p>}
   <p><b>แพ้ยา</b> {p.allergy||'ไม่ระบุข้อมูล'}</p>
  </div>
  <div className="vitals"><div>BW<span/>Kg HT<span/> O2s<span/></div><div>T<span/> P<span/> R<span/></div><div>BP<span/>/<span/> BP2<span/>/<span/></div></div>
  <div className="cc-lines"><div><span>CC</span><i/></div>{Array.from({length:printForm==='lines'?9:4},(_,i)=><div key={i}><i/></div>)}</div>
  {printForm!=='lines'&&<section className="service-points" aria-label="จุดรับบริการ">
   <h3>จุดรับบริการ</h3>
   <div className="service-grid">
    {(isPcu
      ? ['จุดซักประวัติ','พบแพทย์','ห้องจ่ายยา','ห้องแพทย์แผนไทย','ให้คำปรึกษา']
      : ['จุดซักประวัติ','ห้องตรวจ (1) (2)','ห้อง LAB','ห้องทำหัตถการ','ห้องอุบัติเหตุและฉุกเฉิน','ห้องแพทย์แผนไทย','ห้องทันตกรรม','ห้องจ่ายยา','ห้องกายภาพบำบัด','ห้องการเงิน/ประกันสุขภาพ']
    ).map(service=><div className="service-option" key={service}><span className="service-box" aria-hidden="true"/><span>{service}</span></div>)}
    <div className="service-option"><span className="service-box" aria-hidden="true"/><span>อื่น ๆ</span><i className="service-other-line"/></div>
   </div>
  </section>}
 </article>;
}
function SettingsDialog({close,saved}:{close:()=>void;saved:()=>void}) {
 const [confirmReset,setConfirmReset]=useState(false);
 const [config,setConfig]=useState<(Config & {hasPassword?:boolean})|null>(null);const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
 async function unlock(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{await api('/api/settings',{action:'login',password});setConfig(await api('/api/settings'));setPassword('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function action(kind:string){setBusy(true);setError('');setMessage('');try{const d=await api('/api/settings',{action:kind,config});setMessage(d.message);if(kind==='save'){saved();setConfig(await api('/api/settings'));}}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function resetNumber(){
  if(!confirmReset)return;
  setBusy(true);setError('');setMessage('');
  try{const d=await api('/api/settings',{action:'resetQueue',confirm:true});setMessage(d.message);setConfirmReset(false);saved();}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function dismiss(){try{await api('/api/settings',{action:'logout'});}catch{}close();}
 useEffect(()=>{const handler=(e:KeyboardEvent)=>{if(e.key==='Escape')void dismiss();};document.addEventListener('keydown',handler);return()=>document.removeEventListener('keydown',handler);},[]);
 function field<K extends keyof Config>(key:K,value:Config[K]){setConfig(c=>c?{...c,[key]:value}:c);}
 return <div className="modal-backdrop"><section className={'modal '+(config?'wide':'')} role="dialog" aria-modal="true" aria-labelledby="settings-title"><div className="modal-header"><span className="icon-tile">{config?<Database size={22}/>:<LockKeyhole size={22}/>}</span><div><h2 id="settings-title">{config?'ตั้งค่าการเชื่อมต่อ MySQL':'เข้าสู่การตั้งค่า'}</h2><p>{config?'กำหนดฐานข้อมูลและข้อมูลบนใบนำทาง':'สำหรับผู้ดูแลระบบเท่านั้น'}</p></div><button aria-label="ปิด" className="icon-button" onClick={()=>void dismiss()}><X/></button></div>{!config?<form onSubmit={unlock}><label htmlFor="admin-pass">รหัสผ่านผู้ดูแลระบบ</label><input id="admin-pass" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoFocus required autoComplete="current-password"/><button disabled={busy} className="primary full">{busy?'กำลังตรวจสอบ...':'เข้าสู่การตั้งค่า'}</button></form>:<><div className="settings-grid"><label className="span-two">แบบฟอร์มที่จะพิมพ์<select value={config.printForm} onChange={e=>field('printForm',e.target.value as PrintForm)}><option value="services">แบบ รพ.สต.Cup - มีจุดรับบริการ</option><option value="pcu">แบบ PCU - มีจุดรับบริการ</option><option value="pcu-v1">แบบ PCU มีจุดรับบริการ v.1</option><option value="lines">แบบเส้นบันทึก — ไม่มีจุดรับบริการ</option></select><small>{config.printForm==='pcu-v1'?'เลขคิวด้านขวา • ช่อง CC 5 บรรทัด พร้อมจุดรับบริการแบบ PCU':config.printForm==='pcu'?'ช่อง CC 5 บรรทัด พร้อมช่องสี่เหลี่ยมจุดรับบริการ 2 คอลัมน์':config.printForm==='services'?'ช่อง CC 5 บรรทัด พร้อมช่องสี่เหลี่ยมจุดรับบริการ 2 คอลัมน์':'ช่อง CC และเส้นบันทึกยาวถึงด้านล่างกระดาษ'} • กระดาษ A5 ทุกแบบ</small></label><label className="span-two">ชื่อโรงพยาบาล<input value={config.hospital} onChange={e=>field('hospital',e.target.value)}/></label><label>Host<input value={config.host} onChange={e=>field('host',e.target.value)}/></label><label>Port<input type="number" value={config.port} onChange={e=>field('port',Number(e.target.value))}/></label><label>Database<input value={config.database} onChange={e=>field('database',e.target.value)}/></label><label>Username<input value={config.user} onChange={e=>field('user',e.target.value)} autoComplete="off"/></label><label className="span-two">Password<input type="password" value={config.password} placeholder={config.hasPassword?'บันทึกรหัสผ่านไว้แล้ว เว้นว่างเพื่อใช้ค่าเดิม':'รหัสผ่าน MySQL'} onChange={e=>field('password',e.target.value)} autoComplete="new-password"/></label><label className="span-two">SQL สำหรับค้นหา HN<textarea rows={5} value={config.query} onChange={e=>field('query',e.target.value)}/><small>ใช้ SELECT และ ? แทน HN หนึ่งตำแหน่ง • ใช้บัญชีฐานข้อมูลสิทธิอ่านเท่านั้น</small></label><details className="span-two"><summary>ชื่อคอลัมน์ที่ SQL ต้องส่งคืน</summary><p className="sql-help">hn, name, cid, sex, birthDate, rightName, address, allergy, room, authCode</p><small>ใช้ AS ตั้งชื่อคอลัมน์ให้ตรงกับรายการนี้ วันเกิดใช้ YYYY-MM-DD HN ใช้ p.pid รับได้สูงสุด 8 หลัก ถ้าสั้นกว่า 5 หลักจะเติมศูนย์ด้านหน้า และออกเลข Q อัตโนมัติเมื่อกดพิมพ์</small></details><label className="toggle span-two"><input type="checkbox" checked={config.demo} onChange={e=>field('demo',e.target.checked)}/> ใช้ข้อมูลตัวอย่าง (ปิดเพื่อค้นหาจาก MySQL จริง)</label></div>{message&&<div className="success" role="status">{message}</div>}<div className="modal-actions"><button className="outline" onClick={()=>void action('test')} disabled={busy}>ทดสอบการเชื่อมต่อ</button><button className="primary" onClick={()=>void action('save')} disabled={busy}>{busy?'กำลังดำเนินการ...':'บันทึกการตั้งค่า'}</button></div><div className="queue-settings"><h3>จัดการเลขคิว</h3><p>ระบบเริ่ม Q 1 ใหม่ทุกวันตามเวลาไทย หากรีเซ็ตระหว่างวัน เลขคิวอาจซ้ำกับเลขที่ออกไปแล้ว</p><button className="outline" disabled={busy||confirmReset} onClick={()=>{setConfirmReset(true);setMessage('');setError('');}}>รีเซ็ตเลขคิว</button>{confirmReset&&<div className="reset-confirm" role="group" aria-label="ยืนยันรีเซ็ตเลขคิว"><p>ยืนยันรีเซ็ตหรือไม่? คิวถัดไปจะเริ่มที่ Q 1</p><div className="modal-actions"><button className="outline" disabled={busy} onClick={()=>setConfirmReset(false)}>ยกเลิก</button><button className="primary" disabled={busy} onClick={()=>void resetNumber()}>ยืนยันรีเซ็ต</button></div></div>}</div></>}{error&&<div className="error" role="alert">{error}</div>}</section></div>;
}

function QueueDialog({close,saved}:{close:()=>void;saved:()=>void}) {
 const [nextNumber,setNextNumber]=useState('');
 const [last,setLast]=useState<number|null>(null);
 const [confirmNumber,setConfirmNumber]=useState<number|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const value=Number(nextNumber);
 const valid=/^\d+$/.test(nextNumber)&&Number.isSafeInteger(value)&&value>=1&&value<Number.MAX_SAFE_INTEGER;
 useEffect(()=>{let active=true;api('/api/queue').then(d=>{if(active){setLast(d.last);setNextNumber(String(d.nextNumber));}}).catch(e=>{if(active)setError((e as Error).message);});return()=>{active=false;};},[]);
 async function save(){
  if(confirmNumber===null)return;
  setBusy(true);setError('');setMessage('');
  try{const d=await api('/api/queue',{action:'setQueue',nextNumber:confirmNumber,confirm:true});setLast(confirmNumber-1);setMessage(d.message);setConfirmNumber(null);saved();}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <div className="modal-backdrop"><section className="modal queue-modal" role="dialog" aria-modal="true" aria-labelledby="queue-title">
  <div className="modal-header"><span className="icon-tile"><ListOrdered size={22}/></span><div><h2 id="queue-title">แก้ไขเลขคิว</h2><p>กำหนดเลขที่จะออกเมื่อกดพิมพ์ครั้งถัดไป</p></div><button className="icon-button" aria-label="ปิด" disabled={busy} onClick={close}><X/></button></div>
  <p className="queue-current">ตัวนับคิววันนี้: <strong>{last===null?'กำลังโหลด...':`Q ${last}`}</strong></p>
  <label htmlFor="next-queue">เลขคิวถัดไป</label><input id="next-queue" value={nextNumber} onChange={e=>{setNextNumber(e.target.value.replace(/\D/g,''));setConfirmNumber(null);setMessage('');setError('');}} inputMode="numeric" pattern="[0-9]+" disabled={busy} autoFocus/>
  <p className="queue-edit-help">เช่น กรอก 25 เมื่อกดพิมพ์ครั้งถัดไปจะได้ Q 25 จากนั้นนับต่อ 26, 27… ระบบยังเริ่ม Q 1 ใหม่ทุกวันตามเวลาไทย</p>
  <p className="queue-edit-warning">หากเลือกเลขที่เคยออกแล้วในวันนี้ อาจทำให้เลขคิวซ้ำ</p>
  <button className="primary full" disabled={busy||!valid||confirmNumber!==null} onClick={()=>{setConfirmNumber(value);setMessage('');}}>บันทึกเลขคิว</button>
  {confirmNumber!==null&&<div className="reset-confirm" role="group" aria-label="ยืนยันแก้ไขคิว"><p>ให้คิวถัดไปเริ่มที่ Q {confirmNumber} ใช่ไหม?</p><div className="modal-actions"><button className="outline" disabled={busy} onClick={()=>setConfirmNumber(null)}>ยกเลิก</button><button className="primary" disabled={busy} onClick={()=>void save()}>ยืนยันแก้ไขคิว</button></div></div>}
  {error&&<div className="error" role="alert">{error}</div>}{message&&<div className="success" role="status">{message}</div>}
 </section></div>;
}
