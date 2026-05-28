# Patch Notes — v16 (conditional CoC email note + README split)

## 1. Certificate of Compliance email note — now conditional

The CMO 63 s.2017 note ("Please email your approved Certificate of Compliance to
OSDS at osds@ched.gov.ph within 5 calendar days...") is now sent ONLY to
participants of type **Student** and **SAS Practitioner/Guidance/Faculty**. All
other participant types (CHED Central Office, Resource Person/Facilitator/
Moderator, Other) no longer receive it.

`google-apps-script/Code.gs`:
- Added `CERTIFICATE_COMPLIANCE_TYPES = ['Student', 'SAS Practitioner/Guidance/Faculty']`
  (explicit constant, not coupled to the HEI-type list).
- `sendConfirmationEmail_` computes `showCertificate` from `row.participantType`
  (the base type, not the "- Other" suffixed display string) and gates both the
  HTML block and the plain-text line/spacing on it.
- The note text itself is unchanged.

Verified: gating returns true for exactly the two intended types and false for the
other three, and the plain-text body omits the line cleanly when not applicable.

## 2. README split — operational detail removed from version control

The public `README.md` previously exposed detail that shouldn't sit in a public
repo: the real Certificate-of-Compliance Google Drive file ID, the full Apps Script
property set, deployment steps, the `seedUser` admin-account mechanism, and
event specifics (venue, dates, transportation times).

- `README.md` is now a lean, sanitized public overview (project description, main
  files, local commands, a security note) with a pointer to the local doc.
- All operational detail moved to **`README.local.md`** — event specifics, env
  vars, Apps Script properties (incl. the real Drive link), Users-sheet auth and
  account seeding, sheet structure/HEI import, deployment steps, security notes.
- `.gitignore` now excludes `README.local.md` and `*.local.md`, so the detailed
  doc stays local and is never committed.

Verified with a real `git init && git add -A`: `README.local.md` is NOT tracked
(correctly ignored) while `README.md` IS tracked. The public `README.md` contains
none of: the Drive link/file ID, `SPREADSHEET_ID`, `TURNSTILE_SECRET`,
`SUBMIT_SHARED_TOKEN`, `seedUser`, `osds@ched`, or the event venue/dates.

Note: `README.local.md` IS included in this delivered zip so you have the content;
once it's in your repo working tree, git will ignore it per `.gitignore`. Keep it
local or store it privately.

## Validation
- `Code.gs` passes `node --check`.
- `npm run build` succeeds (Vite 8).
- Email gating + git-ignore behavior verified as above.
