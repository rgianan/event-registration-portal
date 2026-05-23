# Google Apps Script Backend

This folder contains the Apps Script backend for the Event Registration Portal.

## Main file

- `Code.gs` — backend API, validation, registration storage, confirmation email, admin login, check-in logging, and audit trail.

## Public notes

The backend uses Google Sheets, MailApp, UrlFetchApp, CacheService, LockService, and script properties.

Do not commit actual spreadsheet IDs, deployment URLs, tokens, Turnstile secrets, admin seed commands with real credentials, or production-only operational details.

Private setup instructions are kept in the root-level `README.local.md`, which is ignored by Git.

## Required deployment reminder

After changing `Code.gs`, redeploy the Apps Script Web App so the frontend calls the updated backend version.
