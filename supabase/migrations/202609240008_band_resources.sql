create table public.band_people (
  id uuid primary key default gen_random_uuid(), band_id uuid not null references public.bands(id) on delete cascade,
  name text not null, kind text not null check (kind in ('musica', 'tecnic', 'manager', 'contacte')),
  phone text not null default '', email text not null default '', active boolean not null default true, created_at timestamptz not null default now()
);
create table public.band_materials (
  id uuid primary key default gen_random_uuid(), band_id uuid not null references public.bands(id) on delete cascade,
  name text not null, category text not null default '', active boolean not null default true, created_at timestamptz not null default now()
);
create table public.setlist_templates (
  id uuid primary key default gen_random_uuid(), band_id uuid not null references public.bands(id) on delete cascade,
  name text not null, songs jsonb not null default '[]'::jsonb, active boolean not null default true, created_at timestamptz not null default now()
);

alter table public.band_people enable row level security; alter table public.band_materials enable row level security; alter table public.setlist_templates enable row level security;
revoke all on public.band_people, public.band_materials, public.setlist_templates from anon, authenticated;
grant select, insert, update on public.band_people, public.band_materials, public.setlist_templates to authenticated;

create policy "Members read band people" on public.band_people for select to authenticated using (exists (select 1 from public.band_members m where m.band_id = band_people.band_id and m.user_id = (select auth.uid())));
create policy "Members write band people" on public.band_people for insert to authenticated with check (exists (select 1 from public.band_members m where m.band_id = band_people.band_id and m.user_id = (select auth.uid())));
create policy "Members update band people" on public.band_people for update to authenticated using (exists (select 1 from public.band_members m where m.band_id = band_people.band_id and m.user_id = (select auth.uid()))) with check (exists (select 1 from public.band_members m where m.band_id = band_people.band_id and m.user_id = (select auth.uid())));
create policy "Members read band materials" on public.band_materials for select to authenticated using (exists (select 1 from public.band_members m where m.band_id = band_materials.band_id and m.user_id = (select auth.uid())));
create policy "Members write band materials" on public.band_materials for insert to authenticated with check (exists (select 1 from public.band_members m where m.band_id = band_materials.band_id and m.user_id = (select auth.uid())));
create policy "Members update band materials" on public.band_materials for update to authenticated using (exists (select 1 from public.band_members m where m.band_id = band_materials.band_id and m.user_id = (select auth.uid()))) with check (exists (select 1 from public.band_members m where m.band_id = band_materials.band_id and m.user_id = (select auth.uid())));
create policy "Members read setlist templates" on public.setlist_templates for select to authenticated using (exists (select 1 from public.band_members m where m.band_id = setlist_templates.band_id and m.user_id = (select auth.uid())));
create policy "Members write setlist templates" on public.setlist_templates for insert to authenticated with check (exists (select 1 from public.band_members m where m.band_id = setlist_templates.band_id and m.user_id = (select auth.uid())));
create policy "Members update setlist templates" on public.setlist_templates for update to authenticated using (exists (select 1 from public.band_members m where m.band_id = setlist_templates.band_id and m.user_id = (select auth.uid()))) with check (exists (select 1 from public.band_members m where m.band_id = setlist_templates.band_id and m.user_id = (select auth.uid())));
