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

