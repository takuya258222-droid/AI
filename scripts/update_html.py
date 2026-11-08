#!/usr/bin/env python3
"""Replace D_KANSAI data and build-version in docs/index.html.

Usage: python update_html.py <app_data_json> <html_path>
"""
import json
import re
import sys
import time


def main():
    if len(sys.argv) < 3:
        print("Usage: python update_html.py <app_data.json> <docs/index.html>")
        sys.exit(1)

    data_path = sys.argv[1]
    html_path = sys.argv[2]

    with open(data_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    data_str = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    print(f"Data: {len(data)} records, {len(data_str)} chars")

    with open(html_path, "r", encoding="utf-8") as f:
        html = f.read()

    old = re.search(r"const D_KANSAI=\[.*?\];", html, re.DOTALL)
    if not old:
        print("ERROR: D_KANSAI not found in HTML")
        sys.exit(1)

    new_block = f"const D_KANSAI={data_str};"
    html = html[: old.start()] + new_block + html[old.end() :]

    ver = str(int(time.time()))
    html = re.sub(r'(build-version"\s+content=")\d+"', f'\\g<1>{ver}"', html)

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"Updated {html_path} (build-version={ver})")


if __name__ == "__main__":
    main()
