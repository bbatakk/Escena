-- Un compte nou crea el seu propi espai de banda. L'accés a concerts sempre passa per RLS.
create table public.bands (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'La nostra banda',
  created_at timestamptz not null default now()
);

create table public.band_members (
  band_id uuid not null references public.bands(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (band_id, user_id),
  unique (user_id)
);

create table public.concerts (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  date date not null,
  status text not null default 'en_converses'
    check (status in ('en_converses', 'reservat', 'confirmat', 'realitzat', 'cancel·lat')),
  venue text not null default '',
  city text not null default '',
  address text not null default '',
  fee_amount numeric(12,2) not null default 0 check (fee_amount >= 0),
  fee_paid numeric(12,2) not null default 0 check (fee_paid >= 0),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index concerts_band_date_idx on public.concerts (band_id, date);

create function public.create_band_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare new_band_id uuid;
begin
  insert into public.bands default values returning id into new_band_id;
  insert into public.band_members (band_id, user_id) values (new_band_id, new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.create_band_for_new_user();

create function public.touch_concert_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

create trigger on_concert_updated
before update on public.concerts
for each row execute function public.touch_concert_updated_at();

alter table public.bands enable row level security;
alter table public.band_members enable row level security;
alter table public.concerts enable row level security;

revoke all on public.bands, public.band_members, public.concerts from anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.bands, public.band_members to authenticated;
grant select, insert, update, delete on public.concerts to authenticated;

create policy "Members can read their membership" on public.band_members
for select to authenticated using (user_id = (select auth.uid()));

create policy "Members can read their band" on public.bands
for select to authenticated using (
  exists (select 1 from public.band_members m where m.band_id = id and m.user_id = (select auth.uid()))
);

create policy "Members can read concerts" on public.concerts
for select to authenticated using (
  exists (select 1 from public.band_members m where m.band_id = concerts.band_id and m.user_id = (select auth.uid()))
);

create policy "Members can create concerts" on public.concerts
for insert to authenticated with check (
  exists (select 1 from public.band_members m where m.band_id = concerts.band_id and m.user_id = (select auth.uid()))
);

create policy "Members can update concerts" on public.concerts
for update to authenticated
using (exists (select 1 from public.band_members m where m.band_id = concerts.band_id and m.user_id = (select auth.uid())))
with check (exists (select 1 from public.band_members m where m.band_id = concerts.band_id and m.user_id = (select auth.uid())));

create policy "Members can delete concerts" on public.concerts
for delete to authenticated using (
  exists (select 1 from public.band_members m where m.band_id = concerts.band_id and m.user_id = (select auth.uid()))
);
