-- Evenly schema. Design and reasoning: docs/ARCHITECTURE.md § Data model.

-- Tables ---------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique check (invite_code ~ '^[0-9A-F]{6}$'),
  created_at timestamptz not null default now()
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  joined_on date not null default current_date,
  left_on date check (left_on >= joined_on),
  created_at timestamptz not null default now()
);

-- v1: a user belongs to at most one household at a time.
create unique index household_members_one_active on public.household_members (user_id)
where
  left_on is null;

create table public.fixed_concepts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles on delete cascade,
  name text not null check (name <> ''),
  is_shared boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.fixed_entries (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null references public.fixed_concepts on delete cascade,
  month date not null check (month = date_trunc('month', month)),
  -- null = pending
  amount bigint check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (concept_id, month)
);

create table public.reference_rates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles on delete cascade,
  month date not null check (month = date_trunc('month', month)),
  ars_per_usd numeric not null check (ars_per_usd > 0),
  created_at timestamptz not null default now(),
  unique (owner_id, month)
);

create table public.shared_movements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  kind text not null check (kind in ('expense', 'reimbursement')),
  paid_by uuid not null references public.profiles,
  paid_to uuid references public.profiles,
  description text not null,
  amount bigint not null check (amount > 0),
  occurred_on date not null default current_date,
  -- Deleting the entry (or its concept) removes the derived movement.
  fixed_entry_id uuid unique references public.fixed_entries on delete cascade,
  created_at timestamptz not null default now(),
  check (
    (kind = 'expense' and paid_to is null)
    or (kind = 'reimbursement' and paid_to is not null and paid_to <> paid_by)
  )
);

-- Membership helpers ---------------------------------------------------------------------------

-- security definer: policies on household_members call it, so it must not go through RLS itself.
create function public.is_active_member(target_household uuid, target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household and user_id = target_user and left_on is null
  );
$$;

-- The equal-split rule: who takes part in an expense on a given date. participant_count and the
-- balance view both read it, so the rule lives only here.
create function public.household_participants(target_household uuid, on_date date)
returns setof uuid
language sql
stable
as $$
  select user_id from public.household_members
  where household_id = target_household
    and joined_on <= on_date
    and (left_on is null or left_on > on_date);
$$;

create function public.participant_count(target_household uuid, on_date date)
returns integer
language sql
stable
as $$
  select count(*)::integer from public.household_participants(target_household, on_date);
$$;

-- Profiles from auth ---------------------------------------------------------------------------

create function public.create_profile_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.create_profile_for_user();

-- Household RPCs (the only client path into household_members) ---------------------------------

create function public.create_household(household_name text)
returns public.households
language plpgsql
security definer
set search_path = ''
as $$
declare
  created public.households;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- ponytail: 16^6 random hex codes, a collision fails the unique constraint; retry loop if it
  -- ever happens with more than a handful of households.
  insert into public.households (name, invite_code)
  values (household_name, upper(substr(md5(gen_random_uuid()::text), 1, 6)))
  returning * into created;

  -- The partial unique index rejects a user who already has an active household.
  insert into public.household_members (household_id, user_id) values (created.id, auth.uid());

  return created;
end;
$$;

create function public.join_household(code text)
returns public.households
language plpgsql
security definer
set search_path = ''
as $$
declare
  found public.households;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into found from public.households where invite_code = upper(trim(code));
  if found.id is null then
    raise exception 'invalid invite code';
  end if;

  insert into public.household_members (household_id, user_id) values (found.id, auth.uid());

  return found;
end;
$$;

-- Shared fixed costs: fixed_entries -> shared_movements ----------------------------------------

-- Runs as the owner of the tables so it can write movements that clients cannot.
create function public.sync_shared_fixed_movement()
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

  if new.amount is null then
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

create trigger sync_shared_fixed_movement
after insert or update of amount on public.fixed_entries
for each row execute function public.sync_shared_fixed_movement();

-- Balances -------------------------------------------------------------------------------------

-- Positive = the household owes this member. Shares stay numeric; round only for display.
create view public.household_balances
with (security_invoker = true)
as
with deltas as (
  select household_id, paid_by as user_id, amount::numeric as delta
  from public.shared_movements
  union all
  select m.household_id, p.user_id,
    -(m.amount::numeric / public.participant_count(m.household_id, m.occurred_on))
  from public.shared_movements m
  cross join lateral public.household_participants(m.household_id, m.occurred_on) as p(user_id)
  where m.kind = 'expense'
  union all
  select household_id, paid_to, -amount::numeric
  from public.shared_movements
  where kind = 'reimbursement'
)
select hm.household_id, hm.user_id, coalesce(sum(d.delta), 0) as balance
from public.household_members hm
left join deltas d on d.household_id = hm.household_id and d.user_id = hm.user_id
group by hm.household_id, hm.user_id;

-- Row Level Security ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.fixed_concepts enable row level security;
alter table public.fixed_entries enable row level security;
alter table public.reference_rates enable row level security;
alter table public.shared_movements enable row level security;

-- Own profile, plus the names of people sharing a household ("paid by Sabrina").
create policy "profiles: self and household members" on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1 from public.household_members hm
    where hm.user_id = profiles.id and public.is_active_member(hm.household_id, (select auth.uid()))
  )
);

create policy "households: active members read" on public.households
for select to authenticated
using (public.is_active_member(id, (select auth.uid())));

-- Inserts go through create_household / join_household only.
create policy "household_members: active members read" on public.household_members
for select to authenticated
using (public.is_active_member(household_id, (select auth.uid())));

create policy "fixed_concepts: owner only" on public.fixed_concepts
for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "fixed_entries: concept owner only" on public.fixed_entries
for all to authenticated
using (
  exists (
    select 1 from public.fixed_concepts c
    where c.id = fixed_entries.concept_id and c.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.fixed_concepts c
    where c.id = fixed_entries.concept_id and c.owner_id = (select auth.uid())
  )
);

create policy "reference_rates: owner only" on public.reference_rates
for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "shared_movements: active members read" on public.shared_movements
for select to authenticated
using (public.is_active_member(household_id, (select auth.uid())));

-- Manual movements only (fixed_entry_id is the trigger's), and only between active members.
create policy "shared_movements: members write manual" on public.shared_movements
for insert to authenticated
with check (
  fixed_entry_id is null
  and public.is_active_member(household_id, (select auth.uid()))
  and public.is_active_member(household_id, paid_by)
  and (paid_to is null or public.is_active_member(household_id, paid_to))
);

create policy "shared_movements: members edit manual" on public.shared_movements
for update to authenticated
using (fixed_entry_id is null and public.is_active_member(household_id, (select auth.uid())))
with check (
  fixed_entry_id is null
  and public.is_active_member(household_id, (select auth.uid()))
  and public.is_active_member(household_id, paid_by)
  and (paid_to is null or public.is_active_member(household_id, paid_to))
);

create policy "shared_movements: members delete manual" on public.shared_movements
for delete to authenticated
using (fixed_entry_id is null and public.is_active_member(household_id, (select auth.uid())));
