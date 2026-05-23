# Patch Notes — v15 (per-user auth, Users sheet, BARMM removal)

## 1. Admin auth reworked: shared key -> per-user accounts

Replaces the single shared `ADMIN_KEY` with email + password accounts validated
against a new `Users` sheet. No Google Workspace console required — this is
application-level credential auth, not Google-identity auth.

- `handleAdminLogin_` now takes `email` + `password`, verifies against the Users
  sheet (`authenticateUserWithLockout_`), and issues the existing stateless
  HMAC-signed session token. The token now carries `{ email, role }` so actions
  are attributable in the audit log. `requireAdmin_` returns the decoded session.
- Removed the shared-key path entirely: `ADMIN_KEY` property, `config.adminKey`,
  `verifyAdminKeyWithLockout_`, and the global lockout cache keys.
- **Passwords are never stored in plaintext.** `Password_Hash` holds a
  self-describing record `ihmac-sha256$<iterations>$<saltB64>$<hashB64>`,
  key-stretched with iterated HMAC-SHA256 (PASSWORD_HASH_ITERATIONS = 12000, per
  user salt). Iteration count is stored in the record, so it can be tuned later
  without invalidating existing accounts.
- **Lockout is now per-email**, not global: 5 failed attempts lock only the
  targeted email for ~15 min. This removes the previous all-admins DoS lever.
  Tradeoff: a known email can be soft-locked by an attacker; raise
  `ADMIN_MAX_ATTEMPTS` or drop the lockout if that matters more than throttling.
- Login responses use one message ("Invalid email or password.") whether the
  email is unknown, inactive, or the password is wrong — no account enumeration.

### Account management (run from the Apps Script editor, not the web app)
- `seedUser('you@example.com', 'password', 'Your Name', 'admin')` — add/update.
- `setUserPassword(email, password)` — reset password (min 8 chars).
- `setUserActive(email, false)` — disable/enable.
- `listUsers()` — log email/role/active.

Account creation is intentionally NOT reachable through `doPost`, so accounts can
only be managed by someone with edit access to the script.

### Fixed along the way
The previous frontend sent `adminKey` on data calls while the backend's
`requireAdmin_` expected `sessionToken`, and discarded the token returned at
login — so authenticated calls would have failed. The frontend now captures the
token at login, stores it in sessionStorage (never the password), sends it on all
data calls, and restores the session on mount (an expired token auto-logs-out).

## 2. Users sheet

`setupProject_()` now creates/normalizes a `Users` sheet with columns:
`Email, Display_Name, Role, Active, Password_Hash, Created_At, Last_Login_At`.
Setup returns a reminder to run `seedUser(...)` when the sheet is still empty.
Optional `USERS_SHEET_NAME` script property overrides the name (default `Users`).

## 3. BARMM removed

Region code `15` (Bangsamoro Autonomous Region in Muslim Mindanao):
- Removed from `REGION_LABELS`.
- Added `EXCLUDED_REGION_CODES = { '15': true }` and skipped in `computeHeiMaster_`,
  so BARMM is gone from the dropdowns AND rejected at submit-time validation even
  if the live `HEI_List` sheet still contains region-15 rows.
- 111 BARMM rows removed from the seed `data/hei-list.csv` (2,471 -> 2,360 rows).

## Files changed
- `google-apps-script/Code.gs` — auth core, Users sheet helpers, password hashing,
  editor management functions, BARMM exclusion, config/setup.
- `src/views/AdminDashboard.vue`, `src/views/AdminCheckIn.vue` — email+password
  login, token capture/restore/logout.
- `data/hei-list.csv` — BARMM rows removed.
- `README.md`, `google-apps-script/README.md`, — auth + Users docs; `.env.example`
  unchanged (no client-side secret involved).

## Deploy steps
1. Deploy backend + frontend together (login request shape changed).
2. Run `setupProject_()` to create the `Users` sheet.
3. Run `seedUser('you@example.com','your-password','Your Name','admin')` once from
   the editor — **no one can log in until at least one user is seeded.**
4. If the live `HEI_List` sheet still has region-15 rows, they're already excluded
   by code; deleting them is optional cleanup.

## Validation
- `Code.gs` passes `node --check`.
- `npm run build` succeeds (Vite 8), no stale `admin.key`/`adminKey` refs.
- Password make/verify (correct/wrong/empty/tampered/bad-format/stored-iters/
  min-length/salt-uniqueness) verified in a Node harness mirroring Apps Script's
  HMAC: 11/11.
