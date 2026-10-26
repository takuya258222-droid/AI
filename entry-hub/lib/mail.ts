import {env,HttpError} from './server';
export function mailConfigured(){return process.env.MAIL_PROVIDER==='gmail'
 ? Boolean(process.env.GMAIL_FROM&&process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&(process.env.GMAIL_REFRESH_TOKEN||process.env.GOOGLE_REFRESH_TOKEN))
 : Boolean(process.env.RESEND_API_KEY&&process.env.EMAIL_FROM);}
function address(value:string){if(!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value))throw new Error('Invalid mail address');return value;}
export function gmailMessage(from:string,to:string,subject:string,text:string){
 const encodedSubject=Array.from(subject).reduce<string[]>((parts,char)=>{if(!parts.length||Buffer.byteLength(parts[parts.length-1]+char)>42)parts.push(char);else parts[parts.length-1]+=char;return parts;},[]).map(part=>`=?UTF-8?B?${Buffer.from(part).toString('base64')}?=`).join('\r\n ');
 return Buffer.from([`From: ${address(from)}`,`To: ${address(to)}`,`Subject: ${encodedSubject}`,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',Buffer.from(text).toString('base64').match(/.{1,76}/g)?.join('\r\n')||''].join('\r\n')).toString('base64url');
}
export async function sendMail(subject:string,text:string,idempotencyKey?:string){
 const to=process.env.NOTIFY_EMAIL||'t-sugimoto@kikari.co.jp';
 if(process.env.MAIL_PROVIDER==='gmail'){
  const auth=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:env('GOOGLE_CLIENT_ID'),client_secret:env('GOOGLE_CLIENT_SECRET'),refresh_token:process.env.GMAIL_REFRESH_TOKEN||env('GOOGLE_REFRESH_TOKEN'),grant_type:'refresh_token'}),signal:AbortSignal.timeout(10000)});
  if(!auth.ok)throw new HttpError(502,'Gmailの認証設定を確認してください');
  const token=(await auth.json()).access_token;if(!token)throw new HttpError(502,'Gmailの認証に失敗しました');
  const response=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({raw:gmailMessage(env('GMAIL_FROM'),to,subject,text)}),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new HttpError(502,'Gmailから送信できませんでした。送信権限とAPI設定を確認してください');
  return (await response.json()) as {id:string};
 }
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env('RESEND_API_KEY')}`,'Content-Type':'application/json',...(idempotencyKey?{'Idempotency-Key':idempotencyKey}:{})},body:JSON.stringify({from:env('EMAIL_FROM'),to:[to],subject,text}),signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new HttpError(502,'通知メールを送信できませんでした');return (await response.json()) as {id:string};
}
