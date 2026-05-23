# Patch Notes — v14 (HEI/region load performance — "Path A")

Goal: cut the ~7s region/HEI dropdown load. The form fires one `getHeiOptions`
call on mount and can't populate the region dropdown until it returns. That call
was doing far more than fetch regions + HEIs.

## What was slow (per the diagnosis)

1. The entire `Registrations` sheet was read **twice** on a public page load
   (once per breakout session).
2. `getDisplayValues()` over the 2,471-row `HEI_List` (slow formatted-string path).
3. Three separate `SpreadsheetApp.openById()` round-trips per request.
4. Unconditional `setFrozenRows`/header **writes** on read paths (force a flush).
5. ~384 KB JSON payload, most of it unused (uii/province/city + a region label
   repeated on every one of the 2,471 rows).
6. Nothing cached — every visitor redid all of the above.

## Changes (backend — Code.gs)

- **Cache the static options** (regions, HEIs, CHEDCO) in `CacheService` for 10
  minutes (`getCachedStaticOptions_` / `buildStaticOptions_`). Submit-time
  validation still reads the **live** sheet (`canonicalizeHeiSelection_` ->
  `getHeiMaster_`), so a newly added HEI is accepted on submit immediately; only
  the dropdown can be up to 10 min stale.
- **Chunked cache** (`cachePutChunked_` / `cacheGetChunked_`): the value is split
  across keys under ~90 KB each (CacheService caps a key at ~100 KB and the
  trimmed payload is ~93 KB today, with little headroom). Partial chunk eviction
  is detected and treated as a miss -> safe rebuild.
- **Trimmed payload**: HEIs are now grouped by region as `{ region: [names] }`
  instead of an array of `{region, regionLabel, name, uii, province, city}`
  objects. The dropdown only needs region + name. This drops the response from
  ~384 KB to ~93 KB and removes the per-row repeated region label.
- **Breakout availability stays live but reads the sheet once.**
  `getBreakoutAvailability_` now calls `countBreakoutSelectionsAll_`, a single
  pass that tallies both sessions, replacing the two full-sheet reads. (Kept live
  rather than cached so capacity counts are never stale; submit still re-checks
  capacity via `enforceBreakoutCapacity_`.)
- **`getValues()` instead of `getDisplayValues()`** for the HEI master read.
  `cleanText_` stringifies any numeric region codes, so values are unchanged.
- **No more writes on read paths.** `ensureHeaders_` only writes headers /
  `setFrozenRows` when the header row actually differs; `getOfficeSheet_` only
  rewrites the `Office_Name` header / freezes rows when it's actually wrong.

## Changes (frontend — PublicForm.vue)

- `fetchAffiliationOptions` reads the new `data.heisByRegion` map and flattens it
  back to the `{region, name}` shape the dropdown filtering already uses, so every
  downstream computed (`filteredHeiOptions`, `heiMasterLoaded`, validation) and
  the template are unchanged. Falls back to the legacy `data.heis` array if a new
  frontend ever hits an old backend.

## Expected effect

- Cache hit: no HEI parse, no `getDisplayValues`, no double scan, no writes —
  just one live breakout read + a ~93 KB (well-compressing) response.
- Cache miss: same single-read/`getValues`/no-write path, then populate the cache.
- The one cost not removed is Apps Script cold start (~1–3s on a cold container);
  an uptime ping/time trigger is optional polish, noted but not added.

## Not included (deliberately)

The lazy region->HEI split was evaluated and rejected: at ~93 KB cached, the full
list ships fine in one shot, and a per-region fetch would add an Apps Script
round-trip mid-form (often a net UX loss). Revisit only if the list grows into the
multi-MB range.

## Compatibility note

`getHeiOptions` response shape changed: `heis` (array) -> `heisByRegion` (map),
and `regionLabel/uii/province/city` are no longer sent per HEI. Deploy the backend
and frontend together. The frontend tolerates the old shape; an old frontend
against this new backend would not see HEIs.

## Validation

- `Code.gs` passes `node --check`.
- `npm run build` succeeds (Vite 8).
- Chunked-cache round-trip (incl. 250 KB across 3 keys + partial-eviction miss)
  and region grouping/flatten verified with a Node harness: 11/11 checks pass.
