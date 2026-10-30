import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {trackIntegration,integrationHealth} from '../lib/integration-health';
import {GET} from '../app/api/admin/integration-queue/route';
test('integration results track actual success and failure independently',async()=>{
 const original=fetch;Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://db.example.test',SUPABASE_SERVICE_ROLE_KEY:'test'});
 const results:{kind:string;ok:boolean}[]=[];
 globalThis.fetch=async(input,init)=>{if(init?.method==='POST'){results.push(JSON.parse(String(init.body)));return Response.json(null);}const url=new URL(String(input));const kind=url.searchParams.get('kind')?.slice(3);const filtered=results.filter(r=>r.kind===kind&&(url.searchParams.has('ok')?r.ok:true));const result=filtered.at(-1);return Response.json(result?{...result,created_at:'2026-10-30T01:00:00Z'}:null);};
 try{await trackIntegration('mail',async()=>42);await assert.rejects(()=>trackIntegration('calendar',async()=>{throw new Error('disconnected');}));const h=await integrationHealth();assert.equal(h.mail.lastResult,true);assert.equal(h.calendar.lastResult,false);assert.equal(h.calendar.lastSuccessAt,null);assert.equal(h.mail.lastSuccessAt,'2026-10-30T01:00:00Z');}finally{globalThis.fetch=original;}
});
test('unprocessed listing requires staff and includes attempts beyond automatic ceiling on later pages',async()=>{
 assert.equal((await GET(new NextRequest('https://example.test/api/admin/integration-queue'))).status,401);
 const original=fetch;globalThis.fetch=async(input)=>{const url=new URL(String(input));if(url.pathname.includes('/auth/'))return Response.json({id:'staff'});if(url.pathname.endsWith('/staff'))return Response.json([{user_id:'staff'}]);assert.equal(url.searchParams.get('offset'),'20');assert.equal(url.searchParams.get('attempts'),null);return new Response(JSON.stringify([{entry_id:'ENT-20990101000000',state:'failed',attempts:8}]),{headers:{'Content-Type':'application/json','Content-Range':'20-20/21'}});};
 try{const response=await GET(new NextRequest('https://example.test/api/admin/integration-queue?kind=mail&page=1',{headers:{authorization:'Bearer test'}}));assert.equal(response.status,200);const result=await response.json();assert.equal(result.total,21);assert.equal(result.rows[0].attempts,8);}finally{globalThis.fetch=original;}
});
