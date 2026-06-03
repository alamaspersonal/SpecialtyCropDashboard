#!/usr/bin/env python3
"""
Historical backfill for SpecialtyCropDashboard.

Reads the combined *-Full.csv files from SpecialtyCropPrices/ReportsBySlugID/SlugIDFullFile/,
formats them with the existing format_for_unified_crop_price() logic, then uploads
to the UnifiedCropPrice Supabase table.

Upload paths (fastest first):
  1. Direct PostgreSQL via psycopg2 execute_values  (~5-15 min for 6M rows)
  2. Supabase REST API fallback                      (~30-60 min for 6M rows)

Set DB_CONNECTION_STRING in .env for the fast path (Supabase Dashboard ->
Settings -> Database -> Connection string -> Session pooler URI).

Usage:
    pip install psycopg2-binary   # once, for the fast path
    python upload_historical.py

The script is idempotent: it deletes each slug+year window before inserting,
so it is safe to re-run from any point if interrupted.

Rows within the last 60 days are skipped — the daily pipeline owns that window.
"""

import glob
import math
import os
import re
import sys
import time
from datetime import datetime, timedelta

import pandas as pd
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

sys.path.insert(0, os.path.dirname(__file__))
from format_data import format_for_unified_crop_price

# ── Configuration ─────────────────────────────────────────────────────────────

FULL_FILE_DIR = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__), "..", "..",
        "SpecialtyCropPrices", "ReportsBySlugID", "SlugIDFullFile",
    )
)

TABLE_NAME = "UnifiedCropPrice"

# Leave the most-recent window for the daily pipeline to manage.
CUTOFF_DATE = (datetime.now() - timedelta(days=60)).date()

# Rows per execute_values batch (PostgreSQL path).
PG_BATCH_SIZE = 5000

# Rows per REST API batch (fallback path).
REST_BATCH_SIZE = 500


# ── Helpers ────────────────────────────────────────────────────────────────────

def extract_slug_id(filepath: str) -> str | None:
    m = re.match(r'^(\d+)-', os.path.basename(filepath))
    return m.group(1) if m else None


def read_csv_by_year(csv_path: str):
    """
    Load a combined full-file CSV and yield (year, DataFrame) pairs, one per
    calendar year, ordered from oldest to newest. Oldest-first keeps the
    delete-then-insert window well away from the live recent data.
    """
    print(f"  Loading {os.path.basename(csv_path)}...")
    df = pd.read_csv(csv_path, low_memory=False)
    print(f"  {len(df):,} raw rows")

    date_col = next(
        (c for c in ("report_date", "report_end_date") if c in df.columns), None
    )
    if not date_col:
        print("  WARNING: no date column — yielding as single chunk")
        yield None, df
        return

    parsed = pd.to_datetime(df[date_col], format="%m/%d/%Y", errors="coerce")
    df = df.assign(_year=parsed.dt.year)

    years = sorted(df["_year"].dropna().unique().astype(int))
    print(f"  Years: {years[0]}–{years[-1]}")

    for year in years:
        chunk = df[df["_year"] == year].drop(columns=["_year"]).copy()
        yield year, chunk


def get_table_columns_pg(cur) -> list[str]:
    """Return column names for TABLE_NAME from information_schema (excludes 'id')."""
    cur.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = %s
          AND column_name != 'id'
        ORDER BY ordinal_position
        """,
        (TABLE_NAME,),
    )
    return [row[0] for row in cur.fetchall()]


def align_df_to_columns(df: pd.DataFrame, table_cols: list[str]) -> pd.DataFrame:
    """
    Keep only columns the table knows about, adding NULLs for any missing ones.
    Strips pass-through columns not yet in the schema.
    """
    extra = set(df.columns) - set(table_cols)
    if extra:
        print(f"    Stripping {len(extra)} unknown column(s): {sorted(extra)[:5]}{'…' if len(extra) > 5 else ''}")
    missing = [c for c in table_cols if c not in df.columns]
    for col in missing:
        df[col] = None
    return df[table_cols]


def to_records(df: pd.DataFrame) -> list[tuple]:
    """Convert DataFrame to list of tuples, replacing NaN/NaT with None."""
    clean = df.where(pd.notna(df), None)
    return [
        tuple(None if (v is None or (isinstance(v, float) and math.isnan(v))) else v
              for v in row)
        for row in clean.itertuples(index=False, name=None)
    ]


# ── PostgreSQL upload path ─────────────────────────────────────────────────────

def delete_year_pg(cur, slug_id: str, year: int):
    cur.execute(
        f'DELETE FROM "{TABLE_NAME}" '
        f'WHERE report_date >= %s AND report_date < %s AND slug_id = %s',
        (f"{year}-01-01", f"{year+1}-01-01", slug_id),
    )


def insert_year_pg(conn, df: pd.DataFrame, table_cols: list[str]) -> int:
    from psycopg2.extras import execute_values

    aligned = align_df_to_columns(df, table_cols)
    records = to_records(aligned)
    col_names = ", ".join(f'"{c}"' for c in table_cols)
    sql = f'INSERT INTO "{TABLE_NAME}" ({col_names}) VALUES %s'

    with conn.cursor() as cur:
        for i in range(0, len(records), PG_BATCH_SIZE):
            execute_values(cur, sql, records[i : i + PG_BATCH_SIZE])
    conn.commit()
    return len(records)


def process_slug_pg(conn, full_csv: str, slug_id: str, table_cols: list[str]) -> int:
    total = 0
    for year, year_df in read_csv_by_year(full_csv):
        if year is None:
            year = 0

        # Check max date in this chunk against the cutoff
        date_col = next(
            (c for c in ("report_date", "report_end_date") if c in year_df.columns), None
        )
        if date_col:
            max_dt = pd.to_datetime(year_df[date_col], format="%m/%d/%Y", errors="coerce").max()
            if pd.notna(max_dt) and max_dt.date() >= CUTOFF_DATE:
                print(f"  {year}: max={max_dt.date()} >= cutoff {CUTOFF_DATE} → skipping (daily pipeline owns)")
                continue

        t0 = time.time()
        print(f"  {year}: {len(year_df):,} raw rows → formatting…", end=" ", flush=True)
        formatted = format_for_unified_crop_price(year_df)

        if formatted.empty:
            print("0 formatted rows, skipping")
            continue

        print(f"{len(formatted):,} rows → uploading…", end=" ", flush=True)

        with conn.cursor() as cur:
            delete_year_pg(cur, slug_id, year)
        conn.commit()

        inserted = insert_year_pg(conn, formatted, table_cols)
        total += inserted
        print(f"✔  ({time.time() - t0:.1f}s)")

    return total


# ── REST API fallback path ─────────────────────────────────────────────────────

def process_slug_rest(full_csv: str, slug_id: str) -> int:
    from overwrite_supabse import get_supabase_client, upload_dataframe

    client = get_supabase_client()
    total = 0

    for year, year_df in read_csv_by_year(full_csv):
        if year is None:
            year = 0

        date_col = next(
            (c for c in ("report_date", "report_end_date") if c in year_df.columns), None
        )
        if date_col:
            max_dt = pd.to_datetime(year_df[date_col], format="%m/%d/%Y", errors="coerce").max()
            if pd.notna(max_dt) and max_dt.date() >= CUTOFF_DATE:
                print(f"  {year}: skipping (within daily pipeline window)")
                continue

        print(f"  {year}: {len(year_df):,} raw rows → formatting…", end=" ", flush=True)
        formatted = format_for_unified_crop_price(year_df)

        if formatted.empty:
            print("0 formatted rows, skipping")
            continue

        print(f"{len(formatted):,} rows → uploading…", end=" ", flush=True)
        t0 = time.time()

        # Delete existing rows for this slug+year window
        try:
            client.table(TABLE_NAME).delete() \
                .gte("report_date", f"{year}-01-01") \
                .lt("report_date", f"{year+1}-01-01") \
                .eq("slug_id", slug_id) \
                .execute()
        except Exception as e:
            print(f"\n    WARNING: delete failed: {e}")

        upload_dataframe(client, TABLE_NAME, formatted, batch_size=REST_BATCH_SIZE)
        total += len(formatted)
        print(f"✔  ({time.time() - t0:.1f}s)")

    return total


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("SpecialtyCropDashboard — Historical Backfill")
    print(f"Table:   {TABLE_NAME}")
    print(f"Cutoff:  {CUTOFF_DATE}  (rows after this date are skipped)")
    print("=" * 60)

    full_files = sorted(glob.glob(os.path.join(FULL_FILE_DIR, "*-Full.csv")))
    if not full_files:
        print(f"\nERROR: No *-Full.csv files found in:\n  {FULL_FILE_DIR}")
        print("Run process_all_slugs.py in SpecialtyCropPrices/ReportsBySlugID/ first.")
        sys.exit(1)

    print(f"\nSource directory:\n  {FULL_FILE_DIR}")
    print(f"\n{len(full_files)} slug file(s) to process:")
    for f in full_files:
        slug = extract_slug_id(f) or "?"
        print(f"  [{slug}] {os.path.basename(f)}")

    # ── Choose upload path ────────────────────────────────────────────────────
    db_conn_str = os.getenv("DB_CONNECTION_STRING")
    use_pg = False
    conn = None
    table_cols: list[str] = []

    if db_conn_str:
        try:
            import psycopg2
            conn = psycopg2.connect(db_conn_str)
            conn.autocommit = False
            with conn.cursor() as cur:
                table_cols = get_table_columns_pg(cur)
            use_pg = True
            print(f"\n✔ Connected via PostgreSQL (fast path)")
            print(f"  Table columns ({len(table_cols)}): {table_cols[:6]}…")
        except Exception as e:
            print(f"\n⚠ PostgreSQL connection failed: {e}")
            print("  Falling back to Supabase REST API")
            conn = None
    else:
        print(
            "\n⚠ DB_CONNECTION_STRING not set — using REST API (slower).\n"
            "  Add DB_CONNECTION_STRING to .env for ~10× faster uploads."
        )

    # ── Process each slug ─────────────────────────────────────────────────────
    grand_total = 0
    grand_t0 = time.time()

    for full_csv in full_files:
        slug_id = extract_slug_id(full_csv)
        if not slug_id:
            print(f"\nWARNING: cannot parse slug ID from {full_csv}, skipping")
            continue

        print(f"\n{'─' * 60}")
        print(f"Slug {slug_id}: {os.path.basename(full_csv)}")
        print("─" * 60)

        try:
            if use_pg and conn:
                inserted = process_slug_pg(conn, full_csv, slug_id, table_cols)
            else:
                inserted = process_slug_rest(full_csv, slug_id)
            grand_total += inserted
            print(f"  Slug {slug_id} done: {inserted:,} rows inserted")
        except Exception as e:
            print(f"\n  ERROR processing slug {slug_id}: {e}")
            if conn:
                try:
                    conn.rollback()
                except Exception:
                    pass
            import traceback
            traceback.print_exc()

    if conn:
        conn.close()

    elapsed = time.time() - grand_t0
    print(f"\n{'=' * 60}")
    print("BACKFILL COMPLETE")
    print(f"  Total rows inserted : {grand_total:,}")
    print(f"  Elapsed             : {elapsed / 60:.1f} min")
    print("=" * 60)
    print("\nVerification SQL:")
    print(
        '  SELECT slug_id, COUNT(*) AS rows,\n'
        '         MIN(report_date), MAX(report_date)\n'
        f'  FROM "{TABLE_NAME}"\n'
        '  GROUP BY slug_id ORDER BY slug_id;'
    )


if __name__ == "__main__":
    main()
