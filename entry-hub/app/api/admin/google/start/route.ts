import {randomBytes} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {staff,failure,HttpError} from '@/lib/server';
import {appOrigin,authorizationUrl,encryptToken,oauthReady,OAUTH_COOKIE,stateHash} from '@/lib/google-oauth';
export async function POST(req:NextRequest){try{
 const client=await staff(req);
 if(req.headers.get('origin')!==appOrigin())throw new HttpError(403,'管理画面から操作してください');
 if(!oauthReady())throw new HttpError(503,'Google連携の初期設定が必要です');
 const token=req.headers.get('authorization')!.replace(/^Bearer /,'');const {data:{user}}=await client.auth.getUser(token);if(!user)throw new HttpError(401,'再ログインしてください');
 const state=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');
 await client.from('google_oauth_states').delete().lt('expires_at',new Date().toISOString());
 const {error}=await client.from('google_oauth_states').insert({state_hash:stateHash(state),staff_id:user.id,verifier:encryptToken(verifier),expires_at:new Date(Date.now()+10*60000).toISOString()});if(error)throw error;
 const response=NextResponse.json({url:authorizationUrl(state,verifier)});response.cookies.set(OAUTH_COOKIE,state,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:600});return response;
}catch(e){return failure(e);}}
