#!/usr/bin/env python3
"""Replace D_KANSAI data and build-version in docs/index.html.

Usage: python update_html.py <app_data_json> <html_path>

2026-11-24: preserve lat/lon (and tel) from the existing D_KANSAI block.
The Sheets-based build cannot produce coordinates, so without carry-over
every daily update would strip the route-map / distance data. Records are
matched by facility identity (normalized name + address); coordinates are
appended only when the old data has exactly one coordinate for the key.
The D_KANSAI block is located with a bracket-aware scan instead of a
non-greedy regex so a "];" inside a string value cannot truncate it.
"""
import json
import re
import sys
import time
import unicodedata
from collections import defaultdict


def find_block(html, name):
    """Return (start, end) of the array/object payload of `const NAME=...`."""
    m = re.search(r"const\s+" + re.escape(name) + r"\s*=\s*", html)
    if not m:
        return None
    start = m.end()
    i = start
    depth = 0
    in_str = None
    esc = False
    began = False
    while i < len(html):
        c = html[i]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == in_str:
                in_str = None
        else:
            if c in "\"'`":
                in_str = c
            elif c in "[{(":
                depth += 1
                began = True
            elif c in "]})":
                depth -= 1
                if began and depth == 0:
                    return (start, i + 1)
            elif c == ";" and not began:
                return (start, i)
        i += 1
    return None


def norm_addr(a):
    a = unicodedata.normalize("NFKC", a or "")
    a = re.sub(r"\s+", "", a)
    a = re.sub(r"(\d+)丁目(\d+)番地?(\d+)号", r"\1-\2-\3", a)
    a = re.sub(r"(\d+)丁目(\d+)番地?", r"\1-\2", a)
    a = re.sub(r"(\d+)番地(\d+)号", r"\1-\2", a)
    a = re.sub(r"(\d+)番地", r"\1", a)
    a = re.sub(r"(\d+)号", r"\1", a)
    return a


def norm_name(n):
    return unicodedata.normalize("NFKC", n or "").strip()


def carry_over(new_data, old_data):
    coords = defaultdict(set)
    tels = {}
    for r in old_data:
        key = (norm_name(r.get("n", "")), norm_addr(r.get("a", "")))
        if "lat" in r and "lon" in r:
            coords[key].add((r["lat"], r["lon"]))
        if r.get("tel"):
            tels.setdefault(key, r["tel"])
    coords = {k: next(iter(v)) for k, v in coords.items() if len(v) == 1}
    n_coord = n_tel = 0
    for r in new_data:
        key = (norm_name(r.get("n", "")), norm_addr(r.get("a", "")))
        if "lat" not in r and key in coords:
            r["lat"], r["lon"] = coords[key]
            n_coord += 1
        if "tel" not in r and key in tels:
            r["tel"] = tels[key]
            n_tel += 1
    return n_coord, n_tel


def main():
    if len(sys.argv) < 3:
        print("Usage: python update_html.py <app_data.json> <docs/index.html>")
        sys.exit(1)

    data_path = sys.argv[1]
    html_path = sys.argv[2]

    with open(data_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()

    span = find_block(html, "D_KANSAI")
    if not span:
        print("ERROR: D_KANSAI not found in HTML")
        sys.exit(1)

    try:
        old_data = json.loads(html[span[0] : span[1]])
    except json.JSONDecodeError:
        old_data = []
    if old_data:
        n_coord, n_tel = carry_over(data, old_data)
        print(f"Carried over coordinates for {n_coord} records, tel for {n_tel}")

    data_str = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    print(f"Data: {len(data)} records, {len(data_str)} chars")

    html = html[: span[0]] + data_str + html[span[1] :]

    ver = str(int(time.time()))
    html = re.sub(r'(build-version"\s+content=")\d+"', f"\\g<1>{ver}\"", html)

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"Updated {html_path} (build-version={ver})")


if __name__ == "__main__":
    main()
