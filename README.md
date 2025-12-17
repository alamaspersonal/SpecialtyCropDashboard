# Specialty Crop Dashboard

A comprehensive dashboard to display specialty crop pricing data, featuring a web interface, a Progressive Web App (PWA), and a native mobile app.

## Project Structure

- **frontend/**: React + Vite web application with Tailwind CSS (PWA enabled).
- **phone_frontend/**: React Native mobile application (Expo).
- **backend/**: FastAPI application using SQLite.
- **specialty_crop.db**: SQLite database (created by backend).

## Network Setup (Important for Mobile & PWA)

To allow the mobile app or PWA to connect to your computer, you must run the servers on your local network IP (not just localhost).

1. Find your computer's local IP address (e.g., `192.168.1.108`).
   - Mac: `ipconfig getifaddr en0` (or `en1`)
2. Ensure your phone and computer are on the **same WiFi network**.

---

## 1. Backend (FastAPI)

The backend serves data to both the web and mobile apps.

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate virtual environment (recommended):
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the server (exposed to network):
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   The API will be running at `http://YOUR_LOCAL_IP:8000`.

---

## 2. Web Frontend & PWA (React)

The web dashboard works in any browser and can be installed as a PWA on mobile.

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server (exposed to network):
   ```bash
   npm run dev -- --host 0.0.0.0
   ```
4. **Accessing:**
   - **Computer:** Open `http://localhost:5173`
   - **Phone (PWA):** Open `http://YOUR_LOCAL_IP:5173` in mobile Chrome/Safari. Tap "Share" -> "Add to Home Screen" to install.

---

## 3. Mobile App (React Native / Expo)

A native mobile application for iOS and Android.

1. Navigate to the mobile app directory:
   ```bash
   cd phone_frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. **Running the App:**

   **Option A: Run on real phone (easiest)**
   1. Install **Expo Go** app on your phone from App Store / Play Store.
   2. Start the Expo server:
      ```bash
      npx expo start
      ```
      (Use `npx expo start --tunnel` if you have firewall issues connecting)
   3. Scan the QR code shown in the terminal with your phone.

   **Option B: Run on iOS Simulator (Mac only)**
   1. Ensure Xcode is installed.
   2. Run:
      ```bash
      npm run ios
      ```

   **Option C: Run on Android Emulator**
   1. Ensure Android Studio is installed and an emulator is running.
   2. Run:
      ```bash
      npm run android
      ```

## Data Processing Pipeline

New scripts have been added to process raw CSV reports:

- `process_all_slugs.py`: Orchestrates the cleaning and combining of all reports.
- `combine_reports.py`: Combines individual year/part files into a single master CSV (output to `SlugIDFullFile/`).
- `order_by_date.py`: Sorts the combined CSVs by date descending.
