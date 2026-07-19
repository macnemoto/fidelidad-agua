begin;

create or replace function public.create_client(
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

create or replace function public.update_client(
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
begin
  if v_cedula !~ '^[0-9]{5,8}$' then raise exception 'La cédula debe tener entre 5 y 8 números.' using errcode = '22023'; end if;
  if char_length(v_name) not between 2 and 60 then raise exception 'El nombre debe tener entre 2 y 60 caracteres.' using errcode = '22023'; end if;
  if p_purchase_count is null or p_purchase_count not between 0 and 10 then raise exception 'El progreso debe estar entre 0 y 10.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_cedula, 0));
  select * into v_existing from public.clients c where c.cedula = v_cedula for update;
  if not found then raise exception 'No existe un cliente con esa cédula.' using errcode = 'P0002'; end if;
  update public.clients set name = v_name, purchase_count = p_purchase_count, updated_at = now() where public.clients.id = v_existing.id returning * into v_saved;
  if v_existing.name is distinct from v_name then insert into public.client_movements (client_id, action, previous_count, new_count) values (v_saved.id, 'profile_updated', v_existing.purchase_count, v_existing.purchase_count); end if;
  if v_existing.purchase_count is distinct from p_purchase_count then insert into public.client_movements (client_id, action, previous_count, new_count) values (v_saved.id, 'progress_updated', v_existing.purchase_count, p_purchase_count); end if;
  return query select v_saved.id, v_saved.cedula, v_saved.name, v_saved.purchase_count, v_saved.created_at, v_saved.updated_at;
end;
$$;

revoke all on function public.save_client(text, text, smallint) from anon, authenticated;
revoke all on function public.create_client(text, text, smallint) from public;
revoke all on function public.update_client(text, text, smallint) from public;
grant execute on function public.create_client(text, text, smallint) to anon, authenticated;
grant execute on function public.update_client(text, text, smallint) to anon, authenticated;

commit;
