import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {NextRequest} from 'next/server';
import {GET} from '../app/api/admin/google/callback/route';
import {POST} from '../app/api/admin/google/start/route';
import {encryptToken,decryptToken,validState,authorizationUrl,assertGoogleIdentity,GOOGLE_SCOPES} from '../lib/google-oauth';
process.env.GOOGLE_TOKEN_ENCRYPTION_KEY=randomBytes(32).toString('base64');
process.env.APP_URL='https://example.com';process.env.GOOGLE_CLIENT_ID='test-client';process.env.GMAIL_FROM='sender@example.com';
test('encrypted refresh tokens detect tampering and incorrect keys',()=>{
 const value=encryptToken('test-secret');assert.equal(decryptToken(value),'test-secret');assert.notEqual(value,encryptToken('test-secret'));
 const parts=value.split('.');const b=Buffer.from(parts[2],'base64url');b[0]^=1;parts[2]=b.toString('base64url');assert.throws(()=>decryptToken(parts.join('.')));
 const old=process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;process.env.GOOGLE_TOKEN_ENCRYPTION_KEY=randomBytes(32).toString('base64');assert.throws(()=>decryptToken(value));process.env.GOOGLE_TOKEN_ENCRYPTION_KEY=old;
});
test('state binding rejects missing, malformed, or different cookies',()=>{const s=randomBytes(32).toString('base64url');assert.equal(validState(s,s),true);assert.equal(validState(s,''),false);assert.equal(validState(s,'x'.repeat(43)),false);assert.equal(validState('x','x'),false);});
test('authorization has PKCE, offline, fixed callback, minimal scopes and no secret',()=>{const u=new URL(authorizationUrl('state','verifier'));assert.equal(u.origin,'https://accounts.google.com');assert.equal(u.searchParams.get('redirect_uri'),'https://example.com/api/admin/google/callback');assert.equal(u.searchParams.get('code_challenge_method'),'S256');assert.equal(u.searchParams.get('access_type'),'offline');assert.equal(u.searchParams.get('client_secret'),null);assert.equal(u.searchParams.get('scope'),GOOGLE_SCOPES.join(' '));});
test('identity and partial scope validation prevent replacing connection with wrong account',()=>{assert.doesNotThrow(()=>assertGoogleIdentity({email:'sender@example.com',email_verified:true},GOOGLE_SCOPES.join(' ')));assert.throws(()=>assertGoogleIdentity({email:'other@example.com',email_verified:true},GOOGLE_SCOPES.join(' ')));assert.throws(()=>assertGoogleIdentity({email:'sender@example.com',email_verified:false},GOOGLE_SCOPES.join(' ')));assert.throws(()=>assertGoogleIdentity({email:'sender@example.com',email_verified:true},'openid email'));});
test('anonymous initiation is rejected and unsolicited callback never exchanges a code',async()=>{
 const res=await POST(new NextRequest('https://example.com/api/admin/google/start',{method:'POST'}));assert.equal(res.status,401);
 const original=fetch;globalThis.fetch=async()=>{throw new Error('Must not access network');};try{const r=await GET(new NextRequest('https://example.com/api/admin/google/callback?code=secret&state=wrong'));assert.equal(r.status,303);assert.equal(r.headers.get('location'),'https://example.com/admin?google=invalid_state');assert.ok(!r.headers.get('location')!.includes('secret'));}finally{globalThis.fetch=original;}
});
test('callback exchanges once, validates identity, encrypts token, and handles failures',async t=>{
 Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://db.example.com',SUPABASE_SERVICE_ROLE_KEY:'test-service',GOOGLE_CLIENT_SECRET:'test-secret'});
 const original=fetch;let consumed=false,saved:Record<string,unknown>|undefined,mode='ok',exchanges=0;const state=randomBytes(32).toString('base64url');
 globalThis.fetch=async(input,init)=>{const url=String(input);if(url.includes('/google_oauth_states')){const present=!consumed;consumed=true;return Response.json(present?[{staff_id:'test-staff',verifier:encryptToken('test-verifier')}]:[]);}
 if(url.includes('/staff'))return Response.json(mode==='removed'?[]:[{user_id:'test-staff'}]);
 if(url.includes('oauth2.googleapis.com')){exchanges++;assert.equal((init?.body as URLSearchParams).get('code_verifier'),'test-verifier');return Response.json(mode==='exchange'?{error:'invalid_client'}:{access_token:'temporary',refresh_token:mode==='no-refresh'?undefined:'refresh-secret',scope:mode==='scope'?'openid email':GOOGLE_SCOPES.join(' ')},{status:mode==='exchange'?400:200});}
 if(url.includes('openidconnect'))return Response.json({email:mode==='wrong'?'other@example.com':'sender@example.com',email_verified:true});
 if(url.includes('/google_connections')){saved=JSON.parse(String(init?.body));return Response.json(null);}
 throw new Error('Unexpected request');};
 const call=(extra='code=authcode')=>GET(new NextRequest('https://example.com/api/admin/google/callback?state='+state+'&'+extra,{headers:{cookie:'__Host-care-google-state='+state}}));
 try{
 await t.test('success stores encrypted token and consumes state against replay',async()=>{const r=await call();assert.equal(r.headers.get('location'),'https://example.com/admin?google=connected');assert.equal(decryptToken(String(saved?.refresh_token)),'refresh-secret');assert.ok(!JSON.stringify(saved).includes('refresh-secret'));assert.equal((await call()).headers.get('location'),'https://example.com/admin?google=invalid_state');assert.equal(exchanges,1);});
 for(const [scenario,expected] of [['wrong','account_mismatch'],['scope','missing_scope'],['exchange','exchange_failed'],['no-refresh','missing_refresh'],['removed','forbidden']])await t.test(scenario,async()=>{mode=scenario;consumed=false;saved=undefined;assert.equal((await call()).headers.get('location'),'https://example.com/admin?google='+expected);assert.equal(saved,undefined);});
 await t.test('consent cancellation consumes state without changing connection',async()=>{mode='ok';consumed=false;saved=undefined;const before=exchanges;assert.equal((await call('error=access_denied')).headers.get('location'),'https://example.com/admin?google=cancelled');assert.equal(exchanges,before);assert.equal(saved,undefined);});
 }finally{globalThis.fetch=original;}
});
