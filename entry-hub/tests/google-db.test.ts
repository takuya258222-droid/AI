import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
test('OAuth tables deny browser roles and consume state once with expiry',async()=>{const db=new PGlite();try{
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);');
 await db.exec(readFileSync(new URL('../supabase/migrations/20261026120523_google_oauth_connect.sql',import.meta.url),'utf8'));
 for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);for(const table of ['google_connections','google_oauth_states'])for(const sql of [`select * from ${table}`,`delete from ${table}`,`update ${table} set ${table==='google_connections'?"email='x'":"verifier='x'"}`,`insert into ${table} default values`])await assert.rejects(()=>db.query(sql));await db.exec('reset role');}
 await db.exec("insert into auth.users values ('11111111-1111-4111-8111-111111111111'); insert into google_oauth_states values ('live','11111111-1111-4111-8111-111111111111','cipher',now()+interval '10 minutes'),('expired','11111111-1111-4111-8111-111111111111','cipher',now()-interval '1 minute');set role service_role;");
 for(const [hash,count] of [['expired',0],['live',1],['live',0]] as const){const result=await db.query('delete from google_oauth_states where state_hash=$1 and expires_at>now() returning staff_id',[hash]);assert.equal(result.rows.length,count);}
 }finally{await db.close();}});
