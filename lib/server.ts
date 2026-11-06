import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import mysql from 'mysql2/promise';
import { Config, defaultQuery } from './types';
const file = path.join(process.cwd(), 'data', 'settings.json');
const state = globalThis as typeof globalThis & { queueSessions?: Map<string, number>; queueAttempts?: Map<string,{count:number; until:number}> };
const sessions = state.queueSessions ??= new Map();
const attempts = state.queueAttempts ??= new Map();
export async function readConfig(): Promise<Config> {
  try { return {printForm:'services',...JSON.parse(await fs.readFile(file,'utf8'))}; } catch(e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  return { host:'127.0.0.1',port:3306,user:'',password:'',database:'jhcisdb',hospital:'โรงพยาบาลแม่วาง',query:defaultQuery,demo:true,printForm:'services' };
}
export async function saveConfig(config:Config) { await fs.mkdir(path.dirname(file),{recursive:true}); const temp = file+'.tmp'; await fs.writeFile(temp,JSON.stringify(config,null,2),{mode:0o600}); await fs.rename(temp,file); }
export async function authorized() { const token=(await cookies()).get('queue-admin')?.value; return !!token && (sessions.get(token) ?? 0)>Date.now(); }
export async function sameOrigin() { const h=await headers(); const origin=h.get('origin'); return !!origin && new URL(origin).host===h.get('host'); }
export async function login(password:string) {
  const key='local'; const entry=attempts.get(key); if(entry && entry.until>Date.now() && entry.count>=5) return false;
  const a=Buffer.from(password); const b=Buffer.from(process.env.SETTINGS_PASSWORD || '12345678');
  if(a.length!==b.length || !timingSafeEqual(a,b)) { attempts.set(key,{count:entry && entry.until>Date.now()?entry.count+1:1,until:Date.now()+300000}); return false; }
  attempts.delete(key); for(const [k,v] of sessions) if(v<Date.now()) sessions.delete(k);
  const token=randomBytes(32).toString('hex'); sessions.set(token,Date.now()+1800000);
  (await cookies()).set('queue-admin',token,{httpOnly:true,sameSite:'strict',secure:(await headers()).get('x-forwarded-proto')==='https',maxAge:1800,path:'/'}); return true;
}
export async function logout() { const c=await cookies(); const token=c.get('queue-admin')?.value; if(token) sessions.delete(token); c.delete('queue-admin'); }
export function validateConfig(c:Config) {
  if(!['services','lines','pcu','pcu-v1'].includes(c.printForm))throw new Error('กรุณาเลือกแบบฟอร์มที่ต้องการพิมพ์');
  if(!c.host || !c.database || !c.hospital || !Number.isInteger(c.port) || c.port<1 || c.port>65535 || typeof c.demo!=='boolean') throw new Error('กรุณากรอกการเชื่อมต่อให้ครบถ้วน');
  if(!/^\s*SELECT\b/i.test(c.query) || c.query.includes(';') || (c.query.match(/\?/g)||[]).length!==1 || /\b(INTO|OUTFILE|DUMPFILE|FOR\s+UPDATE)\b/i.test(c.query)) throw new Error('ใช้ SELECT คำสั่งเดียวและ ? สำหรับ HN หนึ่งตำแหน่งเท่านั้น');
}
export async function connect(c:Config) { return mysql.createConnection({host:c.host,port:c.port,user:c.user,password:c.password,database:c.database,connectTimeout:5000,multipleStatements:false,dateStrings:true,charset:'utf8mb4'}); }
export const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
