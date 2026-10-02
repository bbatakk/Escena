alter table public.band_materials
  add column quantity integer not null default 1
  constraint band_materials_quantity_positive check (quantity >= 1);
