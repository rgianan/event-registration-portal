## Apps Script setup

1. Create a Google Sheet.
2. Open Apps Script and paste the contents of `Code.gs`.
3. Set Script Properties:
   - `SPREADSHEET_ID`
   - `RESPONSES_SHEET_NAME` = `Registrations`
   - `AUDIT_SHEET_NAME` = `Audit`
   - `CHECKINS_SHEET_NAME` = `Checkins`
   - `HEI_LIST_SHEET_NAME` = `HEI_List`
   - `CHEDCO_SHEET_NAME` = `CHEDCO`
   - `USERS_SHEET_NAME` = `Users` (optional; authorized admin accounts)
   - `SUBMIT_SHARED_TOKEN` if used by the frontend
   - `TURNSTILE_ENABLED` = `TRUE`
   - `TURNSTILE_SECRET_KEY` = your Cloudflare Turnstile secret key
   - `EVENT_NAME`
   - `EVENT_ORGANIZER_NAME`
   - `QR_PAYLOAD_PREFIX` optional. Use `https://your-site.netlify.app/checkin?code={{code}}` only if you later build auto-fill from URL; otherwise raw code QR is fine.
   - `CERTIFICATE_COMPLIANCE_PDF_URL` optional; defaults to the provided Google Drive Certificate of Compliance PDF link.
   - `BREAKOUT_SESSION_CAPACITY` optional; defaults to `60` participants per topic option.
4. Run `setupProject_()` once. It creates/normalizes `Registrations`, `Checkins`, `Audit`, `CHEDCO`, and `Users`, and sets the spreadsheet timezone to Singapore Standard Time (`Asia/Singapore`).

### Authorized users (admin login)

Admin access uses per-user accounts in the `Users` sheet — email + password, validated by the app. No shared key and no Google Workspace console required. Columns: `Email`, `Display_Name`, `Role`, `Active`, `Password_Hash`, `Created_At`, `Last_Login_At`.

Passwords are never stored in plaintext. The `Password_Hash` cell holds a self-describing record (`ihmac-sha256$<iterations>$<salt>$<hash>`), key-stretched with iterated HMAC-SHA256.

Create accounts from the Apps Script editor (not the web app):

- `seedUser('you@example.com', 'your-password', 'Your Name', 'admin')` — add or update an account (min 8-char password).
- `setUserPassword('you@example.com', 'new-password')` — reset a password.
- `setUserActive('you@example.com', false)` — disable/enable an account.
- `listUsers()` — log existing accounts (email/role/active only).

Run `seedUser(...)` at least once before anyone can log in. Failed logins lock the **targeted email** for ~15 minutes after 5 attempts (not all admins). Deleting the `SESSION_SECRET` script property logs everyone out immediately.
5. Deploy as Web App.
6. Copy the Web App URL to Netlify as `VITE_GAS_WEB_APP_URL`.

### Affiliation master sheets

`setupProject_()` creates the `CHEDCO` sheet with one field, `Office_Name`, and seeds the approved office dropdown values.

### HEI master sheet

Create a tab named `HEI_List` with these headers:

```text
HEI Name | UII | Region | HEI Type | Province | City/Municipality | Status
```

Only rows with blank `Status` or `Status = Existing` are loaded. The public form uses this tab for the Region dropdown and filters HEIs based on the selected Region for Student and SAS Practitioner/Guidance/Faculty participants. Other participant types use the CHEDCO office sheet or a free-text affiliation field. Resource Person/Facilitator/Moderator participants also require `Current_Designation`.

### Onsite check-in

The frontend route is:

```text
/checkin
```

It is separate from `/admin`, but it uses the same authorized accounts (email + password) as the dashboard. Camera scanning requires HTTPS or localhost and a browser that supports QR scanning through `BarcodeDetector`. Manual registration-code entry is included as fallback.

Successful check-ins update these `Registrations` columns:

```text
Check_In_Status | Check_In_At | Check_In_By | Check_In_Method | Check_In_Note
```

Successful check-ins are also appended to the `Checkins` sheet. Duplicate scans are blocked and written to `Audit`.

### Required scopes

The script uses SpreadsheetApp, MailApp, UrlFetchApp for Turnstile verification, CacheService, and LockService. Apps Script will request the required scopes during authorization. For local testing, Cloudflare documents the test secret key `1x0000000000000000000000000000000AA`; replace it with your real production Turnstile secret key before public deployment.

### Accommodation defaults

For Student and SAS Practitioner/Guidance/Faculty participants who answer `Yes` to accommodation, the backend automatically saves:

```text
Accommodation_Check_In_Date = 2026-06-02
Accommodation_Check_Out_Date = 2026-06-05
```

Other participant types that answer `Yes` must provide their own check-in and check-out dates.
