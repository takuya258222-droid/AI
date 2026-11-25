#!/usr/bin/env python3
"""減ったデータの自動差し戻し (2026-11-25 再発防止)。

push された docs/index.html が公開ガード (pages_guard.py と同じ基準) を満たさないとき、
直近でガードを満たしていた版の docs/index.html に戻してコミットする。
戻したら終了コード 2 (Actions は赤) で、何件→何件だったかをログに残す。
"""
import json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
from update_html import find_block

base = json.load(open('.github/kansai_guard.json', encoding='utf-8'))

def stats(html):
    span = find_block(html, 'D_KANSAI')
    if not span:
        return 0, 0
    data = json.loads(html[span[0]:span[1]])
    c = sum(1 for r in data if r.get('lat') not in (None, '') and r.get('lon') not in (None, ''))
    return len(data), c

def ok(n, c):
    return n >= base['count'] * 0.9 and c >= base['coords'] * 0.9

cur = open('docs/index.html', encoding='utf-8').read()
n, c = stats(cur)
print(f'push後: 関西 {n}件 / 座標あり {c}件 (基準 {base["count"]}件 / {base["coords"]}件)')
if ok(n, c):
    print('ガードOK'); sys.exit(0)
revs = subprocess.check_output(['git', 'log', '--format=%H', '-n', '30', '--', 'docs/index.html']).decode().split()
for rev in revs[1:]:
    old = subprocess.check_output(['git', 'show', f'{rev}:docs/index.html']).decode('utf-8')
    on, oc = stats(old)
    if ok(on, oc):
        open('docs/index.html', 'w', encoding='utf-8').write(old)
        msg = f'公開ガード: 減ったデータ（関西{n}件・座標{c}件）を {rev[:7]} の版（関西{on}件・座標{oc}件）に戻しました'
        subprocess.check_call(['git', 'add', 'docs/index.html'])
        subprocess.check_call(['git', '-c', 'user.name=github-actions[bot]', '-c', 'user.email=github-actions[bot]@users.noreply.github.com', 'commit', '-m', msg])
        subprocess.check_call(['git', 'push'])
        print('::error::' + msg); sys.exit(2)
print('::error::公開ガード: 戻せる版が見つかりませんでした。'); sys.exit(1)
