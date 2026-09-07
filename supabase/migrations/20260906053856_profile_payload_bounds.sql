-- A profile appears throughout the feed. Bound its remaining free text and
-- reject prompt values that cannot be rendered as text.
alter table public.profiles add constraint profiles_year_len
  check (year is null or length(year) between 1 and 8);
alter table public.profiles add constraint profiles_major_len
  check (major is null or length(major) <= 120);
alter table public.profiles add constraint profiles_prompts_shape
  check (not jsonb_path_exists(prompts,
    '$[*] ? (@.type() != "object" || !exists(@.q) || !exists(@.a) || @.q.type() != "string" || @.a.type() != "string")'));
