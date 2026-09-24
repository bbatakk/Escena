-- Els concerts poden indicar el país juntament amb la població.
alter table public.concerts add column country text not null default '';