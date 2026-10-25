import {test} from 'node:test';
import assert from 'node:assert/strict';
import {entrySchema,record,recommendation,validateCallSlot,Entry} from '../lib/model';
const valid={request_id:'b99bcd89-daa3-4bf8-914e-9ef56508c621',full_name:'テスト 太郎',postal_code:'5500001',phone:'090-1234-5678',age:'30代前半',job_type:'介護',qualifications:['介護福祉士'],status_current:'在職中',recent_emp_type:'正社員',total_exp:10,histories:[{facility:'特養',years:3}],earlier_facilities:['老健'],work_hours:['日勤'],work_days:'週5日',call_date_1:'2099-01-01',call_time_1:'10:00',join_date:'2099-02-01',early_join:'前倒し相談可能'};
test('電話番号正規化・過去分をまとめて全経験保存',()=>{const v=entrySchema.parse(valid);assert.equal(v.phone,'09012345678');assert.match(record(v).history_summary,/老健：計7年/);});
test('全角電話番号を正規化',()=>assert.equal(entrySchema.parse({...valid,postal_code:'5500001',phone:'０９０１２３４５６７８'}).phone,'09012345678'));
test('別職種の資格を拒否',()=>assert.equal(entrySchema.safeParse({...valid,qualifications:['正看護師']}).success,false));
test('無資格と有資格の同時選択拒否',()=>assert.equal(entrySchema.safeParse({...valid,qualifications:['無資格','介護福祉士']}).success,false));
test('経験合計の超過を拒否',()=>assert.equal(entrySchema.safeParse({...valid,total_exp:2}).success,false));
test('未経験0年を許容',()=>assert.equal(entrySchema.safeParse({...valid,total_exp:0,histories:[{facility:'その他',years:0}]}).success,true));
test('任意日程の片側だけを拒否',()=>assert.equal(entrySchema.safeParse({...valid,call_date_2:'2099-01-02'}).success,false));
test('存在しない日付を拒否',()=>assert.equal(entrySchema.safeParse({...valid,join_date:'2099-02-30'}).success,false));
test('honeypotと過去日を拒否',()=>{assert.equal(entrySchema.safeParse({...valid,website:'spam'}).success,false);assert.equal(entrySchema.safeParse({...valid,call_date_1:'2020-01-01'}).success,false);});
test('電話面談は希望時刻の30分',()=>{const e={...valid,call_date_2:'',call_time_2:''};assert.equal(validateCallSlot(e,'2099-01-01T10:00:00+09:00'),'2099-01-01T01:30:00.000Z');assert.throws(()=>validateCallSlot(e,'2099-01-01T10:15:00+09:00'));});
test('法人向けコピーから直接識別情報・自由記述を除外',()=>{const e={...record(entrySchema.parse(valid)),id:'ENT-20990101000000',created_at:'2099-01-01',status:'未対応',internal_memo:'秘密社内情報',user_memo:'本人名と住所がある自由記述',updated_at:'2099-01-01',notification_status:'sent'} as Entry;const text=recommendation(e);for(const privateText of [e.full_name,e.phone,e.id,e.internal_memo,e.user_memo])assert.equal(text.includes(privateText),false);assert.ok(text.includes('介護福祉士'));assert.ok(text.includes('特養'));});

test('30年は直近3年＋過去27年',()=>{const r=record(entrySchema.parse({...valid,total_exp:30}));assert.match(r.history_summary,/直近3年/);assert.match(r.history_summary,/計27年/);});
test('3年未満は全経験を直近欄に記録',()=>{const v=entrySchema.parse({...valid,total_exp:1.5,histories:[{facility:'特養',years:1},{facility:'老健',years:.5}],earlier_facilities:[]});assert.match(record(v).history_summary,/直近1年6ヶ月/);assert.ok(!record(v).history_summary.includes('それ以前'));});
test('直近経験に未入力分がある場合は送信不可',()=>assert.equal(entrySchema.safeParse({...valid,histories:[{facility:'特養',years:2}]}).success,false));
test('過去分の施設形態が未選択なら送信不可',()=>assert.equal(entrySchema.safeParse({...valid,earlier_facilities:[]}).success,false));

test('特養5年を切らず保存、残り25年を集約',()=>{const r=record(entrySchema.parse({...valid,total_exp:30,histories:[{facility:'特養',years:5}]}));assert.match(r.history_summary,/特養：5年/);assert.match(r.history_summary,/計25年/);});
test('病院2年＋施設2年を全期間保存',()=>{assert.equal(entrySchema.safeParse({...valid,histories:[{facility:'病院(看護助手)',years:2},{facility:'小規模多機能',years:2}]}).success,true);});
test('郵便番号の正規化と不正値',()=>{assert.equal(entrySchema.parse({...valid,postal_code:'５５０-０００１'}).postal_code,'5500001');assert.equal(entrySchema.safeParse({...valid,postal_code:'123'}).success,false);});
test('終日は日本時間の翌日0時まで',()=>assert.equal(validateCallSlot({...valid,call_date_2:'',call_time_2:'',call_time_1:'いつでも可'},'2099-01-01T00:00:00+09:00'),'2099-01-01T15:00:00.000Z'));

test('郵便番号は法人向けコピーに含まれない',()=>{const e:Entry={...record(entrySchema.parse(valid)),id:'ENT-20990101000000',created_at:'2099-01-01',status:'未対応',internal_memo:'',updated_at:'2099-01-01',notification_status:'pending'};assert.equal(recommendation(e).includes('5500001'),false);});
