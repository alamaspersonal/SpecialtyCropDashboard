# Specialty Crop Dashboard

A comprehensive dashboard to display specialty crop pricing data, featuring a web interface, a Progressive Web App (PWA), and a native mobile app with Supabase integration.

## Project Structure

```
SpecialtyCropDashboard/
├── backend/                    # FastAPI server (Python)
│   ├── main.py                 # API endpoints
│   ├── database.py             # SQLAlchemy models (CropPrice, UnifiedCropPrice)
│   ├── data_ingestion.py       # Import CSV data to database
│   └── .env                    # Local environment config
│
├── backend_update/             # Daily data update pipeline
│   ├── update_daily.py         # Main orchestration script
│   ├── get_recent_data.py      # Fetch data from USDA API
│   ├── format_data.py          # Format data for database schemas
│   ├── overwrite_supabse.py    # Upload to Supabase cloud
│   └── .env                    # API keys (USDA, Supabase)
│
├── phone_frontend/             # React Native mobile app (Expo)
│   ├── App.js                  # App entry with React Query provider
│   ├── src/
│   │   ├── screens/            # App screens
│   │   │   ├── HomeScreen.js
│   │   │   ├── FiltersScreen.js
│   │   │   └── DashboardScreen.js
│   │   ├── components/         # Reusable UI components
│   │   └── services/           # Data layer
│   │       ├── supabase.js     # Supabase client config
│   │       ├── supabaseApi.js  # API functions (getFilters, getPrices, etc.)
│   │       ├── useQueries.js   # React Query hooks for caching
│   │       └── api.js          # Unified exports
│   └── .env                    # Supabase credentials
│
├── frontend/                   # React web app (Vite + Tailwind)
│
├── APP_CROP_DATA/              # Downloaded CSV data from USDA API
│
└── specialty_crop.db           # Local SQLite database
```

---

## Quick Start

### 1. Run the Daily Update Pipeline

Fetches fresh data from USDA and uploads to Supabase:

```bash
cd backend_update
python3 update_daily.py
```

### 2. Run the Mobile App

```bash
cd phone_frontend
npm install
npm run ios  # or: npx expo start
```

The mobile app connects directly to Supabase (no backend server needed).

---

## Backend (FastAPI) - Optional

The FastAPI backend is optional if using Supabase directly. Run it for local development:

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API available at `http://YOUR_LOCAL_IP:8000`

---

## Mobile App Details

### Data Flow

```
USDA API → backend_update → Supabase → Phone App
```

### Services Layer (`phone_frontend/src/services/`)

| File             | Purpose                                         |
| ---------------- | ----------------------------------------------- |
| `supabase.js`    | Supabase client initialization                  |
| `supabaseApi.js` | API functions mirroring FastAPI endpoints       |
| `useQueries.js`  | React Query hooks for caching & offline support |
| `api.js`         | Unified exports for backward compatibility      |

### Offline Support

The app uses TanStack Query (React Query) for:

- **Caching**: Data cached for 30 minutes
- **Offline mode**: Returns cached data when network unavailable
- **Background refresh**: Updates data silently when online

---

## Daily Update Pipeline (`backend_update/`)

| File                   | Purpose                                 |
| ---------------------- | --------------------------------------- |
| `update_daily.py`      | Main script - run this for updates      |
| `get_recent_data.py`   | Fetches last 30 days from USDA MARS API |
| `format_data.py`       | Transforms CSV to database schemas      |
| `overwrite_supabse.py` | Clears and uploads to Supabase tables   |

**Required `.env` variables:**

```
USDA_API_KEY=your_key_here
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SECRET_KEY=your_secret_key
```

---

## Web Frontend (React)

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

Access at `http://localhost:5173` or install as PWA on mobile.

---

## Database Tables (Supabase)

| Table              | Description                           |
| ------------------ | ------------------------------------- |
| `CropPrice`        | Full price data with all USDA fields  |
| `UnifiedCropPrice` | Simplified schema for charts/analysis |

---

## Network Setup

For mobile/PWA to connect to local backend:

1. Find your IP: `ipconfig getifaddr en0`
2. Ensure phone and computer on same WiFi
3. Update `API_URL` in `phone_frontend/src/services/api.js` if using local backend

---

## Security Notes

- Enable **Row Level Security (RLS)** on Supabase tables for production
- Never commit `.env` files (they're in `.gitignore`)
- Use `EXPO_PUBLIC_` prefix for client-safe env vars
