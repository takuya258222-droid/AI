import {NextRequest,NextResponse} from 'next/server';
import {db,env} from '@/lib/server';
export async function GET(req:NextRequest,{params}:{params:Promise<{code:string}>}){const {code}=await params;if(!/^[A-Za-z0-9_-]{8}$/.test(code))return new NextResponse('リンクが見つかりません',{status:404});const {data,error}=await db().from('short_links').select('code').eq('code',code).maybeSingle();if(error)return new NextResponse('時間をおいて再度お試しください',{status:503});if(!data)return new NextResponse('リンクが見つかりません',{status:404});return NextResponse.redirect(new URL('/',env('APP_URL')),302);}
