# Customer app — Play Store listing assets

**Do not store Play screenshots under `apps/customer-app/dist/`.**  
Expo export / EAS update / web export wipe `dist/`, which is why earlier captures vanished.

## Layout

| Path | Purpose |
|------|---------|
| `graphics/` | App icon (512) + feature graphic (1024×500) |
| `screenshots/` | Full capture masters from emulator |
| `play-upload/` | Curated set to upload in Play Console |
| Desktop `~/Desktop/OorjaMan-Play-Store-Listing/` | Same upload files as a backup outside the repo |

## Upload to Play (phone + tablet)

From `play-upload/` (or the Desktop copy):

1. `play-icon-512.png` → App icon  
2. `feature-graphic-1024x500.png` → Feature graphic  
3. Phone screenshots (order matters — home first):  
   `01-home.png` → `02-booking-options.png` → `03-bookings.png` → `04-amc.png` → `05-activity.png` → `06-profile.png`  
4. Reuse the **same six PNGs** for 7-inch and 10-inch tablet slots  

These were captured from the **UAT** build (`com.oorjaman.customer.uat`) as demo user Raju. Prefer a prod build if the status bar / branding shows UAT-only labels.

## Recapture later

Keep this folder. Run emulator + adb capture into `screenshots/`, then refresh `play-upload/` and the Desktop backup.
