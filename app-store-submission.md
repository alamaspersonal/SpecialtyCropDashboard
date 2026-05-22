# App Store Connect Submission Guide
## Specialty Crop Dashboard

---

## 1. App Store Metadata

### App Name
```
Specialty Crop Dashboard
```
_(24 / 30 characters)_

---

### Subtitle
```
USDA Market Prices & Trends
```
_(27 / 30 characters)_

---

### Description
```
Track official USDA specialty crop market prices — all in one place, updated daily.

Specialty Crop Dashboard gives farmers, growers, and produce professionals instant access to real pricing data for fruits, vegetables, nuts, potatoes, and onions across three market types: Terminal, Shipping Point, and Retail.

PRICE DATA & CHARTS
• Live prices pulled directly from USDA Agricultural Marketing Service (AMS) reports
• Price trends over time: 3-month, 6-month, 1-year, 2-year, and all-time views
• Waterfall charts breaking down price levels by market type
• Period-over-period comparison: see exactly what drove price changes between any two date ranges using price bridge decomposition (Price Level, Package Mix, Origin Mix effects)

AI MARKET INSIGHTS
• AI-generated summaries of supply conditions, demand, and market tone — drawn from official USDA market notes

FILTERING & WATCHLIST
• Filter by category, commodity, variety, organic status, district, package type, and origin
• Watchlist to track your most important crops across sessions
• Cascading filters update instantly with no loading delays

BUILT FOR THE FIELD
• Works in light and dark mode
• Offline-friendly: filter options load without an internet connection
• Clean, fast interface designed for quick price lookups

Data is sourced exclusively from the USDA MARS (Market News) API and refreshed daily. No account or sign-up required.
```
_(1,258 / 4,000 characters)_

---

### Keywords
```
USDA prices,farm market,produce prices,commodity,agriculture,fruit,vegetable,nuts,terminal market
```
_(96 / 100 characters — do not repeat words from the app name or subtitle)_

**Keyword rationale:**
- **USDA prices** — the defining data source; farmers and buyers search specifically for USDA data
- **farm market** — broad intent match for the target audience
- **produce prices** — high-relevance search term for buyers and growers
- **commodity** — used by professionals in the ag industry
- **agriculture** — broad category anchor
- **fruit / vegetable / nuts** — the three main crop categories in the app
- **terminal market** — specific market type that trade professionals search for

---

### App Category
| Field | Value |
|---|---|
| Primary Category | Business |
| Secondary Category | Reference |

---

### Age Rating
**4+** — No objectionable content. No user-generated content visible to others. No unrestricted web access.

---

### Copyright
```
© 2026 Anthony Lamas
```
_(Update to your legal entity name if applicable)_

---

### Support URL
You need a publicly accessible URL. The easiest free option is a GitHub repository page, for example:
```
https://github.com/[your-username]/SpecialtyCropDashboard
```

### Privacy Policy URL
Host the `privacy-policy.html` file (provided below) at a stable public URL. The easiest free approach is **GitHub Pages**:

1. Create a `docs/` folder in your repo (or a separate `gh-pages` branch)
2. Drop `privacy-policy.html` in it
3. Enable GitHub Pages in repo Settings → Pages
4. Your URL will be: `https://[your-username].github.io/SpecialtyCropDashboard/privacy-policy.html`

Enter that URL in the Privacy Policy URL field in App Store Connect.

---

## 2. Privacy Nutrition Label

Apple requires you to declare data practices for your app **and all third-party SDKs** bundled in it. This section reflects what the app actually does based on its code.

### Summary

**This app collects no data.** Select "No Data Collected" in App Store Connect.

Here is the reasoning for each data type Apple asks about:

---

### Data Types — Detailed Breakdown

| Data Type | Collected? | Reasoning |
|---|---|---|
| **Contact Info** (name, email, phone, address) | ❌ No | The display name entered in Account screen is stored locally on-device only via AsyncStorage. It is never transmitted anywhere. |
| **Health & Fitness** | ❌ No | Not applicable. |
| **Financial Info** | ❌ No | Not applicable. |
| **Location** | ❌ No | The app does not request location permissions. |
| **Sensitive Info** | ❌ No | Not applicable. |
| **Contacts** | ❌ No | Not applicable. |
| **User Content** (photos, videos) | ❌ No | Profile photo selected via `expo-image-picker` is stored only as a local URI in AsyncStorage. The image is never uploaded, transmitted, or accessible outside the device. |
| **Browsing History** | ❌ No | Not applicable. |
| **Search History** | ❌ No | Not applicable. |
| **Identifiers** (User ID, Device ID) | ❌ No | There is no user account system. No user ID is created or transmitted. The Supabase client uses an anonymous public key only. |
| **Purchases** | ❌ No | The app is free with no in-app purchases. |
| **Usage Data** (product interaction) | ❌ No | No analytics SDK is present (no Firebase Analytics, Amplitude, Mixpanel, Segment, etc.). Filter selections and navigation are not transmitted. |
| **Diagnostics** (crash data, logs) | ❌ No | No crash reporting SDK is present (no Sentry, Bugsnag, etc.). |

---

### Third-Party SDK Review

| SDK / Service | Data Practice |
|---|---|
| **Supabase JS** (`@supabase/supabase-js`) | The app makes anonymous read-only queries to your Supabase project using the public anon key. No user identifier is sent. Supabase may log IP addresses server-side as part of normal infrastructure operation — this is standard for any internet service and is not considered "data collection" under Apple's guidelines. |
| **Cerebras AI** (`cerebrasApi.js`) | When a user views market insights, the app sends USDA market notes (supply/demand/tone text from government reports) to the Cerebras API. No personal data is included in these requests. Filter context (variety, origin, package type) refers to agricultural data categories, not user identity. |
| **AsyncStorage** (`@react-native-async-storage/async-storage`) | All data (display name, profile image URI, watchlist, theme preference, onboarding state) stored locally on device. Nothing is transmitted. |
| **expo-image-picker** | Accesses photo library with user permission. Selected image URI stored locally only. |
| **React Navigation, Skia, Victory Native, Reanimated, Gesture Handler** | UI/rendering libraries with no data collection. |
| **Expo SDK** (base) | A standalone production Expo app does not include Expo's development telemetry. No analytics are bundled at runtime. |

---

### What to Enter in App Store Connect

Navigate to **Your App → App Privacy** and answer as follows:

1. **"Do you collect data from this app?"** → Select **No**
2. Click **Publish** once reviewed

That's it. Because no data is collected, you will not need to fill out data type cards or link data to identity.

> **Note for the future:** If you ever add crash reporting (e.g., Sentry), user accounts, or analytics, you will need to update this label before releasing the next version.

---

## 3. Checklist Before Submitting

- [ ] Privacy policy hosted at a public URL (see Section 1)
- [ ] Support URL accessible (GitHub repo page is fine)
- [ ] App binary uploaded via Xcode or EAS Submit (`eas submit --platform ios`)
- [ ] Screenshots uploaded for iPhone 6.9" (required) and optionally iPad
- [ ] App icon set to 1024×1024 PNG (no alpha channel)
- [ ] `expo-image-picker` permission string set in `app.json` under `infoPlist`:
  ```json
  "NSPhotoLibraryUsageDescription": "Choose a profile photo for your account."
  ```
- [ ] Age rating questionnaire completed (all answers: No → results in 4+)
- [ ] Copyright field filled in
- [ ] Version number and build number set correctly

---

*Generated May 2026 for Specialty Crop Dashboard v1.0*
