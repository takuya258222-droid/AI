import { NextRequest,NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';
import { body,db,env,failure,HttpError } from '@/lib/server';
import {entrySchema,record} from '@/lib/model';
import {scheduleEntryIntegrations} from '@/lib/entry-background';
import {candidateOrigin,candidateHeaders} from '@/lib/candidate-origin';
export function OPTIONS(req:NextRequest){return new NextResponse(null,{status:204,headers:{...candidateHeaders(req.headers.get('origin')),'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'}});}
export async function POST(req:NextRequest){const response=await submit(req);for(const [key,value] of Object.entries(candidateHeaders(req.headers.get('origin'))))response.headers.set(key,value);return response;}
export const runtime='nodejs';
async function submit(req:NextRequest){try{
 const data=entrySchema.safeParse(await body(req));if(!data.success)return NextResponse.json({error:data.error.issues.map(i=>i.message).join('／')},{status:400});
 if(process.env.NODE_ENV==='production'||process.env.TURNSTILE_SECRET_KEY){const res=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:env('TURNSTILE_SECRET_KEY'),response:data.data.turnstile_token}),signal:AbortSignal.timeout(10000)});const check=await res.json();if(!check.success||![new URL(env('APP_URL')).hostname,new URL(candidateOrigin).hostname].includes(check.hostname))throw new HttpError(400,'セキュリティ確認をやり直してください');}
 const rate_key=createHmac('sha256',env('RATE_LIMIT_SALT')).update(data.data.phone).digest('hex');
 const {data:id,error}=await db().rpc('submit_entry',{payload:record(data.data),rate_key});if(error){if(error.message.includes('RATE_LIMIT'))throw new HttpError(429,'送信回数が多いため、しばらくお待ちください');throw error;}
 scheduleEntryIntegrations(id);
 return NextResponse.json({id},{status:201});
 }catch(e){return failure(e);}}
