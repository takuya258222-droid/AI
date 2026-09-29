// 設定ファイル(JSON)の読み込みを一箇所に集約
import brand from "../../config/brand.json" with { type: "json" };
import campaign from "../../config/campaign.json" with { type: "json" };
import notes from "../../config/notes.json" with { type: "json" };

export { brand, campaign, notes };

const noteById = new Map([...notes.cases, ...notes.articles].map((n) => [n.id, n]));
export const getNote = (id) => noteById.get(id);
