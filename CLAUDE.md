# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Specialty Crop Dashboard — displays USDA specialty crop pricing data (fruits, vegetables, nuts, potatoes & onions). Data flows: **USDA MARS API -> backend_update (Python) -> Supabase -> phone_frontend (React Native) / web_frontend (Next.js)**.

One Supabase table drives the app:
- **UnifiedCropPrice** — simplified schema with `price_avg` for charts and time-series analysis (also carries market tone comments and supply/demand notes)

Plus one derived table:
- **UnifiedCropPriceMonthly** — monthly price sums/counts per commodity × market type × variety × package × district × organic × price basis ($/lb, $/each, $/package). Backs the web chart's 1Y/2Y/All ranges, the phone chart's 1Y/2Y ranges, phone custom waterfall ranges too large for raw rows, and raw-export row counts. Rebuilt by `refresh_price_monthly()` (see `backend_update/sql/unified_crop_price_monthly.sql`), which `overwrite_supabase.refresh_monthly_rollup()` calls after every upload — any other change to UnifiedCropPrice rows must refresh it too.

Three market types throughout: **Terminal**, **Shipping Point**, **Retail**.

## Common Commands

### Phone Frontend (React Native / Expo)
```bash
cd phone_frontend
npm install
npx expo start           # Dev server (Expo Go)
npm run ios              # Run on iOS simulator
npm run android          # Run on Android emulator
npm test                 # Jest tests
npx jest --testPathPattern=supabaseApi  # Run a single test file
```

### Backend Update Pipeline (Python)
```bash
cd backend_update
pip install -r requirements.txt   # requests, pandas, python-dotenv, supabase
python update_daily.py            # Full pipeline: fetch USDA -> format -> upload Supabase
python get_recent_data.py         # Step 1 only: fetch CSVs from USDA API
python format_data.py             # Step 2 only: test formatting logic
python overwrite_supabase.py      # Step 3 only: test Supabase connection
python extract_filters.py        # Regenerate phone_frontend/src/constants/staticFilters.js
```

### Web Frontend (Next.js)
```bash
cd web_frontend
npm install
npm run dev              # Dev server at localhost:3000
npm run build            # Production build
npm run lint             # ESLint
```

## Architecture

### phone_frontend (Primary Focus)

**Stack**: Expo 54, React Native 0.81, React 19, Supabase JS, Victory Native (charts), Shopify React Native Skia.

**Navigation flow**: `Onboarding -> Home -> Filters -> Dashboard` (also `Account` from Home).

**Data layer** (`src/services/`):
- `supabase.js` — client init using `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_KEY`
- `supabaseApi.js` — all Supabase queries (getFilters, getStats, getPricesByDateRange, countPricesByDateRange, getTimeSeriesWindow, getMonthlyPriceRollup, getDateRange). Raw UnifiedCropPrice queries page newest-first with a (report_date, id) cursor — OFFSET paging timed out past the anon role's 3s limit on large commodities — with row safety caps. `getMonthlyPriceRollup` reads UnifiedCropPriceMonthly.
- `api.js` — re-exports the supabaseApi.js functions screens and hooks use; tests mock this module.
- `favorites.js` / `userStorage.js` — AsyncStorage-based local persistence for watchlist and user prefs.

**Custom hooks** (`src/hooks/`):
- `useWaterfallData` — core data hook for DashboardScreen waterfall view. Presets (Daily/7/30 days) use 90 days of raw rows ending on the commodity's latest report; a custom range over 20k raw rows uses the monthly rollup plus raw rows for its partial end months (no Origin filter then). Partitions by market type, cascading sub-filters (package/origin/district/variety per market type; package defaults to All), calculates stats. Prices are grouped by unit via `shared/priceEntries.js`: one $/lb average across weighed packages, $/each and $/package kept separate per package. Each instance runs independently for dual-waterfall comparison.
- `usePriceTimeSeries` — 3M/6M from raw rows (`getTimeSeriesWindow`, daily points), 1Y/2Y from the monthly rollup (monthly points). One unit ($/lb, $/each, $/package) for all lines, chosen by a selector; in $/each and $/package each line shows a single package. Per-market sub-filters for variety/package/origin (origin only for 3M/6M).

**Key components** (`src/components/`):
- `PriceWaterfallMobile` — waterfall chart showing terminal/shipping/retail price bars
- `PriceOverTimeChart` — time-series line chart using Victory Native
- `ExpandableBottomSheet` — gesture-driven bottom sheet using react-native-reanimated

**DashboardScreen** has two view modes: `waterfall` (default) and `chart` (price over time). All share the same top-level filters (commodity, variety, organic). (The `priceBridge` engine and its `compare` view mode described in web_frontend's architecture were never built for the phone app.)

**Filter hierarchy**: `category -> commodity -> variety` (cascading). `district` and `organic` are independent. `staticFilters.js` provides pre-computed filter options for instant offline filtering; Supabase is only queried when active filters are set.

**Theme**: Dark/light mode via `ThemeContext`. Slate-based color palette. Persisted to AsyncStorage.

### backend_update

**Pipeline** (`update_daily.py` orchestrates):
1. `get_recent_data.py` — fetches last 60 days from USDA MARS API (`marsapi.ams.usda.gov/services/v1.2/reports`) for configured slug IDs. Flattens nested JSON sections into flat DataFrames. Saves CSVs to `APP_CROP_DATA/`.
2. `format_data.py` — transforms raw CSV columns to the UnifiedCropPrice schema. Normalizes categories (Vegetables/Fruits/Nuts/Potatoes & Onions/Other), title-cases commodity/variety/package, normalizes organic to yes/no, calculates `price_avg` as mean of available price fields, and derives package weight → `price_per_lb` / `price_per_unit`. Weights come only from the package name or the USDA 2023 container table in `package_units.json` — see `backend_update/PACKAGE_WEIGHTS.md` before touching weights.
3. `overwrite_supabase.py` — clears the UnifiedCropPrice table (batch delete by ID), then batch-inserts new data (500 rows/batch). Uses `SUPABASE_SECRET_KEY` (service role key, not anon key).

**USDA Slug IDs**: 2306, 2307, 2308, 2309, 2390, 2391, 3324 — each represents a different USDA market report.

`extract_filters.py` — generates `phone_frontend/src/constants/staticFilters.js` from the formatted data. Run after data changes to keep offline filter options current. Also generates `CATEGORY_COMMODITIES` and `COMMODITY_TO_CATEGORY` lookup maps.

`upload_historical.py` — full historical rebuild from the sibling project's `SpecialtyCropPrices/ReportsBySlugID/SlugIDFullFile/*-Full.csv` files (skips the last 60 days, which the daily pipeline owns).

`update_cpi.py` — refreshes both frontends' `cpiData.js` from the BLS CPI-U series (monthly workflow).

### web_frontend

Next.js 16 app with TailwindCSS, Recharts, Framer Motion. Mirrors the phone_frontend's data layer architecture (same Supabase tables, similar service/hook/shared structure). Uses App Router.

### CI/CD

GitHub Actions workflow (`.github/workflows/daily_update.yml`) runs `backend_update/update_daily.py` daily at 21:30 UTC (1:30 PM PST). Secrets: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `USDA_API_KEY`.

## Environment Variables

**phone_frontend/.env**: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY` (anon key)

**backend_update/.env**: `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (service role), `USDA_API_KEY`

**web_frontend/.env.local**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY`

## Key Patterns

- Supabase queries paginate in 1000-row pages with safety caps (20k-100k rows depending on query)
- Filter state cascades: changing a parent filter validates/clears child selections immediately using local lookup maps (no DB round-trip)
- Price data is partitioned by market_type (Terminal/Shipping/Retail) throughout the app — stats, filters, and charts all operate per-market-type
- `useWaterfallData` can be instantiated multiple times for side-by-side comparison
- The `priceBridge` engine (web_frontend only — see above) is intentionally framework-agnostic
- Both frontends query Supabase directly; there is no app server
