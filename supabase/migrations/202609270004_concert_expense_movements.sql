-- Converteix el camp de despeses resumides de cada fitxa en un moviment automàtic.
alter table public.money_movements drop constraint money_movements_source_type_check;
alter table public.money_movements add constraint money_movements_source_type_check
  check (source_type is null or source_type in ('concert_fee', 'merch_sale', 'legacy_merch', 'merch_total', 'concert_expense'));

create function public.sync_concert_expense_movement(p_concert_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  concert_row record;
  expense_amount numeric := 0;
begin
  select c.band_id, c.id, c.title, c.date, c.details into concert_row
  from public.concerts c where c.id = p_concert_id;
  if not found then
    delete from public.money_movements where source_type = 'concert_expense' and source_id = p_concert_id;
    return;
  end if;

  -- Els moviments manuals són el detall comptable; en aquest cas no sumem també el camp resum de la fitxa.
  if exists (select 1 from public.money_movements m where m.concert_id = p_concert_id and m.kind = 'despesa' and m.source_type is null) then
    delete from public.money_movements where source_type = 'concert_expense' and source_id = p_concert_id;
    return;
  end if;

  begin expense_amount := greatest(0, coalesce((concert_row.details ->> 'expenses')::numeric, 0));
  exception when others then expense_amount := 0;
  end;
  if expense_amount <= 0 then
    delete from public.money_movements where source_type = 'concert_expense' and source_id = p_concert_id;
    return;
  end if;

  insert into public.money_movements (band_id, concert_id, kind, amount, date, category, note, source_type, source_id)
  values (concert_row.band_id, concert_row.id, 'despesa', expense_amount, current_date, 'Despeses del concert', 'Generat automàticament · ' || coalesce(concert_row.title, ''), 'concert_expense', concert_row.id)
  on conflict (source_type, source_id) where source_type is not null do update
    set band_id = excluded.band_id, concert_id = excluded.concert_id, kind = excluded.kind,
        date = case when public.money_movements.amount is distinct from excluded.amount then excluded.date else public.money_movements.date end,
        amount = excluded.amount, category = excluded.category, note = excluded.note;
end;
$$;

create function public.sync_concert_expense_after_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.sync_concert_expense_movement(new.id);
  return new;
end;
$$;
create trigger sync_concert_expense_after_concert_write
after insert or update on public.concerts
for each row execute function public.sync_concert_expense_after_write();

create function public.sync_concert_expense_after_manual_movement()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.source_type is null and old.kind = 'despesa' and old.concert_id is not null then
      perform public.sync_concert_expense_movement(old.concert_id);
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.source_type is null and old.kind = 'despesa' and old.concert_id is not null then
    perform public.sync_concert_expense_movement(old.concert_id);
  end if;
  if new.source_type is null and new.kind = 'despesa' and new.concert_id is not null then
    perform public.sync_concert_expense_movement(new.concert_id);
  end if;
  return new;
end;
$$;
create trigger sync_concert_expense_after_manual_movement_write
after insert or update or delete on public.money_movements
for each row execute function public.sync_concert_expense_after_manual_movement();

create or replace function public.remove_concert_generated_movements()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.money_movements
  where source_id = old.id and source_type in ('concert_fee', 'merch_total', 'concert_expense');
  return old;
end;
$$;

select public.sync_concert_expense_movement(c.id) from public.concerts c;
