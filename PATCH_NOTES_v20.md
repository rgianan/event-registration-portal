# Patch Notes — v20 (login latency, role enforcement, submit-path rescan)

This overlay is drop-in over v19. Changed files only:
`google-apps-script/Code.gs`, `src/views/AdminDashboard.vue`, `src/views/AdminCheckIn.vue`.
Deploy the backend and frontend together.

## 1. Why login felt slow — and what changed

The login button on `/admin` and `/checkin` stayed in its "logging in" state much
longer than the actual authentication took, because several costs were stacked
behind one spinner. Addressed in order of impact:

### a. Frontend: data load was blocking the login spinner (biggest perceived win)
`adminLogin()` `await`ed a full data load (`loadResponses` / `loadRecentCheckins`)
*before* clearing `loggingIn`. So "login" visibly included a second Apps Script
round-trip that scans an entire sheet — and on `/checkin`, `loadRecentCheckins`
uses `limit:'all'`, scanning the whole `Checkins` sheet (and the whole
`Registrations` sheet when any check-in row predates the `Assigned_Sex_At_Birth`
column). Now the spinner drops the moment auth returns; the table/recent-list
loads separately behind its own loading state. The session is usable immediately.

Also fixed: `loadResponses` / `loadCheckins` / `loadRecentCheckins` called the
shared `resetMessages()` on entry, which wiped the "Welcome, …" message a split
second after it appeared. The loaders now clear only the error, so the welcome
message survives.

### b. Backend: the login opened the spreadsheet ~3 times
A single login did `findUserByEmail_` (open + read Users), `touchUserLastLogin_`
(open + read Users **again** + write), and `auditLog_` (open + append Audit).
- `touchUserLastLogin_(user)` now takes the user object already loaded during
  authentication instead of re-querying the Users sheet — one fewer full read.
- New `getSpreadsheet_()` memoizes `SpreadsheetApp.openById` per execution. Every
  `getResponseSheet_`/`getCheckinSheet_`/`getUsersSheet_`/`getAuditSheet_`/
  `getOfficeSheet_`/`computeHeiMaster_` now reuses the one opened handle. A fresh
  container per request means it resets naturally — no staleness.

### c. Costs that are by design (documented, not changed)
- **Apps Script cold start (~1–3s)** on the first call after the container idles.
  Irreducible without a keep-warm time trigger (a 1-line `ScriptApp` trigger
  hitting `doGet` every ~5 min). Left as optional ops polish.
- **12,000-iteration password key-stretch** in `hashPassword_` runs on every
  login. This is deliberate brute-force resistance; lowering it trades security
  for speed. Left as-is. The iteration count is stored per-record, so it can be
  retuned later without invalidating accounts.

## 2. Role enforcement (`role` was captured but never checked)

Tokens already carried `role`, but every authenticated caller had full access.
Now:
- `requireAdmin_` — role must be `admin`: `listResponses`, `updateReviewNote`,
  `resendConfirmation` (full PII dashboard + record edits).
- `requireCheckinAccess_` — roles `admin`, `staff`, or `checkin`:
  `checkInParticipant`, `listCheckins` (the onsite station).
- `requireSession_` — shared token/expiry check used by both.

This makes a check-in-only account possible: seed with
`seedUser('staff@example.com','password','Door 1','staff')` and that account can
run `/checkin` but cannot open the registrant dashboard. **Existing accounts use
the default role `admin` and are unaffected.** The `/admin` page now also shows a
friendly "this account is for check-in only" message instead of failing a load
when a non-admin logs in there.

## 3. Submit-path full-sheet rescan removed

`handleSubmit_` appended the row, then `updateEmailStatus_` re-scanned the entire
`Registrations` sheet by code just to write the email result back to the row it
had *just* created. New `updateEmailStatusAtRow_(sheet, rowNumber, headers, …)`
writes to the known row; `handleSubmit_` and `handleResendConfirmation_` (which
already located the row) both use it. `updateEmailStatus_` remains as a
code-lookup fallback. One fewer O(n) scan per registration and per resend.

## Validation

- `google-apps-script/Code.gs` passes `node --check`.
- `npm run build` passes (Vite 8.0.13, 34 modules, no errors).

## Queued for a later turn (not in this overlay)

- Server-side pagination for `listResponses` (still returns all rows; fine at one
  event's scale, but unbounded).
- Optional keep-warm trigger to mask cold starts.
- Hide the dashboard tabs/role-gated controls in the `/admin` UI for non-admin
  roles (backend already enforces; this is cosmetic).
- Store the privacy-notice version alongside `Consent_Privacy` for DPA audit.
