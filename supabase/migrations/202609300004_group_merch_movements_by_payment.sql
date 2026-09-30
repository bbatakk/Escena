alter table public.money_movements drop constraint money_movements_source_type_check;
alter table public.money_movements add constraint money_movements_source_type_check
  check (source_type is null or source_type in ('concert_fee', 'merch_sale', 'legacy_merch', 'merch_total', 'merch_total_card', 'merch_total_cash', 'concert_expense'));

create or replace function public.sync_concert_merch_total(p_concert_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  concert_row record;
  card_sales numeric := 0;
  cash_sales numeric := 0;
  legacy_sales numeric := 0;
  has_detailed_sales boolean := false;
begin
  select c.band_id, c.id, c.title, c.date, c.details into concert_row
  from public.concerts c where c.id = p_concert_id;
  if not found then
    delete from public.money_movements
    where source_id = p_concert_id and source_type in ('merch_total', 'merch_total_card', 'merch_total_cash');
    return;
  end if;

  select exists(select 1 from public.merch_sales s where s.concert_id = p_concert_id) into has_detailed_sales;
  if has_detailed_sales then
    select
      coalesce(sum(case when s.payment_method = 'cash' then 0 else s.quantity * s.unit_price end), 0),
      coalesce(sum(case when s.payment_method = 'cash' then s.quantity * s.unit_price else 0 end), 0)
    into card_sales, cash_sales
    from public.merch_sales s where s.concert_id = p_concert_id;
  else
    begin legacy_sales := greatest(0, coalesce((concert_row.details ->> 'merchSales')::numeric, 0));
    exception when others then legacy_sales := 0;
    end;
    card_sales := legacy_sales;
  end if;

  card_sales := round(card_sales, 2);
  cash_sales := round(cash_sales, 2);
  delete from public.money_movements
  where concert_id = p_concert_id and source_type in ('merch_sale', 'legacy_merch', 'merch_total');

  if card_sales <= 0 then
    delete from public.money_movements where source_type = 'merch_total_card' and source_id = p_concert_id;
  else
    insert into public.money_movements (band_id, concert_id, kind, amount, date, category, note, payment_method, source_type, source_id)
    values (concert_row.band_id, concert_row.id, 'ingres', card_sales, current_date, 'Marxandatge', 'Total de vendes amb targeta · ' || coalesce(concert_row.title, ''), 'bank', 'merch_total_card', concert_row.id)
    on conflict (source_type, source_id) where source_type is not null do update
      set band_id = excluded.band_id, concert_id = excluded.concert_id, kind = excluded.kind,
          date = case when public.money_movements.amount is distinct from excluded.amount then excluded.date else public.money_movements.date end,
          amount = excluded.amount, category = excluded.category, note = excluded.note, payment_method = excluded.payment_method;
  end if;

  if cash_sales <= 0 then
    delete from public.money_movements where source_type = 'merch_total_cash' and source_id = p_concert_id;
  else
    insert into public.money_movements (band_id, concert_id, kind, amount, date, category, note, payment_method, source_type, source_id)
    values (concert_row.band_id, concert_row.id, 'ingres', cash_sales, current_date, 'Marxandatge', 'Total de vendes en efectiu · ' || coalesce(concert_row.title, ''), 'cash', 'merch_total_cash', concert_row.id)
    on conflict (source_type, source_id) where source_type is not null do update
      set band_id = excluded.band_id, concert_id = excluded.concert_id, kind = excluded.kind,
          date = case when public.money_movements.amount is distinct from excluded.amount then excluded.date else public.money_movements.date end,
          amount = excluded.amount, category = excluded.category, note = excluded.note, payment_method = excluded.payment_method;
  end if;
end;
$$;

create or replace function public.remove_concert_generated_movements()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.money_movements
  where source_id = old.id and source_type in ('concert_fee', 'merch_total', 'merch_total_card', 'merch_total_cash', 'concert_expense');
  return old;
end;
$$;

delete from public.money_movements where source_type in ('merch_sale', 'legacy_merch', 'merch_total');
select public.sync_concert_merch_total(c.id) from public.concerts c;
