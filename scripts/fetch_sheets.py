#!/usr/bin/env python3
"""Fetch Google Sheets data.

Supports two modes:
  1. GAS_DEPLOY_URL env var set -> fetch from Google Apps Script web app
  2. GOOGLE_SERVICE_ACCOUNT_JSON env var set -> use Sheets API directly

Usage: python fetch_sheets.py <output_dir>
"""
import json
import os
import sys
import urllib.request

SHEET_NAMES = ["anken", "kaigo", "kango"]


def fetch_via_gas(deploy_url, out_dir):
    """Fetch all sheets from Google Apps Script web app."""
    url = deploy_url.rstrip("/") + "?sheet=all"
    print(f"Fetching from GAS web app...")
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    if "error" in data:
        print(f"ERROR from GAS: {data['error']}")
        sys.exit(1)

    for name in SHEET_NAMES:
        if name not in data:
            print(f"WARNING: sheet '{name}' not in response")
            continue
        out_path = os.path.join(out_dir, f"{name}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data[name], f, ensure_ascii=False)
        rows = len(data[name].get("values", []))
        print(f"  {name}: {rows} rows -> {out_path}")


def fetch_via_service_account(creds_json, out_dir):
    """Fetch using Google Sheets API with service account."""
    from google.oauth2.service_account import Credentials
    from googleapiclient.discovery import build

    SPREADSHEET_ID = "1GgRzu3_VrF63QIzIxduF4HgeIeCN7WsZuyetLJ8v1jI"
    RANGES = {
        "anken": "案件!A1:S3000",
        "kaigo": "介護案件!A1:Q3000",
        "kango": "看護案件!A1:Q3000",
    }

    creds_info = json.loads(creds_json)
    creds = Credentials.from_service_account_info(
        creds_info,
        scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"],
    )
    service = build("sheets", "v4", credentials=creds)
    sheets_api = service.spreadsheets()

    for name, range_str in RANGES.items():
        print(f"Fetching {name} ({range_str})...")
        result = sheets_api.values().get(
            spreadsheetId=SPREADSHEET_ID, range=range_str
        ).execute()
        out_path = os.path.join(out_dir, f"{name}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False)
        rows = len(result.get("values", []))
        print(f"  {name}: {rows} rows -> {out_path}")


def main():
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    os.makedirs(out_dir, exist_ok=True)

    gas_url = os.environ.get("GAS_DEPLOY_URL")
    sa_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")

    if gas_url:
        fetch_via_gas(gas_url, out_dir)
    elif sa_json:
        fetch_via_service_account(sa_json, out_dir)
    else:
        print("ERROR: Set GAS_DEPLOY_URL or GOOGLE_SERVICE_ACCOUNT_JSON")
        sys.exit(1)

    print("Done.")


if __name__ == "__main__":
    main()
