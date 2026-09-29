-- Enllaços privats, revocables i només de lectura per escoltar cançons.
create table public.song_shares (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  unique (id, band_id),
  check (expires_at > created_at and expires_at <= created_at + interval '31 days'),
  check (revoked_at is null or revoked_at >= created_at)
);

create table public.song_share_projects (
  share_id uuid not null,
  song_project_id uuid not null,
  band_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (share_id, song_project_id),
  foreign key (share_id, band_id) references public.song_shares(id, band_id) on delete cascade,
  foreign key (song_project_id, band_id) references public.song_projects(id, band_id) on delete cascade
);

create index song_shares_band_created_idx on public.song_shares (band_id, created_at desc);
create index song_share_projects_project_idx on public.song_share_projects (song_project_id);

alter table public.song_shares enable row level security;
alter table public.song_share_projects enable row level security;

revoke all on public.song_shares, public.song_share_projects from anon, authenticated;
grant select (id, band_id, created_by, created_at, expires_at, revoked_at) on public.song_shares to authenticated;
grant insert (id, band_id, token_hash, created_by, expires_at) on public.song_shares to authenticated;
grant update (revoked_at) on public.song_shares to authenticated;
grant select, insert, delete on public.song_share_projects to authenticated;

create policy "Members can read song shares" on public.song_shares
for select to authenticated using (
  exists (
    select 1 from public.band_members m
    where m.band_id = song_shares.band_id and m.user_id = (select auth.uid())
  )
);

create policy "Members can create song shares" on public.song_shares
for insert to authenticated with check (
  created_by = (select auth.uid())
  and revoked_at is null
  and exists (
    select 1 from public.band_members m
    where m.band_id = song_shares.band_id and m.user_id = (select auth.uid())
  )
);

create policy "Members can revoke song shares" on public.song_shares
for update to authenticated using (
  exists (
    select 1 from public.band_members m
    where m.band_id = song_shares.band_id and m.user_id = (select auth.uid())
  )
) with check (
  revoked_at is not null
  and exists (
    select 1 from public.band_members m
    where m.band_id = song_shares.band_id and m.user_id = (select auth.uid())
  )
);

create policy "Members can read shared song selections" on public.song_share_projects
for select to authenticated using (
  exists (
    select 1 from public.band_members m
    where m.band_id = song_share_projects.band_id and m.user_id = (select auth.uid())
  )
);

create policy "Members can add songs to a share" on public.song_share_projects
for insert to authenticated with check (
  exists (
    select 1
    from public.band_members m
    join public.song_shares s on s.band_id = m.band_id
    join public.song_projects p on p.band_id = m.band_id
    where m.band_id = song_share_projects.band_id
      and m.user_id = (select auth.uid())
      and s.id = song_share_projects.share_id
      and s.revoked_at is null
      and s.expires_at > now()
      and p.id = song_share_projects.song_project_id
      and p.archived = false
  )
);

create policy "Members can remove songs from a share" on public.song_share_projects
for delete to authenticated using (
  exists (
    select 1 from public.band_members m
    where m.band_id = song_share_projects.band_id and m.user_id = (select auth.uid())
  )
);
