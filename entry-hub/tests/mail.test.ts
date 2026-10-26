import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gmailMessage,sendMail,mailConfigured} from '../lib/mail';
test('Gmail MIME keeps Japanese body and rejects injected recipients',()=>{
 const raw=Buffer.from(gmailMessage('sender@gmail.com','staff@example.com','【新規】応募通知','氏名：架空 太郎\n郵便番号：5500001'),'base64url').toString();
 assert.ok(raw.includes('To: staff@example.com\r\n'));assert.ok(raw.includes('Subject: =?UTF-8?B?'));
 assert.equal(Buffer.from(raw.split('\r\n\r\n')[1].replace(/\r\n/g,''),'base64').toString(),'氏名：架空 太郎\n郵便番号：5500001');
 assert.throws(()=>gmailMessage('sender@gmail.com','staff@example.com\r\nBcc: other@example.com','x','y'));
});
test('Gmail uses send API and reports failures without provider fallback',async()=>{
 const original=fetch,old={...process.env};let calls=0;let fail=false;
 Object.assign(process.env,{MAIL_PROVIDER:'gmail',GMAIL_FROM:'sender@gmail.com',GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test',GOOGLE_REFRESH_TOKEN:'test',NOTIFY_EMAIL:'t-sugimoto@kikari.co.jp'});
 globalThis.fetch=async(input,init)=>{calls++;if(String(input).includes('oauth2'))return Response.json({access_token:'mock'});assert.equal(String(input),'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');const raw=Buffer.from(JSON.parse(String(init?.body)).raw,'base64url').toString();assert.ok(raw.includes('To: t-sugimoto@kikari.co.jp'));return Response.json(fail?{error:'denied'}:{id:'mail-1'},{status:fail?403:200});};
 try{assert.equal(await mailConfigured(),true);assert.equal((await sendMail('確認','本文')).id,'mail-1');fail=true;await assert.rejects(()=>sendMail('確認','本文'));assert.equal(calls,4);}finally{globalThis.fetch=original;for(const k of Object.keys(process.env))if(!(k in old))delete process.env[k];Object.assign(process.env,old);}
});
