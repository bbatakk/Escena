-- Configuració opcional de discogràfica per banda. Les condicions de cada concert són una còpia a concerts.details.
alter table public.bands
  add column label_name text not null default '',
  add column label_tiers jsonb not null default '[]'::jsonb
    check (jsonb_typeof(label_tiers) = 'array');

grant update (label_name, label_tiers) on public.bands to authenticated;
