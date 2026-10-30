import {NextRequest,NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {staff,body,failure,HttpError,env} from '@/lib/server';
import {calendarConfigured,calendarToken,calendarRequest} from '@/lib/calendar';
import {validateCallSlot} from '@/lib/model';
import {recordIntegrationResult} from '@/lib/integration-health';
export async function POST(req:NextRequest){try{const client=await staff(req);if(!await calendarConfigured())throw new HttpError(503,'自動連携は未設定です。「Googleカレンダーで作成」またはICSをご利用ください');const parsed=z.object({id:z.string().regex(/^ENT-\d{14}$/),start:z.string()}).safeParse(await body(req));if(!parsed.success)throw new HttpError(400,'予約内容を確認してください');
 const {id}=parsed.data;let {start}=parsed.data;const {data:e,error}=await client.from('entries').select('*').eq('id',id).single();if(error)throw error;
 const allDay=e.call_time_1==='いつでも可';if(allDay)start=e.call_date_1+'T00:00:00+09:00';let end:string;try{end=validateCallSlot(e,start);}catch(err){throw new HttpError(400,(err as Error).message);}
 const token=await calendarToken();const cid=encodeURIComponent(env('GOOGLE_CALENDAR_ID'));const eventId=createHash('sha256').update(id).digest('hex');
 const {error:reserve}=await client.from('appointments').insert({entry_id:id,starts_at:start,ends_at:end,all_day:allDay});
 if(reserve){const {data:existing}=await client.from('appointments').select('*').eq('entry_id',id).maybeSingle();if(!existing||Date.parse(existing.starts_at)!==Date.parse(start))throw new HttpError(409,'この枠は予約済み、またはこの候補者に別枠が登録済みです');if(existing.state==='confirmed')return NextResponse.json({url:existing.event_url});}
 // 同一IDでGoogle側を先に照会。タイムアウト後の再試行でも二重作成しない。
 let eventResponse=await calendarRequest(token,`calendars/${cid}/events/${eventId}`);let event;
 if(eventResponse.ok){event=await eventResponse.json();if(event.status==='cancelled')throw new HttpError(409,'Google側で削除された予定です。管理者がDBとカレンダーの整合性を確認してください');}
 else if(eventResponse.status===404){
 const busyResponse=await calendarRequest(token,'freeBusy',{method:'POST',body:JSON.stringify({timeMin:new Date(start).toISOString(),timeMax:end,items:[{id:env('GOOGLE_CALENDAR_ID')}]})});if(!busyResponse.ok)throw new HttpError(502,'空き時間の確認に失敗しました。同じ枠で再試行してください');const busy=await busyResponse.json();const cal=busy.calendars?.[env('GOOGLE_CALENDAR_ID')];if(!cal||cal.errors?.length)throw new HttpError(502,'カレンダーの閲覧権限を確認してください');
 if(!allDay&&cal.busy?.length){await client.from('appointments').delete().eq('entry_id',id).eq('state','pending');throw new HttpError(409,'Googleカレンダーの予定と重複しています。別の時間を選択してください');}
 eventResponse=await calendarRequest(token,`calendars/${cid}/events`,{method:'POST',body:JSON.stringify({id:eventId,summary:`${allDay?'電話連絡可能日（時間未定）':'電話面談'} ${id}`,description:`管理画面で詳細を確認：${env('APP_URL')}/admin`,transparency:allDay?'transparent':'opaque',start:allDay?{date:e.call_date_1}:{dateTime:start,timeZone:'Asia/Tokyo'},end:allDay?{date:new Date(Date.parse(e.call_date_1+'T00:00:00Z')+86400000).toISOString().slice(0,10)}:{dateTime:end,timeZone:'Asia/Tokyo'}})});
 if(eventResponse.status===409)eventResponse=await calendarRequest(token,`calendars/${cid}/events/${eventId}`);
 if(!eventResponse.ok)throw new HttpError(502,'登録結果を確認できません。同じ日時で再試行してください');event=await eventResponse.json();
 }else throw new HttpError(502,'カレンダーを確認できません。同じ日時で再試行してください');
 const saved=await client.from('appointments').update({state:'confirmed',event_url:event.htmlLink,synced_at:new Date().toISOString()}).eq('entry_id',id);if(saved.error)throw saved.error;
 await recordIntegrationResult('calendar',true);
 return NextResponse.json({url:event.htmlLink});
 }catch(e){return failure(e);}}
