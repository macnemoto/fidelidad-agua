begin;

do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.client_purchases'::regclass
      and contype = 'c'
  loop
    execute format('alter table public.client_purchases drop constraint %I', v_constraint.conname);
  end loop;
end;
$$;

alter table public.client_purchases
  add constraint client_purchases_quantity_range_check check (quantity between -10 and 10 and quantity <> 0),
  add constraint client_purchases_previous_count_range_check check (previous_count between 0 and 10),
  add constraint client_purchases_new_count_range_check check (new_count between 0 and 10),
  add constraint client_purchases_count_delta_check check (new_count = previous_count + quantity);

create or replace function public.admin_create_client(
  p_cedula text,
  p_name text,
  p_purchase_count smallint
)
returns table (id uuid, cedula text, name text, purchase_count smallint, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  v_cedula text := regexp_replace(coalesce(p_cedula, ''), '[^0-9]', '', 'g');
  v_name text := btrim(coalesce(p_name, ''));
  v_saved public.clients%rowtype;
begin
  perform public.require_admin();
  if v_cedula !~ '^[0-9]{5,8}$' then raise exception 'La cédula debe tener entre 5 y 8 números.' using errcode = '22023'; end if;
  if char_length(v_name) not between 2 and 60 then raise exception 'El nombre debe tener entre 2 y 60 caracteres.' using errcode = '22023'; end if;
  if p_purchase_count is null or p_purchase_count not between 0 and 10 then raise exception 'El progreso debe estar entre 0 y 10.' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_cedula, 0));
  if exists (select 1 from public.clients as c where c.cedula = v_cedula) then
    raise exception 'Esta cédula ya está registrada. Utiliza Buscar cliente.' using errcode = '23505';
  end if;

  insert into public.clients (cedula, name, purchase_count)
  values (v_cedula, v_name, p_purchase_count)
  returning * into v_saved;

  insert into public.client_movements (client_id, action, previous_count, new_count)
  values (v_saved.id, 'created', 0, p_purchase_count);

  if p_purchase_count > 0 then
    insert into public.client_purchases (client_id, quantity, previous_count, new_count, created_by)
    values (v_saved.id, p_purchase_count, 0, p_purchase_count, auth.uid());
    insert into public.client_movements (client_id, action, previous_count, new_count)
    values (v_saved.id, 'purchase_registered', 0, p_purchase_count);
  end if;

  return query select v_saved.id, v_saved.cedula, v_saved.name, v_saved.purchase_count, v_saved.created_at, v_saved.updated_at;
end;
$$;

create or replace function public.admin_update_client(
  p_cedula text,
  p_name text,
  p_purchase_count smallint
)
returns table (id uuid, cedula text, name text, purchase_count smallint, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  v_cedula text := regexp_replace(coalesce(p_cedula, ''), '[^0-9]', '', 'g');
  v_name text := btrim(coalesce(p_name, ''));
  v_existing public.clients%rowtype;
  v_saved public.clients%rowtype;
  v_delta smallint;
begin
  perform public.require_admin();
  if v_cedula !~ '^[0-9]{5,8}$' then raise exception 'La cédula debe tener entre 5 y 8 números.' using errcode = '22023'; end if;
  if char_length(v_name) not between 2 and 60 then raise exception 'El nombre debe tener entre 2 y 60 caracteres.' using errcode = '22023'; end if;
  if p_purchase_count is null or p_purchase_count not between 0 and 10 then raise exception 'El progreso debe estar entre 0 y 10.' using errcode = '22023'; end if;

  select c.* into v_existing from public.clients as c where c.cedula = v_cedula for update;
  if not found then raise exception 'No existe un cliente con esa cédula.' using errcode = 'P0002'; end if;

  v_delta := p_purchase_count - v_existing.purchase_count;
  update public.clients as c
  set name = v_name, purchase_count = p_purchase_count, updated_at = now()
  where c.id = v_existing.id
  returning c.* into v_saved;

  if v_existing.name is distinct from v_name then
    insert into public.client_movements (client_id, action, previous_count, new_count)
    values (v_saved.id, 'profile_updated', v_existing.purchase_count, v_existing.purchase_count);
  end if;

  if v_delta <> 0 then
    insert into public.client_purchases (client_id, quantity, previous_count, new_count, created_by)
    values (v_saved.id, v_delta, v_existing.purchase_count, p_purchase_count, auth.uid());
    insert into public.client_movements (client_id, action, previous_count, new_count)
    values (v_saved.id, case when v_delta > 0 then 'purchase_registered' else 'progress_updated' end, v_existing.purchase_count, p_purchase_count);
  end if;

  return query select v_saved.id, v_saved.cedula, v_saved.name, v_saved.purchase_count, v_saved.created_at, v_saved.updated_at;
end;
$$;

create or replace function public.admin_register_purchase(p_cedula text, p_quantity smallint)
returns table (id uuid, cedula text, name text, purchase_count smallint, updated_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  v_cedula text := regexp_replace(coalesce(p_cedula, ''), '[^0-9]', '', 'g');
  v_client public.clients%rowtype;
  v_saved public.clients%rowtype;
begin
  perform public.require_admin();
  if v_cedula !~ '^[0-9]{5,8}$' then raise exception 'La cédula debe tener entre 5 y 8 números.' using errcode = '22023'; end if;
  if p_quantity is null or p_quantity not between 1 and 10 then raise exception 'La cantidad debe estar entre 1 y 10.' using errcode = '22023'; end if;

  select c.* into v_client from public.clients as c where c.cedula = v_cedula for update;
  if not found then raise exception 'No existe un cliente con esa cédula.' using errcode = 'P0002'; end if;
  if v_client.purchase_count + p_quantity > 10 then raise exception 'Esta compra supera las 10 marcas. Canjea el beneficio antes de registrar más tanques.' using errcode = '23514'; end if;

  update public.clients as c
  set purchase_count = c.purchase_count + p_quantity, updated_at = now()
  where c.id = v_client.id
  returning c.* into v_saved;

  insert into public.client_purchases (client_id, quantity, previous_count, new_count, created_by)
  values (v_saved.id, p_quantity, v_client.purchase_count, v_saved.purchase_count, auth.uid());
  insert into public.client_movements (client_id, action, previous_count, new_count)
  values (v_saved.id, 'purchase_registered', v_client.purchase_count, v_saved.purchase_count);

  return query select v_saved.id, v_saved.cedula, v_saved.name, v_saved.purchase_count, v_saved.updated_at;
end;
$$;

revoke all on function public.admin_create_client(text, text, smallint), public.admin_update_client(text, text, smallint), public.admin_register_purchase(text, smallint) from public;
grant execute on function public.admin_create_client(text, text, smallint), public.admin_update_client(text, text, smallint), public.admin_register_purchase(text, smallint) to authenticated;

commit;
