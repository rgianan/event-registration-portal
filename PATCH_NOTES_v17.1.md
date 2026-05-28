# Patch Notes — v17.1 (registrations table cushion)

Follow-up to v17. The registrations table was sized to exactly the column sum
(1820px in a 1920 viewport) with no breathing room. v17.1 shaves 40px so the
table sits comfortably under 1920 even with outer padding or an inside-rendered
scrollbar.

## Change
- Registrations table `min-w-[1820px]` -> `min-w-[1780px]`.
- Column widths trimmed:
  - Region / Affiliation: 220 -> 210
  - Topics: 230 -> 210
  - Review Note / Cancellation reason: 230 -> 220
- Column sum now equals the new min-width (1780px) exactly.

## Not changed
Check-ins table (1320px) already had plenty of room; left alone.

## Validation
- `npm run build` succeeds (Vite 8).
- Column-width sum verified to match the declared min-width.
