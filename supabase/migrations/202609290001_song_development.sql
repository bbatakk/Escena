-- Espai de treball de cançons en procés i versions d'àudio privades.
create table public.song_projects (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  status text not null default 'idea'
    check (status in ('idea', 'en_proces', 'demo', 'maqueta', 'en_pausa', 'tancada')),
  notes text not null default '',
  lyrics text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, band_id)
);

create table public.song_versions (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  song_project_id uuid not null references public.song_projects(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  kind text not null default 'demo'
    check (kind in ('idea_gravada', 'demo', 'maqueta', 'altra')),
  recorded_on date not null default current_date,
  notes text not null default '',
  external_url text not null default '',
  audio_path text check (audio_path is null or length(trim(audio_path)) > 0),
  audio_file_name text check (audio_file_name is null or length(trim(audio_file_name)) > 0),
  audio_mime_type text check (
    audio_mime_type is null
    or audio_mime_type in ('audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav')
  ),
  audio_size_bytes bigint check (audio_size_bytes is null or audio_size_bytes between 1 and 52428800),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint song_versions_project_band_fk foreign key (song_project_id, band_id)
    references public.song_projects(id, band_id) on delete cascade
);

create index song_projects_band_updated_idx on public.song_projects (band_id, updated_at desc);
create index song_versions_project_recorded_idx on public.song_versions (song_project_id, recorded_on desc, created_at desc);

create function public.touch_song_development_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

create trigger on_song_project_updated
before update on public.song_projects
for each row execute function public.touch_song_development_updated_at();

create trigger on_song_version_updated
before update on public.song_versions
for each row execute function public.touch_song_development_updated_at();

alter table public.song_projects enable row level security;
alter table public.song_versions enable row level security;

revoke all on public.song_projects, public.song_versions from anon, authenticated;
grant select, insert, update, delete on public.song_projects, public.song_versions to authenticated;

create policy "Members can read song projects" on public.song_projects
for select to authenticated using (
  exists (
    select 1 from public.band_members m
    where m.band_id = song_projects.band_id and m.user_id = (select auth.uid())
  )
);

create policy "Members can create song projects" on public.song_projects
for insert to authenticated with check (
  exists (
    select 1 from public.band_members m
    where m.band_id = song_projects.band_id and m.user_id = (select auth.uid())
  )
);

create policy "Members can update song projects" on public.song_projects
for update to authenticated
using (
  exists (
    select 1 from public.band_members m
    where m.band_id = song_projects.band_id and m.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.band_members m
    where m.band_id = song_projects.band_id and m.user_id = (select auth.uid())
  )
);

create policy "Members can delete song projects" on public.song_projects
for delete to authenticated using (
  exists (
    select 1 from public.band_members m
    where m.band_id = song_projects.band_id and m.user_id = (select auth.uid())
  )
);

create policy "Members can read song versions" on public.song_versions
for select to authenticated using (
  exists (
    select 1 from public.band_members m
    where m.band_id = song_versions.band_id and m.user_id = (select auth.uid())
  )
);

create policy "Members can create song versions" on public.song_versions
for insert to authenticated with check (
  exists (
    select 1 from public.band_members m
    where m.band_id = song_versions.band_id and m.user_id = (select auth.uid())
  )
);

create policy "Members can update song versions" on public.song_versions
for update to authenticated
using (
  exists (
    select 1 from public.band_members m
    where m.band_id = song_versions.band_id and m.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.band_members m
    where m.band_id = song_versions.band_id and m.user_id = (select auth.uid())
  )
);

create policy "Members can delete song versions" on public.song_versions
for delete to authenticated using (
  exists (
    select 1 from public.band_members m
    where m.band_id = song_versions.band_id and m.user_id = (select auth.uid())
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'song-files',
  'song-files',
  false,
  52428800,
  array['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav']
)
on conflict (id) do update
  set public = false,
      file_size_limit = 52428800,
      allowed_mime_types = array['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav'];

-- Ruta obligatòria: band_id/song_project_id/song_version_id/fitxer.
create policy "Band members can read song files" on storage.objects
for select to authenticated using (
  bucket_id = 'song-files'
  and array_length(storage.foldername(storage.objects.name), 1) = 3
  and exists (
    select 1
    from public.song_versions v
    join public.song_projects p on p.id = v.song_project_id
    join public.band_members m on m.band_id = p.band_id
    where p.band_id::text = (storage.foldername(storage.objects.name))[1]
      and p.id::text = (storage.foldername(storage.objects.name))[2]
      and v.id::text = (storage.foldername(storage.objects.name))[3]
      and m.user_id = (select auth.uid())
  )
);

create policy "Band members can upload song files" on storage.objects
for insert to authenticated with check (
  bucket_id = 'song-files'
  and array_length(storage.foldername(storage.objects.name), 1) = 3
  and exists (
    select 1
    from public.song_versions v
    join public.song_projects p on p.id = v.song_project_id
    join public.band_members m on m.band_id = p.band_id
    where p.band_id::text = (storage.foldername(storage.objects.name))[1]
      and p.id::text = (storage.foldername(storage.objects.name))[2]
      and v.id::text = (storage.foldername(storage.objects.name))[3]
      and m.user_id = (select auth.uid())
  )
);

create policy "Band members can update song files" on storage.objects
for update to authenticated
using (
  bucket_id = 'song-files'
  and array_length(storage.foldername(storage.objects.name), 1) = 3
  and exists (
    select 1
    from public.song_versions v
    join public.song_projects p on p.id = v.song_project_id
    join public.band_members m on m.band_id = p.band_id
    where p.band_id::text = (storage.foldername(storage.objects.name))[1]
      and p.id::text = (storage.foldername(storage.objects.name))[2]
      and v.id::text = (storage.foldername(storage.objects.name))[3]
      and m.user_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'song-files'
  and array_length(storage.foldername(storage.objects.name), 1) = 3
  and exists (
    select 1
    from public.song_versions v
    join public.song_projects p on p.id = v.song_project_id
    join public.band_members m on m.band_id = p.band_id
    where p.band_id::text = (storage.foldername(storage.objects.name))[1]
      and p.id::text = (storage.foldername(storage.objects.name))[2]
      and v.id::text = (storage.foldername(storage.objects.name))[3]
      and m.user_id = (select auth.uid())
  )
);

create policy "Band members can delete song files" on storage.objects
for delete to authenticated using (
  bucket_id = 'song-files'
  and array_length(storage.foldername(storage.objects.name), 1) = 3
  and exists (
    select 1 from public.band_members m
    where m.band_id::text = (storage.foldername(storage.objects.name))[1]
      and m.user_id = (select auth.uid())
  )
);
