import {NextRequest,NextResponse} from 'next/server';
import {candidateHeaders} from '@/lib/candidate-origin';
export const dynamic='force-dynamic';
export function GET(req:NextRequest){return NextResponse.json({ready:true,siteKey:process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY||''},{headers:candidateHeaders(req.headers.get('origin'))});}
