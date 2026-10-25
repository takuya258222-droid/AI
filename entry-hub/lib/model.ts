import { z } from 'zod';
export const ages=['20代前半','20代後半','30代前半','30代後半','40代','50代','60代以上'] as const;
export const statuses=['未対応','対応済み','対象外'] as const;
export const qualifications={看護:['正看護師','准看護師','保健師','助産師','認定看護師'],介護:['介護福祉士','実務者研修','初任者研修','認知症介護基礎研修','ケアマネジャー','社会福祉士','無資格']};
export const facilities={看護:['急性期病院','慢性期・療養病院','クリニック','特養','訪問看護(施設)','訪問看護(居宅)','デイサービス','看多機','その他'],介護:['特養','老健','有料(介護付)','住宅型有料','サ高住','グループホーム','デイサービス','訪問介護','病院(看護助手)','その他']};
export const hours=['早出','日勤','遅出','夜勤','夜勤専従','こだわらない'];
export const days=['週2-3日','週3-4日','週4-5日','週5日'] as const;
export const callTimes=['10:00〜12:00','12:00〜14:00','14:00〜16:00','16:00〜18:00','18:00〜20:00','いつでも可'];
export const tourTimes=['午前','午後','夕方以降','終日OK'];
export const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());
export function monthLater(){const [y,m,d]=today().split('-').map(Number);const last=new Date(Date.UTC(y,m+1,0)).getUTCDate();return new Date(Date.UTC(y,m,Math.min(d,last))).toISOString().slice(0,10);}
export const monthsOf=(years:number)=>Math.round(years*12);
export function duration(years:number){const m=monthsOf(years);return `${Math.floor(m/12)}年${m%12?`${m%12}ヶ月`:''}`;}
const date=z.string().refine(v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v&&v>=today(),'今日以降の正しい日付を選択してください');
const optDate=z.union([z.literal(''),date]).default('');
const list=(choices:readonly string[])=>z.array(z.string()).min(1).max(choices.length).refine(a=>new Set(a).size===a.length&&a.every(v=>choices.includes(v)),'選択項目を確認してください');
export const entrySchema=z.object({
 request_id:z.uuid(),full_name:z.string().trim().min(1,'氏名を入力してください').max(80),phone:z.string().transform(s=>s.replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-65248)).replace(/[\sー−-]/g,'')).pipe(z.string().regex(/^0\d{9,10}$/,'電話番号は0から始まる10〜11桁で入力してください')),
 age:z.enum(ages),job_type:z.enum(['看護','介護']),qualifications:z.array(z.string()).min(1).max(7),status_current:z.enum(['在職中','離職中']),recent_emp_type:z.enum(['正社員','派遣・契約','パート']),total_exp:z.number().min(0).max(60).refine(v=>Math.abs(v*12-Math.round(v*12))<0.001,'経験年数は年月単位で入力してください'),
 histories:z.array(z.object({facility:z.string().min(1),years:z.number().min(0).max(60)})).min(1).max(36),earlier_facilities:z.array(z.string()).max(10).default([]),work_hours:list(hours),work_days:z.enum(days),
 call_date_1:date,call_time_1:z.enum(callTimes),call_date_2:optDate,call_time_2:z.union([z.literal(''),z.enum(callTimes)]).default(''),
 tour_date_1:optDate,tour_time_1:z.union([z.literal(''),z.enum(tourTimes)]).default(''),tour_date_2:optDate,tour_time_2:z.union([z.literal(''),z.enum(tourTimes)]).default(''),tour_date_3:optDate,tour_time_3:z.union([z.literal(''),z.enum(tourTimes)]).default(''),
 join_date:date,early_join:z.enum(['前倒し相談可能','前倒し不可']),user_memo:z.string().trim().max(3000).default(''),website:z.literal('').default(''),turnstile_token:z.string().max(4096).default('')
}).superRefine((v,ctx)=>{
 const fail=(path:string,message:string)=>ctx.addIssue({code:'custom',path:[path],message});
 if(!v.qualifications.every(q=>qualifications[v.job_type].includes(q))||new Set(v.qualifications).size!==v.qualifications.length)fail('qualifications','資格を選び直してください');
 if(v.qualifications.includes('無資格')&&v.qualifications.length>1)fail('qualifications','無資格と他の資格は同時選択できません');
 if(v.histories.some(h=>!facilities[v.job_type].includes(h.facility)))fail('histories','施設形態を選び直してください');
 const target=Math.min(monthsOf(v.total_exp),36),sum=v.histories.reduce((s,h)=>s+monthsOf(h.years),0);
 if(sum!==target)fail('histories',`直近の職歴を合計${duration(target/12)}になるよう入力してください`);
 if(target>0&&v.histories.some(h=>monthsOf(h.years)<=0))fail('histories','職歴の期間は1ヶ月以上で入力してください');
 if(v.histories.some(h=>Math.abs(h.years*12-Math.round(h.years*12))>0.001))fail('histories','勤務期間は年月単位で入力してください');
 if(monthsOf(v.total_exp)>36&&!v.earlier_facilities.length)fail('earlier_facilities','それ以前に経験した施設形態を選択してください');
 if(v.earlier_facilities.some(f=>!facilities[v.job_type].includes(f)))fail('earlier_facilities','過去の施設形態を確認してください');
 if(v.work_hours.includes('こだわらない')&&v.work_hours.length>1)fail('work_hours','こだわらないは単独で選択してください');
 for(const [d,t] of [[v.call_date_2,v.call_time_2],[v.tour_date_1,v.tour_time_1],[v.tour_date_2,v.tour_time_2],[v.tour_date_3,v.tour_time_3]])if(Boolean(d)!==Boolean(t))fail('schedule','日付と時間帯をセットで選択してください');
 for(const [d,t] of [[v.call_date_1,v.call_time_1],[v.call_date_2,v.call_time_2]])if(d&&t){const end=t==='いつでも可'?20:Number(t.slice(-5,-3));if(Date.parse(d+`T${String(end).padStart(2,'0')}:00:00+09:00`)<=Date.now())fail('schedule','過ぎた電話希望時間帯は選択できません');}
});
export type EntryInput=z.infer<typeof entrySchema>;
export type Entry={id:string;created_at:string;status:typeof statuses[number];full_name:string;phone:string;age:string;job_type:'看護'|'介護';qualifications:string;status_current:string;recent_emp_type:string;total_exp:number;history_summary:string;work_hours:string;work_days:string;call_date_1:string;call_time_1:string;call_date_2:string;call_time_2:string;tour_date_1:string;tour_time_1:string;tour_date_2:string;tour_time_2:string;tour_date_3:string;tour_time_3:string;join_date:string;early_join:string;user_memo:string;internal_memo:string;updated_at:string;notification_status:string;appointments?:{starts_at:string;ends_at:string;state:string;event_url:string|null}[]};
export function record(v:EntryInput){const {request_id,histories,earlier_facilities,website,turnstile_token,...data}=v;void website;void turnstile_token;const recent=Math.min(monthsOf(v.total_exp),36),earlier=Math.max(0,monthsOf(v.total_exp)-recent);return {...data,qualifications:v.qualifications.join(','),work_hours:v.work_hours.join(','),history_summary:v.total_exp===0?'未経験':`【直近${duration(recent/12)}の就業経験・新しい順】\n`+histories.map((h,i)=>`${i+1}. ${h.facility}：${duration(h.years)}${i===0?'（最新）':''}`).join('\n')+(earlier>0?`\n【それ以前の経験・まとめ】\n${earlier_facilities.join('・')}：計${duration(earlier/12)}`:''),request_id};}
export function recommendation(e:Entry,sender:{company:string;name:string}={company:'株式会社〇〇',name:'〇〇'}){const tours=[1,2,3].map(i=>[e[`tour_date_${i}` as keyof Entry],e[`tour_time_${i}` as keyof Entry]].filter(Boolean).join(' ')).filter(Boolean);return `お世話になっております。\n${sender.company}の${sender.name}です。\n\nこの度、派遣にてぜひ一度ご面談いただきたい求職者様がおりますので、ご紹介いたします。\n簡単ではございますが、以下に詳細を記載いたします。\n\n【候補者情報】\n・年代：${e.age}\n・職種：${e.job_type}\n・資格：${e.qualifications}\n・通算経験：${duration(e.total_exp)}\n・希望勤務：${e.work_days}／${e.work_hours}\n・入職希望日：${e.join_date}（${e.early_join}）\n\n【主なご経験】\n${e.history_summary}\n\n【面談候補日】\n${tours.length?tours.map(t=>'・'+t).join('\n'):'別途調整のうえ、ご案内いたします。'}\n\n本件につきまして、スキルシートを添付しておりますので、併せてご確認いただけますと幸いです。\nご面談の可否やご都合のよい日時について、ご教示いただけますでしょうか。\n\n何卒よろしくお願いいたします。`;}

export function validateCallSlot(e:Pick<Entry,'call_date_1'|'call_date_2'|'call_time_1'|'call_time_2'>,start:string){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+09:00$/.test(start))throw new Error('日本時間の日時を指定してください');const d=start.slice(0,10),h=Number(start.slice(11,13))+Number(start.slice(14,16))/60;if(Date.parse(start)<=Date.now())throw new Error('未来の日時を選択してください');if(![[e.call_date_1,e.call_time_1],[e.call_date_2,e.call_time_2]].some(([date,t])=>{if(date!==d)return false;const low=t==='いつでも可'?10:Number(t.slice(0,2));const high=t==='いつでも可'?20:Number(t.slice(-5,-3));return h>=low&&h+1<=high;}))throw new Error('希望時間帯の中で1時間を選択してください');return new Date(Date.parse(start)+3600000).toISOString();}
