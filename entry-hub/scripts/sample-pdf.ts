import {mkdirSync,writeFileSync} from 'node:fs';
import {makePDF} from '../lib/pdf';
import type {Sheet,Profile} from '../lib/sheet';
const sheet:Sheet={inquiry_no:'SAMPLE-1025',headline:'実務者研修修了者のご案内',offer_note:'時給・交通費などの条件はご相談ください',age:'60歳',gender:'女性',qualifications:'実務者研修',employment:'派遣社員',commute:'自転車・片道10分以内',area:'大阪府松原市',join_date:'即日可能',work_days:'週5日',shifts:['○','○','相談','×'],weekdays:['○','○','○','○','○','相談','相談','相談'],careers:[{period:'2年6ヶ月',employment:'パート',detail:'障がい者施設（生活介護）での介護業務'},{period:'1年',employment:'派遣',detail:'有料老人ホームでの介護業務'}],candidate_summary:'【候補者情報】\n・資格：実務者研修\n・通算経験：約3年6ヶ月\n・勤務希望：週5日、早出・日勤\n・入職希望：即日可能\n・通勤希望：自転車10分以内（松原市周辺）',recommendation:'介護現場での実務経験をお持ちの方です。\nこちらは帳票の表示確認用サンプルです。実際の人物評価や勤務条件を保証するものではありません。',tour_dates:'10月28日：終日可能\n10月30日：午後可能\n上記日程での面談調整をご検討いただけますと幸いです。',profile_id:''};
const profile:Profile={id:'3884f950-cd88-4b8f-829f-87002c5ef91a',company:'株式会社キカリ',name:'杉本 卓也',email:'t-sugimoto@kikari.co.jp',phone:'',fax:''};
async function main(){
mkdirSync('output',{recursive:true});
writeFileSync('output/entry-sheet-sample.pdf',await makePDF(sheet,profile));
if(!process.argv.includes('--short'))writeFileSync('output/entry-sheet-long-test.pdf',await makePDF({...sheet,recommendation:'勤務経験や面談で確認した事実を記載します。未確認事項は推測せず担当者に確認します。\n'.repeat(35)},profile));

}
void main();
