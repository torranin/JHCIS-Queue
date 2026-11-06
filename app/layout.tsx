import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'JHCIS Queue • ระบบพิมพ์ใบนำทาง', description: 'ค้นหาผู้ป่วยและพิมพ์ใบนำทาง A5' };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="th"><body>{children}</body></html>; }
