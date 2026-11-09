-- The caller's share of a movement, as a PostgREST computed field (`select('*, my_share')`), so
-- the Compartidos "Mis gastos" total reuses the equal-split rule in household_participants
-- instead of repeating it in the app. Reimbursements and expenses the caller didn't take part in
-- are 0. Not rounded: display rounds (ARCHITECTURE.md § Money).
create function public.my_share(movement public.shared_movements)
returns numeric
language sql
stable
as $$
  select case
    when movement.kind = 'expense'
      and (select auth.uid()) in (
        select public.household_participants(movement.household_id, movement.occurred_on)
      )
    then movement.amount::numeric
      / public.participant_count(movement.household_id, movement.occurred_on)
    else 0
  end;
$$;
