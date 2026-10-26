import {googleAccessToken,googleConfigured} from './google-oauth';
import {env,HttpError} from './server';
export async function calendarConfigured(){return Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&process.env.GOOGLE_CALENDAR_ID&&await googleConfigured());}
export const calendarToken=googleAccessToken;
export async function calendarRequest(token:string,path:string,init:RequestInit={}){return fetch(`https://www.googleapis.com/calendar/v3/${path}`,{...init,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...init.headers},signal:AbortSignal.timeout(12000)});}
