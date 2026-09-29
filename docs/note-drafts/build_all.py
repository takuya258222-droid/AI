import json, csv, med, gen, render as R
from data25 import N
import med2a, med2b, med2c, gen2a, gen2b
from rows_out import HEAD, outline

def build_list(items, sheet):
    out=[]
    for i,(a,n,row) in enumerate(items):
        nxt = items[i+1][0]["titles"][0] if i+1<len(items) else None
        body,line,thp,thc = R.render(a,n,sheet,row,nxt)
        t=a["thumb"]
        out.append(dict(no=a["no"],sheet=sheet,kind=a["kind"],titles=a["titles"],thumb=t,body=body,chars=R.n_chars(body),
                        th_post=thp,th_cmt=thc,checks=a["checks"]))
    return out

meds=[(a,N[a["no"]],a["no"]-5) for a in med.MED]+[(e,e,e["row"]) for e in med2a.E+med2b.E+med2c.E]
gens=[(a,N[a["no"]],a["row"]) for a in gen.GEN]+[(e,e,e["row"]) for e in gen2a.E+gen2b.E]
M=build_list(meds,"医療福祉"); G=build_list(gens,"一般転職")
json.dump(M+G,open("built_all.json","w"),ensure_ascii=False)

def row(x):
    t=x["thumb"]
    return [x["no"],x["sheet"],x["kind"],*x["titles"],t[0],t[1],t[2],outline(x["body"]),x["body"],x["chars"],x["th_post"],x["th_cmt"],"\n".join("・"+c for c in x["checks"]),"下書き"]
for name,lst in (("医療福祉",M),("一般転職",G)):
    with open(f"import_{name}.csv","w",newline="",encoding="utf-8-sig") as f:
        w=csv.writer(f); w.writerow(HEAD)
        for x in lst: w.writerow(row(x))
print(len(M),len(G))
import statistics
for name,lst in (("med",M),("gen",G)):
    cs=[x["chars"] for x in lst]; print(name,min(cs),max(cs),int(statistics.mean(cs)))
nos=[x["no"] for x in M+G]; print(len(nos),len(set(nos)))
bad=[(x["no"],w) for x in M+G for w in ("実例メモ","ネタ帳","担当例","差し替え","要確認") if w in x["body"]]
print(bad)
