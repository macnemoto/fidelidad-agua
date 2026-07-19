begin;

create extension if not exists pgcrypto;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  cedula text not null unique check (cedula ~ '^[0-9]{5,8}$'),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  purchase_count smallint not null default 0 check (purchase_count between 0 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_movements (
  id bigint generated always as identity primary key,
  client_id uuid not null references public.clients(id) on delete restrict,
  action text not null check (action in ('created', 'progress_updated', 'profile_updated', 'reward_redeemed')),
  previous_count smallint not null check (previous_count between 0 and 10),
  new_count smallint not null check (new_count between 0 and 10),
  created_at timestamptz not null default now()
);

create index if not exists client_movements_client_created_idx
  on public.client_movements (client_id, created_at desc);

alter table public.clients enable row level security;
alter table public.client_movements enable row level security;

revoke all on table public.clients from anon, authenticated;
revoke all on table public.client_movements from anon, authenticated;
revoke all on sequence public.client_movements_id_seq from anon, authenticated;

create or replace function public.find_client(p_cedula text)
returns table (
  id uuid,
  cedula text,
  name text,
  purchase_count smallint,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cedula text := regexp_replace(coalesce(p_cedula, ''), '[^0-9]', '', 'g');
begin
  if v_cedula !~ '^[0-9]{5,8}$' then
    raise exception 'La cédula debe tener entre 5 y 8 números.' using errcode = '22023';
  end if;

  return query
    select c.id, c.cedula, c.name, c.purchase_count, c.created_at, c.updated_at
    from public.clients as c
    where c.cedula = v_cedula
    limit 1;
end;
$$;

create or replace function public.save_client(
  p_cedula text,
  p_name text,
  p_purchase_count smallint
)
returns table (
  id uuid,
  cedula text,
  name text,
  purchase_count smallint,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cedula text := regexp_replace(coalesce(p_cedula, ''), '[^0-9]', '', 'g');
  v_name text := btrim(coalesce(p_name, ''));
  v_existing public.clients%rowtype;
  v_saved public.clients%rowtype;
  v_action text;
begin
  if v_cedula !~ '^[0-9]{5,8}$' then
    raise exception 'La cédula debe tener entre 5 y 8 números.' using errcode = '22023';
  end if;
  if char_length(v_name) not between 2 and 60 then
    raise exception 'El nombre debe tener entre 2 y 60 caracteres.' using errcode = '22023';
  end if;
  if p_purchase_count is null or p_purchase_count not between 0 and 10 then
    raise exception 'El progreso debe estar entre 0 y 10.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_cedula, 0));
  select * into v_existing from public.clients as c where c.cedula = v_cedula for update;

  if not found then
    insert into public.clients (cedula, name, purchase_count)
    values (v_cedula, v_name, p_purchase_count)
    returning * into v_saved;

    insert into public.client_movements (client_id, action, previous_count, new_count)
    values (v_saved.id, 'created', 0, p_purchase_count);
  else
    update public.clients
      set name = v_name,
          purchase_count = p_purchase_count,
          updated_at = now()
      where public.clients.id = v_existing.id
      returning * into v_saved;

    if v_existing.purchase_count is distinct from p_purchase_count then
      v_action := 'progress_updated';
    elsif v_existing.name is distinct from v_name then
      v_action := 'profile_updated';
    end if;

    if v_action is not null then
      insert into public.client_movements (client_id, action, previous_count, new_count)
      values (v_saved.id, v_action, v_existing.purchase_count, p_purchase_count);
    end if;
  end if;

  return query
    select v_saved.id, v_saved.cedula, v_saved.name, v_saved.purchase_count, v_saved.created_at, v_saved.updated_at;
end;
$$;

create or replace function public.get_client_history(p_cedula text, p_limit integer default 10)
returns table (
  id bigint,
  action text,
  previous_count smallint,
  new_count smallint,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cedula text := regexp_replace(coalesce(p_cedula, ''), '[^0-9]', '', 'g');
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 10);
begin
  if v_cedula !~ '^[0-9]{5,8}$' then
    raise exception 'La cédula debe tener entre 5 y 8 números.' using errcode = '22023';
  end if;

  return query
    select m.id, m.action, m.previous_count, m.new_count, m.created_at
    from public.client_movements as m
    join public.clients as c on c.id = m.client_id
    where c.cedula = v_cedula
    order by m.created_at desc, m.id desc
    limit v_limit;
end;
$$;

create or replace function public.redeem_reward(p_cedula text)
returns table (
  id uuid,
  cedula text,
  name text,
  purchase_count smallint,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cedula text := regexp_replace(coalesce(p_cedula, ''), '[^0-9]', '', 'g');
  v_existing public.clients%rowtype;
  v_saved public.clients%rowtype;
begin
  if v_cedula !~ '^[0-9]{5,8}$' then
    raise exception 'La cédula debe tener entre 5 y 8 números.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_cedula, 0));
  select * into v_existing from public.clients as c where c.cedula = v_cedula for update;

  if not found then
    raise exception 'No existe un cliente con esa cédula.' using errcode = 'P0002';
  end if;
  if v_existing.purchase_count <> 10 then
    raise exception 'El cliente debe tener 10 compras para canjear el beneficio.' using errcode = '23514';
  end if;

  update public.clients
    set purchase_count = 0, updated_at = now()
    where public.clients.id = v_existing.id
    returning * into v_saved;

  insert into public.client_movements (client_id, action, previous_count, new_count)
  values (v_saved.id, 'reward_redeemed', 10, 0);

  return query
    select v_saved.id, v_saved.cedula, v_saved.name, v_saved.purchase_count, v_saved.created_at, v_saved.updated_at;
end;
$$;

revoke all on function public.find_client(text) from public;
revoke all on function public.save_client(text, text, smallint) from public;
revoke all on function public.get_client_history(text, integer) from public;
revoke all on function public.redeem_reward(text) from public;

grant execute on function public.find_client(text) to anon, authenticated;
grant execute on function public.save_client(text, text, smallint) to anon, authenticated;
grant execute on function public.get_client_history(text, integer) to anon, authenticated;
grant execute on function public.redeem_reward(text) to anon, authenticated;

commit;
