-- Manté compatibles les vendes històriques sense talla i valida també l'estoc total.
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

  if jsonb_array_length(product_sizes) > 0 and new.size is not null and length(trim(new.size)) > 0 then
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

    select least(available, product_stock - coalesce(sum(s.quantity), 0)::integer) into available
    from public.merch_sales s
    where s.product_id = new.product_id and s.id <> new.id;
  else
    -- Older sales without a size remain included in the product's overall stock.
    select product_stock - coalesce(sum(s.quantity), 0)::integer into available
    from public.merch_sales s
    where s.product_id = new.product_id and s.id <> new.id;
  end if;

  if new.quantity > available then raise exception 'No hi ha prou estoc disponible'; end if;
  return new;
end;
$$;

create or replace function public.guard_merch_product_stock()
returns trigger language plpgsql set search_path = '' as $$
declare
  total_sold integer;
  sold_variant record;
  variant_stock integer;
begin
  select coalesce(sum(s.quantity), 0)::integer into total_sold
  from public.merch_sales s where s.product_id = old.id;
  if new.stock < total_sold then
    raise exception 'L’estoc no pot ser inferior a les unitats ja venudes';
  end if;

  for sold_variant in
    select s.size, coalesce(sum(s.quantity), 0)::integer as quantity
    from public.merch_sales s
    where s.product_id = old.id and s.size is not null and length(trim(s.size)) > 0
    group by s.size
  loop
    select (variant->>'stock')::integer into variant_stock
    from jsonb_array_elements(new.sizes) as variant
    where upper(trim(variant->>'name')) = upper(trim(sold_variant.size))
    limit 1;
    if variant_stock is null or variant_stock < sold_variant.quantity then
      raise exception 'No pots treure una talla ni reduir-ne l’estoc per sota de les unitats venudes';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists guard_merch_product_stock_before_update on public.merch_products;
create trigger guard_merch_product_stock_before_update
before update of stock, sizes on public.merch_products
for each row execute function public.guard_merch_product_stock();
