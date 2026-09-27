-- Imatges privades opcionals per als productes de marxandatge.
alter table public.merch_products add column image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('merch-product-images', 'merch-product-images', false, 5242880, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/webp', 'image/png', 'image/jpeg'];

create policy "Band members can read merch product images" on storage.objects
for select to authenticated using (
  bucket_id = 'merch-product-images'
  and exists (
    select 1 from public.band_members m
    join public.merch_products p on p.band_id = m.band_id
    where m.band_id::text = (storage.foldername(storage.objects.name))[1]
      and p.id::text = (storage.foldername(storage.objects.name))[2]
      and m.user_id = (select auth.uid())
  )
);

create policy "Band members can upload merch product images" on storage.objects
for insert to authenticated with check (
  bucket_id = 'merch-product-images'
  and exists (
    select 1 from public.band_members m
    join public.merch_products p on p.band_id = m.band_id
    where m.band_id::text = (storage.foldername(storage.objects.name))[1]
      and p.id::text = (storage.foldername(storage.objects.name))[2]
      and m.user_id = (select auth.uid())
  )
);

create policy "Band members can delete merch product images" on storage.objects
for delete to authenticated using (
  bucket_id = 'merch-product-images'
  and exists (
    select 1 from public.band_members m
    join public.merch_products p on p.band_id = m.band_id
    where m.band_id::text = (storage.foldername(storage.objects.name))[1]
      and p.id::text = (storage.foldername(storage.objects.name))[2]
      and m.user_id = (select auth.uid())
  )
);
