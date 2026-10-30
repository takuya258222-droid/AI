import {db} from './server';
import {notifyEntry} from './notify';
import {syncQueuedCalendarEntry} from './calendar-sync';

export async function catchUpGoogleIntegrations(limit=20){
 const client=db();
 const [{data:mail,error:mailError},{data:calendar,error:calendarError}]=await Promise.all([
  client.from('notifications').select('entry_id').neq('state','sent').lt('attempts',5).order('entry_id').limit(limit),
  client.from('appointments').select('entry_id').in('state',['pending','failed']).lt('attempts',5).order('starts_at').limit(limit)
 ]);
 if(mailError)throw mailError;if(calendarError)throw calendarError;
 let mailSent=0,calendarSynced=0;
 for(const row of mail||[]){await notifyEntry(row.entry_id);const {data}=await client.from('notifications').select('state').eq('entry_id',row.entry_id).single();if(data?.state==='sent')mailSent++;}
 for(const row of calendar||[]){const result=await syncQueuedCalendarEntry(row.entry_id);if(result.state==='confirmed')calendarSynced++;}
 return {mailSent,calendarSynced};
}
