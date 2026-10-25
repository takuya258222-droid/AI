import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
export function env(name:string){const v=process.env[name];if(!v)throw new Error(`未設定: ${name}`);return v;}
export function db(){return createClient(env('NEXT_PUBLIC_SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});}
export class HttpError extends Error{constructor(public status:number,message:string){super(message);}}
export async function staff(req:NextRequest){const token=req.headers.get('authorization')?.replace(/^Bearer /,'');if(!token)throw new HttpError(401,'社内アカウントでログインしてください');const client=db();const {data,error}=await client.auth.getUser(token);if(error||!data.user)throw new HttpError(401,'ログイン期限が切れました');const {data:member,error:lookup}=await client.from('staff').select('user_id').eq('user_id',data.user.id).maybeSingle();if(lookup||!member)throw new HttpError(403,'管理者権限がありません');return client;}
export function failure(error:unknown){if(error instanceof HttpError)return NextResponse.json({error:error.message},{status:error.status});console.error('Request failed:',error instanceof Error?error.name:'Error');return NextResponse.json({error:'処理に失敗しました。時間をおいて再試行してください。'},{status:500});}
export async function body(req:NextRequest){const raw=await req.text();if(raw.length>24000)throw new HttpError(413,'入力が長すぎます');try{return JSON.parse(raw);}catch{throw new HttpError(400,'入力形式が不正です');}}
