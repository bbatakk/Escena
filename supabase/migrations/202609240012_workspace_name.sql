-- Permet als membres de la banda canviar el nom del seu espai compartit.
grant update (name) on public.bands to authenticated;

create policy "Members can rename their band" on public.bands
for update to authenticated
using (
  exists (select 1 from public.band_members m where m.band_id = bands.id and m.user_id = (select auth.uid()))
)
with check (
  exists (select 1 from public.band_members m where m.band_id = bands.id and m.user_id = (select auth.uid()))
);
