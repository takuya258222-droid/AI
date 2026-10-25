import {z} from 'zod';
import {Entry,recommendation,duration} from './model';
const short=z.string().max(150);
export const availability=['○','×','相談','未確認'] as const;
export const sheetSchema=z.object({inquiry_no:short,headline:short,offer_note:z.string().max(300),age:short,gender:short,qualifications:short,employment:short,commute:short,area:short,join_date:short,work_days:short,shifts:z.array(z.enum(availability)).length(4),weekdays:z.array(z.enum(availability)).length(8),careers:z.array(z.object({period:z.string().max(40),employment:z.string().max(40),detail:z.string().max(200)})).max(36),candidate_summary:z.string().max(3000),recommendation:z.string().max(3000),tour_dates:z.string().max(500),profile_id:z.union([z.uuid(),z.literal('')]).default('')});
export type Sheet=z.infer<typeof sheetSchema>;
export const profileSchema=z.object({id:z.uuid().optional(),company:z.string().trim().min(1).max(120),name:z.string().trim().min(1).max(60),email:z.email().max(150),phone:z.string().max(40),fax:z.string().max(40)});
export type Profile=z.infer<typeof profileSchema>&{id:string;owner_id?:string};
export function initialSheet(e:Entry):Sheet{const lines=e.history_summary.split('\n').filter(l=>/^\d+\./.test(l)||l.includes('：計'));
 const careers=lines.map((line)=>{const normalized=line.replace(/^\d+\. /,'');const p=normalized.lastIndexOf('：');return {period:p>=0?normalized.slice(p+1):'',employment:'未確認',detail:p>=0?normalized.slice(0,p):normalized};});
 const shift=(s:string):typeof availability[number]=>e.work_hours.includes(s)||e.work_hours.includes('こだわらない')||s==='夜勤'&&e.work_hours.includes('夜勤専従')?'○':'未確認';
 return {inquiry_no:`Q-${e.id.slice(4)}`,headline:`${e.qualifications.replaceAll(',','・')}のご案内`,offer_note:'',age:e.age,gender:'未確認',qualifications:e.qualifications,employment:'未確認',commute:'未確認',area:'未確認',join_date:e.join_date,work_days:e.work_days,shifts:['早出','日勤','遅出','夜勤'].map(shift),weekdays:Array(8).fill('未確認'),careers,candidate_summary:`【候補者情報】\n・年代：${e.age}\n・資格：${e.qualifications}\n・通算経験：${duration(e.total_exp)}\n・希望勤務：${e.work_days}／${e.work_hours}\n・入職希望：${e.join_date}（${e.early_join}）`,recommendation:'',tour_dates:[1,2,3].map(i=>[e[`tour_date_${i}` as keyof Entry],e[`tour_time_${i}` as keyof Entry]].filter(Boolean).join(' ')).filter(Boolean).join('\n')||'別途調整',profile_id:''};}
// 自動入力は構造化項目だけ。氏名・電話・自由記述・社内メモを引き継がない。
export function privateDataWarnings(e:Entry,s:Sheet){const text=JSON.stringify(s);return [e.full_name,e.phone].filter(v=>v&&text.includes(v));}
