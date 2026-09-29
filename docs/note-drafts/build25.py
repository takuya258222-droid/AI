import json, med, gen, render as R
from data25 import N
rows=[]
items=[(a,"医療福祉",a["no"]-5) for a in med.MED]+[(a,"一般転職",a["row"]) for a in gen.GEN]
for i,(a,sheet,row) in enumerate(items):
    nxt = items[i+1][0]["titles"][0] if i+1<len(items) else None
    body,line,thp,thc = R.render(a,N[a["no"]],sheet,row,nxt)
    t=a["thumb"]
    rows.append(dict(no=a["no"],sheet=sheet,kind=a["kind"],titles=a["titles"],thumb=t,body=body,chars=R.n_chars(body),
                     outline=(R.OUTLINE_GEN if sheet=="一般転職" else R.OUTLINE_MED),th_post=thp,th_cmt=thc,checks=a["checks"]))
json.dump(rows,open("built25.json","w"),ensure_ascii=False)
for r in rows: print(r["no"],r["sheet"],r["chars"])
