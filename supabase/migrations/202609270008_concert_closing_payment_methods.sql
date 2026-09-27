create or replace function public.sync_concert_fee_movement(p_concert_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  concert_row record;
  net_paid numeric;
  payment_method_value text;
begin
  select c.band_id, c.id, c.title, c.date, c.details into concert_row
  from public.concerts c where c.id = p_concert_id;
  if not found then
    delete from public.money_movements where source_type = 'concert_fee' and source_id = p_concert_id;
    return;
  end if;

  net_paid := public.net_concert_fee(p_concert_id);
  if net_paid <= 0 then
    delete from public.money_movements where source_type = 'concert_fee' and source_id = p_concert_id;
    return;
  end if;

  payment_method_value := case when concert_row.details ->> 'feePaymentMethod' = 'cash' then 'cash' else 'bank' end;
  insert into public.money_movements (band_id, concert_id, kind, amount, date, category, note, payment_method, source_type, source_id)
  values (concert_row.band_id, concert_row.id, 'ingres', net_paid, current_date, 'Catxet', 'Generat automàticament · ' || coalesce(concert_row.title, ''), payment_method_value, 'concert_fee', concert_row.id)
  on conflict (source_type, source_id) where source_type is not null do update
    set band_id = excluded.band_id, concert_id = excluded.concert_id, kind = excluded.kind,
        date = case when public.money_movements.amount is distinct from excluded.amount then excluded.date else public.money_movements.date end,
        amount = excluded.amount, category = excluded.category, note = excluded.note, payment_method = excluded.payment_method;
end;
$$;

create or replace function public.sync_concert_expense_movement(p_concert_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  concert_row record;
  expense_amount numeric := 0;
  payment_method_value text;
begin
  select c.band_id, c.id, c.title, c.date, c.details into concert_row
  from public.concerts c where c.id = p_concert_id;
  if not found then
    delete from public.money_movements where source_type = 'concert_expense' and source_id = p_concert_id;
    return;
  end if;

  -- Manual expense movements replace the summary amount and its generated movement.
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

  payment_method_value := case when concert_row.details ->> 'expensePaymentMethod' = 'cash' then 'cash' else 'bank' end;
  insert into public.money_movements (band_id, concert_id, kind, amount, date, category, note, payment_method, source_type, source_id)
  values (concert_row.band_id, concert_row.id, 'despesa', expense_amount, current_date, 'Despeses del concert', 'Generat automàticament · ' || coalesce(concert_row.title, ''), payment_method_value, 'concert_expense', concert_row.id)
  on conflict (source_type, source_id) where source_type is not null do update
    set band_id = excluded.band_id, concert_id = excluded.concert_id, kind = excluded.kind,
        date = case when public.money_movements.amount is distinct from excluded.amount then excluded.date else public.money_movements.date end,
        amount = excluded.amount, category = excluded.category, note = excluded.note, payment_method = excluded.payment_method;
end;
$$;

select public.sync_concert_fee_movement(c.id) from public.concerts c;
select public.sync_concert_expense_movement(c.id) from public.concerts c;
