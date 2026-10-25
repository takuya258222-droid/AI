import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialSheet,privateDataWarnings,sheetSchema} from '../lib/sheet';
import type {Entry} from '../lib/model';
const entry={id:'ENT-20990101000000',full_name:'架空山架空子',postal_code:'5500001',phone:'09000000000',age:'40代',qualifications:'実務者研修',total_exp:30,history_summary:'【直近3年の就業経験・新しい順】\n1. 特養：2年（最新）\n2. 老健：1年\n【それ以前の経験・まとめ】\n有料(介護付)：計27年',work_hours:'日勤',work_days:'週5日',join_date:'2099-02-01',early_join:'前倒し相談可能',user_memo:'架空山架空子の個人メモ',internal_memo:'外部には出さない',tour_date_1:'',tour_date_2:'',tour_date_3:''} as Entry;
test('PDF初期入力：直接識別情報や自由記述を自動転記しない',()=>{const s=initialSheet(entry),text=JSON.stringify(s);for(const value of [entry.full_name,entry.phone,entry.user_memo,entry.internal_memo])assert.ok(!text.includes(value));assert.equal(s.gender,'未確認');assert.equal(s.employment,'未確認');assert.equal(s.careers[0].employment,'未確認');});
test('PDF経歴：直近と過去まとめを全部転記',()=>{const s=initialSheet(entry);assert.equal(s.careers.length,3);assert.equal(s.careers[2].period,'計27年');assert.equal(s.careers[2].detail,'有料(介護付)');});
test('PDF不足情報の編集を保持して検証',()=>{const s=sheetSchema.parse({...initialSheet(entry),gender:'女性',commute:'自転車20分',area:'大阪市',recommendation:'面談で確認した内容'});assert.equal(s.commute,'自転車20分');assert.equal(s.area,'大阪市');});
test('PDFに氏名・電話を手入力した場合は検出',()=>{const s={...initialSheet(entry),recommendation:entry.full_name+' '+entry.phone};assert.deepEqual(privateDataWarnings(entry,s),[entry.full_name,entry.phone]);});
