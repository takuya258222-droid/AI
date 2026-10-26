import {NextRequest,NextResponse} from 'next/server';
import {db,env,HttpError} from '@/lib/server';
import {appOrigin,assertGoogleIdentity,callbackUrl,decryptToken,encryptToken,OAUTH_COOKIE,stateHash,validState} from '@/lib/google-oauth';
function finish(result:string){const response=NextResponse.redirect(appOrigin()+'/admin?google='+result,303);response.cookies.set(OAUTH_COOKIE,'',{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:0});response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy','no-referrer');return response;}
export async function GET(req:NextRequest){try{
 const state=req.nextUrl.searchParams.get('state')||'',cookie=req.cookies.get(OAUTH_COOKIE)?.value||'';
 if(!validState(state,cookie))return finish('invalid_state');
 const client=db();const {data:pending,error}=await client.from('google_oauth_states').delete().eq('state_hash',stateHash(state)).gt('expires_at',new Date().toISOString()).select('staff_id,verifier').maybeSingle();
 if(error||!pending)return finish('invalid_state');
 const {data:member,error:memberError}=await client.from('staff').select('user_id').eq('user_id',pending.staff_id).maybeSingle();if(memberError||!member)return finish('forbidden');
 if(req.nextUrl.searchParams.has('error'))return finish('cancelled');
 const code=req.nextUrl.searchParams.get('code');if(!code||code.length>4096)return finish('exchange_failed');
 const exchange=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:env('GOOGLE_CLIENT_ID'),client_secret:env('GOOGLE_CLIENT_SECRET'),code,code_verifier:decryptToken(pending.verifier),redirect_uri:callbackUrl(),grant_type:'authorization_code'}),signal:AbortSignal.timeout(15000)});
 if(!exchange.ok)return finish('exchange_failed');const tokens=await exchange.json();if(!tokens.access_token||!tokens.refresh_token)return finish('missing_refresh');
 const identity=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${tokens.access_token}`},signal:AbortSignal.timeout(10000)});if(!identity.ok)return finish('identity_failed');const profile=await identity.json();assertGoogleIdentity(profile,tokens.scope||'');
 const lifetime=Number(tokens.refresh_token_expires_in);const {error:save}=await client.from('google_connections').upsert({id:'primary',email:profile.email,client_id:env('GOOGLE_CLIENT_ID'),refresh_token:encryptToken(tokens.refresh_token),connected_by:pending.staff_id,connected_at:new Date().toISOString(),expires_at:Number.isFinite(lifetime)&&lifetime>0?new Date(Date.now()+lifetime*1000).toISOString():null});if(save)return finish('save_failed');
 return finish('connected');
}catch(e){return finish(e instanceof HttpError&&['account_mismatch','missing_scope'].includes(e.message)?e.message:'failed');}}
