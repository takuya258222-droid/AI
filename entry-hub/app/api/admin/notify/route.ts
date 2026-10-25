import {NextRequest,NextResponse} from 'next/server';
import {body,staff,failure,HttpError} from '@/lib/server';
import {notifyEntry} from '@/lib/notify';
export async function POST(req:NextRequest){try{const client=await staff(req);const {id}=await body(req);if(typeof id!=='string'||!/^ENT-\d{14}$/.test(id))throw new HttpError(400,'IDを確認してください');await notifyEntry(id);const {data,error}=await client.from('entries').select('notification_status').eq('id',id).single();if(error)throw error;return NextResponse.json(data);}catch(e){return failure(e);}}
