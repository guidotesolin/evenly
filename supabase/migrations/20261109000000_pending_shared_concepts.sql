-- Shared fixed costs another member hasn't entered yet this month, so they show as pending on my
-- Fijos too (a shared concept is a monthly household cost). fixed_concepts stays private: this
-- returns only the name and owner of active, shared, non-archived concepts of my own household's
-- active members, and only while that month has no amount. security definer: RLS would hide
-- the other member's concepts.
-- ponytail: no record of when a concept became shared, so a concept shared today also shows as
-- pending in past months; store a `shared_since` month if that gets in the way.
create function public.pending_shared_concepts(target_month date)
returns table (concept_id uuid, name text, owner_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.owner_id
  from public.household_members mine
  join public.household_members theirs
    on theirs.household_id = mine.household_id and theirs.left_on is null
  join public.fixed_concepts c on c.owner_id = theirs.user_id
  where mine.user_id = (select auth.uid())
    and mine.left_on is null
    and c.owner_id <> mine.user_id
    and c.is_shared
    and c.archived_at is null
    and not exists (
      select 1 from public.fixed_entries e
      where e.concept_id = c.id and e.month = target_month and e.amount is not null
    );
$$;
