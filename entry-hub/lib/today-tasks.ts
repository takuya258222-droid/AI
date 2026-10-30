import type {Entry} from './model';
export type TaskGroup='overdue'|'today'|'unhandled';
export function callWindow(entry:Entry){
 const confirmed=entry.appointments?.find(a=>a.state==='confirmed');
 if(confirmed)return {start:Date.parse(confirmed.starts_at),end:Date.parse(confirmed.ends_at),label:new Date(confirmed.starts_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})};
 const date=entry.call_date_1,time=entry.call_time_1;
 if(time==='いつでも可'){const start=Date.parse(`${date}T00:00:00+09:00`);return {start,end:start+86400000,label:`${date} 終日（いつでも可）`};}
 const [from,to]=time.split('〜');
 const start=Date.parse(`${date}T${from}:00+09:00`);
 return {start,end:to?Date.parse(`${date}T${to}:00+09:00`):start+1800000,label:`${date} ${time}`};
}
export function todayTasks(entries:Entry[],now:number){
 const day=(n:number)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date(n));
 const today=day(now),pending=entries.filter(e=>e.status==='未対応');
 const overdue=pending.filter(e=>callWindow(e).end<=now).sort((a,b)=>callWindow(a).end-callWindow(b).end);
 const due=pending.filter(e=>{const w=callWindow(e);return Number.isFinite(w.start)&&day(w.start)===today&&w.end>now;}).sort((a,b)=>callWindow(a).start-callWindow(b).start);
 const unhandled=[...pending].sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at));
 return {overdue,today:due,unhandled};
}
