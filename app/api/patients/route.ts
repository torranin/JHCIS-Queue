import { connect,json,readConfig,sameOrigin } from '@/lib/server';
import type { RowDataPacket } from 'mysql2';
export const runtime='nodejs';
export async function GET(req:Request) {
  return findPatient(new URL(req.url).searchParams.get('hn'));
}
export async function POST(req:Request) {
  if(!await sameOrigin()) return json({error:'คำขอไม่ถูกต้อง'},403);
  try { const body=await req.json(); return findPatient(body.search); }
  catch { return json({error:'คำขอไม่ถูกต้อง'},400); }
}
async function findPatient(value:unknown) {
  const input=typeof value==='string'?value.trim():'';
  if(!/^(?:\d{1,8}|\d{13})$/.test(input)) return json({error:'กรุณากรอก HN 1–8 หลัก หรือเลขบัตรประชาชน 13 หลัก'},400);
  const isIdcard=input.length===13;
  const hn=isIdcard?'00001':input.padStart(5,'0');
  try {
    const config=await readConfig();
    if(config.demo) {
      if(isIdcard?input!=='0000000000000':hn!=='00001') return json({error:'ไม่พบข้อมูลตัวอย่าง ลองใช้ HN 00001 หรือเลขบัตร 0000000000000'},404);
      return json({hospital:config.hospital,printForm:config.printForm,demo:true,patient:{hn,name:'นายทดสอบ ระบบใบนำทาง',cid:'0000000000000',sex:'ชาย',birthDate:'1990-06-26',rightName:'ข้าราชการ กรมบัญชีกลาง',address:'99 หมู่ 1 ต.บ้านกาด อ.แม่วาง จ.เชียงใหม่',allergy:'ข้อมูลตัวอย่าง — ไม่ใช่ประวัติแพ้ยาจริง',room:'จุดซักประวัติผู้ป่วยนอก screen',authCode:'ติดต่อเจ้าหน้าที่'}});
    }
    const conn=await connect(config);
    try {
      let pid=Number(hn);
      if(isIdcard) {
        const [matches]=await conn.execute<RowDataPacket[]>({sql:'SELECT pid FROM person WHERE idcard = ? LIMIT 2',timeout:8000},[input]);
        if(!matches.length) return json({error:'ไม่พบผู้ป่วยที่มีเลขบัตรประชาชนนี้'},404);
        if(matches.length>1) return json({error:'พบเลขบัตรประชาชนซ้ำ กรุณาค้นหาด้วย HN และตรวจสอบข้อมูลก่อนพิมพ์'},409);
        pid=Number(matches[0].pid);
      }
      const [rows]=await conn.execute<RowDataPacket[]>({sql:config.query,timeout:8000},[pid]);
      if(!rows.length) return json({error:'ไม่พบข้อมูลผู้ป่วยที่ค้นหา'},404);
      if(rows.length>1) return json({error:'พบ pid ซ้ำหลายหน่วยบริการ กรุณาระบุ pcucodeperson ใน SQL ก่อนพิมพ์'},409);
      const row=rows[0];
      if(!row.hn || !row.name) return json({error:'SQL ต้องส่งคืน hn และ name กรุณาตรวจสอบชื่อคอลัมน์'},422);
      if(isIdcard && String(row.cid??'').trim()!==input) return json({error:'ข้อมูลเลขบัตรประชาชนไม่ตรงกับผลค้นหา กรุณาตรวจสอบ SQL และหน่วยบริการ'},409);
      const fields=['hn','name','cid','sex','birthDate','rightName','address','allergy','room','authCode'];
      return json({hospital:config.hospital,printForm:config.printForm,demo:false,patient:Object.fromEntries(fields.map(k=>[k,k==='hn'?String(row[k]).padStart(5,'0'):(row[k]==null?'':String(row[k]))]))});
    } finally { await conn.end(); }
  } catch { return json({error:'ไม่สามารถอ่านข้อมูลจาก MySQL ได้ กรุณาตรวจสอบการเชื่อมต่อและ SQL ในการตั้งค่า'},503); }
}
