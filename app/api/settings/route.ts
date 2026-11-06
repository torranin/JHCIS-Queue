import { authorized,connect,json,login,logout,readConfig,sameOrigin,saveConfig,validateConfig } from '@/lib/server';
import { getQueueStatus,resetQueue,setNextQueue } from '@/lib/queue';
export const runtime='nodejs';
export async function GET() { if(!await authorized()) return json({error:'กรุณาใส่รหัสผ่าน'},401); const c=await readConfig(); return json({...c,password:'',hasPassword:!!c.password}); }
export async function POST(req:Request) {
  if(!await sameOrigin()) return json({error:'คำขอไม่ถูกต้อง'},403);
  try {
    const body=await req.json();
    if(body.action==='login') return await login(String(body.password??''))?json({ok:true}):json({error:'รหัสผ่านไม่ถูกต้อง หรือพยายามเกิน 5 ครั้ง กรุณารอ 5 นาที'},401);
    if(!await authorized()) return json({error:'เซสชันหมดอายุ กรุณาเข้าตั้งค่าใหม่'},401);
    if(body.action==='logout') { await logout(); return json({ok:true}); }
    if(body.action==='queueStatus')return json(await getQueueStatus());
    if(body.action==='setQueue') {
      if(body.confirm!==true)return json({error:'กรุณายืนยันการแก้ไขเลขคิว'},400);
      if(!Number.isSafeInteger(body.nextNumber)||body.nextNumber<1||body.nextNumber>=Number.MAX_SAFE_INTEGER)return json({error:'กรุณากรอกเลขคิวเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป'},400);
      try {await setNextQueue(body.nextNumber);return json({ok:true,message:`บันทึกแล้ว คิวถัดไปคือ Q ${body.nextNumber}`});}
      catch {return json({error:'แก้ไขเลขคิวไม่สำเร็จ กรุณาลองอีกครั้ง หากยังไม่ได้ให้ตรวจสอบ data/queue.lock'},503);}
    }
    if(body.action==='resetQueue') {
      if(body.confirm!==true)return json({error:'กรุณายืนยันการรีเซ็ตเลขคิว'},400);
      try {await resetQueue();return json({ok:true,message:'รีเซ็ตเลขคิวแล้ว คิวถัดไปเริ่มที่ Q 1'});}
      catch {return json({error:'รีเซ็ตเลขคิวไม่สำเร็จ กรุณาลองอีกครั้ง หากยังไม่ได้ให้ตรวจสอบ data/queue.lock'},503);}
    }
    const previous=await readConfig(); const c={...body.config,printForm:body.config.printForm??previous.printForm,password:body.config.password || previous.password}; validateConfig(c);
    if(body.action==='test') { const conn=await connect(c); try { await conn.query('SELECT 1'); } finally { await conn.end(); } return json({ok:true,message:'เชื่อมต่อ MySQL สำเร็จ'}); }
    if(body.action!=='save') return json({error:'คำขอไม่ถูกต้อง'},400);
    await saveConfig(c); return json({ok:true,message:'บันทึกการตั้งค่าแล้ว'});
  } catch { return json({error:'ดำเนินการไม่สำเร็จ ตรวจสอบค่าการเชื่อมต่อ และ SQL (SELECT พร้อม ? หนึ่งตำแหน่ง)'},400); }
}
