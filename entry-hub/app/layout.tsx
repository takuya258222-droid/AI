import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'CARE ENTRY | お仕事エントリー',description:'看護・介護のお仕事相談。希望に合う働き方を一緒に。',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ja"><body>{children}</body></html>;}
