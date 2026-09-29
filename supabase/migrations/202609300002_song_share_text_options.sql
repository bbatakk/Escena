-- Cada enllaç pot autoritzar lletra i notes de treball de manera independent.
alter table public.song_shares
  add column include_lyrics boolean not null default false,
  add column include_notes boolean not null default false;

grant select (include_lyrics, include_notes) on public.song_shares to authenticated;
grant insert (include_lyrics, include_notes) on public.song_shares to authenticated;
