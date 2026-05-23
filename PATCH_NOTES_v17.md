# Patch Notes — v17 (BARMM frontend/backend hard removal)

## Changes

1. Removed BARMM from the frontend fallback region list.
   - `src/lib/eventOptions.js` no longer includes `Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)` in `FALLBACK_REGIONS`.

2. Added frontend BARMM guard filtering.
   - Added `isExcludedRegion()` helper.
   - `PublicForm.vue` now filters out BARMM/Region 15 even if stale API data sends it back.
   - HEIs under excluded regions are also filtered before the dropdown is built.

3. Hardened backend HEI master filtering.
   - `google-apps-script/Code.gs` now excludes BARMM using code `15`, `BARMM`, `Bangsamoro`, or `Muslim Mindanao` markers.
   - This protects the public dropdown and submit-time validation even if the live `HEI_List` sheet still contains stale BARMM rows.

4. Verified seed HEI CSV.
   - `data/hei-list.csv` contains 2,360 HEI rows.
   - BARMM/Bangsamoro/Muslim Mindanao matching rows found: `0`.

## Validation

- `npm run build` passed.
- `google-apps-script/Code.gs` JavaScript syntax check passed by copying to a temporary `.js` file.
- HEI seed CSV audit passed with zero BARMM-related rows.
