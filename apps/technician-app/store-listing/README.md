# Partner app — Play Store listing assets

Mirror of `apps/customer-app/store-listing/` for **OorjaMan Partner** (`com.oorjaman.technician`).

**Listing copy:** see [`LISTING.md`](./LISTING.md) (short + full description for Play Console).

## Layout

| Path | Purpose |
|------|---------|
| `graphics/` | App icon (512) + feature graphic (1024×500) |
| `screenshots/` | Full capture masters (includes login debug shots) |
| `play-upload/` | Curated set for Play Console |
| Desktop `~/Desktop/OorjaMan-Partner-Play-Store-Listing/` | Same upload files outside the repo |

## Upload to Play (phone + tablet)

From `play-upload/` (or the Desktop copy):

1. `play-icon-512.png` → App icon  
2. `feature-graphic-1024x500.png` → Feature graphic  
3. Phone screenshots (order matters — home first):  
   `01-home.png` → `02-jobs.png` → `03-job-detail.png` → `04-feedback.png` → `05-activity.png` → `06-profile.png`  
4. Reuse the **same six PNGs** for 7-inch and 10-inch tablet slots  

Captured from the **UAT** build (`com.oorjaman.technician.uat`) as technician Amit Das (GGE). Prefer a prod build later if the status bar / branding shows UAT-only labels.

## Recapture later

Keep this folder. Run emulator + adb capture into `screenshots/`, then refresh `play-upload/` and the Desktop backup.
