import {NextRequest,NextResponse} from 'next/server';
import {staff,failure,HttpError} from '@/lib/server';
import {sheetSchema,profileSchema} from '@/lib/sheet';
import {makePDF} from '@/lib/pdf';
export const runtime='nodejs';
export async function GET(req:NextRequest){try{const client=await staff(req);const id=req.nextUrl.searchParams.get('id');if(!id||!/^ENT-\d{14}$/.test(id))throw new HttpError(400,'IDを確認してください');const {data:saved,error}=await client.from('entry_sheets').select('data').eq('entry_id',id).single();if(error)throw new HttpError(400,'エントリーシートを先に保存してください');const s=sheetSchema.parse(saved.data);if(!s.profile_id)throw new HttpError(400,'担当者プロフィールを選択してください');const {data:profile,error:load}=await client.from('author_profiles').select('*').eq('id',s.profile_id).single();if(load)throw new HttpError(400,'担当者プロフィールを確認してください');const p=profileSchema.parse(profile);const bytes=await makePDF(s,{...p,id:profile.id});return new NextResponse(new Uint8Array(bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="entry-sheet-${id.slice(4)}.pdf"`,'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
