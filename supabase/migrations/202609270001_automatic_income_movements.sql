-- Catxets nets, vendes i resums antics passen a ser moviments d’ingrés identificables.
alter table public.money_movements
  add column source_type text,
  add column source_id uuid,
  add constraint money_movements_source_type_check
    check (source_type is null or source_type in ('concert_fee', 'merch_sale', 'legacy_merch')),
  add constraint money_movements_source_pair_check
    check ((source_type is null and source_id is null) or (source_type is not null and source_id is not null));

create unique index money_movements_source_unique_idx
  on public.money_movements (source_type, source_id) where source_type is not null;

drop policy "Members can add money movements" on public.money_movements;
create policy "Members can add manual money movements" on public.money_movements
for insert to authenticated with check (
  source_type is null
  and exists (select 1 from public.band_members m where m.band_id = money_movements.band_id and m.user_id = (select auth.uid()))
  and (concert_id is null or exists (select 1 from public.concerts c where c.id = money_movements.concert_id and c.band_id = money_movements.band_id))
);

drop policy "Members can update money movements" on public.money_movements;
create policy "Members can update manual money movements" on public.money_movements
for update to authenticated using (
  source_type is null
  and exists (select 1 from public.band_members m where m.band_id = money_movements.band_id and m.user_id = (select auth.uid()))
) with check (
  source_type is null
  and exists (select 1 from public.band_members m where m.band_id = money_movements.band_id and m.user_id = (select auth.uid()))
);

drop policy "Members can delete money movements" on public.money_movements;
create policy "Members can delete manual money movements" on public.money_movements
for delete to authenticated using (
  source_type is null
  and exists (select 1 from public.band_members m where m.band_id = money_movements.band_id and m.user_id = (select auth.uid()))
);

create function public.net_concert_fee(p_concert_id uuid)
returns numeric language plpgsql stable security definer set search_path = '' as $$
declare
  concert_row record;
  current_label_name text;
  manager text;
  agreement jsonb;
  tier jsonb;
  gross numeric;
  commission_rate numeric := 0;
  selected_threshold numeric := -1;
  threshold_value numeric;
  percent_value numeric;
begin
  select c.band_id, c.fee_paid, c.details into concert_row
  from public.concerts c where c.id = p_concert_id;
  if not found then return 0; end if;

  gross := greatest(coalesce(concert_row.fee_paid, 0), 0);
  if gross <= 0 then return 0; end if;
  manager := coalesce(nullif(concert_row.details ->> 'management', ''), 'pendent');
  select b.label_name into current_label_name from public.bands b where b.id = concert_row.band_id;

  if manager = 'pendent' and coalesce(current_label_name, '') <> '' then return 0; end if;
  if manager <> 'discografica' then return round(gross, 2); end if;

  agreement := concert_row.details -> 'labelAgreement';
  if jsonb_typeof(agreement) is distinct from 'object' or jsonb_typeof(agreement -> 'tiers') is distinct from 'array' then return 0; end if;
  for tier in select value from jsonb_array_elements(agreement -> 'tiers') as tier_rows(value) loop
    begin
      threshold_value := (tier ->> 'above')::numeric;
      percent_value := (tier ->> 'percent')::numeric;
    exception when others then
      continue;
    end;
    if gross > threshold_value and threshold_value > selected_threshold then
      selected_threshold := threshold_value;
      commission_rate := greatest(0, least(100, percent_value));
    end if;
  end loop;

  return round(gross - round(gross * commission_rate) / 100, 2);
end;
$$;

create function public.sync_concert_fee_movement(p_concert_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  concert_row record;
  net_paid numeric;
begin
  select c.band_id, c.id, c.title, c.date into concert_row
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

  insert into public.money_movements (band_id, concert_id, kind, amount, date, category, note, source_type, source_id)
  values (concert_row.band_id, concert_row.id, 'ingres', net_paid, current_date, 'Catxet', 'Generat automàticament · ' || coalesce(concert_row.title, ''), 'concert_fee', concert_row.id)
  on conflict (source_type, source_id) where source_type is not null do update
    set band_id = excluded.band_id, concert_id = excluded.concert_id, kind = excluded.kind,
        date = case when public.money_movements.amount is distinct from excluded.amount then excluded.date else public.money_movements.date end,
        amount = excluded.amount, category = excluded.category, note = excluded.note;
end;
$$;

create function public.on_concert_fee_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.sync_concert_fee_movement(new.id);
  return new;
end;
$$;

create trigger sync_concert_fee_movement_after_write
after insert or update on public.concerts
for each row execute function public.on_concert_fee_changed();

create function public.sync_concert_fees_for_band()
returns trigger language plpgsql security definer set search_path = '' as $$
declare concert_id uuid;
begin
  for concert_id in select c.id from public.concerts c where c.band_id = new.id loop
    perform public.sync_concert_fee_movement(concert_id);
  end loop;
  return new;
end;
$$;

create trigger sync_concert_fees_after_band_label_change
after update of label_name on public.bands
for each row when (old.label_name is distinct from new.label_name)
execute function public.sync_concert_fees_for_band();

create function public.sync_legacy_merch_movement(p_concert_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  concert_row record;
  legacy_amount numeric := 0;
begin
  select c.band_id, c.id, c.title, c.date, c.details into concert_row
  from public.concerts c where c.id = p_concert_id;
  if not found then
    delete from public.money_movements where source_type = 'legacy_merch' and source_id = p_concert_id;
    return;
  end if;

  delete from public.money_movements where source_type = 'legacy_merch' and source_id = p_concert_id;
  if exists (select 1 from public.merch_sales s where s.concert_id = p_concert_id) then return; end if;
  begin legacy_amount := greatest(0, coalesce((concert_row.details ->> 'merchSales')::numeric, 0));
  exception when others then legacy_amount := 0;
  end;
  if legacy_amount <= 0 then return; end if;

  insert into public.money_movements (band_id, concert_id, kind, amount, date, category, note, source_type, source_id)
  values (concert_row.band_id, concert_row.id, 'ingres', legacy_amount, concert_row.date, 'Marxandatge (resum antic)', 'Generat automàticament · ' || coalesce(concert_row.title, ''), 'legacy_merch', concert_row.id)
  on conflict (source_type, source_id) where source_type is not null do update
    set band_id = excluded.band_id, concert_id = excluded.concert_id, kind = excluded.kind,
        amount = excluded.amount, date = excluded.date, category = excluded.category, note = excluded.note;
end;
$$;

create function public.on_concert_legacy_merch_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.sync_legacy_merch_movement(new.id);
  return new;
end;
$$;
create trigger sync_legacy_merch_after_concert_write
after insert or update on public.concerts
for each row execute function public.on_concert_legacy_merch_changed();

create function public.sync_merch_sale_movement()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  product_name text;
  movement_amount numeric;
begin
  if tg_op = 'DELETE' then
    delete from public.money_movements where source_type = 'merch_sale' and source_id = old.id;
    perform public.sync_legacy_merch_movement(old.concert_id);
    return old;
  end if;

  select p.name into product_name from public.merch_products p where p.id = new.product_id;
  movement_amount := round(greatest(0, new.quantity * new.unit_price), 2);
  if movement_amount <= 0 then
    delete from public.money_movements where source_type = 'merch_sale' and source_id = new.id;
  else
    insert into public.money_movements (band_id, concert_id, kind, amount, date, category, note, source_type, source_id)
    values (new.band_id, new.concert_id, 'ingres', movement_amount, new.created_at::date, 'Marxandatge', 'Generat automàticament · ' || coalesce(nullif(new.note, ''), coalesce(product_name, 'Venda de marxandatge')), 'merch_sale', new.id)
    on conflict (source_type, source_id) where source_type is not null do update
      set band_id = excluded.band_id, concert_id = excluded.concert_id, kind = excluded.kind,
          amount = excluded.amount, date = excluded.date, category = excluded.category, note = excluded.note;
  end if;
  if tg_op = 'UPDATE' and old.concert_id is distinct from new.concert_id then
    perform public.sync_legacy_merch_movement(old.concert_id);
  end if;
  perform public.sync_legacy_merch_movement(new.concert_id);
  return new;
end;
$$;

create trigger sync_merch_sale_income_after_write
after insert or update on public.merch_sales
for each row execute function public.sync_merch_sale_movement();
create trigger sync_merch_sale_income_after_delete
after delete on public.merch_sales
for each row execute function public.sync_merch_sale_movement();

create function public.remove_concert_generated_movements()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.money_movements
  where source_id = old.id and source_type in ('concert_fee', 'legacy_merch');
  return old;
end;
$$;
create trigger remove_concert_generated_movements_after_delete
after delete on public.concerts
for each row execute function public.remove_concert_generated_movements();

-- Una venda detallada substitueix el resum antic; els dos ingressos no conviuen.
insert into public.money_movements (band_id, concert_id, kind, amount, date, category, note, source_type, source_id)
select s.band_id, s.concert_id, 'ingres', round(s.quantity * s.unit_price, 2), s.created_at::date,
       'Marxandatge', 'Generat automàticament · ' || coalesce(nullif(s.note, ''), p.name), 'merch_sale', s.id
from public.merch_sales s join public.merch_products p on p.id = s.product_id
where s.quantity * s.unit_price > 0
on conflict (source_type, source_id) where source_type is not null do nothing;

select public.sync_concert_fee_movement(c.id) from public.concerts c;
select public.sync_legacy_merch_movement(c.id) from public.concerts c;
