# OorjaMan - billing & paid services

Living checklist of third-party services that require billing accounts, API keys, or usage-based fees. Add a new dated entry when we onboard another provider.

**Do not commit real API keys or secrets to this file.** Store keys in `.env` (local) or your secret manager (CI/production).

For a full **development vs production** env checklist (Supabase, Expo, Vite, edge functions, push), see [**ENVIRONMENT.md**](ENVIRONMENT.md).

---

## How to add an entry

Copy this template for each new service:

```markdown
### [Service name] - [short purpose]

- **Status:** not started | in setup | active | optional
- **Used by:** apps/packages affected
- **Env var(s):** `NAME=description`
- **Console:** link
- **APIs / products to enable:**
- **Requires billing account:** yes/no
- **Typical cost notes:**
- **Setup steps:**
- **Key restrictions (recommended):**
- **Deploy / rebuild notes:**
- **What works without it:**
- **Added:** YYYY-MM-DD
- **Last reviewed:** YYYY-MM-DD
- **Notes:**
```

---

## Entries

### Google Maps Platform - in-app maps & site photo stamps

- **Status:** optional for browser links; **required** for Google map tiles in the customer app (iOS/Android)
- **Used by:** `apps/customer-app` - site photo stamp (`SitePhotoMapSnapshot`), booking track, activity map preview; `app.config.ts` native SDK config; `lib/google-maps.ts` static map fallback
- **Env var(s):** `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in `apps/customer-app/.env`
- **Console:** https://console.cloud.google.com/
- **APIs / products to enable:**
  - Maps SDK for Android
  - Maps SDK for iOS
  - Maps Static API (fallback when native map snapshot fails on site photos)
- **Requires billing account:** yes (Google Cloud billing must be enabled; Maps Platform includes monthly free credit - see current pricing on Google’s site)
- **Typical cost notes:** Usage-based (map loads, static map requests). Monitor in Cloud Console → Billing → Reports. Set budget alerts.
- **Setup steps:**
  1. Create or select a Google Cloud project (e.g. OorjaMan).
  2. Enable billing on the project.
  3. **APIs & Services → Library** - enable the three APIs listed above.
  4. **APIs & Services → Credentials → Create credentials → API key**.
  5. Add to `apps/customer-app/.env`:
     ```bash
     EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
     ```
  6. **Rebuild the native customer app** (`npx expo run:ios` / `npx expo run:android` or EAS build). Hot reload is not enough - the key is baked into native config at build time.
- **Key restrictions (recommended):**
  - **Application restrictions:** iOS bundle `com.oorjaman.customer`; Android package `com.oorjaman.customer` (add SHA-1 for release keystores).
  - **API restrictions:** limit to Maps SDK for Android, Maps SDK for iOS, and Maps Static API only.
- **Deploy / rebuild notes:** Any change to this key or to `app.config.ts` maps config requires a new native build for store/dev clients.
- **What works without it:**
  - Tapping GPS coordinates on Profile still opens Google Maps in the browser (`https://www.google.com/maps?q=lat,lng`) - no API key needed.
  - On iOS, in-app maps may fall back to Apple Maps (Apple logo on stamp) if the key is missing or the app was not rebuilt.
- **Added:** 2026-05-16
- **Last reviewed:** 2026-05-16
- **Notes:** Opening coordinates in Safari does not use this key. Site photo stamps need a rebuild after adding the key to show Google tiles instead of Apple Maps on iOS.

---

## Quick reference - env vars (customer app)

| Variable                          | Service              | Required                    |
| --------------------------------- | -------------------- | --------------------------- |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps Platform | For in-app Google maps only |
| `EXPO_PUBLIC_SUPABASE_URL`        | Supabase             | Yes (app backend)           |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`   | Supabase             | Yes (app backend)           |

Add rows to this table as new billed services are documented above.
