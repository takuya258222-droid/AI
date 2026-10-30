import {after} from 'next/server';
import {notifyEntry} from './notify';
import {queueCalendarEntry,syncQueuedCalendarEntry} from './calendar-sync';

type Schedule=(task:()=>Promise<void>)=>void;
const jobs={mail:notifyEntry,calendar:async(id:string)=>{await queueCalendarEntry(id);await syncQueuedCalendarEntry(id);}};

// The entry and mail queue are already committed. Nothing below may turn that
// successful submission into an error, including failure to schedule the work.
export function scheduleEntryIntegrations(id:string,schedule:Schedule=after,work=jobs){
 try{
  schedule(async()=>{
   const results=await Promise.allSettled([
    Promise.resolve().then(()=>work.mail(id)),
    Promise.resolve().then(()=>work.calendar(id))
   ]);
   if(results.some(result=>result.status==='rejected'))console.error('Entry integration deferred; saved entry retained for retry');
  });
 }catch{console.error('Entry background scheduling failed; saved entry retained for retry');}
}
