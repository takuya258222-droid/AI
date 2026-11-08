#!/usr/bin/env python3
"""Fetch Google Sheets data using service account credentials.

Requires GOOGLE_SERVICE_ACCOUNT_JSON env var (the JSON key content).
Outputs 3 JSON files to the specified output directory.
"""
import json
import os
import sys

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

SPREADSHEET_ID = "1GgRzu3_VrF63QIzIxduF4HgeIeCN7WsZuyetLJ8v1jI"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

SHEETS = {
    "anken": "案件!A1:S3000",
    "kaigo": "介護案件!A1:Q3000",
    "kango": "看護案件!A1:Q3000",
}


def main():
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "."

    creds_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    if not creds_json:
        print("ERROR: GOOGLE_SERVICE_ACCOUNT_JSON env var not set")
        sys.exit(1)

    creds_info = json.loads(creds_json)
    creds = Credentials.from_service_account_info(creds_info, scopes=SCOPES)
    service = build("sheets", "v4", credentials=creds)
    sheets_api = service.spreadsheets()

    os.makedirs(out_dir, exist_ok=True)

    for name, range_str in SHEETS.items():
        print(f"Fetching {name} ({range_str})...")
        result = sheets_api.values().get(
            spreadsheetId=SPREADSHEET_ID, range=range_str
        ).execute()
        out_path = os.path.join(out_dir, f"{name}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False)
        rows = len(result.get("values", []))
        print(f"  -> {out_path} ({rows} rows)")

    print("Done.")


if __name__ == "__main__":
    main()
