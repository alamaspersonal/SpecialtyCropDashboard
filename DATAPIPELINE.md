# Data Pipeline

This document describes the end-to-end data pipeline for the Specialty Crop Dashboard — from the USDA MARS API through formatting and upload into Supabase, to consumption by the web and mobile frontends.

---

## Overview

```
USDA MARS API
     │
     ▼
get_recent_data.py   ──► APP_CROP_DATA/{slug}_recent.csv
     │
     ▼
format_data.py       ──► pandas DataFrame (unified schema)
     │
     ▼
overwrite_supabase.py ──► Supabase: UnifiedCropPrice table
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
             phone_frontend        web_frontend
            (React Native)          (Next.js)
```

---

## Step 1 — Fetch: `get_recent_data.py`

Pulls raw report data from the **USDA MARS API** for each configured slug ID.

**Entry point:** `fetch_recent_data(slug_ids, days=None)`

| Parameter | Default | Behavior |
|-----------|---------|----------|
| `days=60` | 60 | Fetches the last N days of published reports |
| `days=None` | — | No date filter — returns the maximum available data |

**Slug IDs fetched:**

| Slug | Report |
|------|--------|
| 2306 | Terminal Market — Fruits & Vegetables |
| 2307 | Terminal Market — Fruits & Vegetables |
| 2308 | Shipping Point — Fruits & Vegetables |
| 2309 | Shipping Point — Fruits & Vegetables |
| 2390 | Retail — Fruits & Vegetables |
| 2391 | Retail — Fruits & Vegetables |
| 3324 | Specialty Crops |

**What it does:**
1. Calls `GET https://marsapi.ams.usda.gov/services/v1.2/reports/{slug}?allSections=true`
2. Flattens the nested JSON sections structure into a flat DataFrame (propagating top-level metadata like `report_date`, `market_type`, `slug_id` down to each result row)
3. Saves each slug as `APP_CROP_DATA/{slug}_recent.csv`

**CLI usage:**
```bash
cd backend_update
python get_recent_data.py              # last 60 days (default)
python get_recent_data.py --all        # no date filter (max rows)
python get_recent_data.py --days 30    # custom window
```

**Output directory:** `backend_update/APP_CROP_DATA/`

---

## Step 2 — Format: `format_data.py`

Transforms the raw USDA CSVs into the `UnifiedCropPrice` schema.

**Entry point:** `load_and_format_all_data()` → `pd.DataFrame`

Reads every `*_recent.csv` from `APP_CROP_DATA/` and calls `format_for_unified_crop_price(df)` on each.

### Field Mapping

| Output Column | Source Column(s) | Transform |
|---------------|-----------------|-----------|
| `report_date` | `report_date`, `report_end_date` | Parsed from MM/DD/YYYY → ISO 8601 |
| `market_type` | `market_type` | Title-cased |
| `category` | `category`, `community`, `grp`, `group` | Normalized → Fruits / Vegetables / Nuts / Potatoes & Onions / Other |
| `commodity` | `commodity` | Title-cased |
| `variety` | `variety`, `var` | Title-cased |
| `package` | `package`, `pkg`, `size` | Title-cased |
| `origin` | `origin`, `region` (retail fallback) | Title-cased |
| `district` | `district` | Title-cased |
| `organic` | `organic` | Normalized → `"yes"` / `"no"` |
| `price_avg` | `low_price`, `high_price`, `mostly_low_price`, `mostly_high_price`, `wtd_avg_price` | Mean of all non-null price fields |
| `weight_lbs`, `weight_kgs` | `package` (+ `item_size`, `origin`, `district`) | Net package weight: parsed from the package name, else the USDA 2023 container table in `package_units.json`, else null. See [`PACKAGE_WEIGHTS.md`](backend_update/PACKAGE_WEIGHTS.md) |
| `units` | `package` | Count of sellable items ("12 1-pint baskets" → 12, "each" → 1) |
| `price_per_lb` | `price_avg`, `weight_lbs` | `price_avg / weight_lbs` when a weight is known |
| `price_per_unit` | `price_avg`, `units` | `price_avg / units` only when there is a count and no weight |
| `low_price` | `low_price` | Cleaned float |
| `high_price` | `high_price` | Cleaned float |
| `mostly_low_price` | `mostly_low_price` | Cleaned float |
| `mostly_high_price` | `mostly_high_price` | Cleaned float |
| `wtd_avg_price` | `wtd_avg_price` | Cleaned float |
| `market_location_name` | `market_location_name` | Direct |
| `item_size` | `item_size` | Direct |
| `slug_id` | `slug_id` | String |
| `slug_name` | `slug_name` | Direct |
| `supply_tone_comments` | `supply_tone_comments` | Direct |
| `demand_tone_comments` | `demand_tone_comments` | Direct |
| `market_tone_comments` | `market_tone_comments` | Direct |
| `offerings_comments` | `offerings_comments` | Direct |
| `reporter_comment` | `reporter_comment`, `rep_cmt` | First non-null |
| `commodity_comments` | `commodity_comments` | Direct |

**Rows dropped if:** no valid `report_date`, or `commodity` is missing/empty.

**Pass-through columns:** Any raw API column not in the handled set is automatically included in the output, ensuring new USDA fields are never silently lost.

---

## Step 3 — Upload: `overwrite_supabase.py`

Clears and re-populates `UnifiedCropPrice` in Supabase.

**Entry point:** `overwrite_supabase_data(unified_crop_price_df)`

### Execution order (critical)

```
1. detect_new_columns()   ← must run BEFORE clear so table has rows to query
2. clear_table()          ← batch-deletes all rows by ID (10k IDs at a time)
3. upload_dataframe()     ← batch-inserts in groups of 200 rows
```

### Schema detection

Before every upload, `detect_new_columns()` queries a single existing row to determine what columns `UnifiedCropPrice` currently has, then diffs against the DataFrame columns. If new columns are found:

- The ALTER TABLE SQL is printed to stdout
- Those columns are stripped from the upload so it doesn't fail
- On the next run (after the user applies the SQL), all columns populate

Example output:
```
⚠️  New columns detected that are not yet in UnifiedCropPrice:
  Run the following SQL in your Supabase SQL editor, then re-run the pipeline:

    ALTER TABLE "UnifiedCropPrice" ADD COLUMN IF NOT EXISTS "new_field" text;
```

### Credentials

Requires a **service role** key (not the anon key):

```
SUPABASE_URL=https://...supabase.co
SUPABASE_SECRET_KEY=service_role_key_here
```

---

## Orchestrator: `update_daily.py`

Runs all three steps in sequence. This is the only script that needs to be called for a full pipeline run.

```bash
cd backend_update
python update_daily.py
```

Exit code `0` = success, `1` = failure at any step.

```
[Step 1/3] Fetching all available data from USDA API (no date filter)...
[Step 2/3] Formatting data for UnifiedCropPrice table...
[Step 3/3] Uploading to Supabase...
```

---

## Historical Rebuild: `upload_historical.py`

Rebuilds history from the combined `*-Full.csv` files in the sibling `SpecialtyCropPrices/ReportsBySlugID/SlugIDFullFile/` project, using the same `format_for_unified_crop_price()` logic, then refreshes the monthly rollup. Rows from the last 60 days are skipped (the daily pipeline owns them). Idempotent: it deletes each slug + year window before inserting. Set `DB_CONNECTION_STRING` in `.env` for the fast psycopg2 path.

```bash
cd backend_update
python upload_historical.py
```

---

## Static Filters: `extract_filters.py`

Generates pre-computed filter option files consumed by both frontends for instant offline filtering (no DB round-trip when no active filters are set).

**Run from project root after any data change:**
```bash
python backend_update/extract_filters.py
```

**Writes to both:**
- `phone_frontend/src/constants/staticFilters.js`
- `web_frontend/src/constants/staticFilters.js`

**Exports generated:**

| Export | Description |
|--------|-------------|
| `CATEGORY_COMMODITIES` | `{ "Fruits": ["Apples", ...], "Vegetables": [...], ... }` |
| `COMMODITY_TO_CATEGORY` | Reverse lookup built at runtime from `CATEGORY_COMMODITIES` |
| `STATIC_FILTERS` | Flat arrays: categories, commodities, varieties, packages, districts, organics |

---

## Supabase Schema: `UnifiedCropPrice`

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint | Auto-generated primary key |
| `report_date` | timestamptz | USDA report date |
| `market_type` | text | Terminal / Shipping Point / Retail |
| `category` | text | Fruits / Vegetables / Nuts / Potatoes & Onions / Other |
| `commodity` | text | e.g. Apples, Strawberries |
| `variety` | text | e.g. Gala, Fuji |
| `package` | text | e.g. 40 Lb Carton |
| `origin` | text | Growing region |
| `district` | text | Market district |
| `organic` | text | `"yes"` or `"no"` |
| `price_avg` | real | Mean of all available price fields |
| `low_price` | real | USDA low price |
| `high_price` | real | USDA high price |
| `mostly_low_price` | real | USDA mostly low |
| `mostly_high_price` | real | USDA mostly high |
| `wtd_avg_price` | real | Weighted average price |
| `market_location_name` | text | Terminal/market name |
| `item_size` | text | Size designation |
| `slug_id` | text | Source report slug (2306–3324) |
| `slug_name` | text | Human-readable report name |
| `supply_tone_comments` | text | USDA supply narrative |
| `demand_tone_comments` | text | USDA demand narrative |
| `market_tone_comments` | text | Overall market tone |
| `offerings_comments` | text | Offerings narrative |
| `reporter_comment` | text | Reporter notes |
| `commodity_comments` | text | Commodity-level notes |
| `weight_lbs` | real | Net package weight, or null if unknown (see `PACKAGE_WEIGHTS.md`) |
| `weight_kgs` | real | Same weight in kg |
| `units` | real | Sellable items per package, if stated |
| `price_per_lb` | real | `price_avg / weight_lbs` |
| `price_per_unit` | real | `price_avg / units`, only when there is no weight |

---

## Automated Schedule (GitHub Actions)

**File:** `.github/workflows/daily_update.yml`

| Setting | Value |
|---------|-------|
| Schedule | Daily at 21:30 UTC (1:30 PM PST) |
| Trigger | `schedule` + `workflow_dispatch` (manual) |
| Runner | `ubuntu-latest`, Python 3.10 |
| Script | `python backend_update/update_daily.py` |

**Required GitHub Secrets:**

| Secret | Purpose |
|--------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Service role key |
| `USDA_API_KEY` | USDA MARS API key |

---

## Environment Files

| File | Keys | Used By |
|------|------|---------|
| `backend_update/.env` | `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `USDA_API_KEY` | Pipeline scripts |
| `phone_frontend/.env` | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY` (anon) | React Native app |
| `web_frontend/.env.local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY` (anon) | Next.js app |

> The backend uses the **service role key** to write. Both frontends use the **anon key** to read.

---

## Running the Pipeline Locally

```bash
# 1. Install dependencies
cd backend_update
pip install -r requirements.txt

# 2. Create .env
cp .env.example .env   # or create manually

# 3. Run full pipeline (fetch all data, format, upload)
python update_daily.py

# 4. Regenerate static filter files for both frontends
cd ..
python backend_update/extract_filters.py
```

**Individual steps (for debugging):**
```bash
cd backend_update
python get_recent_data.py --all    # Step 1 only: fetch CSVs
python format_data.py              # Step 2 only: test formatting
python overwrite_supabase.py        # Step 3 only: test Supabase connection
```
