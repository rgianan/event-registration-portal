## Apps Script setup

1. Create a Google Sheet.
2. Open Apps Script and paste the contents of `Code.gs`.
3. Set Script Properties:
   - `SPREADSHEET_ID`
   - `RESPONSES_SHEET_NAME` = `Registrations`
   - `AUDIT_SHEET_NAME` = `Audit`
   - `CHECKINS_SHEET_NAME` = `Checkins`
   - `HEI_LIST_SHEET_NAME` = `HEI_List`
   - `CHEDRO_SHEET_NAME` = `CHEDRO`
   - `CHEDCO_SHEET_NAME` = `CHEDCO`
   - `ADMIN_KEY`
   - `SUBMIT_SHARED_TOKEN` if used by the frontend
   - `TURNSTILE_SECRET_KEY` if Cloudflare Turnstile is enabled
   - `EVENT_NAME`
   - `EVENT_ORGANIZER_NAME`
   - `QR_PAYLOAD_PREFIX` optional. Use `https://your-site.netlify.app/checkin?code={{code}}` only if you later build auto-fill from URL; otherwise raw code QR is fine.
4. Run `setupProject_()` once. It creates/normalizes `Registrations`, `Checkins`, `Audit`, `CHEDRO`, and `CHEDCO`, and sets the spreadsheet timezone to Singapore Standard Time (`Asia/Singapore`).
5. Deploy as Web App.
6. Copy the Web App URL to Netlify as `VITE_GAS_WEB_APP_URL`.

### Affiliation master sheets

`setupProject_()` creates `CHEDRO` and `CHEDCO` sheets with one field, `Office_Name`, and seeds the approved office dropdown values.

### HEI master sheet

Create a tab named `HEI_List` with these headers:

```text
HEI Name | UII | Region | HEI Type | Province | City/Municipality | Status
```

Only rows with blank `Status` or `Status = Existing` are loaded. The public form uses this tab for the Region dropdown and filters HEIs based on the selected Region for Student and SAS Practitioner/Guidance/Faculty participants. Other participant types use the CHEDRO/CHEDCO office sheets or a free-text affiliation field. Resource Person/Facilitator/Moderator participants also require `Current_Designation`.

### Onsite check-in

The frontend route is:

```text
/checkin
```

It is separate from `/admin`, but it is still protected by the same `ADMIN_KEY` as the dashboard. Camera scanning requires HTTPS or localhost and a browser that supports QR scanning through `BarcodeDetector`. Manual registration-code entry is included as fallback.

Successful check-ins update these `Registrations` columns:

```text
Check_In_Status | Check_In_At | Check_In_By | Check_In_Method | Check_In_Note
```

Successful check-ins are also appended to the `Checkins` sheet. Duplicate scans are blocked and written to `Audit`.

### Required scopes

The script uses SpreadsheetApp, MailApp, UrlFetchApp when Turnstile is enabled, CacheService, and LockService. Apps Script will request the required scopes during authorization.

### Accommodation defaults

For Student and SAS Practitioner/Guidance/Faculty participants who answer `Yes` to accommodation, the backend automatically saves:

```text
Accommodation_Check_In_Date = 2026-06-02
Accommodation_Check_Out_Date = 2026-06-05
```

Other participant types that answer `Yes` must provide their own check-in and check-out dates.
