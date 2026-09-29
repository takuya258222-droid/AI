#!/usr/bin/env python3
"""noteマガジン「転職体験記」の型で、1記事を組み立てる（約2,000〜2,400字）。
既存の med.py / gen.py（基本情報）＋ N（拡充用の追加項目）＋ ネタ帳（フック・共感・〆）から生成。"""
import json, re

SP = "/tmp/claude-0/-home-user-AI/9589074f-bb55-5ec9-9773-636ba2f6d233/scratchpad/"
NETA = json.load(open(SP + "neta.json"))
LINKS = json.load(open(SP + "notelinks.json"))
BASE = "https://career-line-bot.career-line-bot.workers.dev/l/"

OUTLINE_MED = """【構成】noteマガジン「転職体験記」の型（見出し番号つき）
0. PR表記（冒頭）／モデルケースは想定事例である旨も同じ場所に
導入：面談での一言（フック）＋共感の3つ
1. プロフィールと、動いた理由
2. 条件を、並べてみる（数字）
3. 転職活動のリアル
★軽い中間CTA（3と4の間に1回だけ）
4. 入ってからの1日（時間割・想定）
5. 「聞いていなかった」となりやすい3つ
6. 1年後のリアル（想定）
7. この事例から持ち帰れる5つ
8. 面談・面接で、必ず聞く5つ
9. ○○の方が求人を見るなら（PR）：読まなくていい人／登録の流れ3ステップ／リンク＋LINE診断
まとめ（3行）／出典・注記／次回予告＋マガジンフォロー導線"""

OUTLINE_GEN = OUTLINE_MED.replace("4. 入ってからの1日（時間割・想定）", "4. 選考の流れ（応募から内定まで・想定）").replace("8. 面談・面接で、必ず聞く5つ", "8. 選考で見られたポイント5つ")


def neta(sheet, row):
    out = {}
    for r, c in NETA[sheet]:
        if r == row:
            out = {k: (str(v).strip() if v is not None else "") for k, v in c.items()}
    return out


def bullets(s):
    return "\n".join(l if l.startswith("✔") else "✔" + l for l in s.splitlines() if l.strip())


def cta_lines(pairs):
    out = []
    for name, label, url in pairs:
        out.append(f"▶ {label}（{name}）\n{url}" if name else f"▶ {label}\n{url}")
    return "\n".join(out)


def prefix_of(title):
    t = re.sub(r"^【[^】]*】", "", title.split("＜")[0]).strip()
    return t


def render(a, n, sheet_name, sheet_row, next_title=None):
    """a: med.py / gen.py の1件、n: 追加項目"""
    is_gen = sheet_name == "一般転職"
    c = neta(sheet_name, sheet_row)
    hook, emp, close = (c["M"], c["N"], c["O"]) if is_gen else (c["Q"], c["R"], c["S"])
    job = a.get("job") or ""
    tag = a["tag"]
    line_url = BASE + tag + (f"?job={job}" if job else "")
    main = a["cta"]["main"] if is_gen else a.get("cta_main")
    sub = a["cta"]["sub"] if is_gen else a.get("cta_sub")
    main_p = (main[0], main[1], LINKS[main[0]]) if main else None
    sub_p = (sub[0], sub[1], LINKS[sub[0]]) if sub else None
    line_short = ("LINE診断", "自分に合う転職サービスを30秒で診断（無料）", line_url)
    line_full = ("", "自分に合う転職サービスを30秒で診断（LINE・無料）", line_url)
    names = [p[0] for p in (main_p, sub_p) if p]
    pr_note = ""
    if "sXars" in names:
        pr_note += "※sXarsは対象エリアがあるため、公式サイトで確認してください。\n"
    if "Agent Projin" in names:
        pr_note += "※Agent Projinは関東エリア向けです。公式サイトで確認してください。\n"

    model_note = "" if a["kind"] == "実例" else "\n※この記事は、複数の相談事例をもとにした想定ケース（モデルケース）です。実在の特定の方の話ではありません。"
    q_title = "選考で見られたポイント5つ" if is_gen else "面談・面接で、必ず聞く5つ"
    parts = []
    parts.append("※本記事にはアフィリエイト広告（PR）を含みます（第9章に明記）。" + model_note)
    parts.append(hook)
    parts.append("■ こんな悩み、ありませんか？\n" + bullets(emp))
    parts.append(f"この記事でわかるのは、①{n['learn1']}、②入ってから「聞いていなかった」となりやすい3つ、③{q_title.replace('、必ず','')}、の3点です。")
    # CTA① 早め・軽く（LINE診断だけに絞る）
    parts.append("▼ 先に結論だけ知りたい方へ（PR）\nLINE診断（5問・30秒）で、職種・年代・年収・重視すること・時期から、条件に合うサービスを2つに絞れます。\n" + cta_lines([line_short]))
    parts.append("■ 1. プロフィールと、動いた理由\n" + a["sit"])
    res = "\n".join(f"・{k}：{v}" for k, v in a["result"])
    parts.append("■ 2. 条件を、並べてみる\n" + res + "\n※" + n.get("rnote", a["result_note"]).lstrip("※"))
    parts.append("■ 3. " + a["h"]["real"] + "\n" + a["real"])
    # CTA② 中盤（今の条件で求人が出るか）
    mid = [p for p in (main_p, line_short) if p]
    parts.append("▼ 同じ条件で、いま求人が出るか確かめたい方は、こちらから（PR）\n" + cta_lines(mid))
    ep_title, ep_lines = n["ep"]
    parts.append(f"■ 4. {ep_title}\n" + "\n".join(ep_lines))
    parts.append("■ 5. 入ってから「聞いていなかった」となりやすい3つ\n" + "\n".join(f"{i+1}. {t}" for i, t in enumerate(n["miss"])))
    parts.append("■ 6. 1年後のリアル\n" + n["after"])
    parts.append("■ 7. この事例から持ち帰れる5つ\n" + a["agent"] + "\n" + "\n".join(f"{i+1}. {t}" for i, t in enumerate(n["take"])))
    parts.append(f"■ 8. {q_title}\n" + "\n".join(f"{i+1}. {t}" for i, t in enumerate(n["q"])))
    who_no, who_yes = n["who"]
    fast = [p for p in (main_p, sub_p) if p]
    pr = [f"■ 9. {n['prt']}（PR）", close,
          f"【読まなくていい人】{who_no}", f"【読んでほしい人】{who_yes}",
          "〈登録の流れ〉", f"① {n['step1']}", f"② {n['step2']}", "③ 出てきた求人を、第8章の5つで確認する",
          "登録・相談に費用はかかりません（詳細は各社の公式サイトで確認してください）。",
          "電話が不安な方は、登録時の備考欄に「連絡はメール希望」など、希望の連絡方法を書いておくと安心です。"]
    if pr_note:
        pr.append(pr_note.strip())
    if fast:
        pr.append("〈どちらから動く？〉")
        pr.append("今週中に動きたい方 → 専門のエージェントに、条件をそのまま伝える\n" + cta_lines(fast))
        pr.append("まず条件を整理したい方 → LINE診断で2つに絞る（30秒）\n" + cta_lines([line_full]))
    else:
        pr.append("〈まずはここから〉\nこの職種に強い提携先は、診断で条件から絞り込みます。まず条件を整理したい方は、こちらから（30秒）\n" + cta_lines([line_full]))
    parts.append("\n".join(pr))
    parts.append("■ まとめ\n" + "\n".join("・" + s for s in n["sum"]) + "\n迷ったら、まず30秒の診断から。\n" + cta_lines([line_full]))
    if a["kind"] == "実例":
        note = "面談記録をもとに、年齢・地域・施設名（会社名）を加工し、一部を再構成しています。時間割・エピソードは想定を含みます。数字は目安で、実際の条件・勤務時間で変わります。"
    else:
        note = "この記事は想定事例です。時間割・エピソードを含め、相談事例をもとに設定した例で、実在の特定の方の話ではありません。実際の年収・条件は、会社・評価・経験によって変わります。"
    parts.append("■ 出典・注記\n" + note)
    if next_title:
        parts.append(f"次回は、「{prefix_of(next_title)}」の話を書きます。マガジンをフォローしておくと届きます。")
    body = "\n\n".join(parts)
    # Threads告知（投稿本文＋コメント欄）
    th_post = "【PR】" + a["thumb"][0] + "\n\n" + a["thumb"][1].replace("\n", " ") + "\n" + a["thumb"][2] + "\n\n" + prefix_of(a["titles"][0]) + "の話を、数字ごとnoteに書きました。\n▼ コメント欄へ"
    th_cmt = "noteはこちら → 【noteのURL】\n（PR）30秒診断（LINE・無料）→ " + line_url + ("\n（PR）" + main_p[1] + "（" + main_p[0] + "）→ " + main_p[2] if main_p else "")
    return body, line_url, th_post, th_cmt


def n_chars(s):
    return len(re.sub(r"https?://\S+", "", s))
