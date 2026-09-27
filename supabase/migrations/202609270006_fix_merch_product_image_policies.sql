drop policy if exists "Band members can view merch product images" on storage.objects;
drop policy if exists "Band members can read merch product images" on storage.objects;
drop policy if exists "Band members can upload merch product images" on storage.objects;
drop policy if exists "Band members can update merch product images" on storage.objects;
drop policy if exists "Band members can delete merch product images" on storage.objects;

create policy "Band members can view merch product images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'merch-product-images'
  and exists (
    select 1
    from public.band_members m
    join public.merch_products p on p.band_id = m.band_id
    where m.band_id::text = (storage.foldername(storage.objects.name))[1]
      and p.id::text = (storage.foldername(storage.objects.name))[2]
      and m.user_id = (select auth.uid())
  )
);

create policy "Band members can upload merch product images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'merch-product-images'
  and exists (
    select 1
    from public.band_members m
    join public.merch_products p on p.band_id = m.band_id
    where m.band_id::text = (storage.foldername(storage.objects.name))[1]
      and p.id::text = (storage.foldername(storage.objects.name))[2]
      and m.user_id = (select auth.uid())
  )
);

create policy "Band members can update merch product images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'merch-product-images'
  and exists (
    select 1
    from public.band_members m
    join public.merch_products p on p.band_id = m.band_id
    where m.band_id::text = (storage.foldername(storage.objects.name))[1]
      and p.id::text = (storage.foldername(storage.objects.name))[2]
      and m.user_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'merch-product-images'
  and exists (
    select 1
    from public.band_members m
    join public.merch_products p on p.band_id = m.band_id
    where m.band_id::text = (storage.foldername(storage.objects.name))[1]
      and p.id::text = (storage.foldername(storage.objects.name))[2]
      and m.user_id = (select auth.uid())
  )
);

create policy "Band members can delete merch product images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'merch-product-images'
  and exists (
    select 1
    from public.band_members m
    join public.merch_products p on p.band_id = m.band_id
    where m.band_id::text = (storage.foldername(storage.objects.name))[1]
      and p.id::text = (storage.foldername(storage.objects.name))[2]
      and m.user_id = (select auth.uid())
  )
);
