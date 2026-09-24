-- Biblioteca de documents comuns de la banda. Cal haver executat 001 i 002.
insert into storage.buckets (id, name, public, file_size_limit)
values ('concert-documents', 'concert-documents', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = 20971520;

create table public.band_documents (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  url text not null default '',
  storage_path text,
  file_name text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index band_documents_band_idx on public.band_documents (band_id, created_at);
alter table public.band_documents enable row level security;
revoke all on public.band_documents from anon, authenticated;
grant select, insert, update on public.band_documents to authenticated;

create policy "Members can read their library" on public.band_documents
for select to authenticated using (
  exists (select 1 from public.band_members m where m.band_id = band_documents.band_id and m.user_id = (select auth.uid()))
);

create policy "Members can add to their library" on public.band_documents
for insert to authenticated with check (
  exists (select 1 from public.band_members m where m.band_id = band_documents.band_id and m.user_id = (select auth.uid()))
);

create policy "Members can update their library" on public.band_documents
for update to authenticated
using (exists (select 1 from public.band_members m where m.band_id = band_documents.band_id and m.user_id = (select auth.uid())))
with check (exists (select 1 from public.band_members m where m.band_id = band_documents.band_id and m.user_id = (select auth.uid())));

-- Els fitxers de la biblioteca comparteixen el bucket privat, però tenen una ruta diferent.
create policy "Band members can upload shared documents" on storage.objects
for insert to authenticated with check (
  bucket_id = 'concert-documents' and (storage.foldername(name))[2] = 'shared'
  and exists (
    select 1 from public.band_members m
    join public.band_documents d on d.band_id = m.band_id
    where m.band_id::text = (storage.foldername(name))[1]
      and d.id::text = (storage.foldername(name))[3]
      and m.user_id = (select auth.uid())
  )
);

create policy "Band members can read shared documents" on storage.objects
for select to authenticated using (
  bucket_id = 'concert-documents' and (storage.foldername(name))[2] = 'shared'
  and exists (
    select 1 from public.band_members m
    where m.band_id::text = (storage.foldername(name))[1]
      and m.user_id = (select auth.uid())
  )
);

create policy "Band members can replace shared documents" on storage.objects
for update to authenticated using (
  bucket_id = 'concert-documents' and (storage.foldername(name))[2] = 'shared'
  and exists (
    select 1 from public.band_members m
    where m.band_id::text = (storage.foldername(name))[1]
      and m.user_id = (select auth.uid())
  )
) with check (
  bucket_id = 'concert-documents' and (storage.foldername(name))[2] = 'shared'
  and exists (
    select 1 from public.band_members m
    where m.band_id::text = (storage.foldername(name))[1]
      and m.user_id = (select auth.uid())
  )
);

create policy "Band members can remove shared documents" on storage.objects
for delete to authenticated using (
  bucket_id = 'concert-documents' and (storage.foldername(name))[2] = 'shared'
  and exists (
    select 1 from public.band_members m
    where m.band_id::text = (storage.foldername(name))[1]
      and m.user_id = (select auth.uid())
  )
);
