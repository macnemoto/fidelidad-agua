begin;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.client_purchases (
  id bigint generated always as identity primary key,
  client_id uuid not null references public.clients(id) on delete restrict,
  quantity smallint not null check (quantity between 1 and 10),
  previous_count smallint not null check (previous_count between 0 and 9),
  new_count smallint not null check (new_count between 1 and 10),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (new_count = previous_count + quantity)
);

create index if not exists client_purchases_created_at_idx on public.client_purchases(created_at desc);
create index if not exists client_purchases_client_created_idx on public.client_purchases(client_id, created_at desc);

alter table public.admin_users enable row level security;
alter table public.client_purchases enable row level security;
revoke all on table public.admin_users, public.client_purchases from anon, authenticated;
revoke all on sequence public.client_purchases_id_seq from anon, authenticated;

alter table public.client_movements drop constraint if exists client_movements_action_check;
alter table public.client_movements add constraint client_movements_action_check check (action in ('created', 'progress_updated', 'profile_updated', 'reward_redeemed', 'purchase_registered'));

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users a where a.user_id = auth.uid());
$$;

create or replace function public.require_admin()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.admin_find_client(p_cedula text)
returns table (id uuid, cedula text, name text, purchase_count smallint, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_cedula text := regexp_replace(coalesce(p_cedula, ''), '[^0-9]', '', 'g');
begin
  perform public.require_admin();
  if v_cedula !~ '^[0-9]{5,8}$' then raise exception 'La cédula debe tener entre 5 y 8 números.' using errcode = '22023'; end if;
  return query select c.id, c.cedula, c.name, c.purchase_count, c.created_at, c.updated_at from public.clients c where c.cedula = v_cedula limit 1;
end;
$$;

create or replace function public.admin_create_client(p_cedula text, p_name text, p_purchase_count smallint)
returns table (id uuid, cedula text, name text, purchase_count smallint, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_cedula text := regexp_replace(coalesce(p_cedula, ''), '[^0-9]', '', 'g'); v_name text := btrim(coalesce(p_name, '')); v_saved public.clients%rowtype;
begin
  perform public.require_admin();
  if v_cedula !~ '^[0-9]{5,8}$' then raise exception 'La cédula debe tener entre 5 y 8 números.' using errcode = '22023'; end if;
  if char_length(v_name) not between 2 and 60 then raise exception 'El nombre debe tener entre 2 y 60 caracteres.' using errcode = '22023'; end if;
  if p_purchase_count is null or p_purchase_count not between 0 and 10 then raise exception 'El progreso debe estar entre 0 y 10.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_cedula, 0));
  if exists (select 1 from public.clients c where c.cedula = v_cedula) then raise exception 'Esta cédula ya está registrada. Utiliza Buscar cliente.' using errcode = '23505'; end if;
  insert into public.clients (cedula, name, purchase_count) values (v_cedula, v_name, p_purchase_count) returning * into v_saved;
  insert into public.client_movements (client_id, action, previous_count, new_count) values (v_saved.id, 'created', 0, p_purchase_count);
  return query select v_saved.id, v_saved.cedula, v_saved.name, v_saved.purchase_count, v_saved.created_at, v_saved.updated_at;
end;
$$;

create or replace function public.admin_update_client(p_cedula text, p_name text, p_purchase_count smallint)
returns table (id uuid, cedula text, name text, purchase_count smallint, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_cedula text := regexp_replace(coalesce(p_cedula, ''), '[^0-9]', '', 'g'); v_name text := btrim(coalesce(p_name, '')); v_existing public.clients%rowtype; v_saved public.clients%rowtype;
begin
  perform public.require_admin();
  if v_cedula !~ '^[0-9]{5,8}$' then raise exception 'La cédula debe tener entre 5 y 8 números.' using errcode = '22023'; end if;
  if char_length(v_name) not between 2 and 60 then raise exception 'El nombre debe tener entre 2 y 60 caracteres.' using errcode = '22023'; end if;
  if p_purchase_count is null or p_purchase_count not between 0 and 10 then raise exception 'El progreso debe estar entre 0 y 10.' using errcode = '22023'; end if;
  select * into v_existing from public.clients c where c.cedula = v_cedula for update;
  if not found then raise exception 'No existe un cliente con esa cédula.' using errcode = 'P0002'; end if;
  update public.clients set name = v_name, purchase_count = p_purchase_count, updated_at = now() where id = v_existing.id returning * into v_saved;
  if v_existing.name is distinct from v_name then insert into public.client_movements (client_id, action, previous_count, new_count) values (v_saved.id, 'profile_updated', v_existing.purchase_count, v_existing.purchase_count); end if;
  if v_existing.purchase_count is distinct from p_purchase_count then insert into public.client_movements (client_id, action, previous_count, new_count) values (v_saved.id, 'progress_updated', v_existing.purchase_count, p_purchase_count); end if;
  return query select v_saved.id, v_saved.cedula, v_saved.name, v_saved.purchase_count, v_saved.created_at, v_saved.updated_at;
end;
$$;

create or replace function public.admin_get_client_history(p_cedula text, p_limit integer default 10)
returns table (id bigint, action text, previous_count smallint, new_count smallint, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin perform public.require_admin(); return query select * from public.get_client_history(p_cedula, p_limit); end;
$$;

create or replace function public.admin_redeem_reward(p_cedula text)
returns table (id uuid, cedula text, name text, purchase_count smallint, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin perform public.require_admin(); return query select * from public.redeem_reward(p_cedula); end;
$$;

create or replace function public.admin_register_purchase(p_cedula text, p_quantity smallint)
returns table (id uuid, cedula text, name text, purchase_count smallint, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_cedula text := regexp_replace(coalesce(p_cedula, ''), '[^0-9]', '', 'g'); v_client public.clients%rowtype; v_saved public.clients%rowtype;
begin
  perform public.require_admin();
  if v_cedula !~ '^[0-9]{5,8}$' then raise exception 'La cédula debe tener entre 5 y 8 números.' using errcode = '22023'; end if;
  if p_quantity is null or p_quantity not between 1 and 10 then raise exception 'La cantidad debe estar entre 1 y 10.' using errcode = '22023'; end if;
  select * into v_client from public.clients c where c.cedula = v_cedula for update;
  if not found then raise exception 'No existe un cliente con esa cédula.' using errcode = 'P0002'; end if;
  if v_client.purchase_count + p_quantity > 10 then raise exception 'Esta compra supera las 10 marcas. Canjea el beneficio antes de registrar más tanques.' using errcode = '23514'; end if;
  update public.clients set purchase_count = purchase_count + p_quantity, updated_at = now() where id = v_client.id returning * into v_saved;
  insert into public.client_purchases(client_id, quantity, previous_count, new_count, created_by) values (v_saved.id, p_quantity, v_client.purchase_count, v_saved.purchase_count, auth.uid());
  insert into public.client_movements(client_id, action, previous_count, new_count) values (v_saved.id, 'purchase_registered', v_client.purchase_count, v_saved.purchase_count);
  return query select v_saved.id, v_saved.cedula, v_saved.name, v_saved.purchase_count, v_saved.updated_at;
end;
$$;

create or replace function public.admin_dashboard_summary(p_from date default null, p_to date default null)
returns table(total_clients bigint, active_clients bigint, ready_clients bigint, tanks_registered bigint, rewards_redeemed bigint)
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query select (select count(*) from public.clients), (select count(*) from public.clients where purchase_count between 1 and 9), (select count(*) from public.clients where purchase_count = 10), (select coalesce(sum(quantity),0) from public.client_purchases where (p_from is null or created_at::date >= p_from) and (p_to is null or created_at::date <= p_to)), (select count(*) from public.client_movements where action = 'reward_redeemed' and (p_from is null or created_at::date >= p_from) and (p_to is null or created_at::date <= p_to));
end;
$$;

create or replace function public.admin_daily_purchases(p_from date default null, p_to date default null)
returns table(day date, tanks_registered bigint) language plpgsql security definer set search_path = '' as $$
begin perform public.require_admin(); return query select p.created_at::date, sum(p.quantity)::bigint from public.client_purchases p where (p_from is null or p.created_at::date >= p_from) and (p_to is null or p.created_at::date <= p_to) group by p.created_at::date order by p.created_at::date; end;
$$;

create or replace function public.admin_recent_activity(p_limit integer default 8)
returns table(id bigint, action text, previous_count smallint, new_count smallint, created_at timestamptz, cedula text, name text) language plpgsql security definer set search_path = '' as $$
begin perform public.require_admin(); return query select m.id,m.action,m.previous_count,m.new_count,m.created_at,c.cedula,c.name from public.client_movements m join public.clients c on c.id=m.client_id order by m.created_at desc,m.id desc limit least(greatest(coalesce(p_limit,8),1),20); end;
$$;

create or replace function public.admin_list_clients(p_search text default '', p_status text default 'all', p_limit integer default 20, p_offset integer default 0)
returns table(id uuid, cedula text, name text, purchase_count smallint, updated_at timestamptz) language plpgsql security definer set search_path = '' as $$
declare v_search text := btrim(coalesce(p_search,'')); v_status text := coalesce(p_status,'all');
begin
  perform public.require_admin();
  if v_status not in ('all','empty','active','ready') then raise exception 'Filtro inválido.' using errcode='22023'; end if;
  return query select c.id,c.cedula,c.name,c.purchase_count,c.updated_at from public.clients c where (v_search='' or c.cedula like '%'||regexp_replace(v_search,'[^0-9]','','g')||'%' or c.name ilike '%'||v_search||'%') and (v_status='all' or (v_status='empty' and c.purchase_count=0) or (v_status='active' and c.purchase_count between 1 and 9) or (v_status='ready' and c.purchase_count=10)) order by c.updated_at desc,c.name asc limit least(greatest(coalesce(p_limit,20),1),50) offset greatest(coalesce(p_offset,0),0);
end;
$$;

revoke all on function public.is_admin(), public.require_admin() from public;
revoke all on function public.admin_find_client(text), public.admin_create_client(text,text,smallint), public.admin_update_client(text,text,smallint), public.admin_get_client_history(text,integer), public.admin_redeem_reward(text), public.admin_register_purchase(text,smallint), public.admin_dashboard_summary(date,date), public.admin_daily_purchases(date,date), public.admin_recent_activity(integer), public.admin_list_clients(text,text,integer,integer) from public;
grant execute on function public.admin_find_client(text), public.admin_create_client(text,text,smallint), public.admin_update_client(text,text,smallint), public.admin_get_client_history(text,integer), public.admin_redeem_reward(text), public.admin_register_purchase(text,smallint), public.admin_dashboard_summary(date,date), public.admin_daily_purchases(date,date), public.admin_recent_activity(integer), public.admin_list_clients(text,text,integer,integer) to authenticated;

commit;
