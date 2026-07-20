begin;

-- Report the business day in Venezuela, never in the database server timezone.
create or replace function public.admin_dashboard_summary(p_from date default null, p_to date default null)
returns table(total_clients bigint, active_clients bigint, ready_clients bigint, tanks_registered bigint, rewards_redeemed bigint)
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query select
    (select count(*) from public.clients),
    (select count(*) from public.clients c where c.purchase_count between 1 and 9),
    (select count(*) from public.clients c where c.purchase_count = 10),
    (select coalesce(sum(p.quantity), 0) from public.client_purchases p where (p_from is null or (p.created_at at time zone 'America/Caracas')::date >= p_from) and (p_to is null or (p.created_at at time zone 'America/Caracas')::date <= p_to)),
    (select count(*) from public.client_movements m where m.action = 'reward_redeemed' and (p_from is null or (m.created_at at time zone 'America/Caracas')::date >= p_from) and (p_to is null or (m.created_at at time zone 'America/Caracas')::date <= p_to));
end;
$$;

create or replace function public.admin_daily_purchases(p_from date default null, p_to date default null)
returns table(day date, tanks_registered bigint)
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query select (p.created_at at time zone 'America/Caracas')::date, sum(p.quantity)::bigint
  from public.client_purchases p
  where (p_from is null or (p.created_at at time zone 'America/Caracas')::date >= p_from)
    and (p_to is null or (p.created_at at time zone 'America/Caracas')::date <= p_to)
  group by (p.created_at at time zone 'America/Caracas')::date
  order by (p.created_at at time zone 'America/Caracas')::date;
end;
$$;

create or replace function public.admin_financial_summary(p_from date default null, p_to date default null)
returns table (trucks_registered bigint, tanks_registered bigint, revenue_usd numeric, revenue_ves numeric, revenue_usdt numeric, missing_rate_trucks bigint)
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query select coalesce(sum(p.quantity), 0)::bigint,
    coalesce(sum(p.quantity * coalesce(p.tanks_per_truck, 3)), 0)::bigint,
    coalesce(sum(p.revenue_usd), 0), coalesce(sum(p.revenue_ves), 0), coalesce(sum(p.revenue_usdt), 0),
    coalesce(sum(case when p.rate_status = 'missing' then p.quantity else 0 end), 0)::bigint
  from public.client_purchases p
  where (p_from is null or (p.created_at at time zone 'America/Caracas')::date >= p_from)
    and (p_to is null or (p.created_at at time zone 'America/Caracas')::date <= p_to);
end;
$$;

create or replace function public.admin_daily_financials(p_from date default null, p_to date default null)
returns table (day date, trucks_registered bigint, tanks_registered bigint, revenue_usd numeric, revenue_ves numeric, revenue_usdt numeric, bcv_rate numeric, binance_rate numeric, rate_status text)
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return query select (p.created_at at time zone 'America/Caracas')::date,
    sum(p.quantity)::bigint, sum(p.quantity * coalesce(p.tanks_per_truck, 3))::bigint,
    coalesce(sum(p.revenue_usd), 0), coalesce(sum(p.revenue_ves), 0), coalesce(sum(p.revenue_usdt), 0),
    (array_agg(r.bcv_rate order by p.created_at desc, p.id desc))[1],
    (array_agg(r.binance_rate order by p.created_at desc, p.id desc))[1],
    (array_agg(coalesce(p.rate_status, 'legacy') order by p.created_at desc, p.id desc))[1]
  from public.client_purchases p left join public.exchange_rate_snapshots r on r.id = p.rate_snapshot_id
  where (p_from is null or (p.created_at at time zone 'America/Caracas')::date >= p_from)
    and (p_to is null or (p.created_at at time zone 'America/Caracas')::date <= p_to)
  group by (p.created_at at time zone 'America/Caracas')::date
  order by (p.created_at at time zone 'America/Caracas')::date;
end;
$$;

revoke all on function public.admin_dashboard_summary(date,date), public.admin_daily_purchases(date,date), public.admin_financial_summary(date,date), public.admin_daily_financials(date,date) from public;
grant execute on function public.admin_dashboard_summary(date,date), public.admin_daily_purchases(date,date), public.admin_financial_summary(date,date), public.admin_daily_financials(date,date) to authenticated;

commit;
