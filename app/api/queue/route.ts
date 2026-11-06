import { json,sameOrigin } from '@/lib/server';
import { allocateQueue,getQueueStatus,setNextQueue } from '@/lib/queue';
export const runtime='nodejs';
export async function GET() {
  try {return json(await getQueueStatus());}
  catch {return json({error:'อ่านเลขคิวไม่สำเร็จ กรุณาลองอีกครั้ง'},503);}
}
export async function POST(req:Request) {
  if(!await sameOrigin())return json({error:'คำขอไม่ถูกต้อง'},403);
  try {
    const {action,nextNumber,confirm,requestId}=await req.json();
    if(action==='setQueue') {
      if(confirm!==true)return json({error:'กรุณายืนยันการแก้ไขเลขคิว'},400);
      if(!Number.isSafeInteger(nextNumber)||nextNumber<1||nextNumber>=Number.MAX_SAFE_INTEGER)return json({error:'กรุณากรอกเลขคิวเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป'},400);
      await setNextQueue(nextNumber);
      return json({ok:true,message:`บันทึกแล้ว คิวถัดไปคือ Q ${nextNumber}`});
    }
    if(typeof requestId!=='string'||!/^[\da-f-]{36}$/i.test(requestId))return json({error:'คำขอไม่ถูกต้อง'},400);
    return json({number:await allocateQueue(requestId)});
  } catch {return json({error:'ไม่สามารถออกเลขคิวได้ กรุณาลองอีกครั้ง หากยังไม่ได้ให้ตรวจสอบ data/queue.lock'},503);}
}
