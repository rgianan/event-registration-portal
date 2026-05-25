# Patch Notes v19 — Table Page Size Controls

## Changes

- Admin dashboard registration table now defaults to 25 rows per page.
- Admin dashboard check-ins table now defaults to 25 rows per page.
- Check-in module recent check-ins list now defaults to 25 rows per page.
- Added page-size options: 25, 50, 100, and All.
- Added previous/next pagination controls and visible row range labels.
- Updated `listCheckins` backend action to support `limit: 'all'` so the frontend can paginate the full check-in log instead of being capped at 30 or 200 rows.

## Validation

- `npm run build` passed.
- `google-apps-script/Code.gs` syntax check passed via Node after temporary `.js` copy.
