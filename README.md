# Event Registration Portal

Public registration and onsite check-in portal built with Vue, Vite, Google Apps Script, Google Sheets, and MailApp.

## What it does

### Public registration form
- Collects participant profile, personal information, emergency contact, affiliation details, food restrictions, accommodation details, transportation requests when applicable, and topic choices.
- Enforces required fields on both the frontend and backend.
- Allows only one registration per email address.
- Generates a unique 16-character registration code and QR code.
- Sends a registration confirmation email.
- Supports optional Cloudflare Turnstile verification.
- Saves timestamps using Singapore Standard Time (`Asia/Singapore`).
- Automatically assigns the accommodation dates for Student and SAS Practitioner/Guidance/Faculty participants who answer Yes to accommodation.

### Admin dashboard
- Protected dashboard for authorized users.
- View, search, export, and review registrations.
- Save internal review notes.
- Resend QR confirmation emails.
- View registration, accommodation, check-in, and participant-type summaries.

### Onsite check-in module
- Protected `/checkin` route for authorized users.
- Scans participant QR codes using the browser camera when supported.
- Provides manual registration-code entry as fallback.
- Prevents duplicate check-ins.
- Updates the registration record and writes check-in attempts to the audit/check-in sheets.

## Main files

- `src/views/PublicForm.vue` — public registration form.
- `src/views/AdminDashboard.vue` — admin registration dashboard.
- `src/views/AdminCheckIn.vue` — onsite QR scanner and manual check-in module.
- `src/lib/eventOptions.js` — frontend option lists.
- `google-apps-script/Code.gs` — backend API, validation, email confirmation, Google Sheets logging, and audit trail.

## Local commands

```bash
npm install
npm run dev
npm run build
```

## Public setup notes

Do not commit real deployment URLs, spreadsheet IDs, admin seed commands, tokens, secret keys, or production-only operational details.

Private deployment instructions have been moved to `README.local.md`. That file is ignored by Git and should be kept only on your local machine or shared through a secure channel.

Use `.env.example` only as a placeholder reference. Create `.env` locally and configure production variables directly in the hosting provider dashboard.

## Git safety checklist

Before pushing:

```bash
git status --ignored
```

Confirm that these are not staged:

- `.env`
- `README.local.md`
- deployment URLs
- spreadsheet IDs
- secret keys
- exported build folders
- `node_modules`
