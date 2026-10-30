import {createHash} from 'node:crypto';
import {calendarConfigured,calendarRequest,calendarToken} from './calendar';
import {db,env,HttpError} from './server';

type Appointment={entry_id:string;starts_at:string;ends_at:string;all_day:boolean;state:string;attempts:number;event_url:string|null};
const japanDate=(value:string)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date(value));

function preferredSlot(entry:{call_date_1:string;call_time_1:string}){
 const allDay=entry.call_time_1==='いつでも可';
 const start=allDay?`${entry.call_date_1}T00:00:00+09:00`:`${entry.call_date_1}T${entry.call_time_1}:00+09:00`;
 const endsAt=new Date(Date.parse(start)+(allDay?86400000:1800000)).toISOString();
 return {start,endsAt,allDay};
}

export async function queueCalendarEntry(id:string){
 const client=db();
 const {data:existing,error:lookup}=await client.from('appointments').select('entry_id').eq('entry_id',id).maybeSingle();
 if(lookup)throw lookup;if(existing)return;
 const {data:entry,error}=await client.from('entries').select('call_date_1,call_time_1').eq('id',id).single();
 if(error)throw error;const slot=preferredSlot(entry);
 const saved=await client.from('appointments').insert({entry_id:id,starts_at:slot.start,ends_at:slot.endsAt,all_day:slot.allDay,state:'pending'});
 if(saved.error&&saved.error.code!=='23505')throw saved.error;
}

async function mark(appointment:Appointment,state:string,lastError:string|null,eventUrl:string|null=null){
 const saved=await db().from('appointments').update({state,last_error:lastError,event_url:eventUrl,synced_at:state==='confirmed'?new Date().toISOString():null,attempts:appointment.attempts+1}).eq('entry_id',appointment.entry_id);
 if(saved.error)throw saved.error;
}

export async function syncQueuedCalendarEntry(id:string){
 const client=db();const {data:a,error}=await client.from('appointments').select('*').eq('entry_id',id).single();if(error)throw error;
 const appointment=a as Appointment;if(appointment.state==='confirmed')return {state:'confirmed',url:appointment.event_url};
 if(Date.parse(appointment.ends_at)<=Date.now()){await mark(appointment,'expired','希望日時を過ぎたため自動登録しませんでした');return {state:'expired',url:null};}
 try{
  if(!await calendarConfigured())throw new HttpError(503,'Googleカレンダーが未連携です');
  const token=await calendarToken(),cid=encodeURIComponent(env('GOOGLE_CALENDAR_ID')),eventId=createHash('sha256').update(id).digest('hex');
  let response=await calendarRequest(token,`calendars/${cid}/events/${eventId}`);let event;
  if(response.ok)event=await response.json();
  else if(response.status===404){
   const busyResponse=await calendarRequest(token,'freeBusy',{method:'POST',body:JSON.stringify({timeMin:new Date(appointment.starts_at).toISOString(),timeMax:new Date(appointment.ends_at).toISOString(),items:[{id:env('GOOGLE_CALENDAR_ID')}]})});
   if(!busyResponse.ok)throw new Error('空き時間を確認できませんでした');const busy=await busyResponse.json();const cal=busy.calendars?.[env('GOOGLE_CALENDAR_ID')];
   if(!cal||cal.errors?.length)throw new Error('カレンダーの権限を確認できませんでした');
   if(!appointment.all_day&&cal.busy?.length){await mark(appointment,'conflict','既存の予定と重複しています');return {state:'conflict',url:null};}
   response=await calendarRequest(token,`calendars/${cid}/events`,{method:'POST',body:JSON.stringify({id:eventId,summary:`${appointment.all_day?'電話連絡可能日（時間未定）':'電話面談'} ${id}`,description:`管理画面で詳細を確認：${env('APP_URL')}/admin`,transparency:appointment.all_day?'transparent':'opaque',start:appointment.all_day?{date:japanDate(appointment.starts_at)}:{dateTime:appointment.starts_at,timeZone:'Asia/Tokyo'},end:appointment.all_day?{date:japanDate(appointment.ends_at)}:{dateTime:appointment.ends_at,timeZone:'Asia/Tokyo'}})});
   if(response.status===409)response=await calendarRequest(token,`calendars/${cid}/events/${eventId}`);if(!response.ok)throw new Error('予定を登録できませんでした');event=await response.json();
  }else throw new Error('カレンダーを確認できませんでした');
  await mark(appointment,'confirmed',null,event.htmlLink||null);return {state:'confirmed',url:event.htmlLink||null};
 }catch(error){await mark(appointment,'failed',error instanceof Error?error.message:'カレンダー連携に失敗しました');return {state:'failed',url:null};}
}
