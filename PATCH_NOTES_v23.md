# Patch Notes — v23 (accommodation check-in date → 03 June 2026)

Drop-in over v22. Changed files:
`google-apps-script/Code.gs`, `src/views/PublicForm.vue`.
Deploy backend and frontend together.

## What changed

For the HEI participant types — **Student** and **SAS Practitioner/Guidance/
Faculty** — who select Accommodation = Yes, the auto-assigned dates change from
02 June → 05 June to **03 June 2026 check-in, 05 June 2026 check-out**.

Three places updated, all gated on the existing two-type rule
(`HEI_PARTICIPANT_TYPES` / `fixedAccommodationEligible`):
1. Backend `sanitizeRegistration_` — the authoritative auto-set
   (`accommodationCheckInDate = '2026-06-03'`).
2. Frontend `PublicForm.vue` — `fixedAccommodationCheckInDate = '2026-06-03'`
   (drives the locked field value and the submitted payload).
3. Frontend notice text — now reads "automatically set to 03 June 2026 check-in
   and 05 June 2026 check-out."

Check-out stays 05 June 2026. Other participant types (Resource Person, CHED
Central Office, Other) continue to enter their own dates manually — unchanged.

## Deliberately NOT changed

The transportation schedule labels are a separate concern and were left intact:
- CHED to Tagaytay Venue 02 June 2026, 2:00PM
- CHED to Tagaytay Venue 03 June 2026, 6:00AM
- Tagaytay Venue to CHED 05 June 2026, 10:00AM

## Notes

- Existing registrations keep their stored dates; this applies to new
  submissions going forward. If pre-v23 HEI registrations need to move to
  03 June, that's a one-time data edit in the sheet (let me know and I can script
  it).
- The 03 June → 05 June range still passes the check-out ≥ check-in validation.

## Validation

- `google-apps-script/Code.gs` passes `node --check`.
- `npm run build` passes (Vite 8.0.13, 34 modules, no errors).
