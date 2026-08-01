# React Doctor false positives

Sites where a rule fires but the finding doesn't hold. The triage playbook reads
this file and drops matching diagnostics. Entries that say "skip after verifying
X" require actually checking the code shape first — never suppress on filename
alone.

Keep this narrow. A rule stays on repo-wide so it can still catch genuine hits;
this file only excuses the specific sites below.

## react-doctor/js-set-map-lookups

- `screens/Create.tsx` — `years.includes(y)` inside the `allYears.map(...)` chip
  row. Skip after verifying the array is `classYears` (4 fixed items). A Set for
  4 entries is more code, no measurable gain. Re-triage if the year list ever
  becomes dynamic or grows past ~10.
