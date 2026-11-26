#!/usr/bin/env python3
"""Merge supplement (spreadsheet) data into base (D_KANSAI from HTML).

Cumulative merge:
- All base records are kept (never deleted).
- If a facility name matches (NFKC-normalized, stripped): always update
  date/order/shifts/time/contact/facility_type from supplement. If supplement
  date is empty, use today's date (the facility is in the active spreadsheet,
  so it's a current listing).
- If a facility is in supplement but not in base: add it.
- lat/lon/tel from base are always preserved.

Usage: python merge_supplement.py <base.json> <supplement.json> <output.json>
"""
import json
import sys
import unicodedata
from datetime import datetime


def norm_name(n):
    return unicodedata.normalize("NFKC", str(n or "")).strip()


def main():
    if len(sys.argv) < 4:
        print("Usage: python merge_supplement.py <base.json> <supplement.json> <output.json>")
        sys.exit(1)

    base_path, supp_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]

    with open(base_path, "r", encoding="utf-8") as f:
        base = json.load(f)
    with open(supp_path, "r", encoding="utf-8") as f:
        supplement = json.load(f)

    print(f"Base: {len(base)} records")
    print(f"Supplement: {len(supplement)} records")

    # Index base by normalized name (first occurrence wins for index)
    base_by_name = {}
    for i, r in enumerate(base):
        nn = norm_name(r.get("n", ""))
        if nn not in base_by_name:
            base_by_name[nn] = i

    # Index supplement by normalized name, keeping latest date per name
    supp_by_name = {}
    for r in supplement:
        nn = norm_name(r.get("n", ""))
        if nn not in supp_by_name or (r.get("d", "") > supp_by_name[nn].get("d", "")):
            supp_by_name[nn] = r

    updated = 0
    added = 0

    today = datetime.now().strftime("%Y/%m/%d")

    # Update existing base records
    for nn, supp_rec in supp_by_name.items():
        if nn in base_by_name:
            idx = base_by_name[nn]
            base_rec = base[idx]
            supp_date = supp_rec.get("d", "") or today
            base_rec["d"] = max(supp_date, base_rec.get("d", ""), today)
            if supp_rec.get("o"):
                base_rec["o"] = supp_rec["o"]
            if supp_rec.get("s"):
                base_rec["s"] = supp_rec["s"]
            if supp_rec.get("t"):
                base_rec["t"] = supp_rec["t"]
            if supp_rec.get("c"):
                base_rec["c"] = supp_rec["c"]
            if supp_rec.get("ft") and supp_rec["ft"] != "その他":
                base_rec["ft"] = supp_rec["ft"]
            updated += 1
        else:
            if not supp_rec.get("d"):
                supp_rec["d"] = today
            added += 1
            base.append(supp_rec)

    # Re-sort by date descending
    base.sort(key=lambda x: x.get("d", ""), reverse=True)

    print(f"Updated info: {updated} existing records")
    print(f"Added new: {added} records")
    print(f"Merged total: {len(base)} records")

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(base, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Saved: {out_path}")


if __name__ == "__main__":
    main()
