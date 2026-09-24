create table public.merch_products (
  id uuid primary key default gen_random_uuid(), band_id uuid not null references public.bands(id) on delete cascade,
  name text not null check (length(trim(name)) > 0), price numeric(12,2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0), active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.merch_sales (
  id uuid primary key default gen_random_uuid(), band_id uuid not null references public.bands(id) on delete cascade,
  concert_id uuid not null references public.concerts(id) on delete cascade, product_id uuid not null references public.merch_products(id) on delete restrict,
  quantity integer not null check (quantity > 0), unit_price numeric(12,2) not null check (unit_price >= 0), note text not null default '', created_at timestamptz not null default now()
);

create function public.check_merch_stock()
returns trigger language plpgsql set search_path = '' as $$
declare available integer;
begin
  select p.stock into available from public.merch_products p
  where p.id = new.product_id and p.band_id = new.band_id for update;
  if available is null then raise exception 'Producte de marxandatge no trobat'; end if;
  select available - coalesce(sum(s.quantity), 0) into available
  from public.merch_sales s where s.product_id = new.product_id and s.id <> new.id;
  if new.quantity > available then raise exception 'No hi ha prou estoc disponible'; end if;
  return new;
end;
$$;

create trigger check_merch_stock_before_sale
before insert or update on public.merch_sales
for each row execute function public.check_merch_stock();
create index merch_products_band_idx on public.merch_products (band_id, name);
create index merch_sales_band_idx on public.merch_sales (band_id, created_at desc);
alter table public.merch_products enable row level security; alter table public.merch_sales enable row level security;
revoke all on public.merch_products, public.merch_sales from anon, authenticated;
grant select, insert, update on public.merch_products to authenticated; grant select, insert, delete on public.merch_sales to authenticated;
create policy "Members read merch products" on public.merch_products for select to authenticated using (exists (select 1 from public.band_members m where m.band_id = merch_products.band_id and m.user_id = (select auth.uid())));
create policy "Members write merch products" on public.merch_products for insert to authenticated with check (exists (select 1 from public.band_members m where m.band_id = merch_products.band_id and m.user_id = (select auth.uid())));
create policy "Members update merch products" on public.merch_products for update to authenticated using (exists (select 1 from public.band_members m where m.band_id = merch_products.band_id and m.user_id = (select auth.uid()))) with check (exists (select 1 from public.band_members m where m.band_id = merch_products.band_id and m.user_id = (select auth.uid())));
create policy "Members read merch sales" on public.merch_sales for select to authenticated using (exists (select 1 from public.band_members m where m.band_id = merch_sales.band_id and m.user_id = (select auth.uid())));
create policy "Members add merch sales" on public.merch_sales for insert to authenticated with check (exists (select 1 from public.band_members m where m.band_id = merch_sales.band_id and m.user_id = (select auth.uid())) and exists (select 1 from public.concerts c where c.id = merch_sales.concert_id and c.band_id = merch_sales.band_id) and exists (select 1 from public.merch_products p where p.id = merch_sales.product_id and p.band_id = merch_sales.band_id));
create policy "Members delete merch sales" on public.merch_sales for delete to authenticated using (exists (select 1 from public.band_members m where m.band_id = merch_sales.band_id and m.user_id = (select auth.uid())));
