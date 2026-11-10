-- Another member's shared concept shows with its owner's emoji on my Fijos, not just the initial.
-- fixed_concepts stays private, so the emoji comes through security definer functions that expose
-- only that column of concepts the caller already sees by name.

-- Same as 20261109000000_pending_shared_concepts.sql plus `emoji`; a new return column needs a
-- drop, `create or replace` can't change it.
drop function public.pending_shared_concepts(date);

create function public.pending_shared_concepts(target_month date)
returns table (concept_id uuid, name text, owner_id uuid, emoji text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.owner_id, c.emoji
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

-- The emoji of the concept a derived movement comes from, as a PostgREST computed field
-- (`select('*, concept_emoji')`). The movement is looked up again by id and the caller must be an
-- active member of its household, so a hand-built row passed to /rpc reveals nothing.
create function public.concept_emoji(movement public.shared_movements)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select c.emoji
  from public.shared_movements m
  join public.fixed_entries e on e.id = m.fixed_entry_id
  join public.fixed_concepts c on c.id = e.concept_id
  where m.id = movement.id
    and public.is_active_member(m.household_id, (select auth.uid()));
$$;
