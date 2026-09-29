#!/usr/bin/env python3
"""アフィリエイトリンク一覧(xlsm)の『threds』タブから実URLを取り込み、
config/services.src.json の '@threds:' 参照を解決して config/services.json を生成する。

使い方:  python3 scripts/sync-links.py <affiliate-links.xlsm> [--tab threds]
"""
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
ROOT = Path(__file__).resolve().parent.parent


def read_tab(xlsm_path: str, tab: str) -> dict:
    z = zipfile.ZipFile(xlsm_path)
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in root.findall("m:si", NS):
            shared.append("".join(t.text or "" for t in si.iter("{%s}t" % NS["m"])))
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    names = [s.get("name") for s in wb.find("m:sheets", NS)]
    if tab not in names:
        sys.exit(f"タブ '{tab}' が見つかりません: {names}")
    sheet = ET.fromstring(z.read(f"xl/worksheets/sheet{names.index(tab) + 1}.xml"))
    links = {}
    for row in sheet.iter("{%s}row" % NS["m"]):
        cells = {}
        for c in row.findall("m:c", NS):
            v = c.find("m:v", NS)
            if v is None:
                continue
            val = shared[int(v.text)] if c.get("t") == "s" else v.text
            cells[re.sub(r"\d+", "", c.get("r"))] = val
        if cells.get("B") and str(cells.get("D", "")).startswith("http"):
            links[cells["B"].strip()] = cells["D"].strip()
    return links


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    tab = sys.argv[sys.argv.index("--tab") + 1] if "--tab" in sys.argv else "threds"
    links = read_tab(sys.argv[1], tab)
    # 「app」タブ（アプリ登録のリンク。MyVisionなど）も取り込む。同名は threds を優先
    try:
        for k, v in read_tab(sys.argv[1], "app").items():
            links.setdefault(k, v)
    except SystemExit:
        pass
    src = json.loads((ROOT / "config/services.src.json").read_text(encoding="utf-8"))
    missing = []
    for s in src["services"]:
        url = links.get(s["linkName"])
        if not url:
            missing.append(s["linkName"])
        s["url"] = url
        s.pop("linkName", None)
    if missing:
        sys.exit(f"リンクが見つからないサービス: {missing}")
    src.pop("_readme", None)
    src["meta"] = {"linkTab": tab, "count": len(src["services"])}
    out = ROOT / "config/services.json"
    out.write_text(json.dumps(src, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"OK: {len(src['services'])} services -> {out} (tab={tab})")


if __name__ == "__main__":
    main()
