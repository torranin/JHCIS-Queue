import { promises as fs } from 'node:fs';
import path from 'node:path';

// Allocation and manual resets share the same lock across tabs and processes.
async function withQueueLock<T>(directory:string, operation:()=>Promise<T>):Promise<T> {
  await fs.mkdir(directory,{recursive:true});
  const lock=path.join(directory,'queue.lock');
  let acquired=false;
  for(let i=0;i<100;i++) {
    try {await fs.mkdir(lock);acquired=true;break;}
    catch(e) {if((e as NodeJS.ErrnoException).code!=='EEXIST') throw e;await new Promise(r=>setTimeout(r,50));}
  }
  if(!acquired) throw new Error('Queue is busy');
  try {return await operation();} finally {await fs.rmdir(lock);}
}

function queueDate(now:()=>Date) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(now());
}

export async function resetQueue(directory=path.join(process.cwd(),'data'), now:()=>Date=()=>new Date()) {
  return setNextQueue(1,directory,now);
}

export async function setNextQueue(nextNumber:number, directory=path.join(process.cwd(),'data'), now:()=>Date=()=>new Date()) {
  if(!Number.isSafeInteger(nextNumber)||nextNumber<1||nextNumber>=Number.MAX_SAFE_INTEGER)throw new Error('Invalid queue number');
  return withQueueLock(directory,async()=>{
    const file=path.join(directory,'queue.json');
    await fs.writeFile(file+'.tmp',JSON.stringify({date:queueDate(now),last:nextNumber-1,requests:{}}),{mode:0o600});
    await fs.rename(file+'.tmp',file);
  });
}

export async function getQueueStatus(directory=path.join(process.cwd(),'data'), now:()=>Date=()=>new Date()) {
  return withQueueLock(directory,async()=>{
    const date=queueDate(now);
    let state:{date?:string;last:number}={date,last:0};
    try {state=JSON.parse(await fs.readFile(path.join(directory,'queue.json'),'utf8'));}
    catch(e) {if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
    if(!Number.isSafeInteger(state.last)||state.last<0)throw new Error('Invalid queue state');
    const last=state.date && state.date!==date?0:state.last;
    return {date,last,nextNumber:last+1};
  });
}

export async function allocateQueue(requestId:string, directory=path.join(process.cwd(),'data'), now:()=>Date=()=>new Date()) {
  if(!/^[\da-f-]{36}$/i.test(requestId)) throw new Error('Invalid request ID');
  return withQueueLock(directory,async()=>{
    const file=path.join(directory,'queue.json');
    // Read the date inside the lock so requests waiting over midnight use the new day.
    const date=queueDate(now);
    let state:{date?:string;last:number;requests:Record<string,number>}={date,last:0,requests:{}};
    try {state=JSON.parse(await fs.readFile(file,'utf8'));} catch(e) {if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
    if(!Number.isSafeInteger(state.last)||state.last<0||!state.requests)throw new Error('Invalid queue state');
    // Keep today's existing counter when upgrading a file that has no date yet.
    if(state.date && state.date!==date)state={date,last:0,requests:{}};
    state.date=date;
    const number=state.requests[requestId] ?? state.last+1;
    if(!Number.isSafeInteger(number))throw new Error('Queue limit reached');
    state.last=Math.max(state.last,number);
    state.requests[requestId]=number;
    const temp=file+'.tmp';
    await fs.writeFile(temp,JSON.stringify(state),{mode:0o600});
    await fs.rename(temp,file);
    return number;
  });
}
