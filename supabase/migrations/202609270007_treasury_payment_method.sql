alter table public.money_movements
  add column payment_method text not null default 'bank',
  add constraint money_movements_payment_method_check
  check (payment_method in ('bank', 'cash'));
