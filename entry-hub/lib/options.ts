export const ages=['20代前半','20代後半','30代前半','30代後半','40代','50代','60代以上'] as const;
export const statuses=['未対応','対応済み','対象外'] as const;
export const qualifications={看護:['正看護師','准看護師','保健師','助産師','認定看護師'],介護:['介護福祉士','実務者研修','初任者研修','認知症介護基礎研修','ケアマネジャー','社会福祉士','無資格']};
const additionalFacilities=['特別養護老人ホーム','グループホーム','介護付き有料老人ホーム','老人保健施設','サービス付き高齢者向け住宅','住宅型有料老人ホーム','小規模多機能','看護多機能','デイサービス','デイケア'];
export const facilities={看護:['急性期病院','慢性期・療養病院','クリニック','特養','訪問看護(施設)','訪問看護(居宅)','デイサービス','看多機','その他'],介護:['特養','老健','有料(介護付)','住宅型有料','サ高住','グループホーム','デイサービス','訪問介護','病院(看護助手)','その他']};
facilities.看護=Array.from(new Set([...facilities.看護,...additionalFacilities]));facilities.介護=Array.from(new Set([...facilities.介護,...additionalFacilities]));
export const hours=['早出','日勤','遅出','夜勤','夜勤専従','こだわらない'];
export const days=['週1日','週2日','週3日','週4日','週5日','週2-3日','週3-4日','週4-5日','相談して決めたい'] as const;
export const callTimes=[...Array.from({length:20},(_,i)=>`${String(10+Math.floor(i/2)).padStart(2,'0')}:${i%2?'30':'00'}`),'いつでも可'];
export const tourTimes=['午前','午後','夕方以降','終日OK'];
export const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());
export function monthLater(){const [y,m,d]=today().split('-').map(Number);const last=new Date(Date.UTC(y,m+1,0)).getUTCDate();return new Date(Date.UTC(y,m,Math.min(d,last))).toISOString().slice(0,10);}
export const monthsOf=(years:number)=>Math.round(years*12);
export function duration(years:number){const m=monthsOf(years);return `${Math.floor(m/12)}年${m%12?`${m%12}ヶ月`:''}`;}
