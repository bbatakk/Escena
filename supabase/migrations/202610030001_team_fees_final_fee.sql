-- Tarifes opcionals del cataleg. Els concerts conserven la seva copia a details.teamFees.
create function public.valid_money_json(value jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(value) = 'number' and (value #>> '{}')::numeric between 0 and 9999999999.99
    and round((value #>> '{}')::numeric, 2) = (value #>> '{}')::numeric, false);
$$;

create function public.valid_person_fee_agreement(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare tier jsonb; previous_from numeric := -1;
begin
  if value is null or value = 'null'::jsonb then return true; end if;
  if value ->> 'kind' = 'fixed' then return public.valid_money_json(value -> 'amount'); end if;
  if value ->> 'kind' is distinct from 'tiers' or jsonb_typeof(value -> 'tiers') is distinct from 'array' then return false; end if;
  if jsonb_array_length(value -> 'tiers') not between 1 and 20 then return false; end if;
  for tier in select * from jsonb_array_elements(value -> 'tiers') loop
    if not public.valid_money_json(tier -> 'from') or not public.valid_money_json(tier -> 'amount') then return false; end if;
    if (tier ->> 'from')::numeric <= previous_from then return false; end if;
    previous_from := (tier ->> 'from')::numeric;
  end loop;
  return true;
exception when others then return false;
end;
$$;

alter table public.band_people add column fee_agreement jsonb
  check (public.valid_person_fee_agreement(fee_agreement));

create function public.valid_concert_team_fees(details jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare fee jsonb; payment jsonb; person_ids text[] := '{}'; payment_ids text[] := '{}';
begin
  if details ? 'finalFee' and not public.valid_money_json(details -> 'finalFee') then return false; end if;
  if not (details ? 'teamFees') then return true; end if;
  if jsonb_typeof(details -> 'teamFees') is distinct from 'array' then return false; end if;
  if jsonb_array_length(details -> 'teamFees') > 100 then return false; end if;
  for fee in select * from jsonb_array_elements(details -> 'teamFees') loop
    if coalesce(fee ->> 'personId', '') = '' or coalesce(trim(fee ->> 'name'), '') = ''
      or fee ->> 'personId' = any(person_ids) or not public.valid_person_fee_agreement(fee -> 'agreement') then return false; end if;
    person_ids := array_append(person_ids, fee ->> 'personId');
    if jsonb_typeof(fee -> 'payments') is distinct from 'array' then return false; end if;
    if jsonb_array_length(fee -> 'payments') > 100 then return false; end if;
    for payment in select * from jsonb_array_elements(fee -> 'payments') loop
      if not public.valid_money_json(payment -> 'amount') or (payment ->> 'amount')::numeric <= 0
        or coalesce(payment ->> 'payer', '') not in ('band', 'manager')
        or coalesce(payment ->> 'paymentMethod', '') not in ('bank', 'cash')
        or coalesce(payment ->> 'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or payment ->> 'id' = any(payment_ids)
        or coalesce(payment ->> 'date', '') !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
      perform (payment ->> 'date')::date;
      payment_ids := array_append(payment_ids, payment ->> 'id');
    end loop;
  end loop;
  return true;
exception when others then return false;
end;
$$;

alter table public.concerts add constraint concert_team_fees_valid check (public.valid_concert_team_fees(details));

create or replace function public.net_concert_fee(p_concert_id uuid)
returns numeric language plpgsql stable security definer set search_path = '' as $$
declare
  concert_row record; current_label_name text; manager text; tier jsonb; fee jsonb; payment jsonb;
  basis numeric; gross numeric; commission_rate numeric := 0; selected_threshold numeric := -1; threshold_value numeric; percent_value numeric;
  manager_paid numeric := 0;
begin
  select c.band_id, c.fee_amount, c.fee_paid, c.details into concert_row from public.concerts c where c.id = p_concert_id;
  if not found then return 0; end if;
  gross := concert_row.fee_paid;
  basis := coalesce((concert_row.details ->> 'finalFee')::numeric, concert_row.fee_amount);
  manager := coalesce(nullif(concert_row.details ->> 'management', ''), 'pendent');
  select b.label_name into current_label_name from public.bands b where b.id = concert_row.band_id;
  if manager = 'pendent' and coalesce(current_label_name, '') <> '' then return 0; end if;
  if manager = 'discografica' then
    if jsonb_typeof(concert_row.details -> 'labelAgreement' -> 'tiers') is distinct from 'array' then return 0; end if;
    for tier in select * from jsonb_array_elements(concert_row.details -> 'labelAgreement' -> 'tiers') loop
      threshold_value := (tier ->> 'above')::numeric;
      percent_value := (tier ->> 'percent')::numeric;
      if basis > threshold_value and threshold_value > selected_threshold then
        selected_threshold := threshold_value;
        commission_rate := greatest(0, least(100, percent_value));
      end if;
    end loop;
  end if;
  for fee in select * from jsonb_array_elements(coalesce(concert_row.details -> 'teamFees', '[]'::jsonb)) loop
    for payment in select * from jsonb_array_elements(fee -> 'payments') loop
      if payment ->> 'payer' = 'manager' then manager_paid := manager_paid + (payment ->> 'amount')::numeric; end if;
    end loop;
  end loop;
  return round(gross - round(gross * commission_rate) / 100 - manager_paid, 2);
end;
$$;

create or replace function public.sync_concert_fee_movement(p_concert_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare concert_row record; net_paid numeric;
begin
  select * into concert_row from public.concerts where id = p_concert_id;
  if not found then
    delete from public.money_movements where source_type = 'concert_fee' and source_id = p_concert_id;
    return;
  end if;
  net_paid := public.net_concert_fee(p_concert_id);
  if net_paid = 0 then
    delete from public.money_movements where source_type = 'concert_fee' and source_id = p_concert_id;
    return;
  end if;
  insert into public.money_movements (band_id, concert_id, kind, amount, date, category, note, payment_method, source_type, source_id)
  values (concert_row.band_id, concert_row.id, case when net_paid < 0 then 'despesa' else 'ingres' end, abs(net_paid), current_date, 'Catxet',
    'Generat automàticament · Net cobrat · ' || concert_row.title, case when concert_row.details ->> 'feePaymentMethod' = 'cash' then 'cash' else 'bank' end, 'concert_fee', concert_row.id)
  on conflict (source_type, source_id) where source_type is not null do update
    set kind = excluded.kind, amount = excluded.amount, payment_method = excluded.payment_method, note = excluded.note,
      date = case when public.money_movements.amount is distinct from excluded.amount then excluded.date else public.money_movements.date end;
end;
$$;

alter table public.money_movements drop constraint money_movements_source_type_check;
alter table public.money_movements add constraint money_movements_source_type_check check
  (source_type is null or source_type in ('concert_fee', 'merch_sale', 'legacy_merch', 'merch_total', 'merch_total_card', 'merch_total_cash', 'concert_expense', 'team_payment'));

create function public.sync_team_payment_movements()
returns trigger language plpgsql security definer set search_path = '' as $$
declare fee jsonb; payment jsonb;
begin
  if tg_op = 'DELETE' then
    delete from public.money_movements where source_type = 'team_payment' and concert_id = old.id;
    return old;
  end if;
  delete from public.money_movements where source_type = 'team_payment' and concert_id = new.id;
  for fee in select * from jsonb_array_elements(coalesce(new.details -> 'teamFees', '[]'::jsonb)) loop
    for payment in select * from jsonb_array_elements(fee -> 'payments') loop
      if payment ->> 'payer' <> 'band' then continue; end if;
      -- La clau unica rebutja UUID de liquidacions que ja pertanyen a altres concerts.
      insert into public.money_movements (band_id, concert_id, kind, amount, date, category, note, payment_method, source_type, source_id)
      values (new.band_id, new.id, 'despesa', (payment ->> 'amount')::numeric, (payment ->> 'date')::date,
        'Honoraris de l’equip', (fee ->> 'name') || ' · ' || new.title, payment ->> 'paymentMethod', 'team_payment', (payment ->> 'id')::uuid);
    end loop;
  end loop;
  return new;
end;
$$;
create trigger sync_team_payments_after_write after insert or update on public.concerts for each row execute function public.sync_team_payment_movements();
create trigger remove_team_payments_before_delete before delete on public.concerts for each row execute function public.sync_team_payment_movements();

revoke execute on function public.net_concert_fee(uuid), public.sync_concert_fee_movement(uuid), public.sync_team_payment_movements() from public, anon, authenticated;
select public.sync_concert_fee_movement(id) from public.concerts;
