create table public.money_movements (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  concert_id uuid references public.concerts(id) on delete set null,
  kind text not null check (kind in ('ingres', 'despesa')),
  amount numeric(12,2) not null check (amount > 0),
  date date not null,
  category text not null default 'Altres',
  note text not null default '',
  created_at timestamptz not null default now()
);

create index money_movements_band_date_idx on public.money_movements (band_id, date desc);
alter table public.money_movements enable row level security;
revoke all on public.money_movements from anon, authenticated;
grant select, insert, update, delete on public.money_movements to authenticated;

create policy "Members can read their money movements" on public.money_movements
for select to authenticated using (
  exists (select 1 from public.band_members m where m.band_id = money_movements.band_id and m.user_id = (select auth.uid()))
);

create policy "Members can add money movements" on public.money_movements
for insert to authenticated with check (
  exists (select 1 from public.band_members m where m.band_id = money_movements.band_id and m.user_id = (select auth.uid()))
  and (concert_id is null or exists (select 1 from public.concerts c where c.id = money_movements.concert_id and c.band_id = money_movements.band_id))
);

create policy "Members can update money movements" on public.money_movements
for update to authenticated using (
  exists (select 1 from public.band_members m where m.band_id = money_movements.band_id and m.user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.band_members m where m.band_id = money_movements.band_id and m.user_id = (select auth.uid()))
);

create policy "Members can delete money movements" on public.money_movements
for delete to authenticated using (
  exists (select 1 from public.band_members m where m.band_id = money_movements.band_id and m.user_id = (select auth.uid()))
);
