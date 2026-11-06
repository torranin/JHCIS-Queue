import { json,readConfig } from '@/lib/server';
export async function GET() { const c=await readConfig(); return json({demo:c.demo,hospital:c.hospital,printForm:c.printForm}); }
