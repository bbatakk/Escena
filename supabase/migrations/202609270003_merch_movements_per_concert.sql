-- En lloc d’un únic ingrés global de marxandatge, manté un total per concert.
drop trigger sync_band_merch_total_after_sale on public.merch_sales;
drop trigger sync_band_merch_total_after_concert_write on public.concerts;

create function public.sync_concert_merch_total(p_concert_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  concert_row record;
  detailed_sales numeric := 0;
  legacy_sales numeric := 0;
  total_sales numeric := 0;
begin
  select c.band_id, c.id, c.title, c.date, c.details into concert_row
  from public.concerts c where c.id = p_concert_id;
  if not found then
    delete from public.money_movements where source_type = 'merch_total' and source_id = p_concert_id;
    return;
  end if;

  select coalesce(sum(s.quantity * s.unit_price), 0) into detailed_sales
  from public.merch_sales s where s.concert_id = p_concert_id;
  if detailed_sales <= 0 and not exists (select 1 from public.merch_sales s where s.concert_id = p_concert_id) then
    begin legacy_sales := greatest(0, coalesce((concert_row.details ->> 'merchSales')::numeric, 0));
    exception when others then legacy_sales := 0;
    end;
  end if;
  total_sales := round(detailed_sales + legacy_sales, 2);
  if total_sales <= 0 then
    delete from public.money_movements where source_type = 'merch_total' and source_id = p_concert_id;
    return;
  end if;

  insert into public.money_movements (band_id, concert_id, kind, amount, date, category, note, source_type, source_id)
  values (concert_row.band_id, concert_row.id, 'ingres', total_sales, current_date, 'Marxandatge', 'Total de vendes del concert · ' || coalesce(concert_row.title, ''), 'merch_total', concert_row.id)
  on conflict (source_type, source_id) where source_type is not null do update
    set band_id = excluded.band_id, concert_id = excluded.concert_id, kind = excluded.kind,
        date = case when public.money_movements.amount is distinct from excluded.amount then excluded.date else public.money_movements.date end,
        amount = excluded.amount, category = excluded.category, note = excluded.note;
end;
$$;

create function public.sync_concert_merch_total_after_sale()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_concert_merch_total(old.concert_id);
    return old;
  end if;
  if tg_op = 'UPDATE' and old.concert_id is distinct from new.concert_id then
    perform public.sync_concert_merch_total(old.concert_id);
  end if;
  perform public.sync_concert_merch_total(new.concert_id);
  return new;
end;
$$;
create trigger sync_concert_merch_total_after_sale
after insert or update or delete on public.merch_sales
for each row execute function public.sync_concert_merch_total_after_sale();

create function public.sync_concert_merch_total_after_concert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.sync_concert_merch_total(new.id);
  return new;
end;
$$;
create trigger sync_concert_merch_total_after_concert_write
after insert or update on public.concerts
for each row execute function public.sync_concert_merch_total_after_concert();

create or replace function public.remove_concert_generated_movements()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.money_movements
  where source_id = old.id and source_type in ('concert_fee', 'merch_total');
  return old;
end;
$$;

-- Reparte el antiguo total global segons les vendes detallades i els resums antics de cada concert.
delete from public.money_movements where source_type = 'merch_total';
select public.sync_concert_merch_total(c.id) from public.concerts c;
