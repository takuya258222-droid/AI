import json, re, sys
HEAD=["No","区分","種別","タイトル案1（推奨）","タイトル案2","タイトル案3","サムネ：悩み","サムネ：タイトル","サムネ：訴求","構成案（本文の見出しから自動生成）","本文（約2,000〜2,500字・コピペ用）","文字数（URL除く）","Threads投稿案","Threads コメント欄","要確認・注意","ステータス"]
def outline(body):
    hs=[l.strip() for l in body.splitlines() if l.startswith("■ ")]
    hs=[h[2:] for h in hs if not h.startswith("こんな悩み")]
    return "0. PR表記／導入／共感3つ／★CTA①（LINE診断）\n"+"\n".join(hs)+"\n（3と4の間に★CTA②／最後にCTA③）"
def row(x):
    t=x["thumb"]
    return [x["no"],x["sheet"],x["kind"],*x["titles"],t[0],t[1],t[2],outline(x["body"]),x["body"],x["chars"],x["th_post"],x["th_cmt"],"\n".join("・"+c for c in x["checks"]),"下書き"]
if __name__=="__main__":
    src=sys.argv[1]; sheet=sys.argv[2]; a=int(sys.argv[3]); b=int(sys.argv[4]); head=len(sys.argv)>5
    rows=[x for x in json.load(open(src)) if x["sheet"]==sheet]
    out=([HEAD] if head else [])+[row(x) for x in rows[a:b]]
    print(json.dumps(out,ensure_ascii=False))
