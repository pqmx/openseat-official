# React Doctor false positives

Sites where a rule fires but the finding doesn't hold. The triage playbook reads
this file and drops matching diagnostics. Entries that say "skip after verifying
X" require actually checking the code shape first — never suppress on filename
alone.

Keep this narrow. A rule stays on repo-wide so it can still catch genuine hits;
this file only excuses the specific sites below.

No entries — every rule is answered in the code.
