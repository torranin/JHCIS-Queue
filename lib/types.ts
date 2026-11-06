export type Patient = { hn:string; name:string; cid:string; sex:string; birthDate:string; rightName:string; address:string; allergy:string; room:string; authCode:string };
export type PrintForm = 'services'|'lines'|'pcu'|'pcu-v1';
export type Config = { host:string; port:number; user:string; password:string; database:string; hospital:string; query:string; demo:boolean; printForm:PrintForm };
export const defaultQuery = `SELECT p.pid AS hn,
 CONCAT(COALESCE(t.titlename, ''), COALESCE(p.fname, ''), ' ', COALESCE(p.lname, '')) AS name,
 p.idcard AS cid, CASE p.sex WHEN '1' THEN 'ชาย' WHEN '2' THEN 'หญิง' ELSE 'ไม่ระบุ' END AS sex,
 p.birth AS birthDate, r.rightname AS rightName,
 CONCAT_WS(' ', NULLIF(p.hnomoi, ''), IF(NULLIF(p.mumoi, '') IS NULL, NULL, CONCAT('หมู่ ', p.mumoi)), NULLIF(p.roadmoi, ''),
 IF(sd.subdistname IS NULL, NULL, CONCAT('ต.', sd.subdistname)), IF(d.distname IS NULL, NULL, CONCAT('อ.', d.distname)), IF(pv.provname IS NULL, NULL, CONCAT('จ.', pv.provname))) AS address,
 p.allergic AS allergy, '' AS room, '' AS authCode
FROM person p
LEFT JOIN ctitle t ON t.titlecode = p.prename
LEFT JOIN cright r ON r.rightcode = p.rightcode
LEFT JOIN cprovince pv ON pv.provcode = p.provcodemoi
LEFT JOIN cdistrict d ON d.provcode = p.provcodemoi AND d.distcode = p.distcodemoi
LEFT JOIN csubdistrict sd ON sd.provcode = p.provcodemoi AND sd.distcode = p.distcodemoi AND sd.subdistcode = p.subdistcodemoi
WHERE p.pid = ? LIMIT 2`;
