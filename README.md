# Netlify + Google Sheets Event Registration Portal

This project has been restructured from a document-intake checklist into an event registration form backed by Google Apps Script, Google Sheets, and MailApp.

## What it does

### Public registration form
- Collects participant profile first, then personal information, conditional affiliation details, food restrictions, emergency contact, accommodation details, two-way transportation requests when applicable, and topic choices.
- Enforces required fields on the frontend and backend.
- Accepts only one registration per email address.
- Generates a unique 16-character alphanumeric registration code.
- Shows a QR code immediately after successful submission.
- Sends the registration code and QR code to the participant by email.
- Supports optional Cloudflare Turnstile verification.

### Admin dashboard
- Admin-key protected dashboard.
- View and search registrations.
- Switch to a dedicated check-ins table from the dashboard.
- Export the active table to CSV from the browser.
- Save internal review notes.
- Resend QR confirmation emails.
- Dashboard stats for total registrations, today's registrations, checked-in participants, accommodation requests, and participant types.

### Onsite check-in module
- Protected route at `/checkin` requiring the admin key.
- Scans participant QR codes using the browser camera when supported.
- Provides manual registration-code entry as fallback.
- Accepts either the raw 16-character registration code or a QR payload URL containing `?code={{code}}`.
- Records check-in only once per participant. Duplicate scans are blocked and shown as already checked in.
- Updates the `Registrations` sheet and appends a successful check-in row to the `Checkins` sheet.
- Writes duplicate/missing-code attempts to the `Audit` sheet.

## Main files

- `src/views/PublicForm.vue` — event registration form with conditional affiliation fields: Region → HEI for Student/SAS participants, CHEDRO/CHEDCO office dropdowns, and resource-person affiliation textbox.
- `src/views/AdminDashboard.vue` — admin registration dashboard.
- `src/views/AdminCheckIn.vue` — protected onsite QR scanner and manual check-in module.
- `src/lib/eventOptions.js` — frontend options for food restrictions, participant types, CHEDRO/CHEDCO office fallbacks, and topic options.
- `google-apps-script/Code.gs` — backend API, validation, unique email enforcement, QR generation, email confirmation, Google Sheets logging, and audit trail.

## Environment variables for Netlify

Copy `.env.example` to `.env` for local development only. In Netlify, set these as environment variables:

```env
VITE_GAS_WEB_APP_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
VITE_SUBMIT_SHARED_TOKEN=your-public-submit-token
VITE_TURNSTILE_SITE_KEY=
```

Do not commit `.env`, `dist`, or `node_modules`.

## Apps Script properties

Set these in Apps Script Project Settings > Script Properties:

```text
SPREADSHEET_ID=your_google_sheet_id
RESPONSES_SHEET_NAME=Registrations
AUDIT_SHEET_NAME=Audit
CHECKINS_SHEET_NAME=Checkins
HEI_LIST_SHEET_NAME=HEI_List
CHEDRO_SHEET_NAME=CHEDRO
CHEDCO_SHEET_NAME=CHEDCO
ADMIN_KEY=your_admin_key
SUBMIT_SHARED_TOKEN=must_match_VITE_SUBMIT_SHARED_TOKEN_if_used
TURNSTILE_SECRET_KEY=optional_cloudflare_secret_key
EVENT_NAME=Event Registration Portal
EVENT_ORGANIZER_NAME=Event Registration Portal
QR_PAYLOAD_PREFIX=optional_prefix_or_url_with_{{code}}
```

`SUBMIT_SHARED_TOKEN` is only a low-friction filter because the frontend value is public. For real abuse protection, enable Turnstile and configure `TURNSTILE_SECRET_KEY`.

## Google Sheet tabs

The backend creates these tabs if missing:

- `Registrations`
- `Checkins`
- `Audit`
- `CHEDRO`
- `CHEDCO`

Required HEI master list tab for Student and SAS Practitioner/Guidance/Faculty participants:

- `HEI_List`

The uploaded `hei list.xlsx` structure is supported directly. Use these headers in row 1:

```text
HEI Name | UII | Region | HEI Type | Province | City/Municipality | Status
```

The backend also accepts these alternate HEI name headers: `Higher Education Institution`, `HEI`, `Institution Name`, or `Name`.

Only rows with blank `Status` or `Status = Existing` are returned to the frontend. Region options are generated from the unique Region values in this sheet. After the participant selects a Region, the HEI dropdown is filtered to HEIs under that Region only. The backend re-validates the Region + HEI pair on submit, so users cannot bypass the dropdown with browser edits. For non-HEI participant types, the backend uses `CHEDRO`, `CHEDCO`, or a free-text affiliation field and stores the final value in the `Affiliation` column.

A CSV seed converted from the provided workbook is included here:

```text
data/hei-list.csv
```

To use it, create or open the `HEI_List` tab in the same Google Sheet used by Apps Script, then import/paste the CSV contents starting at cell A1.

## Local commands

```bash
npm install
npm run dev
npm run build
```

## Deployment notes

1. Deploy `google-apps-script/Code.gs` as a Google Apps Script Web App.
2. Set the Apps Script properties above.
3. Run `setupProject_()` once from the Apps Script editor to create/normalize sheets. This now also creates the `Checkins`, `CHEDRO`, and `CHEDCO` tabs, adds check-in columns, and appends accommodation/transportation/affiliation audit fields to `Registrations`.
4. Import `data/hei-list.csv` into the `HEI_List` tab starting at A1.
5. Copy the deployed Web App URL into `VITE_GAS_WEB_APP_URL`.
6. Deploy the frontend to Netlify.
7. Open `/checkin` onsite using HTTPS. Camera scanning requires HTTPS or localhost; manual entry works as a fallback.

## Important security note

The frontend is public. Never put real secrets in any `VITE_*` variable. Admin access is still based on a shared admin key in this version. For a stronger internal deployment, replace shared-key admin access with Google-account whitelist validation.
