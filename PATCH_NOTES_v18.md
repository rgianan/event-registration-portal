# Patch Notes v18 — Check-in CSV Sex Column

## Requested change
- Added the participant sex field to the **Check-ins** CSV export.
- Export order is now:
  - Timestamp
  - Check-in ID
  - Registration Code
  - Email Address
  - Full Name
  - Region
  - Assigned Sex at Birth
  - Affiliation
  - Participant Type
  - Check-in Status
  - Method
  - Checked In By
  - Note

## Backend hardening
- `listCheckins` now returns `sexAtBirth` for check-in records.
- New check-in log entries now store `Assigned_Sex_At_Birth` in the `Checkins` sheet.
- Existing check-in rows without the new column can still export sex by falling back to the matching registration record using `Registration_Code`.

## Validation
- Apps Script syntax check passed.
- Frontend production build passed.
