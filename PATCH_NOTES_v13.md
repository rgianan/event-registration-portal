# Patch Notes — v13 (fixes + CHEDRO removal)

## Fixes

1. **CSV formula-injection guard (security).**
   `src/views/AdminDashboard.vue` → `csvEscape()` now prefixes any value
   beginning with `=`, `+`, `-`, `@`, tab, or CR with a single quote before
   quoting, so registrant-supplied text (name, emergency contact, review note,
   etc.) cannot execute as a formula when an admin opens the export in
   Excel/Sheets.

2. **Registration-code uniqueness no longer rescans the whole sheet 20×.**
   `makeUniqueRegistrationCode_()` now reads the `Registration_Code` column once
   into a set (`readRegistrationCodeSet_()`) and checks generated codes in
   memory. The now-unused `registrationCodeExists_()` was removed.

3. **HEI master parse is memoized per request.**
   `getHeiMaster_()` now caches its result in `HEI_MASTER_MEMO_` for the life of
   a single Apps Script execution (parsing logic moved to `computeHeiMaster_()`).
   This collapses the repeated 192 KB `HEI_List` parses that happened within one
   submit (canonicalize + options + validation). Each web-app invocation is a
   fresh execution, so the memo resets naturally per request — no staleness.

## CHEDRO removal

"CHED Regional Office" was never a selectable participant type (absent from
`PARTICIPANT_TYPES` in both backend and frontend), so all CHEDRO code was
unreachable. Removed end to end:

- `Code.gs`: `CHEDRO_OFFICE_OPTIONS`, the dead `'CHED Regional Office'` branch in
  `canonicalizeAffiliationSelection_`, `chedroOffice` field in
  `sanitizeRegistration_`, `chedroOffices` in `handleGetHeiOptions_`,
  `CHEDRO_Office` column from `getResponseHeaders_` / `registrationToRow_` and all
  read paths, the unreachable `stats.chedro` counter (+ `emptyStats_`),
  `chedroSheetName` / `CHEDRO_SHEET_NAME` config, and the CHEDRO `getOfficeSheet_`
  call in `setupProject_`.
- `src/lib/eventOptions.js`: removed `CHEDRO_OFFICES`.
- `src/views/AdminDashboard.vue`: removed `chedro` from the stats ref.
- READMEs: removed `CHEDRO_SHEET_NAME`, the `CHEDRO` tab, and CHEDRO mentions.

NOTE: the `'CHEDRO Region'` entry in `getHeiMaster_`'s region-header alias list
was **kept** — it is an alternate column header for the HEI_List Region column,
not part of the office feature.

## Migration note for EXISTING deployments

The backend keys rows by header name, but `ensureHeaders_()` rewrites row 1 to
match `getResponseHeaders_()`. Because `CHEDRO_Office` sat between `CHEDCO_Office`
and `Resource_Affiliation`, removing it shifts those trailing headers left by one.
For an EXISTING `Registrations` sheet, manually delete the `CHEDRO_Office` column
once (it was always blank, since the path was unreachable) so the header row and
the data columns stay aligned. Fresh deployments need no action. The standalone
`CHEDRO` tab, if present, can be deleted.

## Validation

- `Code.gs` passes `node --check`.
- `npm run build` succeeds (Vite 8.0.13, 34 modules, no errors).
