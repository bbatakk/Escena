-- Reparació segura per projectes que ja han executat la migració 003.
insert into storage.buckets (id, name, public, file_size_limit)
values ('concert-documents', 'concert-documents', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = 20971520;

-- La carpeta de banda ja és la frontera de seguretat; no cal que l'upload
-- depengui d'una lectura addicional de band_documents durant la petició Storage.
create policy "Band members can upload shared files v2" on storage.objects
for insert to authenticated with check (
  bucket_id = 'concert-documents' and (storage.foldername(name))[2] = 'shared'
  and exists (
    select 1 from public.band_members m
    where m.band_id::text = (storage.foldername(name))[1]
      and m.user_id = (select auth.uid())
  )
);

create policy "Band members can read shared files v2" on storage.objects
for select to authenticated using (
  bucket_id = 'concert-documents' and (storage.foldername(name))[2] = 'shared'
  and exists (
    select 1 from public.band_members m
    where m.band_id::text = (storage.foldername(name))[1]
      and m.user_id = (select auth.uid())
  )
);

create policy "Band members can update shared files v2" on storage.objects
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

create policy "Band members can remove shared files v2" on storage.objects
for delete to authenticated using (
  bucket_id = 'concert-documents' and (storage.foldername(name))[2] = 'shared'
  and exists (
    select 1 from public.band_members m
    where m.band_id::text = (storage.foldername(name))[1]
      and m.user_id = (select auth.uid())
  )
);
