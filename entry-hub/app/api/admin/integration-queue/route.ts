import {after,NextRequest,NextResponse} from 'next/server';
import {body,staff,failure,HttpError} from '@/lib/server';
import {notifyEntry} from '@/lib/notify';
import {queueCalendarEntry,syncQueuedCalendarEntry} from '@/lib/calendar-sync';
const kinds=['mail','calendar','missing'];
export async function GET(req:NextRequest){try{
 const client=await staff(req),kind=req.nextUrl.searchParams.get('kind')||'mail';
 const page=Number(req.nextUrl.searchParams.get('page')||0);
 if(!kinds.includes(kind)||!Number.isSafeInteger(page)||page<0||page>100000)throw new HttpError(400,'表示条件を確認してください');
 const query=kind==='mail'
  ?client.from('notifications').select('entry_id,state,attempts,last_error,lease_until,entries(full_name)',{count:'exact'}).neq('state','sent').order('entry_id')
  :kind==='calendar'
  ?client.from('appointments').select('entry_id,state,attempts,last_error,starts_at,ends_at,entries(full_name)',{count:'exact'}).neq('state','confirmed').order('entry_id')
  :client.from('entries').select('id,full_name,appointments(entry_id)',{count:'exact'}).is('appointments','null').order('id');
 const {data,error,count}=await query.range(page*20,page*20+19);if(error)throw error;
 return NextResponse.json({rows:data||[],total:count||0,page});
 }catch(e){return failure(e);}}
export async function POST(req:NextRequest){try{
 const client=await staff(req),{kind,ids}=await body(req);
 if(!kinds.includes(kind)||!Array.isArray(ids)||ids.length<1||ids.length>20||ids.some(id=>typeof id!=='string'||!/^ENT-\d{14}$/.test(id)))throw new HttpError(400,'再処理する応募を確認してください');
 const unique=[...new Set<string>(ids)];
 const {data,error}=await client.from('entries').select('id').in('id',unique);if(error)throw error;
 if(data?.length!==unique.length)throw new HttpError(404,'応募が見つかりません');
 after(async()=>{
  // Manual retries deliberately bypass the automatic five-attempt ceiling.
  // Mail claims and deterministic calendar event IDs still prevent duplicates.
  for(const id of unique){try{
   if(kind==='mail')await notifyEntry(id);
   else{await queueCalendarEntry(id);await syncQueuedCalendarEntry(id);}
  }catch{console.error('Manual integration retry failed; saved entry retained');}}
 });
 return NextResponse.json({message:`${unique.length}件の再処理を受け付けました。結果は一覧を更新して確認できます。`},{status:202});
 }catch(e){return failure(e);}}
