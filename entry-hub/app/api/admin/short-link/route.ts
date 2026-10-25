import {NextRequest,NextResponse} from 'next/server';
import {randomBytes} from 'node:crypto';
import {staff,env,failure} from '@/lib/server';
export async function POST(req:NextRequest){try{const client=await staff(req);const code=randomBytes(6).toString('base64url');const {error}=await client.from('short_links').insert({code});if(error)throw error;return NextResponse.json({url:`${env('APP_URL')}/s/${code}`});}catch(e){return failure(e);}}
