import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scheduleEntryIntegrations} from '../lib/entry-background';

test('saved submission does not start or wait for external calls before response',async()=>{
 let task:(()=>Promise<void>)|undefined;
 let calls=0,release!:()=>void;
 const blocked=new Promise<void>(resolve=>{release=resolve;});
 scheduleEntryIntegrations('entry',callback=>{task=callback;},{mail:async()=>{calls++;await blocked;},calendar:async()=>{calls++;await blocked;}});
 assert.equal(calls,0);
 assert.ok(task);
 const completion=task();
 await Promise.resolve();
 assert.equal(calls,2);
 release();await completion;
});

test('mail failure does not prevent calendar processing or reject background callback',async()=>{
 let task:(()=>Promise<void>)|undefined,calendarCalled=false;
 scheduleEntryIntegrations('entry',callback=>{task=callback;},{mail:async()=>{throw new Error('offline');},calendar:async()=>{calendarCalled=true;}});
 await assert.doesNotReject(task!);
 assert.equal(calendarCalled,true);
});

test('background scheduler failure cannot turn saved submission into failure',()=>{
 assert.doesNotThrow(()=>scheduleEntryIntegrations('entry',()=>{throw new Error('shutdown');}));
});
