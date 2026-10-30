import {test} from 'node:test';
import assert from 'node:assert/strict';
import {todayTasks} from '../lib/today-tasks';
import type {Entry} from '../lib/model';
const entry=(id:string,time:string,more:Partial<Entry>={}):Entry=>({id,status:'未対応',created_at:'2026-10-29T00:00:00Z',call_date_1:'2026-10-30',call_time_1:time,...more} as Entry);
test('Japanese day boundary, all-day preference, handled exclusion and call end boundary',()=>{
 const entries=[entry('past','09:00'),entry('next','10:00'),entry('all','いつでも可'),entry('done','09:00',{status:'対応済み'}),entry('excluded','09:00',{status:'対象外'})];
 const result=todayTasks(entries,Date.parse('2026-10-30T09:30:00+09:00'));
 assert.deepEqual(result.overdue.map(e=>e.id),['past']);
 assert.deepEqual(result.today.map(e=>e.id),['all','next']);
 assert.equal(result.unhandled.length,3);
 assert.deepEqual(todayTasks([entries[2]],Date.parse('2026-10-30T15:00:00Z')).overdue.map(e=>e.id),['all']);
});
test('confirmed rescheduled calendar time takes priority over old preference',()=>{
 const e=entry('rescheduled','09:00',{appointments:[{starts_at:'2026-10-31T01:00:00Z',ends_at:'2026-10-31T01:30:00Z',state:'confirmed',event_url:null}]});
 const result=todayTasks([e],Date.parse('2026-10-30T12:00:00+09:00'));
 assert.equal(result.overdue.length,0);assert.equal(result.today.length,0);assert.equal(result.unhandled.length,1);
});
