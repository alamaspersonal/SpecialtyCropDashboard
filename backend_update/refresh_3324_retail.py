#!/usr/bin/env python3
# ruff: noqa: E402
"""
refresh_3324_retail.py
──────────────────────
Clean re-population of the "Retail - Specialty Crops" segment in Supabase.

Three steps (run in order):
  1. Delete all rows in UnifiedCropPrice where market_type = 'Retail - Specialty Crops'
  2. Fetch the maximum available data from the USDA MARS API for slug 3324
     (no date filter → API returns as much history as it has)
  3. Format via the existing pipeline and batch-insert into Supabase

Flags
-----
  --dry-run      Preview row counts and sample dates; no DB writes or deletes.
  --skip-fetch   Skip Step 2 and reuse APP_CROP_DATA/3324_recent.csv
                 (handy if the API fetch succeeded but upload failed).

Usage
-----
  cd backend_update/

  # Preview only
  python refresh_3324_retail.py --dry-run

  # Full run
  python refresh_3324_retail.py

  # Re-upload only (API already fetched)
  python refresh_3324_retail.py --skip-fetch
"""

import argparse
import os
import sys
import time

import requests
import pandas as pd
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

# ── Local imports (reuse existing modules, zero logic duplication) ──────────
from get_recent_data import flatten_sections, OUTPUT_DIR, API_KEY
from format_data import format_for_unified_crop_price
from overwrite_supabse import get_supabase_client, detect_new_columns, upload_dataframe

# ── Constants ────────────────────────────────────────────────────────────────
SLUG = "3324"
MARKET_TYPE_FILTER = "Retail - Specialty Crops"
API_BASE = "https://marsapi.ams.usda.gov/services/v1.2/reports"
CSV_BACKUP = os.path.join(OUTPUT_DIR, f"{SLUG}_recent.csv")

# Fetch 2024-01-01 through today, split by year to avoid API timeouts.
START_YEAR = 2024
REQUEST_TIMEOUT = 120   # seconds per year-chunk request
REQUEST_DELAY  = 1.5    # polite pause between requests


# ── Step 1: Delete existing Retail - Specialty Crops rows ───────────────────

def delete_retail_rows(client, dry_run: bool) -> int:
    """
    Delete all UnifiedCropPrice rows where market_type = 'Retail - Specialty Crops'.
    Returns the count of rows deleted (or that would be deleted in dry-run).
    """
    print(f"\n[Step 1/3] Removing existing '{MARKET_TYPE_FILTER}' rows from Supabase...")

    # Collect all IDs in pages
    all_ids = []
    offset = 0
    page_size = 10_000

    while True:
        res = (
            client.table("UnifiedCropPrice")
            .select("id")
            .eq("market_type", MARKET_TYPE_FILTER)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = res.data or []
        if not batch:
            break
        all_ids.extend(row["id"] for row in batch)
        offset += page_size
        if len(batch) < page_size:
            break

    print(f"  Found {len(all_ids):,} rows to delete.")

    if dry_run:
        print("  [DRY RUN] Skipping delete.")
        return len(all_ids)

    if not all_ids:
        print("  Nothing to delete — table already clean for this market type.")
        return 0

    # Delete in batches of 1,000
    batch_size = 1_000
    deleted = 0
    for i in range(0, len(all_ids), batch_size):
        chunk = all_ids[i : i + batch_size]
        client.table("UnifiedCropPrice").delete().in_("id", chunk).execute()
        deleted += len(chunk)
        print(f"  Progress: deleted {deleted:,}/{len(all_ids):,}")

    print(f"  ✔ Deleted {deleted:,} rows.")
    return deleted


# ── Step 2: Fetch from USDA MARS API ────────────────────────────────────────

def _fetch_year(year: int) -> pd.DataFrame:
    """
    Fetch one calendar year of slug 3324 data from the USDA MARS API.
    Uses a 120-second timeout and a date range query to avoid the server
    timing out on the full unfiltered history.
    """
    start = f"01/01/{year}"
    end   = f"12/31/{year}"
    url   = f"{API_BASE}/{SLUG}"
    params = {
        "allSections": "true",
        "q": f"published_date={start}:{end}",
    }
    auth = (API_KEY, "") if API_KEY and API_KEY != "YOUR_API_KEY_HERE" else None
    try:
        resp = requests.get(url, params=params, auth=auth, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        time.sleep(REQUEST_DELAY)
    except Exception as e:
        print(f"    ⚠ Request failed for {year}: {e}")
        return pd.DataFrame()

    df = flatten_sections(data)
    return df if df is not None else pd.DataFrame()


def fetch_from_api(skip_fetch: bool, dry_run: bool) -> pd.DataFrame:
    """
    Fetch maximum available data for slug 3324 by pulling one year at a time.
    Saves the merged raw CSV to APP_CROP_DATA/3324_recent.csv as a backup.
    If skip_fetch=True, reads from the existing CSV instead.
    """
    print(f"\n[Step 2/3] Fetching data for slug {SLUG} from USDA MARS API...")

    if skip_fetch:
        if not os.path.exists(CSV_BACKUP):
            print(f"  ✘ --skip-fetch specified but {CSV_BACKUP} does not exist.")
            sys.exit(1)
        print(f"  Loading existing CSV: {CSV_BACKUP}")
        df = pd.read_csv(CSV_BACKUP, low_memory=False)
        print(f"  ✔ Loaded {len(df):,} raw rows from CSV.")
        return df

    current_year = datetime.now().year
    years = list(range(START_YEAR, current_year + 1))
    print(f"  Fetching {len(years)} year(s): {years[0]}–{years[-1]}  "
          f"(timeout={REQUEST_TIMEOUT}s/year, date range: 01/01/{START_YEAR}–today)")

    yearly_frames = []
    for year in years:
        print(f"  → {year} ...", end=" ", flush=True)
        ydf = _fetch_year(year)
        if ydf.empty:
            print("0 rows")
        else:
            print(f"{len(ydf):,} rows")
            yearly_frames.append(ydf)

    if not yearly_frames:
        print("  ✘ No data returned from API for any year.")
        sys.exit(1)

    df = pd.concat(yearly_frames, ignore_index=True)
    print(f"  ✔ {len(df):,} total raw rows across all years.")

    if not dry_run:
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        df.to_csv(CSV_BACKUP, index=False)
        print(f"  ✔ Saved backup CSV → {CSV_BACKUP}")
    else:
        print("  [DRY RUN] Skipping CSV backup save.")

    return df


# ── Step 3: Format and upload ────────────────────────────────────────────────

def format_and_upload(client, raw_df: pd.DataFrame, dry_run: bool):
    """
    Format raw USDA DataFrame via the existing pipeline and insert into Supabase.
    """
    print(f"\n[Step 3/3] Formatting and uploading...")

    unified_df = format_for_unified_crop_price(raw_df)

    if unified_df.empty:
        print("  ✘ No rows remained after formatting (check date/commodity filters).")
        sys.exit(1)

    print(f"  ✔ Formatted {len(unified_df):,} rows for UnifiedCropPrice.")

    # Sanity-check: confirm report_date is coming from report_end_date
    sample = unified_df[unified_df["report_date"].notna()].head(3)
    if not sample.empty:
        print("  Sample report_date values (should be week-end dates, not publish dates):")
        for _, r in sample.iterrows():
            print(f"    {r.get('report_date')}  |  commodity={r.get('commodity')}  |  origin={r.get('origin')}")

    if dry_run:
        print("\n  [DRY RUN] Skipping Supabase insert.")
        print(f"\n  Would insert {len(unified_df):,} rows into UnifiedCropPrice.")
        return

    # Validate schema before inserting
    print("\n  Checking schema compatibility...")
    unified_df = detect_new_columns(client, "UnifiedCropPrice", unified_df)

    # Append insert (no clear — other market types stay untouched)
    upload_dataframe(client, "UnifiedCropPrice", unified_df, batch_size=500)


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Delete Retail - Specialty Crops rows and re-populate from USDA MARS API."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview counts and sample data without any DB writes or deletes.",
    )
    parser.add_argument(
        "--skip-fetch",
        action="store_true",
        help="Skip API fetch and reuse existing APP_CROP_DATA/3324_recent.csv.",
    )
    args = parser.parse_args()

    dry_run = args.dry_run
    skip_fetch = args.skip_fetch

    print("=" * 60)
    print("Refresh: Retail - Specialty Crops (Slug 3324)")
    if dry_run:
        print("MODE: DRY RUN — no DB changes will be made")
    print("=" * 60)

    # Connect to Supabase (always, even in dry-run, so schema checks work)
    try:
        client = get_supabase_client()
        print("✔ Connected to Supabase.")
    except Exception as e:
        print(f"✘ Failed to connect to Supabase: {e}")
        sys.exit(1)

    # Step 1 — Delete
    delete_retail_rows(client, dry_run=dry_run)

    # Step 2 — Fetch
    raw_df = fetch_from_api(skip_fetch=skip_fetch, dry_run=dry_run)

    # Step 3 — Format + Upload
    format_and_upload(client, raw_df, dry_run=dry_run)

    print("\n" + "=" * 60)
    if dry_run:
        print("✔ Dry run complete — no changes made.")
    else:
        print("✔ Refresh complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
