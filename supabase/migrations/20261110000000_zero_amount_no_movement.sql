-- An amount of 0 means "not paid this month" (shown as `-` on Fijos). On a shared concept it must
-- not become a $0 expense in Compartidos, so 0 now behaves like null: no derived movement, and an
-- existing one is deleted. Same function as in the schema migration otherwise.
create or replace function public.sync_shared_fixed_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  concept public.fixed_concepts;
  owner_household uuid;
begin
  select * into concept from public.fixed_concepts where id = new.concept_id;

  -- Toggling is_shared only affects entries written afterwards: movements of a concept that is
  -- no longer shared stay, they may already be settled.
  if not concept.is_shared then
    return new;
  end if;

  if new.amount is null or new.amount = 0 then
    delete from public.shared_movements where fixed_entry_id = new.id;
    return new;
  end if;

  select household_id into owner_household
  from public.household_members
  where user_id = concept.owner_id and left_on is null;

  if owner_household is null then
    return new;
  end if;

  insert into public.shared_movements
    (household_id, kind, paid_by, description, amount, occurred_on, fixed_entry_id)
  values (
    owner_household,
    'expense',
    concept.owner_id,
    concept.name,
    new.amount,
    greatest(new.month, least(current_date, (new.month + interval '1 month - 1 day')::date)),
    new.id
  )
  on conflict (fixed_entry_id) do update set amount = excluded.amount;

  return new;
end;
$$;
