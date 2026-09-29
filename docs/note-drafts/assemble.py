#!/usr/bin/env python3
"""med.py / gen.py + ネタ帳(neta.json) → 「文章・構成案」タブ用のデータ(articles.json / articles.csv / articles.md)を生成"""
import csv, json, sys
from urllib.parse import quote
import med, gen

SP = "/tmp/claude-0/-home-user-AI/9589074f-bb55-5ec9-9773-636ba2f6d233/scratchpad/"
NETA = json.load(open(SP + "neta.json")); LINKS = json.load(open(SP + "notelinks.json"))
BASE = "https://career-line-bot.career-line-bot.workers.dev/l/"
PR = "※本記事にはアフィリエイト広告（PR）を含みます。"
MEMO = "【要実例確認】"

def cols(sheet, row): return {k: (str(v).strip() if v is not None else "") for r, c in NETA[sheet] if r == row for k, v in c.items()}

def link(cta):
    if not cta: return ("", "", "")
    name, label = cta
    return (name, label, LINKS[name])

def bullets(s): return "\n".join(l if l.startswith("✔") else "✔" + l for l in s.splitlines() if l.strip())

def build(a, hook, empathy, close, main, sub, sheetrow, job_key):
    kind_note = "" if a["kind"] == "実例" else "※この記事は、複数の相談事例をもとにした想定ケース（モデルケース）です。実在の特定の方の話ではありません。\n"
    line_url = BASE + a["tag"] + (f"?job={job_key}" if job_key else "")
    h = a["h"]
    outline = "\n".join([
        f"0. PR表記／{'モデルケース注記' if a['kind']!='実例' else '個人特定の配慮'}",
        "1. 冒頭フック（面談での一言）", "2. こんな悩み、ありませんか？（共感）", f"3. {h['sit']}", f"4. {h['real']}",
        "★中間CTA（4と5の間）", f"5. {h['res']}", f"6. {h['one']}", f"7. {h['agent']}", "8. 〆（共感→↓）", "9. CTA（メイン＋サブ＋LINE診断）"])
    def cta_block(title):
        out = [title]
        out.append(f"▶ {main[1]}（{main[0]}）\n{main[2]}")
        if sub[0]: out.append(f"▶ {sub[1]}（{sub[0]}）\n{sub[2]}")
        out.append(f"▶ 自分に合う転職サービスを30秒で診断（LINE・無料）\n{line_url}")
        return "\n".join(out)
    body = "\n\n".join([
        PR + ("\n" + kind_note.strip() if kind_note else ""),
        hook, "■ こんな悩み、ありませんか？\n" + bullets(empathy),
        f"■ {h['sit']}\n{a['sit']}", f"■ {h['real']}\n{a['real']}",
        cta_block("▼ ここまで読んで気になった方は、先にチェックしてみてください"),
        f"■ {h['res']}\n" + "\n".join(f"・{k}：{v}" for k, v in a["result"]) + "\n" + a["result_note"],
        f"■ {h['one']}\n{a['oneyear']}", f"■ {h['agent']}\n{a['agent']}", close, cta_block("↓")])
    return outline, body, line_url

def main():
    rows = []
    for a in med.MED:
        c = cols("医療福祉", a["no"] - 5)
        m, s = link(a["cta_main"]), link(a["cta_sub"])
        if not a["cta_main"]:  # PTなど提携先なし：ダミーを避けLINE診断のみ
            m = ("", "職種に合う転職サービスを診断", "")
        outline, body, url = build(a, c["Q"], c["R"], c["S"], m, s if a["cta_sub"] else ("", "", ""), a["no"] - 5, a["job"] or "")
        if not a["cta_main"]: body = body.replace("▶ 職種に合う転職サービスを診断（）\n\n", "")
        rows.append((a, outline, body, url, m, s, c["T"], "医療福祉", a["no"] - 5))
    for a in gen.GEN:
        c = cols("一般転職", a["row"])
        m, s = link(a["cta"]["main"]), link(a["cta"]["sub"])
        outline, body, url = build(a, c["M"], c["N"], c["O"], m, s, a["row"], "")
        rows.append((a, outline, body, url, m, s, c["P"], "一般転職", a["row"]))
    out = []
    for a, outline, body, url, m, s, orig, sheet, row in rows:
        t = a["thumb"]
        out.append(dict(no=a["no"], sheet=sheet, row=row, kind=a["kind"], titles=a["titles"], orig_title=orig,
                        thumb_worry=t[0], thumb_title=t[1], thumb_appeal=t[2], outline=outline, body=body,
                        checks="\n".join("・" + x for x in a["checks"]),
                        cta_main=f"{m[1]}（{m[0]}）\n{m[2]}" if m[0] else "（提携先なし：LINE診断のみ）",
                        cta_sub=f"{s[1]}（{s[0]}）\n{s[2]}" if s[0] else "", line=url, chars=len(body)))
    json.dump(out, open("articles.json", "w"), ensure_ascii=False, indent=1)
    head = ["公開No","区分","ネタ帳の行","実例/モデルケース","タイトル案1（推奨）","タイトル案2","タイトル案3","サムネ：悩み","サムネ：タイトル","サムネ：訴求","構成案","本文（コピペ用）","文字数","要確認・注意","CTAメイン","CTAサブ","LINE診断リンク","ステータス"]
    with open("articles.csv", "w", newline="") as f:
        w = csv.writer(f); w.writerow(head)
        for o in out:
            w.writerow([o["no"],o["sheet"],o["row"],o["kind"],*o["titles"],o["thumb_worry"],o["thumb_title"],o["thumb_appeal"],o["outline"],o["body"],o["chars"],o["checks"],o["cta_main"],o["cta_sub"],o["line"],"下書き"])
    with open("articles.md", "w") as f:
        f.write("# note 転職体験記 文章・構成案（下書き）\n\n")
        for o in out:
            f.write(f"\n---\n## No.{o['no']}（{o['sheet']} {o['row']}行目・{o['kind']}）\n\n**タイトル案**\n" + "\n".join(f"{i+1}. {t}" for i,t in enumerate(o["titles"])) +
                    f"\n\n**サムネ**：悩み＝{o['thumb_worry']}／タイトル＝{o['thumb_title'].replace(chr(10),' ')}／訴求＝{o['thumb_appeal']}\n\n**構成案**\n```\n{o['outline']}\n```\n\n**本文**\n\n{o['body']}\n\n**要確認**\n{o['checks']}\n")
    print(len(out), "articles;", min(o["chars"] for o in out), "-", max(o["chars"] for o in out), "chars; max cell", max(len(o["body"]) for o in out))
main()
