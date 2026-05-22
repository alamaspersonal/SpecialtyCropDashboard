# Web Frontend — Architecture & Developer Guide

Next.js 16 app that mirrors the phone frontend's feature set in a browser. Reads from Supabase directly, uses Tailwind v4 for styling, Recharts for charts, and proxies AI market-insight calls server-side.

---

## Stack

| Layer | Library | Version |
|---|---|---|
| Framework | Next.js (App Router, Turbopack) | 16.1.6 |
| UI runtime | React | 19.2.3 |
| Data fetching | TanStack React Query | 5.90 |
| Database | Supabase JS SDK | 2.98 |
| Charts | Recharts | 3.8 |
| Animation | Framer Motion | 12.35 |
| Styling | Tailwind CSS v4 + PostCSS | 4.2 |
| Icons | Lucide React | 0.577 |

---

## Directory Layout

```
src/
├── app/                     # Next.js App Router pages + API routes
│   ├── layout.js            # Root HTML shell, fonts, metadata
│   ├── page.js              # Home: search + watchlist
│   ├── globals.css          # Tailwind v4 @theme tokens + base styles
│   ├── providers.js         # React Query + Theme providers
│   ├── onboarding/page.js   # First-run name-entry screen
│   ├── filters/page.js      # Cascading filter selection wizard
│   ├── dashboard/page.js    # Core analytics view
│   ├── account/page.js      # Profile, dark mode, data clear
│   └── api/insights/route.js # Server-side Cerebras AI proxy
├── components/              # All UI components (see below)
├── context/ThemeContext.js  # Dark/light mode via data-theme attribute
├── hooks/usePriceBridge.js  # Period A vs B comparison hook
├── services/                # Data access + external APIs
├── shared/priceBridge.js    # Platform-agnostic price decomposition engine
├── utils/exportUtils.js     # CSV generation + browser download
└── constants/staticFilters.js  # Hard-coded category↔commodity maps
```

---

## Navigation Flow

```
/onboarding  →  /  (Home)  →  /filters  →  /dashboard?[params]
                    ↓
                /account
```

All navigation state is URL-encoded. `/dashboard` reads commodity, category, variety, organic, package, district from query params. The filter page writes those params; the dashboard reads them.

---

## Pages

### `/` — Home (`page.js`)

- Hero section with a searchable commodity input.
- Autocomplete draws from `STATIC_FILTERS.commodities` (no API call).
- Watchlist shows saved favorites read from localStorage via `favorites.js`.
- Each `WatchlistCard` links to `/dashboard?commodity=...`.

### `/onboarding` (`onboarding/page.js`)

- Shown once on first visit (checked via `userStorage.hasCompletedOnboarding()`).
- Collects user name (min 2 chars), stores via `userStorage.setUserName()`.
- Redirects to `/` after completion.

### `/filters` (`filters/page.js`)

- Cascading select: **Category → Commodity → Variety → District**.
- Category change clears Commodity; Commodity change clears Variety.
- "Complete Data Only" and "Organic Only" toggles filter commodities using `getCommoditiesWithCompleteData()` / `getCommoditiesWithOrganicData()`.
- "Apply Filters" pushes to `/dashboard` with all selected params.

### `/dashboard` (`dashboard/page.js`)

- Reads filter params from `useSearchParams()`.
- Time range: preset buttons (1d, 7d, 30d) or custom date picker.
- View modes: **Overview** (waterfall + price blocks) and **Compare** (Period A vs B bridge).
- Favorite toggle writes to localStorage.
- Export dropdown generates CSVs per market type.
- Inline `DashboardFilters` panel lets you change commodity without going back to `/filters`.

### `/account` (`account/page.js`)

- Inline name editing (save/cancel without page reload).
- Dark mode toggle syncs to `ThemeContext` + localStorage.
- "Clear All Data" calls `userStorage.clearUserData()` + `favorites` clear.

### `/api/insights` (`route.js`)

- Server-only POST endpoint — the `CEREBRAS_API_KEY` never reaches the browser.
- Accepts `{ commodity, shippingData, terminalData, dateInfo, filterContext }`.
- Builds a structured prompt with Shipping Point and Terminal Market sections.
- Calls Cerebras (`llama3.1-8b`, max 300 tokens, temp 0.5).
- Returns `{ insight: "..." }` or a graceful fallback string.

---

## Components

### `Header/Header.js`
Sticky glass-morphic nav bar. Desktop: nav links with Framer Motion `layoutId` active indicator. Mobile: hamburger → slide-down menu. Theme toggle (Sun/Moon) calls `setTheme`.

### `PageTransition/PageTransition.js`
Wraps every page content area. Framer Motion `opacity` + `y` translate on enter/exit (300ms ease).

### `PriceWaterfall/PriceWaterfall.js`
Three `PriceBlock` sub-components side-by-side (Terminal | Shipping Point | Retail). Each block shows:
- Colored header stripe (sky / orange / purple per market type)
- Average price with unit label
- Date range and report count
- Sub-filter dropdowns: **Package**, **Origin**, **District** (populated from data)
- Horizontal summary bar comparing the three market averages at the bottom

### `PriceBridge/PriceBridge.js`
Recharts `BarChart` that renders the waterfall decomposition from `priceBridge.js`:
- Period A base (blue anchor bar)
- Price Level Effect (green/red floating bar)
- Package Mix Effect
- Origin Mix Effect
- Residual / Other
- Period B total (blue anchor bar)

Each bar has a custom tooltip. Positive deltas are green, negative are red.

### `ComparisonContainer/ComparisonContainer.js`
Houses the compare-mode UI:
- Dual date pickers (Period A blue, Period B green).
- Preset time range buttons per period.
- Calls `usePriceBridge` hook for decomposed results.
- Summary chips showing `±$` and `±%` per market type.
- Side-by-side bar chart for Period A vs B averages.

### `DashboardFilters/DashboardFilters.js`
Collapsible inline filter panel (height + opacity animation). Mirrors the `/filters` page logic but without a full page navigation. Applies by pushing updated URL params.

### `FilterDropdown/FilterDropdown.js`
Custom `<select>` replacement:
- Animated chevron.
- Search input injected when options > 5.
- Click-outside closes the menu.
- Optional color dot indicator.

### `WatchlistCard/WatchlistCard.js`
Expandable card for saved favorites. Chevron rotates on expand. "View Dashboard" button in the expanded area navigates to the dashboard with that commodity pre-loaded.

### `ExportDropdown/ExportDropdown.js`
Four export options: Combined, Terminal, Retail, Shipping. Each calls `exportToCSV()` with the appropriate data slice. Shows record count next to each option.

### `LoadingSkeleton/LoadingSkeleton.js`
Four exports: `SkeletonBlock`, `SkeletonCard`, `SkeletonChart`, `SkeletonText`. All apply the CSS `.skeleton` shimmer class.

---

## Services

### `supabase.js`
Creates and exports a single Supabase client using `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_KEY`. Session persistence is on; session-in-URL detection is off.

### `supabaseApi.js`
All database access. Key functions:

| Function | What it does |
|---|---|
| `getFilters(filters)` | Returns distinct options for commodity/variety/package/district; uses CATEGORY_COMMODITIES for fast client-side category filtering |
| `getPricesByDateRange(filters, start, end)` | Paginates UnifiedCropPrice in 1000-row pages up to a 20k-row safety cap |
| `getDateRange(filters)` | Two single-row queries (min + max `report_date`) for the picker bounds |
| `getStats(filters, cutoff)` | Computes current-week vs prior-week averages and % delta per market type |
| `getCommoditiesWithCompleteData()` | Queries `commodity_metadata` for `has_complete_data = true` |
| `getCommoditiesWithOrganicData()` | Queries `commodity_metadata` for `has_organic_data = true` |

All paginating functions use a `while (true)` loop fetching 1000 rows at a time until Supabase returns fewer than 1000 (end of data) or the safety cap is hit.

### `useQueries.js`
Thin React Query wrappers around supabaseApi functions. All hooks share:
- `staleTime: 5 minutes`
- `gcTime: 30 minutes`
- `retry: 2`
- `refetchOnWindowFocus: false`
- `networkMode: 'offlineFirst'`

### `favorites.js`
localStorage CRUD for the watchlist. Key: `@market_intel_favorites`. Stores an array of filter objects `{ commodity, category, variety, ... }`.

### `userStorage.js`
localStorage CRUD for user profile. Keys: `USER_NAME`, `ONBOARDING_COMPLETE`, `THEME_PREFERENCE`. All wrapped in try/catch. `clearUserData()` removes all keys atomically.

### `cerebrasApi.js`
Client-side wrapper that POSTs to `/api/insights`. Returns the AI-generated insight string or a fallback error message. Never touches the API key directly.

---

## Shared Logic

### `shared/priceBridge.js`

Zero-dependency price decomposition engine (shared with `phone_frontend`). Given two arrays of rows (Period A and Period B from `UnifiedCropPrice`):

1. **`buildSegmentMap(rows)`** — groups rows by `(package, origin)` pair, computes weighted average price for each segment.
2. **`buildDimensionMap(rows, field)`** — groups by a single field (`package` or `origin`), computes share weights.
3. **`computeBridge(periodA, periodB)`** — core Laspeyres decomposition:
   - **Price Level Effect**: hold Period A weights, apply Period B prices.
   - **Package Mix Effect**: shift in package-type distribution × reference price.
   - **Origin Mix Effect**: shift in origin distribution × reference price.
   - **Residual**: `totalDelta − (priceLevel + packageMix + originMix)` — ensures the bridge always sums exactly.
4. **`computeAllBridges(allDataA, allDataB)`** — partitions data by `market_type` and runs `computeBridge` for Terminal, Shipping Point, and Retail. Returns a summary object with all three bridges plus per-market-type totals.

---

## Context

### `context/ThemeContext.js`
On mount, reads `localStorage.THEME_PREFERENCE` (or system `prefers-color-scheme` as fallback). Applies `data-theme="dark"|"light"` to `<html>`. All dark-mode CSS overrides in `globals.css` key off this attribute. Consumers call `useTheme()` → `{ theme, setTheme }`.

---

## Styling System (`globals.css`)

Tailwind v4 with an `@theme` block defining all design tokens as CSS custom properties:

| Token group | Examples |
|---|---|
| Colors | `--color-surface`, `--color-accent` (#22c55e / green), `--color-terminal` (sky), `--color-shipping` (orange), `--color-retail` (purple) |
| Typography | `--font-sans` (Inter), `--font-mono` (JetBrains Mono) |
| Shadows | `--shadow-card`, `--shadow-glass`, `--shadow-dropdown` |
| Radii | `--radius-card` (16px), `--radius-button` (12px), `--radius-pill` (9999px) |
| Layout | `--header-height` (64px), `--max-content` (1400px) |
| Easing | `--ease-spring`, `--ease-smooth` |

Dark mode overrides all color tokens under `[data-theme="dark"]`.

Three utility classes used across many components:
- `.glass` — `backdrop-filter: blur(20px)` translucent card surface
- `.skeleton` — shimmer loading placeholder animation
- `.spinner` — rotating border animation for loading states

---

## Constants (`staticFilters.js`)

Pre-computed at build time by running `backend_update/extract_filters.py`. Contains:

- **`CATEGORY_COMMODITIES`** — `{ Fruits: [...], Vegetables: [...], Nuts: [...], "Potatoes & Onions": [...], Other: [...] }`. ~200 commodities total.
- **`COMMODITY_TO_CATEGORY`** — reverse lookup built from `CATEGORY_COMMODITIES`.
- **`STATIC_FILTERS`** — complete snapshot of all filter options (categories, commodities, varieties, packages, districts). Used as the zero-API fallback for the initial filter render.

When `STATIC_FILTERS` is stale (new USDA data added), run:
```bash
cd backend_update && python extract_filters.py
```

---

## Data Flow Summary

```
User picks filters (/filters page)
        ↓
URL params pushed to /dashboard?commodity=...&variety=...
        ↓
dashboard/page.js reads params → calls getPricesByDateRange()
        ↓
supabaseApi.js paginates UnifiedCropPrice table
        ↓
React Query caches result (5min stale, 30min gc)
        ↓
PriceWaterfall renders 3 market-type price blocks
        ↓ (optional)
ComparisonContainer calls usePriceBridge
        ↓
priceBridge.js decomposes delta into Price Level + Mix effects
        ↓
PriceBridge chart renders waterfall bars
```

---

## Environment Variables

| Variable | Scope | Used by |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | `supabase.js` |
| `NEXT_PUBLIC_SUPABASE_KEY` | Client + Server | `supabase.js` (anon/public key) |
| `CEREBRAS_API_KEY` | **Server only** | `app/api/insights/route.js` |

The Cerebras key must NOT have a `NEXT_PUBLIC_` prefix — it would be bundled into client JS if it did.

---

## Running Locally

```bash
cd web_frontend
npm install
npm run dev        # Turbopack dev server → http://localhost:3000
npm run build      # Production build
npm run lint       # ESLint
```

The app expects a `.env.local` in `web_frontend/` with the three variables above. Copy `.env.local.example` if available, or ask the project owner for credentials.

---

## Known Limitations

- **Weight calculation in priceBridge**: uses report-count as a weight proxy. USDA data does not include sales volume, so mix effects reflect frequency of reports, not trade volume.
- **`staticFilters.js` drift**: if new commodities are added to the USDA pipeline and `extract_filters.py` is not re-run, those commodities will not appear in the Category dropdown or autocomplete until the file is regenerated.
- **No authentication**: the Supabase anon key is public. Row-level security on Supabase controls what can be read/written.
