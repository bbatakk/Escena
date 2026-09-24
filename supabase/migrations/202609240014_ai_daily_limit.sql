-- Límit diari de crides per compte autenticat a l’assistent d’IA.
create table public.ai_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, usage_date)
);

alter table public.ai_daily_usage enable row level security;
revoke all on public.ai_daily_usage from anon, authenticated;

create or replace function public.consume_ai_request(p_daily_limit integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  used integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_daily_limit < 1 or p_daily_limit > 100 then raise exception 'INVALID_DAILY_LIMIT'; end if;

  insert into public.ai_daily_usage (user_id, usage_date, request_count)
  values ((select auth.uid()), current_date, 1)
  on conflict (user_id, usage_date) do update
    set request_count = public.ai_daily_usage.request_count + 1
    where public.ai_daily_usage.request_count < p_daily_limit
  returning request_count into used;

  if used is null then raise exception 'AI_DAILY_LIMIT_REACHED'; end if;
  return used;
end;
$$;

revoke all on function public.consume_ai_request(integer) from public, anon;
grant execute on function public.consume_ai_request(integer) to authenticated;
