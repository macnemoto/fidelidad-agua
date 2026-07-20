import { requireSupabase } from '../lib/supabase'
import type { DashboardActivity, DashboardClient, DashboardFilter, DashboardSummary, DailyPurchase, ClientStatus, DailyFinancial, FinancialSummary } from '../types/dashboard'

export function caracasDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function datesForFilter(filter: DashboardFilter) {
  if (filter.mode === 'all') return { p_from: null, p_to: null }
  if (filter.mode === 'day') return { p_from: filter.date, p_to: filter.date }
  if (filter.mode === 'range') return { p_from: filter.from, p_to: filter.to }
  const today = new Date(`${caracasDate()}T12:00:00`)
  today.setDate(today.getDate() - (filter.days - 1))
  const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return { p_from: from, p_to: caracasDate() }
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireSupabase().rpc(name, args)
  if (error) throw new Error(error.message)
  return data as T
}

export async function getDashboardSummary(filter: DashboardFilter): Promise<DashboardSummary> {
  const rows = await rpc<DashboardSummary[]>('admin_dashboard_summary', datesForFilter(filter))
  return rows[0] ?? { total_clients: 0, active_clients: 0, ready_clients: 0, tanks_registered: 0, rewards_redeemed: 0 }
}

export async function getDailyPurchases(filter: DashboardFilter): Promise<DailyPurchase[]> {
  return rpc<DailyPurchase[]>('admin_daily_purchases', datesForFilter(filter))
}

export async function getFinancialSummary(filter: DashboardFilter): Promise<FinancialSummary> {
  const rows = await rpc<FinancialSummary[]>('admin_financial_summary', datesForFilter(filter))
  return rows[0] ?? { trucks_registered: 0, tanks_registered: 0, revenue_usd: 0, revenue_ves: 0, revenue_usdt: 0, missing_rate_trucks: 0 }
}

export async function getDailyFinancials(filter: DashboardFilter): Promise<DailyFinancial[]> {
  return rpc<DailyFinancial[]>('admin_daily_financials', datesForFilter(filter))
}

export async function getDashboardActivity(): Promise<DashboardActivity[]> {
  return rpc<DashboardActivity[]>('admin_recent_activity', { p_limit: 8 })
}

export async function getDashboardClients(search: string, status: ClientStatus, offset = 0): Promise<DashboardClient[]> {
  return rpc<DashboardClient[]>('admin_list_clients', { p_search: search, p_status: status, p_limit: 20, p_offset: offset })
}

export async function registerPurchase(cedula: string, quantity: number) {
  const rows = await rpc<DashboardClient[]>('admin_register_purchase', { p_cedula: cedula, p_quantity: quantity })
  if (!rows[0]) throw new Error('Supabase no devolvió el cliente actualizado.')
  return rows[0]
}
