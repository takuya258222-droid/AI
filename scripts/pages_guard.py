#!/usr/bin/env python3
"""公開前ガード (2026-11-25 再発防止)。

docs/index.html の関西案件 (D_KANSAI) が、基準より大きく減っていたら公開を止める。
- 件数が基準件数の90%未満 → 止める (2026-11-23・11-25朝に約2,850件で上書きされた事故の防止)
- 座標あり (路線図・距離検索に使う lat/lon) の件数が基準の90%未満 → 止める
止めた場合、この Actions 実行は失敗 (赤) になり、GitHub Pages は前回公開した版のまま残る。
基準は .github/kansai_guard.json。正しい減少のときだけ、人が基準を書き換える。
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from update_html import find_block

base = json.load(open('.github/kansai_guard.json', encoding='utf-8'))
html = open('docs/index.html', encoding='utf-8').read()
span = find_block(html, 'D_KANSAI')
if not span:
    print('::error::公開ガード: D_KANSAI が見つかりません。公開を止めました。'); sys.exit(1)
data = json.loads(html[span[0]:span[1]])
n = len(data)
coords = sum(1 for r in data if r.get('lat') not in (None, '') and r.get('lon') not in (None, ''))
print(f'関西 {n}件 (基準 {base["count"]}件) / 座標あり {coords}件 (基準 {base["coords"]}件)')
bad = []
if n < base['count'] * 0.9:
    bad.append(f'件数が {base["count"]}件 → {n}件 に減っています')
if coords < base['coords'] * 0.9:
    bad.append(f'座標ありが {base["coords"]}件 → {coords}件 に減っています (路線図・距離検索が壊れます)')
if bad:
    print('::error::公開ガード: ' + ' / '.join(bad) + '。公開を止めました (公開中のページは前回の版のまま)。')
    sys.exit(1)
