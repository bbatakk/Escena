-- Tresoreria mostra un únic moviment amb el total de marxandatge de la banda.
alter table public.money_movements drop constraint money_movements_source_type_check;
alter table public.money_movements add constraint money_movements_source_type_check
  check (source_type is null or source_type in ('concert_fee', 'merch_sale', 'legacy_merch', 'merch_total'));

drop trigger sync_merch_sale_income_after_write on public.merch_sales;
drop trigger sync_merch_sale_income_after_delete on public.merch_sales;
drop trigger sync_legacy_merch_after_concert_write on public.concerts;

create function public.sync_band_merch_total(p_band_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  detailed_sales numeric := 0;
  legacy_sales numeric := 0;
  total_sales numeric := 0;
begin
  select coalesce(sum(s.quantity * s.unit_price), 0) into detailed_sales
  from public.merch_sales s where s.band_id = p_band_id;

  select coalesce(sum(case
    when c.details ->> 'merchSales' ~ '^[0-9]+([.][0-9]+)?$' then greatest((c.details ->> 'merchSales')::numeric, 0)
    else 0
  end), 0) into legacy_sales
  from public.concerts c
  where c.band_id = p_band_id
    and not exists (select 1 from public.merch_sales s where s.concert_id = c.id);

  total_sales := round(detailed_sales + legacy_sales, 2);
  delete from public.money_movements where band_id = p_band_id and source_type in ('merch_sale', 'legacy_merch');
  if total_sales <= 0 then
    delete from public.money_movements where source_type = 'merch_total' and source_id = p_band_id;
    return;
  end if;

  insert into public.money_movements (band_id, concert_id, kind, amount, date, category, note, source_type, source_id)
  values (p_band_id, null, 'ingres', total_sales, current_date, 'Marxandatge', 'Total de vendes detallades i resums antics', 'merch_total', p_band_id)
  on conflict (source_type, source_id) where source_type is not null do update
    set band_id = excluded.band_id, concert_id = null, kind = excluded.kind,
        date = case when public.money_movements.amount is distinct from excluded.amount then excluded.date else public.money_movements.date end,
        amount = excluded.amount, category = excluded.category, note = excluded.note;
end;
$$;

create function public.sync_band_merch_total_after_sale()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_band_merch_total(old.band_id);
    return old;
  end if;
  if tg_op = 'UPDATE' and old.band_id is distinct from new.band_id then
    perform public.sync_band_merch_total(old.band_id);
  end if;
  perform public.sync_band_merch_total(new.band_id);
  return new;
end;
$$;
create trigger sync_band_merch_total_after_sale
after insert or update or delete on public.merch_sales
for each row execute function public.sync_band_merch_total_after_sale();

create function public.sync_band_merch_total_after_concert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.sync_band_merch_total(new.band_id);
  return new;
end;
$$;
create trigger sync_band_merch_total_after_concert_write
after insert or update on public.concerts
for each row execute function public.sync_band_merch_total_after_concert();

create or replace function public.remove_concert_generated_movements()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.money_movements where source_type = 'concert_fee' and source_id = old.id;
  perform public.sync_band_merch_total(old.band_id);
  return old;
end;
$$;

-- Converte les vendes existents (una línia per venda) en el moviment agregat.
select public.sync_band_merch_total(b.id) from public.bands b;
