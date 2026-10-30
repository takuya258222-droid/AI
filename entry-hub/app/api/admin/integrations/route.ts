import {googleStatus} from '@/lib/google-oauth';
import {mailConfigured,sendMail} from '@/lib/mail';
import {NextRequest,NextResponse} from 'next/server';
import {randomBytes} from 'node:crypto';
import {staff,body,env,failure,HttpError} from '@/lib/server';
import {calendarConfigured,calendarRequest,calendarToken} from '@/lib/calendar';
export async function GET(req:NextRequest){try{
 const client=await staff(req),status=await googleStatus();
 const [mail,calendar,missing,health]=await Promise.all([
  client.from('notifications').select('*',{count:'exact',head:true}).neq('state','sent'),
  client.from('appointments').select('*',{count:'exact',head:true}).neq('state','confirmed'),
  client.from('entries').select('id,appointments(entry_id)',{count:'exact',head:true}).is('appointments','null'),
  integrationHealth()
 ]);
 if(mail.error||calendar.error||missing.error)throw mail.error||calendar.error||missing.error;
 return NextResponse.json({...status,health,mailConfigured:await mailConfigured(),mailRecipient:process.env.NOTIFY_EMAIL||'t-sugimoto@kikari.co.jp',calendarConfigured:await calendarConfigured(),pendingMail:mail.count||0,pendingCalendar:calendar.count||0,missingCalendar:missing.count||0,turnstileConfigured:Boolean(process.env.TURNSTILE_SECRET_KEY&&process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)});
 }catch(e){return failure(e);}}
export async function POST(req:NextRequest){let testKind='';try{await staff(req);const {kind,start}=await body(req);testKind=kind;
 if(kind==='email'){const result=await sendMail('【接続テスト】CARE ENTRY メール通知の確認',`このメールはエントリー管理アプリの接続確認用です。\n求職者情報は含まれていません。\n送信時刻：${new Date().toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}\n管理画面：${env('APP_URL')}/admin`);return NextResponse.json({message:'送信サービスが受け付けました。受信箱・迷惑メールをご確認ください。',providerId:result.id});}
 if(kind==='calendar'){if(!await calendarConfigured())throw new HttpError(503,'カレンダー連携が未設定です');if(typeof start!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+09:00$/.test(start)||!Number.isFinite(Date.parse(start))||Date.parse(start)<=Date.now())throw new HttpError(400,'未来のテスト日時を指定してください');const end=new Date(Date.parse(start)+1800000).toISOString(),token=await calendarToken(),cid=encodeURIComponent(env('GOOGLE_CALENDAR_ID'));const busy=await calendarRequest(token,'freeBusy',{method:'POST',body:JSON.stringify({timeMin:new Date(start).toISOString(),timeMax:end,items:[{id:env('GOOGLE_CALENDAR_ID')}]})});if(!busy.ok)throw new HttpError(502,'空き時間の取得に失敗しました');const cal=(await busy.json()).calendars?.[env('GOOGLE_CALENDAR_ID')];if(!cal||cal.errors?.length)throw new HttpError(502,'カレンダーへの権限を確認してください');if(cal.busy?.length)throw new HttpError(409,'その時間には既存の予定があります');const id='test'+randomBytes(12).toString('hex');const r=await calendarRequest(token,`calendars/${cid}/events`,{method:'POST',body:JSON.stringify({id,summary:'【接続テスト】CARE ENTRY 電話面談 30分',description:'アプリの動作確認用です。求職者との実際の面談ではありません。確認後、この予定はGoogleカレンダーから削除できます。',start:{dateTime:start,timeZone:'Asia/Tokyo'},end:{dateTime:end,timeZone:'Asia/Tokyo'}})});if(!r.ok)throw new HttpError(502,'テスト予定を登録できませんでした');const event=await r.json();const verified=await calendarRequest(token,`calendars/${cid}/events/${id}`);if(!verified.ok)throw new HttpError(502,'登録後の再取得に失敗しました。カレンダーをご確認ください');await recordIntegrationResult('calendar',true);return NextResponse.json({message:'30分のテスト予定を登録し、Google側から再取得できました。',url:event.htmlLink});}
 throw new HttpError(400,'テストの種類を確認してください');}catch(e){if(testKind==='calendar'&&(!(e instanceof HttpError)||e.status>=500))await recordIntegrationResult('calendar',false);return failure(e);}}
import {integrationHealth,recordIntegrationResult} from '@/lib/integration-health';
