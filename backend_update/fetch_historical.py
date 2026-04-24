"""
Backfill historical data for slug 3324 (retail) from 2015 to Aug 2023.
Fetches one year at a time to avoid API result limits, then merges into
the existing 3324_recent.csv without duplicates.
"""

import os
import time
import requests
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv

from get_recent_data import flatten_sections

load_dotenv()

API_KEY = os.getenv("USDA_API_KEY", "")
BASE_URL = "https://marsapi.ams.usda.gov/services/v1.2/reports"
OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "APP_CROP_DATA"))
REQUEST_DELAY = 1.5


def fetch_slug_range(slug, start_str, end_str):
    """Fetch one date range for a slug. Returns DataFrame or None."""
    url = f"{BASE_URL}/{slug}"
    params = {
        "allSections": "true",
        "q": f"published_date={start_str}:{end_str}",
    }
    auth = (API_KEY, "") if API_KEY else None
    try:
        resp = requests.get(url, params=params, auth=auth, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        if not data or isinstance(data, str):
            return None
        df = flatten_sections(data)
        return df if (df is not None and not df.empty) else None
    except Exception as e:
        print(f"  Error: {e}")
        return None


def backfill_slug(slug, start_year, end_year, existing_csv):
    """
    Fetch slug data year-by-year from start_year to end_year,
    merge with existing CSV, deduplicate, save back.
    """
    existing_df = pd.read_csv(existing_csv, low_memory=False) if os.path.exists(existing_csv) else pd.DataFrame()
    print(f"Existing rows in {os.path.basename(existing_csv)}: {len(existing_df):,}")

    new_frames = []

    for year in range(start_year, end_year + 1):
        start_str = f"01/01/{year}"
        end_str = f"12/31/{year}"
        print(f"  Fetching {slug} for {year} ({start_str} - {end_str})...", end=" ", flush=True)
        df = fetch_slug_range(slug, start_str, end_str)
        if df is not None:
            print(f"{len(df):,} rows")
            new_frames.append(df)
        else:
            print("no data")
        time.sleep(REQUEST_DELAY)

    if not new_frames:
        print("No new data fetched.")
        return

    combined = pd.concat([existing_df] + new_frames, ignore_index=True)
    before = len(combined)

    # Deduplicate on report_date + commodity + variety + package + market_type + origin
    dedup_cols = [c for c in ['report_date', 'report_end_date', 'commodity', 'variety',
                               'package', 'market_type', 'origin', 'region']
                  if c in combined.columns]
    combined = combined.drop_duplicates(subset=dedup_cols, keep='last')
    after = len(combined)
    print(f"\nMerge: {before:,} -> {after:,} rows (removed {before - after:,} duplicates)")

    combined.to_csv(existing_csv, index=False)
    print(f"Saved to {existing_csv}")


if __name__ == "__main__":
    # 3324 current data starts 2023-08-18, so backfill 2015-2022 + Jan-Aug 2023
    print("=== Backfilling slug 3324 (Retail) 2015-2023 ===\n")
    csv_path = os.path.join(OUTPUT_DIR, "3324_recent.csv")

    # Fetch full years 2015-2022
    backfill_slug("3324", start_year=2015, end_year=2022, existing_csv=csv_path)

    # Fetch Jan 1 - Aug 17, 2023 separately (the gap before existing data)
    print("\n  Fetching 3324 for Jan-Aug 2023...", end=" ", flush=True)
    df_2023 = fetch_slug_range("3324", "01/01/2023", "08/17/2023")
    if df_2023 is not None:
        print(f"{len(df_2023):,} rows")
        existing = pd.read_csv(csv_path, low_memory=False)
        combined = pd.concat([existing, df_2023], ignore_index=True)
        dedup_cols = [c for c in ['report_date', 'report_end_date', 'commodity', 'variety',
                                   'package', 'market_type', 'origin', 'region']
                      if c in combined.columns]
        combined = combined.drop_duplicates(subset=dedup_cols, keep='last')
        combined.to_csv(csv_path, index=False)
        print(f"Final row count: {len(combined):,}")
    else:
        print("no data")

    print("\nDone.")
