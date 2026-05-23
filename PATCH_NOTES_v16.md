# Patch Notes v16

## Email confirmation gating

- The Certificate of Compliance warning is now included only for these participant types:
  - `Student`
  - `SAS Practitioner/Guidance/Faculty`
- Other participant types no longer receive the Certificate of Compliance warning block or PDF link in either the HTML email body or the plain-text email body.
- Added `certificateComplianceRequiredForParticipant_(participantType)` in `google-apps-script/Code.gs` so the rule is centralized and easier to audit.

## README privacy cleanup

- Replaced the tracked root `README.md` with a public-safe version.
- Replaced `google-apps-script/README.md` with a public-safe version.
- Moved private deployment/setup content to root `README.local.md`.
- Added local/private README files to `.gitignore` so normal `git add .` will not include them.

## Validation performed

- `google-apps-script/Code.gs` syntax checked through Node after copying to a temporary `.js` file.
- Frontend production build passed with `npm run build`.
