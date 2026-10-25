import {NextRequest,NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {db,env,failure,HttpError} from '@/lib/server';
import {notifyEntry} from '@/lib/notify';
export async function GET(req:NextRequest){try{const expected=Buffer.from(`Bearer ${env('CRON_SECRET')}`),actual=Buffer.from(req.headers.get('authorization')||'');if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new HttpError(401,'Unauthorized');const {data,error}=await db().from('notifications').select('entry_id').neq('state','sent').lt('attempts',5).limit(10);if(error)throw error;for(const row of data)await notifyEntry(row.entry_id);return NextResponse.json({processed:data.length});}catch(e){return failure(e);}}
