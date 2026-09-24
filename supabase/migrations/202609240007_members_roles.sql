-- Preparació per comptes individuals. El compte compartit continua funcionant igual.
alter table public.band_members add column if not exists role text not null default 'member';
update public.band_members set role = 'owner' where role = 'member';
alter table public.band_members drop constraint if exists band_members_role_check;
alter table public.band_members add constraint band_members_role_check check (role in ('owner', 'manager', 'member', 'technician'));

create table public.band_invitations (
  id uuid primary key default gen_random_uuid(), band_id uuid not null references public.bands(id) on delete cascade,
  email text not null, role text not null default 'member' check (role in ('manager', 'member', 'technician')),
  token_hash text not null unique, expires_at timestamptz not null, accepted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.band_invitations enable row level security;
revoke all on public.band_invitations from anon, authenticated;
grant select, insert, update on public.band_invitations to authenticated;
create policy "Owners can read invitations" on public.band_invitations for select to authenticated using (exists (select 1 from public.band_members m where m.band_id = band_invitations.band_id and m.user_id = (select auth.uid()) and m.role in ('owner', 'manager')));
create policy "Owners can create invitations" on public.band_invitations for insert to authenticated with check (exists (select 1 from public.band_members m where m.band_id = band_invitations.band_id and m.user_id = (select auth.uid()) and m.role in ('owner', 'manager')));
create policy "Owners can update invitations" on public.band_invitations for update to authenticated using (exists (select 1 from public.band_members m where m.band_id = band_invitations.band_id and m.user_id = (select auth.uid()) and m.role in ('owner', 'manager')));

comment on table public.band_invitations is 'Esquema preparat; la UI d invitacions es farà quan s abandoni el compte compartit.';
