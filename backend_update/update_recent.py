#!/usr/bin/env python3
"""
Targeted incremental update for SpecialtyCropDashboard.

Fetches only the missing data window (from the last date in each cached CSV
up through today), merges into the existing CSVs, then formats and uploads
the full dataset to Supabase.

This avoids the timeout that occurs when fetching all history with no date
filter, while still producing a complete Supabase table.
"""

import os
import sys
import time
import pandas as pd
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

from get_recent_data import safe_request, flatten_sections, REQUIRED_SLUG_IDS, OUTPUT_DIR
from format_data import load_and_format_all_data
from overwrite_supabse import overwrite_supabase_data

API_KEY = os.getenv("USDA_API_KEY")
BASE_URL = "https://marsapi.ams.usda.gov/services/v1.2/reports"
TODAY_STR = datetime.now().strftime("%m/%d/%Y")


def last_date_in_csv(slug):
    """Return the latest report_date in the existing CSV (as a datetime), or None."""
    csv_path = os.path.join(OUTPUT_DIR, f"{slug}_recent.csv")
    if not os.path.exists(csv_path):
        return None
    df = pd.read_csv(csv_path, low_memory=False)
    date_col = next((c for c in ("report_date", "report_end_date", "published_Date")
                     if c in df.columns), None)
    if not date_col:
        return None
    dates = pd.to_datetime(df[date_col], format="%m/%d/%Y", errors="coerce").dropna()
    return dates.max().to_pydatetime() if len(dates) else None


def fetch_slug_range(slug, start_dt, end_dt):
    """Fetch rows for a single slug between start_dt and end_dt (inclusive)."""
    start_str = start_dt.strftime("%m/%d/%Y")
    end_str   = end_dt.strftime("%m/%d/%Y")
    print(f"  Fetching {slug}: {start_str} → {end_str}")
    url = f"{BASE_URL}/{slug}"
    params = {
        "allSections": "true",
        "q": f"published_date={start_str}:{end_str}",
    }
    data = safe_request(url, params)
    if not data:
        return pd.DataFrame()
    df = flatten_sections(data)
    return df if df is not None else pd.DataFrame()


def merge_into_csv(slug, new_df, cutoff_dt):
    """
    Merge new_df into the existing CSV for slug.
    Drops any rows from the old CSV with report_date >= cutoff_dt (the fetch
    window start) to prevent duplicates, then appends the fresh rows.
    """
    csv_path = os.path.join(OUTPUT_DIR, f"{slug}_recent.csv")
    if not os.path.exists(csv_path) or new_df.empty:
        if not new_df.empty:
            new_df.to_csv(csv_path, index=False)
            print(f"  Created {csv_path} ({len(new_df)} rows)")
        return

    old_df = pd.read_csv(csv_path, low_memory=False)

    date_col = next((c for c in ("report_date", "report_end_date") if c in old_df.columns), None)
    if date_col:
        parsed = pd.to_datetime(old_df[date_col], format="%m/%d/%Y", errors="coerce")
        old_before = old_df[parsed < pd.Timestamp(cutoff_dt)]
    else:
        old_before = old_df  # can't filter; keep everything

    combined = pd.concat([old_before, new_df], ignore_index=True)
    combined.to_csv(csv_path, index=False)
    print(f"  Updated {csv_path}: {len(old_before)} old + {len(new_df)} new = {len(combined)} total rows")


def main():
    print("=" * 60)
    print("SpecialtyCropDashboard — Incremental Update")
    print(f"Today: {TODAY_STR}")
    print("=" * 60)

    # ── Step 1: Fetch missing data for each slug ──────────────────
    print("\n[Step 1/3] Fetching missing data from USDA API...")
    print("-" * 40)

    for slug in REQUIRED_SLUG_IDS:
        last_dt = last_date_in_csv(slug)
        if last_dt is None:
            # No CSV yet — fetch last 2 years as a reasonable default
            start_dt = datetime.now() - timedelta(days=730)
            print(f"Slug {slug}: no existing CSV; fetching last 2 years")
        else:
            # Start one day after the last date we already have
            start_dt = last_dt + timedelta(days=1)
            print(f"Slug {slug}: last date in CSV = {last_dt.strftime('%m/%d/%Y')}")

        end_dt = datetime.now()

        if start_dt > end_dt:
            print(f"  Already up to date, skipping.")
            continue

        new_df = fetch_slug_range(slug, start_dt, end_dt)
        if new_df.empty:
            print(f"  No new rows returned.")
            continue

        print(f"  Got {len(new_df)} new rows.")
        merge_into_csv(slug, new_df, start_dt)

    # ── Step 2: Format ────────────────────────────────────────────
    print("\n[Step 2/3] Formatting data for UnifiedCropPrice table...")
    print("-" * 40)
    try:
        unified_df = load_and_format_all_data()
        if unified_df.empty:
            print("✘ No data formatted. Aborting upload.")
            return False
        print(f"✔ Formatted {len(unified_df):,} records")
    except Exception as e:
        print(f"✘ Formatting error: {e}")
        return False

    # ── Step 3: Upload ────────────────────────────────────────────
    print("\n[Step 3/3] Uploading to Supabase...")
    print("-" * 40)
    success = overwrite_supabase_data(unified_df)

    if success:
        print("\n" + "=" * 60)
        print("✔ Incremental update completed successfully!")
        print("=" * 60)
        return True
    else:
        print("\n" + "=" * 60)
        print("✘ Upload failed.")
        print("=" * 60)
        return False


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
