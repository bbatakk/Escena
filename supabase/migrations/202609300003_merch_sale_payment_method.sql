alter table public.merch_sales
  add column payment_method text not null default 'card',
  add constraint merch_sales_payment_method_check
    check (payment_method in ('card', 'cash'));

create or replace function public.sync_merch_sale_movement()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  product_name text;
  movement_amount numeric;
  movement_payment_method text;
begin
  if tg_op = 'DELETE' then
    delete from public.money_movements where source_type = 'merch_sale' and source_id = old.id;
    perform public.sync_legacy_merch_movement(old.concert_id);
    return old;
  end if;

  select p.name into product_name from public.merch_products p where p.id = new.product_id;
  movement_amount := round(greatest(0, new.quantity * new.unit_price), 2);
  movement_payment_method := case when new.payment_method = 'cash' then 'cash' else 'bank' end;
  if movement_amount <= 0 then
    delete from public.money_movements where source_type = 'merch_sale' and source_id = new.id;
  else
    insert into public.money_movements (band_id, concert_id, kind, amount, date, category, note, payment_method, source_type, source_id)
    values (new.band_id, new.concert_id, 'ingres', movement_amount, new.created_at::date, 'Marxandatge', 'Generat automàticament · ' || coalesce(nullif(new.note, ''), coalesce(product_name, 'Venda de marxandatge')), movement_payment_method, 'merch_sale', new.id)
    on conflict (source_type, source_id) where source_type is not null do update
      set band_id = excluded.band_id, concert_id = excluded.concert_id, kind = excluded.kind,
          amount = excluded.amount, date = excluded.date, category = excluded.category,
          note = excluded.note, payment_method = excluded.payment_method;
  end if;
  if tg_op = 'UPDATE' and old.concert_id is distinct from new.concert_id then
    perform public.sync_legacy_merch_movement(old.concert_id);
  end if;
  perform public.sync_legacy_merch_movement(new.concert_id);
  return new;
end;
$$;

update public.money_movements m
set payment_method = case when s.payment_method = 'cash' then 'cash' else 'bank' end
from public.merch_sales s
where m.source_type = 'merch_sale' and m.source_id = s.id;
