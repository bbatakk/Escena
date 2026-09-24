-- Permet eliminar documents de la biblioteca i les seves files de Storage.
grant delete on public.band_documents to authenticated;

create policy "Members can delete from their library" on public.band_documents
for delete to authenticated using (
  exists (select 1 from public.band_members m where m.band_id = band_documents.band_id and m.user_id = (select auth.uid()))
);
