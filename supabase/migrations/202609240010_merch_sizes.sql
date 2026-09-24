-- Afegeix variants de talla i estoc per talla al catàleg de marxandatge.
alter table public.merch_products
  add column sizes jsonb not null default '[]'::jsonb,
  add constraint merch_products_sizes_array check (jsonb_typeof(sizes) = 'array');

alter table public.merch_sales add column size text;

create or replace function public.check_merch_stock()
returns trigger language plpgsql set search_path = '' as $$
declare
  product_stock integer;
  product_sizes jsonb;
  size_stock integer;
  available integer;
begin
  select p.stock, p.sizes into product_stock, product_sizes
  from public.merch_products p
  where p.id = new.product_id and p.band_id = new.band_id
  for update;

  if product_stock is null then raise exception 'Producte de marxandatge no trobat'; end if;

  if jsonb_array_length(product_sizes) > 0 then
    if new.size is null or length(trim(new.size)) = 0 then
      raise exception 'Cal seleccionar una talla';
    end if;
    select (variant->>'stock')::integer into size_stock
    from jsonb_array_elements(product_sizes) as variant
    where upper(trim(variant->>'name')) = upper(trim(new.size))
    limit 1;
    if size_stock is null then raise exception 'Talla de marxandatge no trobada'; end if;
    select size_stock - coalesce(sum(s.quantity), 0)::integer into available
    from public.merch_sales s
    where s.product_id = new.product_id
      and upper(trim(coalesce(s.size, ''))) = upper(trim(new.size))
      and s.id <> new.id;
  else
    select product_stock - coalesce(sum(s.quantity), 0)::integer into available
    from public.merch_sales s
    where s.product_id = new.product_id and s.id <> new.id;
  end if;

  if new.quantity > available then raise exception 'No hi ha prou estoc disponible'; end if;
  return new;
end;
$$;
