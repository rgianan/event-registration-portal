# Patch Notes — v22 (check-in attribution)

Drop-in over v21. Changed file only: `google-apps-script/Code.gs`.
Backend-only — redeploy the Apps Script Web App. No frontend change needed.

## What changed

`Check_In_By` (Registrations sheet) and `Checked_In_By` (Checkins sheet) recorded
the literal `'admin'` for every check-in. Now that v20 lets `staff`/`checkin`
role accounts run the station, that erased who actually did each check-in. Both
columns now record the **session email** of the person who performed the
check-in.

- The identity comes from the verified session token (`requireCheckinAccess_`
  returns `{ email, role }`), **not** the client payload, so it can't be spoofed.
- Falls back to `'admin'` only if a token somehow carries no email.
- The check-in audit entries now also include `by=<email>`:
  - `participant_checkin` (success)
  - `participant_checkin_duplicate` (someone scanned an already-checked-in code)
  - `participant_checkin_missing_code` (someone scanned an unknown code)

`Updated_By` is left as the `'admin_checkin'` mechanism marker — that column
tracks *which flow* last touched the row (`public_form`, `system`, `admin`,
`admin_checkin`), consistent with the rest of the codebase, not the operator.

## Effect on existing data and exports

- Rows checked in before this deploy keep their old `'admin'` value; new
  check-ins record the operator email going forward.
- The dashboard Check-ins CSV (`Checked In By` column) and the per-record
  payload now surface the operator email automatically — no export change
  required.

## Validation

- `google-apps-script/Code.gs` passes `node --check`.
- `npm run build` passes (Vite 8.0.13, 34 modules, no errors).

## Still queued for a later turn

- Audit-log Actor is still the literal `'system'` for every action (login,
  notes, resend, check-in). Threading the session email into `auditLog_` would
  attribute all admin actions, not just check-in — a broader change touching
  every call site.
- Server-side pagination for `listResponses` (still returns all rows).
- Optional keep-warm trigger to mask Apps Script cold starts.
