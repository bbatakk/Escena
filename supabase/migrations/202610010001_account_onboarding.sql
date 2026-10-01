-- Els espais nous demanen el nom artistic al primer inici de sessio.
alter table public.bands
add column if not exists onboarding_completed boolean not null default false;

update public.bands
set onboarding_completed = true
where trim(name) <> 'La nostra banda';

grant update (name, onboarding_completed) on public.bands to authenticated;

-- El creador d'un espai n'ha de ser el propietari, tambe per als comptes nous.
create or replace function public.create_band_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare new_band_id uuid;
begin
  insert into public.bands default values returning id into new_band_id;
  insert into public.band_members (band_id, user_id, role) values (new_band_id, new.id, 'owner');
  return new;
end;
$$;
