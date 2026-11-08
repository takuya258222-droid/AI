#!/usr/bin/env python3
"""Build app_data.json from Google Sheets JSON exports.

Usage: python build_app_data.py <sheets_dir> <output_path>
  sheets_dir: directory containing anken.json, kaigo.json, kango.json
  output_path: where to write app_data.json
"""
import json
import re
import os
import sys
from datetime import datetime

TARGET_PREFS = {"京都府", "大阪府", "滋賀県", "奈良県", "兵庫県"}

TIME_PATTERN = re.compile(r'\d{1,2}[：:]\d{2}\s*[～~〜ー\-－]\s*\d{1,2}[：:]\d{2}')
TIME_EXTRACT = re.compile(r'(\d{1,2})[：:](\d{2})\s*[～~〜ー\-－]\s*(\d{1,2})[：:](\d{2})')
SHIFT_LABELS = ["早番", "遅番", "日勤", "夜勤", "早出", "遅出", "準夜", "深夜"]
CONTACT_PATTERN = re.compile(r'【顧客担当者】\s*(.+?)(?:\n|$)')
CONTACT_PATTERN2 = re.compile(r'【担当者】\s*(.+?)(?:\n|$)')

CITY_RE = re.compile(r'(京都府|大阪府|滋賀県|奈良県|兵庫県)(.+?[市区町村郡])')

KNOWN_FACILITY_ADDRS = {
    "エリーネス須磨": "兵庫県神戸市須磨区行幸町3-1-12",
    "淳風おおさか": "大阪府大阪市西成区天下茶屋北1-6-16",
    "ケアハイツいたみ": "兵庫県伊丹市北伊丹5-68",
    "天神の杜": "京都府京都市北区紫野雲林院町35",
    "山科積慶園": "京都府京都市山科区東野竹田6",
}


def classify_shifts(text):
    if not text:
        return []
    text = str(text)
    shifts = set()
    if "早出" in text or "早番" in text:
        shifts.add("早出")
    if "日勤" in text:
        shifts.add("日勤")
    if "遅出" in text or "遅番" in text:
        shifts.add("遅出")
    if "夜勤" in text or "準夜" in text or "深夜" in text:
        shifts.add("夜勤")
    for m in TIME_EXTRACT.finditer(text):
        sh, sm, eh, em = int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4))
        start = sh * 60 + sm
        end = eh * 60 + em
        if end <= start:
            shifts.add("夜勤")
        elif start < 480:
            shifts.add("早出")
        elif start < 600:
            shifts.add("日勤")
        elif start < 780:
            shifts.add("遅出")
        else:
            shifts.add("夜勤")
    return sorted(shifts)


def classify_facility(name, order):
    text = (name or '') + ' ' + (order or '')
    if '特別養護老人ホーム' in text or '特養' in text:
        return '特養'
    if '介護老人保健施設' in text or '老健' in text:
        return '老健'
    if '介護医療院' in text:
        return '病院'
    if '有料老人ホーム' in text:
        return '有料'
    if 'グループホーム' in text or '認知症対応型' in text:
        return 'GH'
    if 'サービス付き高齢者向け住宅' in text or 'サ高住' in text:
        return 'サ高住'
    if '小規模多機能' in text or '看護小規模多機能' in text:
        return '小多機'
    if 'デイサービス' in text or 'デイケア' in text or '通所介護' in text or '通所リハ' in text:
        return 'デイ'
    if 'ショートステイ' in text or '短期入所' in text:
        return 'ショート'
    if '訪問看護' in text:
        return '訪問看護'
    if '訪問介護' in text or 'ヘルパー' in text:
        return '訪問介護'
    if '病院' in text or 'クリニック' in text or '診療所' in text or '医院' in text:
        return '病院'
    if '居宅介護支援' in text or 'ケアプランセンター' in text or '地域包括' in text:
        return '居宅'
    if 'ケアハウス' in text or '軽費老人ホーム' in text or '養護老人ホーム' in text:
        return 'ケアハウス'
    return 'その他'


def extract_pref(address):
    if not address:
        return ""
    for p in TARGET_PREFS:
        if str(address).startswith(p):
            return p
    return ""


def is_addr_valid(addr):
    if not addr:
        return False
    addr = addr.strip()
    if len(addr) <= 4:
        return False
    return bool(CITY_RE.match(addr))


def clean_address(addr, facility_name):
    if not addr:
        return addr
    addr = addr.strip()
    if facility_name and facility_name in addr:
        idx = addr.find(facility_name)
        cleaned = addr[:idx].rstrip()
        if is_addr_valid(cleaned):
            return cleaned
    return addr


def supplement_address(addr, facility_name, pref):
    if is_addr_valid(addr):
        return addr
    for key, known_addr in KNOWN_FACILITY_ADDRS.items():
        if key in facility_name:
            return known_addr
    return addr


def extract_times(text):
    if not text:
        return ""
    text = str(text)
    times = TIME_PATTERN.findall(text)
    if times:
        return " / ".join(times[:3])
    found = [s for s in SHIFT_LABELS if s in text]
    if found:
        return "・".join(found)
    return ""


def extract_contact_from_remarks(remarks):
    if not remarks:
        return ""
    m = CONTACT_PATTERN.search(str(remarks))
    if m:
        return m.group(1).strip()
    m = CONTACT_PATTERN2.search(str(remarks))
    if m:
        return m.group(1).strip()
    return ""


def clean_remarks(remarks):
    if not remarks:
        return ""
    lines = str(remarks).split("\n")
    short = []
    skip_prefixes = ("【元BOID", "【クライアント", "【ステータス", "【登録ユーザー",
                     "【インポート日", "【送迎", "【派遣料金", "【紹介雇用",
                     "【給与】", "【勤務条件", "【福利厚生", "【育児", "【紹介料",
                     "【スプレッドシート", "【登録日", "【取引種別", "【BO発生経路",
                     "【案件種別", "【必要な資格", "【経験要件", "【就業日数",
                     "【就業曜日", "【シフト詳細", "【業務内容")
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if any(line.startswith(p) for p in skip_prefixes):
            continue
        short.append(line)
    return " / ".join(short[:3])


def normalize_name(name):
    if not name:
        return ""
    name = str(name).strip()
    name = name.replace("　", " ")
    name = re.sub(r'\s+', ' ', name).strip()
    return name


def parse_date(s):
    if not s:
        return ""
    s = str(s).strip()
    for fmt in ("%Y/%m/%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S+09:00", "%Y/%m/%d",
                "%Y-%m-%d %H:%M:%S", "%Y年%m月%d日"):
        try:
            dt = datetime.strptime(s, fmt)
            return dt.strftime("%Y/%m/%d")
        except ValueError:
            continue
    m = re.match(r'^(\d{1,2})/(\d{1,2})$', s)
    if m:
        month, day = int(m.group(1)), int(m.group(2))
        now = datetime.now()
        if 1 <= month <= 12 and 1 <= day <= 31:
            return f"{now.year}/{month:02d}/{day:02d}"
    if s.isdigit() and 3 <= len(s) <= 4:
        if len(s) == 3:
            month, day = s[0], s[1:]
        else:
            month, day = s[:2], s[2:]
        try:
            m_i, d_i = int(month), int(day)
            now = datetime.now()
            if 1 <= m_i <= 12 and 1 <= d_i <= 31:
                return f"{now.year}/{m_i:02d}/{d_i:02d}"
        except ValueError:
            pass
    return s


def main():
    if len(sys.argv) < 3:
        print("Usage: python build_app_data.py <sheets_dir> <output_path>")
        sys.exit(1)

    sheets_dir = sys.argv[1]
    output_path = sys.argv[2]

    all_records = []

    # === 1) Process 案件 sheet ===
    with open(os.path.join(sheets_dir, "anken.json"), "r", encoding="utf-8") as f:
        data = json.load(f)
    rows = data.get("values", [])
    headers = rows[0] if rows else []
    for row in rows[1:]:
        rd = {}
        for i, h in enumerate(headers):
            rd[h.strip()] = row[i] if i < len(row) else ""
        fname = str(rd.get("事業所名　", rd.get("事業所名", "")) or "").strip()
        if not fname:
            continue
        addr = str(rd.get("所在地", "") or "").strip()
        pref = extract_pref(addr)
        if pref not in TARGET_PREFS:
            continue
        job = str(rd.get("職種", "") or "").strip()
        cat = "看護" if "看護" in job else "介護"

        order_parts = []
        if job:
            order_parts.append(job)
        qual = str(rd.get("資格", "") or "").strip()
        if qual:
            order_parts.append(qual)
        shift = str(rd.get("シフト（日勤OR夜勤）", "") or "").strip()
        if shift:
            order_parts.append(shift)
        days = str(rd.get("勤務日数", "") or "").strip()
        if days:
            order_parts.append(days)
        time_col = str(rd.get("時間", "") or "").strip()
        if time_col:
            order_parts.append(time_col)
        other = str(rd.get("その他", "") or "").strip()
        if other:
            order_parts.append(other)
        order = " | ".join(p for p in order_parts if p)

        time_str = extract_times(time_col) or extract_times(shift) or extract_times(other)
        shifts = classify_shifts(shift) or classify_shifts(time_col) or classify_shifts(other)
        contact = str(rd.get("担当者名", "") or "").strip()
        date_str = parse_date(str(rd.get("取得日", "") or ""))

        all_records.append({
            "name": normalize_name(fname), "address": addr, "pref": pref,
            "contact": contact, "date": date_str, "order": order,
            "time": time_str, "shifts": shifts, "cat": cat,
        })

    print(f"案件: {len(all_records)}")

    # === 2) Process 介護案件 sheet ===
    with open(os.path.join(sheets_dir, "kaigo.json"), "r", encoding="utf-8") as f:
        data = json.load(f)
    rows = data.get("values", [])
    headers = rows[0] if rows else []
    before = len(all_records)
    for row in rows[1:]:
        rd = {}
        job_val = ""
        for i, h in enumerate(headers):
            val = row[i] if i < len(row) else ""
            h = h.strip()
            if h == "職種" and "職種" in rd:
                job_val = val
            else:
                rd[h] = val
        fname = str(rd.get("施設名", "") or "").strip()
        if not fname:
            continue
        pref_col = str(rd.get("都道府県", "") or "").strip()
        if pref_col not in TARGET_PREFS:
            continue
        city = str(rd.get("市区町村以下", "") or "").strip()
        addr = f"{pref_col}{city}"
        remarks = str(rd.get("備考", "") or "")

        if not job_val:
            job_val = str(rd.get("職種", "") or "").strip()
        emp = str(rd.get("雇用形態", "") or "").strip()
        shift = str(rd.get("シフト", "") or "").strip()

        order_parts = []
        if job_val:
            order_parts.append(str(job_val))
        if emp:
            order_parts.append(emp)
        if shift:
            order_parts.append(shift)
        cr = clean_remarks(remarks)
        if cr:
            order_parts.append(cr)
        order = " | ".join(p for p in order_parts if p and p != "None")

        time_str = extract_times(remarks) or extract_times(shift)
        shifts = classify_shifts(shift) or classify_shifts(remarks) or classify_shifts(time_str)
        contact = str(rd.get("施設担当者", "") or "").strip()
        if not contact:
            contact = extract_contact_from_remarks(remarks)
        date_str = parse_date(str(rd.get("更新日時", "") or ""))

        all_records.append({
            "name": normalize_name(fname), "address": addr, "pref": pref_col,
            "contact": contact, "date": date_str, "order": order,
            "time": time_str, "shifts": shifts, "cat": "介護",
        })

    print(f"介護案件: +{len(all_records) - before}")

    # === 3) Process 看護案件 sheet ===
    with open(os.path.join(sheets_dir, "kango.json"), "r", encoding="utf-8") as f:
        data = json.load(f)
    rows = data.get("values", [])
    headers = rows[0] if rows else []
    before = len(all_records)
    for row in rows[1:]:
        rd = {}
        job_val = ""
        for i, h in enumerate(headers):
            val = row[i] if i < len(row) else ""
            h = h.strip()
            if h == "職種" and "職種" in rd:
                job_val = val
            else:
                rd[h] = val
        fname = str(rd.get("施設名", "") or "").strip()
        if not fname:
            continue
        pref_col = str(rd.get("都道府県", "") or "").strip()
        if pref_col not in TARGET_PREFS:
            continue
        city = str(rd.get("市区町村以下", "") or "").strip()
        addr = f"{pref_col}{city}"
        remarks = str(rd.get("備考", "") or "")

        if not job_val:
            job_val = str(rd.get("職種", "") or "").strip()
        emp = str(rd.get("雇用形態", "") or "").strip()
        shift = str(rd.get("シフト", "") or "").strip()

        order_parts = []
        if job_val:
            order_parts.append(str(job_val))
        if emp:
            order_parts.append(emp)
        if shift:
            order_parts.append(shift)
        cr = clean_remarks(remarks)
        if cr:
            order_parts.append(cr)
        order = " | ".join(p for p in order_parts if p and p != "None")

        time_str = extract_times(remarks) or extract_times(shift)
        shifts = classify_shifts(shift) or classify_shifts(remarks) or classify_shifts(time_str)
        contact = str(rd.get("施設担当者", "") or "").strip()
        if not contact:
            contact = extract_contact_from_remarks(remarks)
        date_str = parse_date(str(rd.get("更新日時", "") or ""))

        all_records.append({
            "name": normalize_name(fname), "address": addr, "pref": pref_col,
            "contact": contact, "date": date_str, "order": order,
            "time": time_str, "shifts": shifts, "cat": "看護",
        })

    print(f"看護案件: +{len(all_records) - before}")

    # === Clean addresses ===
    for rec in all_records:
        rec["address"] = clean_address(rec["address"], rec["name"])

    # === Deduplicate ===
    groups = {}
    for rec in all_records:
        key = (rec["name"], rec["cat"])
        if key in groups:
            grp = groups[key]
            if rec["date"] > grp["date"]:
                grp["date"] = rec["date"]
                grp["pref"] = rec["pref"]
            if is_addr_valid(rec["address"]):
                if not is_addr_valid(grp["address"]) or rec["date"] >= grp["date"]:
                    grp["address"] = rec["address"]
                    if rec["pref"]:
                        grp["pref"] = rec["pref"]
            if rec["contact"] and not grp["contact"]:
                grp["contact"] = rec["contact"]
            if rec["time"] and not grp["time"]:
                grp["time"] = rec["time"]
            if rec["order"] and rec["order"] not in grp["orders"]:
                grp["orders"].append(rec["order"])
            grp["shifts"].update(rec.get("shifts", []))
        else:
            groups[key] = {
                "name": rec["name"], "address": rec["address"],
                "pref": rec["pref"], "contact": rec["contact"],
                "date": rec["date"], "order": rec["order"],
                "orders": [rec["order"]] if rec["order"] else [],
                "time": rec["time"], "shifts": set(rec.get("shifts", [])),
                "cat": rec["cat"],
            }

    # === Build final list ===
    final = []
    stats = {"valid": 0, "supplemented": 0, "pref_only": 0}
    for grp in groups.values():
        if len(grp["orders"]) > 1:
            combined = "\n".join(f"({i+1}) {o}" for i, o in enumerate(grp["orders"]))
        elif grp["orders"]:
            combined = grp["orders"][0]
        else:
            combined = ""

        addr = grp["address"]
        orig_addr = addr
        addr = supplement_address(addr, grp["name"], grp["pref"])
        if addr != orig_addr:
            stats["supplemented"] += 1
            grp["pref"] = extract_pref(addr)

        if is_addr_valid(addr):
            stats["valid"] += 1
        elif addr:
            stats["pref_only"] += 1

        final.append({
            "n": grp["name"],
            "a": addr,
            "p": grp["pref"] or extract_pref(addr),
            "c": grp["contact"],
            "d": grp["date"],
            "o": combined,
            "t": grp["time"],
            "s": sorted(grp["shifts"]),
            "cat": grp["cat"],
            "ft": classify_facility(grp["name"], combined),
        })

    final.sort(key=lambda x: x["d"], reverse=True)

    kaigo = sum(1 for r in final if r["cat"] == "介護")
    kango = sum(1 for r in final if r["cat"] == "看護")
    print(f"\nTotal: {len(final)} (介護: {kaigo}, 看護: {kango})")
    print(f"Address: valid={stats['valid']}, supplemented={stats['supplemented']}, pref_only={stats['pref_only']}")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(final, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Saved: {output_path} ({os.path.getsize(output_path)} bytes)")


if __name__ == "__main__":
    main()
