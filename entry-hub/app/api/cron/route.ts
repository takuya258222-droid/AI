import {NextRequest,NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {env,failure,HttpError} from '@/lib/server';
import {catchUpGoogleIntegrations} from '@/lib/integration-catchup';
export async function GET(req:NextRequest){try{const expected=Buffer.from(`Bearer ${env('CRON_SECRET')}`),actual=Buffer.from(req.headers.get('authorization')||'');if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new HttpError(401,'Unauthorized');return NextResponse.json(await catchUpGoogleIntegrations(10));}catch(e){return failure(e);}}
