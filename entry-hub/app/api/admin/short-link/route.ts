import {NextRequest,NextResponse} from 'next/server';
import {staff,env,failure} from '@/lib/server';
export async function POST(req:NextRequest){try{await staff(req);return NextResponse.json({url:`${env('APP_URL')}/e`});}catch(e){return failure(e);}}
