-- Afegeix una imatge identificativa privada a l’espai de la banda.
alter table public.bands add column logo_path text;

grant update (logo_path) on public.bands to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('band-assets', 'band-assets', false, 5242880)
on conflict (id) do update set public = false, file_size_limit = 5242880;

create policy "Band members can read their brand assets" on storage.objects
for select to authenticated using (
  bucket_id = 'band-assets' and (storage.foldername(name))[2] = 'branding'
  and exists (select 1 from public.band_members m where m.band_id::text = (storage.foldername(name))[1] and m.user_id = (select auth.uid()))
);

create policy "Band members can upload their brand assets" on storage.objects
for insert to authenticated with check (
  bucket_id = 'band-assets' and (storage.foldername(name))[2] = 'branding'
  and exists (select 1 from public.band_members m where m.band_id::text = (storage.foldername(name))[1] and m.user_id = (select auth.uid()))
);

create policy "Band members can delete their brand assets" on storage.objects
for delete to authenticated using (
  bucket_id = 'band-assets' and (storage.foldername(name))[2] = 'branding'
  and exists (select 1 from public.band_members m where m.band_id::text = (storage.foldername(name))[1] and m.user_id = (select auth.uid()))
);
