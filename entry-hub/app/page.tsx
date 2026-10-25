import {redirect} from 'next/navigation';
import EntryForm from '@/components/EntryForm';
export default async function Page({searchParams}:{searchParams:Promise<{mode?:string}>}){if((await searchParams).mode==='admin')redirect('/admin');return <EntryForm/>;}
