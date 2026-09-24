-- Executar a l'SQL Editor després de la migració inicial.
-- Bucket privat; cada objecte viu sota <band_id>/<concert_id>/<document_id>/.
insert into storage.buckets (id, name, public, file_size_limit)
values ('concert-documents', 'concert-documents', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = 20971520;

create policy "Band members can read concert documents" on storage.objects
for select to authenticated using (
  bucket_id = 'concert-documents' and exists (
    select 1 from public.band_members m
    where m.band_id::text = (storage.foldername(name))[1] and m.user_id = (select auth.uid())
  )
);

create policy "Band members can upload concert documents" on storage.objects
for insert to authenticated with check (
  bucket_id = 'concert-documents' and exists (
    select 1 from public.band_members m
    join public.concerts c on c.band_id = m.band_id
    where m.band_id::text = (storage.foldername(name))[1]
      and c.id::text = (storage.foldername(name))[2]
      and m.user_id = (select auth.uid())
  )
);

create policy "Band members can remove concert documents" on storage.objects
for delete to authenticated using (
  bucket_id = 'concert-documents' and exists (
    select 1 from public.band_members m
    where m.band_id::text = (storage.foldername(name))[1] and m.user_id = (select auth.uid())
  )
);
