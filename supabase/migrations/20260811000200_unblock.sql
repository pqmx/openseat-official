-- Unblocking.
--
-- A block is a `reports` row with `blocked` set, and there was no statement that
-- could ever clear it: `reports` had SELECT and INSERT for its author and nothing
-- else, so every block was permanent and invisible. `private.blocked_with` reads
-- it symmetrically, so the person you blocked lost your rooms too, forever, with
-- no way for either of you to undo it.
--
-- UPDATE by column, not by table — the two `reviewed_*` columns are the triage
-- queue's, and a table-level grant here would hand a reporter the column
-- `private.report_queue` filters on. That mistake has already been made once.
grant update(blocked) on public.reports to authenticated;

create policy reports_update_own on public.reports for update to authenticated
  using ((reporter_id = (select auth.uid())))
  with check ((reporter_id = (select auth.uid())));
