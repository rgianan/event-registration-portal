# Patch Notes — v21 (check-in module performance)

Drop-in over v20. Changed files only:
`google-apps-script/Code.gs`, `src/views/AdminCheckIn.vue`.
Deploy the backend and frontend together.

## Verdict: yes, the check-in module was slow — and got slower as the event filled

Each scan did far more work than it needed to, and one cost grew with every
prior check-in. Three issues, all fixed here.

### 1. Frontend re-fetched the ENTIRE check-in log after every scan
After each successful check-in, `checkInParticipant()` called
`loadRecentCheckins()` with `limit:'all'`, which scans the whole `Checkins`
sheet (and the whole `Registrations` sheet when any check-in row predates the
v18 sex column). So the cost of scan #400 included reading ~400 prior rows back.
This is the cause that compounds over the day. (It was effectively introduced
when the recent-list fetch moved to `limit:'all'`.)

Fix: the station now prepends the just-recorded check-in **locally** from the
check-in response — no extra round-trip per scan. The list still reconciles with
the sheet on the manual **Refresh** button and on login/session restore, which
keep the full fetch. New helper `prependRecentCheckin()`.

### 2. Backend scanned the Registrations sheet TWICE per check-in
`handleCheckInParticipant_` ran `findRegistrationRow_` to locate the row, wrote
the check-in, then ran `findRegistrationRow_` **again** ("refresh") just to read
back what it had written. The second full scan is removed: the row already in
memory is updated and reused for the response payload.

### 3. Backend did 7 single-cell writes per check-in
The 7 `setValue` calls are now 2 batched `setValues` over contiguous column
blocks (`Check_In_Status..Check_In_Note` = 5 adjacent columns; `Updated_At..
Updated_By` = 2 adjacent columns). New helper `writeContiguousCells_` falls back
to per-cell writes if a sheet was manually reordered.

### Net effect on the per-scan critical section (inside the global lock)
- Full Registrations scans: 2 → 1
- Sheet writes for the registration row: 7 → 2
- Extra round-trip + full Checkins scan after each scan: removed

Shorter lock hold time also means multiple check-in stations scanning at once
queue for less time. The script lock stays global (Apps Script has no row-level
lock, and we need atomic read-status-then-write to prevent double check-in), but
the section it guards is now roughly half the work and no longer grows with the
log size.

## Not changed (deliberate)

- The initial `findRegistrationRow_` scan to locate the row by code stays — it's
  one unavoidable read without a separate code→row index sheet.
- The camera `scanLoop` (one `detector.detect` per animation frame) is fine:
  each call is awaited so frames can't pile up, and throttling risks making
  scanning feel laggier. Left as-is.
- `getRegistrationSexByCode_`'s fallback Registrations scan in `listCheckins`
  only triggers for pre-v18 check-in rows; new rows store the sex column, so a
  fresh event never hits it.

## Validation

- `google-apps-script/Code.gs` passes `node --check`.
- `npm run build` passes (Vite 8.0.13, 34 modules, no errors).

## Queued for a later turn

- Record the actual session email in `Check_In_By` / `Checked_In_By` instead of
  the literal `'admin'`, now that non-admin `staff`/`checkin` roles can check in
  (attribution improvement; pairs with v20 role enforcement).
- Server-side pagination for `listResponses` (still returns all rows).
- Optional keep-warm trigger to mask Apps Script cold starts.
