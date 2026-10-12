# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Specialty Crop Dashboard — displays USDA specialty crop pricing data (fruits, vegetables, nuts, potatoes & onions). Data flows: **USDA MARS API -> backend_update (Python) -> Supabase -> phone_frontend (React Native) / web_frontend (Next.js)**.

One Supabase table drives the app:
- **UnifiedCropPrice** — simplified schema with `price_avg` for charts and time-series analysis (also carries market tone comments and supply/demand notes)

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
python overwrite_supabse.py       # Step 3 only: test Supabase connection
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

### Original Backend (FastAPI) — largely superseded by direct Supabase queries
```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Architecture

### phone_frontend (Primary Focus)

**Stack**: Expo 54, React Native 0.81, React 19, TanStack React Query, Supabase JS, Victory Native (charts), Shopify React Native Skia.

**Navigation flow**: `Onboarding -> Home -> Filters -> Dashboard` (also `Account` from Home).

**Data layer** (`src/services/`):
- `supabase.js` — client init using `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_KEY`
- `supabaseApi.js` — all Supabase queries (getFilters, getPrices, getStats, getUnifiedPrices, getTimeSeriesData, getPricesByDateRange, getDateRange). Queries the UnifiedCropPrice table directly. Implements pagination (1000 rows/page) with safety limits. `getTimeSeriesData` caps history at 2 years (phone app only — web_frontend allows full history).
- `useQueries.js` — TanStack Query hooks wrapping supabaseApi functions. 5-minute stale time, 30-minute cache, offlineFirst mode.
- `api.js` — re-exports everything from supabaseApi.js and useQueries.js. Legacy axios instance kept for backward compat but unused.
- `cerebrasApi.js` — calls Cerebras AI (gemma-4-31b) to generate market insight summaries from shipping/terminal market notes.
- `favorites.js` / `userStorage.js` — AsyncStorage-based local persistence for watchlist and user prefs.

**Custom hooks** (`src/hooks/`):
- `useWaterfallData` — core data hook for DashboardScreen waterfall view. Fetches from UnifiedCropPrice via `getPricesByDateRange`, partitions by market type, implements cascading sub-filters (package/origin/district per market type), calculates stats. Each instance runs independently for dual-waterfall comparison.
- `usePriceTimeSeries` — fetches history from `getTimeSeriesData` (capped at 2 years), aggregates to monthly averages per market type. Cascading sub-filters for package/origin. Time range presets (3M/6M/1Y/2Y).

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
2. `format_data.py` — transforms raw CSV columns to the UnifiedCropPrice schema. Normalizes categories (Vegetables/Fruits/Nuts/Potatoes & Onions/Other), title-cases commodity/variety/package, normalizes organic to yes/no, calculates `price_avg` as mean of available price fields.
3. `overwrite_supabse.py` — clears the UnifiedCropPrice table (batch delete by ID), then batch-inserts new data (500 rows/batch). Uses `SUPABASE_SECRET_KEY` (service role key, not anon key).

**USDA Slug IDs**: 2306, 2307, 2308, 2309, 2390, 2391, 3324 — each represents a different USDA market report.

`extract_filters.py` — generates `phone_frontend/src/constants/staticFilters.js` from the formatted data. Run after data changes to keep offline filter options current. Also generates `CATEGORY_COMMODITIES` and `COMMODITY_TO_CATEGORY` lookup maps.

`upload_recent_slugs.py` — alternative upload path that reads from sibling project `SpecialtyCropPrices/recent_slugs/`.

### web_frontend

Next.js 16 app with TailwindCSS, Recharts, Framer Motion. Mirrors the phone_frontend's data layer architecture (same Supabase tables, similar service/hook/shared structure). Uses App Router.

### CI/CD

GitHub Actions workflow (`.github/workflows/daily_update.yml`) runs `backend_update/update_daily.py` daily at 21:30 UTC (1:30 PM PST). Secrets: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `USDA_API_KEY`.

## Environment Variables

**phone_frontend/.env**: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY` (anon key), `EXPO_PUBLIC_CEREBRAS_API_KEY`

**backend_update/.env**: `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (service role), `USDA_API_KEY`

**web_frontend/.env.local**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY`

## Key Patterns

- Supabase queries paginate in 1000-row pages with safety caps (20k-100k rows depending on query)
- Filter state cascades: changing a parent filter validates/clears child selections immediately using local lookup maps (no DB round-trip)
- Price data is partitioned by market_type (Terminal/Shipping/Retail) throughout the app — stats, filters, and charts all operate per-market-type
- `useWaterfallData` can be instantiated multiple times for side-by-side comparison
- The `priceBridge` engine (web_frontend only — see above) is intentionally framework-agnostic
- The backend (FastAPI + SQLite) is the original architecture; the app has migrated to querying Supabase directly from the frontends
