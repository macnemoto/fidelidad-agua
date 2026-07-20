begin;

-- Financial snapshots are additive: records created by v1 remain valid and are
-- marked as legacy by the reporting functions when these columns are null.
create table if not exists public.business_settings (
  id boolean primary key default true check (id),
  usd_per_truck numeric(12,2) not null default 25 check (usd_per_truck > 0),
  tanks_per_truck smallint not null default 3 check (tanks_per_truck > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete restrict
);

insert into public.business_settings (id, usd_per_truck, tanks_per_truck)
values (true, 25, 3)
on conflict (id) do nothing;

create table if not exists public.exchange_rate_snapshots (
  id bigint generated always as identity primary key,
  provider text not null default 'cotizave',
  bcv_rate numeric(18,6),
  binance_rate numeric(18,6),
  bcv_updated_at timestamptz,
  binance_updated_at timestamptz,
  fetched_at timestamptz not null default now(),
  status text not null default 'live' check (status in ('live', 'fallback')),
  check (bcv_rate is null or bcv_rate > 0),
  check (binance_rate is null or binance_rate > 0),
  check (bcv_rate is not null or binance_rate is not null)
);

create index if not exists exchange_rate_snapshots_fetched_idx
  on public.exchange_rate_snapshots(fetched_at desc);

alter table public.client_purchases
  add column if not exists rate_snapshot_id bigint references public.exchange_rate_snapshots(id) on delete restrict,
  add column if not exists usd_per_truck numeric(12,2),
  add column if not exists tanks_per_truck smallint,
  add column if not exists revenue_usd numeric(18,2),
  add column if not exists revenue_ves numeric(20,2),
  add column if not exists revenue_usdt numeric(20,6),
  add column if not exists rate_status text;

alter table public.client_purchases
  drop constraint if exists client_purchases_financial_status_check;
alter table public.client_purchases
  add constraint client_purchases_financial_status_check
  check (rate_status is null or rate_status in ('live', 'fallback', 'missing', 'legacy'));

alter table public.business_settings enable row level security;
alter table public.exchange_rate_snapshots enable row level security;
revoke all on table public.business_settings, public.exchange_rate_snapshots from anon, authenticated;
revoke all on sequence public.exchange_rate_snapshots_id_seq from anon, authenticated;

create or replace function public.admin_get_business_settings()
returns table (usd_per_truck numeric, tanks_per_truck smallint, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query select s.usd_per_truck, s.tanks_per_truck, s.updated_at
  from public.business_settings s where s.id = true;
end;
$$;

create or replace function public.admin_get_latest_rate_snapshot(p_max_age_minutes integer default 5)
returns table (id bigint, bcv_rate numeric, binance_rate numeric, bcv_updated_at timestamptz,
  binance_updated_at timestamptz, fetched_at timestamptz, status text)
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query select r.id, r.bcv_rate, r.binance_rate, r.bcv_updated_at,
    r.binance_updated_at, r.fetched_at, r.status
  from public.exchange_rate_snapshots r
  where r.fetched_at >= now() - make_interval(mins => least(greatest(coalesce(p_max_age_minutes, 5), 0), 60))
  order by r.fetched_at desc, r.id desc limit 1;
end;
$$;

create or replace function public.admin_record_rate_snapshot(
  p_bcv_rate numeric, p_binance_rate numeric, p_bcv_updated_at timestamptz,
  p_binance_updated_at timestamptz, p_status text default 'live'
)
returns table (id bigint, bcv_rate numeric, binance_rate numeric, bcv_updated_at timestamptz,
  binance_updated_at timestamptz, fetched_at timestamptz, status text)
language plpgsql security definer set search_path = '' as $$
declare v_row public.exchange_rate_snapshots%rowtype;
begin
  perform public.require_admin();
  if p_bcv_rate is null or p_bcv_rate <= 0 or p_binance_rate is null or p_binance_rate <= 0 then
    raise exception 'Las tasas deben ser números positivos.' using errcode = '22023';
  end if;
  if p_status not in ('live', 'fallback') then raise exception 'Estado de tasa inválido.' using errcode = '22023'; end if;
  insert into public.exchange_rate_snapshots (bcv_rate, binance_rate, bcv_updated_at, binance_updated_at, status)
  values (p_bcv_rate, p_binance_rate, p_bcv_updated_at, p_binance_updated_at, p_status)
  returning * into v_row;
  return query select v_row.id, v_row.bcv_rate, v_row.binance_rate, v_row.bcv_updated_at,
    v_row.binance_updated_at, v_row.fetched_at, v_row.status;
end;
$$;

create or replace function public.admin_financial_summary(p_from date default null, p_to date default null)
returns table (trucks_registered bigint, tanks_registered bigint, revenue_usd numeric,
  revenue_ves numeric, revenue_usdt numeric, missing_rate_trucks bigint)
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query select
    coalesce(sum(p.quantity), 0)::bigint,
    coalesce(sum(p.quantity * coalesce(p.tanks_per_truck, 3)), 0)::bigint,
    coalesce(sum(p.revenue_usd), 0), coalesce(sum(p.revenue_ves), 0), coalesce(sum(p.revenue_usdt), 0),
    coalesce(sum(case when p.rate_status = 'missing' then p.quantity else 0 end), 0)::bigint
  from public.client_purchases p
  where (p_from is null or p.created_at::date >= p_from)
    and (p_to is null or p.created_at::date <= p_to);
end;
$$;

create or replace function public.admin_daily_financials(p_from date default null, p_to date default null)
returns table (day date, trucks_registered bigint, tanks_registered bigint, revenue_usd numeric,
  revenue_ves numeric, revenue_usdt numeric, bcv_rate numeric, binance_rate numeric, rate_status text)
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query select p.created_at::date,
    sum(p.quantity)::bigint,
    sum(p.quantity * coalesce(p.tanks_per_truck, 3))::bigint,
    coalesce(sum(p.revenue_usd), 0), coalesce(sum(p.revenue_ves), 0), coalesce(sum(p.revenue_usdt), 0),
    (array_agg(r.bcv_rate order by p.created_at desc, p.id desc))[1],
    (array_agg(r.binance_rate order by p.created_at desc, p.id desc))[1],
    (array_agg(coalesce(p.rate_status, 'legacy') order by p.created_at desc, p.id desc))[1]
  from public.client_purchases p
  left join public.exchange_rate_snapshots r on r.id = p.rate_snapshot_id
  where (p_from is null or p.created_at::date >= p_from)
    and (p_to is null or p.created_at::date <= p_to)
  group by p.created_at::date order by p.created_at::date;
end;
$$;

create or replace function public.admin_create_client_v2(
  p_cedula text, p_name text, p_purchase_count smallint,
  p_rate_snapshot_id bigint default null, p_rate_status text default 'missing'
)
returns table (id uuid, cedula text, name text, purchase_count smallint, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_cedula text := regexp_replace(coalesce(p_cedula, ''), '[^0-9]', '', 'g');
  v_name text := btrim(coalesce(p_name, ''));
  v_saved public.clients%rowtype;
  v_settings public.business_settings%rowtype;
  v_rate public.exchange_rate_snapshots%rowtype;
  v_usd numeric;
begin
  perform public.require_admin();
  if v_cedula !~ '^[0-9]{5,8}$' then raise exception 'La cédula debe tener entre 5 y 8 números.' using errcode = '22023'; end if;
  if char_length(v_name) not between 2 and 60 then raise exception 'El nombre debe tener entre 2 y 60 caracteres.' using errcode = '22023'; end if;
  if p_purchase_count is null or p_purchase_count not between 0 and 10 then raise exception 'El progreso debe estar entre 0 y 10.' using errcode = '22023'; end if;
  if p_rate_status not in ('live', 'fallback', 'missing') then raise exception 'Estado de tasa inválido.' using errcode = '22023'; end if;
  select s.* into v_settings from public.business_settings s where s.id = true;
  if p_rate_snapshot_id is not null then select r.* into v_rate from public.exchange_rate_snapshots r where r.id = p_rate_snapshot_id; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_cedula, 0));
  if exists (select 1 from public.clients c where c.cedula = v_cedula) then raise exception 'Esta cédula ya está registrada. Utiliza Buscar cliente.' using errcode = '23505'; end if;
  insert into public.clients (cedula, name, purchase_count) values (v_cedula, v_name, p_purchase_count) returning * into v_saved;
  insert into public.client_movements (client_id, action, previous_count, new_count) values (v_saved.id, 'created', 0, p_purchase_count);
  if p_purchase_count > 0 then
    v_usd := p_purchase_count * v_settings.usd_per_truck;
    insert into public.client_purchases (client_id, quantity, previous_count, new_count, created_by, rate_snapshot_id, usd_per_truck, tanks_per_truck, revenue_usd, revenue_ves, revenue_usdt, rate_status)
    values (v_saved.id, p_purchase_count, 0, p_purchase_count, auth.uid(), p_rate_snapshot_id, v_settings.usd_per_truck, v_settings.tanks_per_truck, v_usd,
      case when v_rate.bcv_rate is not null then v_usd * v_rate.bcv_rate end,
      case when v_rate.bcv_rate is not null and v_rate.binance_rate is not null then v_usd * v_rate.bcv_rate / v_rate.binance_rate end,
      case when p_rate_snapshot_id is null then 'missing' else p_rate_status end);
    insert into public.client_movements (client_id, action, previous_count, new_count) values (v_saved.id, 'purchase_registered', 0, p_purchase_count);
  end if;
  return query select v_saved.id, v_saved.cedula, v_saved.name, v_saved.purchase_count, v_saved.created_at, v_saved.updated_at;
end;
$$;

create or replace function public.admin_update_client_v2(
  p_cedula text, p_name text, p_purchase_count smallint,
  p_rate_snapshot_id bigint default null, p_rate_status text default 'missing'
)
returns table (id uuid, cedula text, name text, purchase_count smallint, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_cedula text := regexp_replace(coalesce(p_cedula, ''), '[^0-9]', '', 'g');
  v_name text := btrim(coalesce(p_name, ''));
  v_existing public.clients%rowtype;
  v_saved public.clients%rowtype;
  v_settings public.business_settings%rowtype;
  v_rate public.exchange_rate_snapshots%rowtype;
  v_delta smallint;
  v_usd numeric;
begin
  perform public.require_admin();
  if v_cedula !~ '^[0-9]{5,8}$' then raise exception 'La cédula debe tener entre 5 y 8 números.' using errcode = '22023'; end if;
  if char_length(v_name) not between 2 and 60 then raise exception 'El nombre debe tener entre 2 y 60 caracteres.' using errcode = '22023'; end if;
  if p_purchase_count is null or p_purchase_count not between 0 and 10 then raise exception 'El progreso debe tener entre 0 y 10.' using errcode = '22023'; end if;
  if p_rate_status not in ('live', 'fallback', 'missing') then raise exception 'Estado de tasa inválido.' using errcode = '22023'; end if;
  select c.* into v_existing from public.clients c where c.cedula = v_cedula for update;
  if not found then raise exception 'No existe un cliente con esa cédula.' using errcode = 'P0002'; end if;
  select s.* into v_settings from public.business_settings s where s.id = true;
  if p_rate_snapshot_id is not null then select r.* into v_rate from public.exchange_rate_snapshots r where r.id = p_rate_snapshot_id; end if;
  v_delta := p_purchase_count - v_existing.purchase_count;
  update public.clients c set name = v_name, purchase_count = p_purchase_count, updated_at = now() where c.id = v_existing.id returning c.* into v_saved;
  if v_existing.name is distinct from v_name then
    insert into public.client_movements (client_id, action, previous_count, new_count) values (v_saved.id, 'profile_updated', v_existing.purchase_count, v_existing.purchase_count);
  end if;
  if v_delta <> 0 then
    v_usd := v_delta * v_settings.usd_per_truck;
    insert into public.client_purchases (client_id, quantity, previous_count, new_count, created_by, rate_snapshot_id, usd_per_truck, tanks_per_truck, revenue_usd, revenue_ves, revenue_usdt, rate_status)
    values (v_saved.id, v_delta, v_existing.purchase_count, p_purchase_count, auth.uid(), p_rate_snapshot_id, v_settings.usd_per_truck, v_settings.tanks_per_truck, v_usd,
      case when v_rate.bcv_rate is not null then v_usd * v_rate.bcv_rate end,
      case when v_rate.bcv_rate is not null and v_rate.binance_rate is not null then v_usd * v_rate.bcv_rate / v_rate.binance_rate end,
      case when p_rate_snapshot_id is null then 'missing' else p_rate_status end);
    insert into public.client_movements (client_id, action, previous_count, new_count)
    values (v_saved.id, case when v_delta > 0 then 'purchase_registered' else 'progress_updated' end, v_existing.purchase_count, p_purchase_count);
  end if;
  return query select v_saved.id, v_saved.cedula, v_saved.name, v_saved.purchase_count, v_saved.created_at, v_saved.updated_at;
end;
$$;

revoke all on function public.admin_get_business_settings(), public.admin_get_latest_rate_snapshot(integer),
  public.admin_record_rate_snapshot(numeric,numeric,timestamptz,timestamptz,text),
  public.admin_financial_summary(date,date), public.admin_daily_financials(date,date),
  public.admin_create_client_v2(text,text,smallint,bigint,text),
  public.admin_update_client_v2(text,text,smallint,bigint,text) from public;
grant execute on function public.admin_get_business_settings(), public.admin_get_latest_rate_snapshot(integer),
  public.admin_record_rate_snapshot(numeric,numeric,timestamptz,timestamptz,text),
  public.admin_financial_summary(date,date), public.admin_daily_financials(date,date),
  public.admin_create_client_v2(text,text,smallint,bigint,text),
  public.admin_update_client_v2(text,text,smallint,bigint,text) to authenticated;

commit;
