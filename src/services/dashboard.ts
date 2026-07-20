import { requireSupabase } from '../lib/supabase'
import type { DashboardActivity, DashboardClient, DashboardSummary, DailyPurchase, ClientStatus, DailyFinancial, FinancialSummary } from '../types/dashboard'

function datesFor(period: 7 | 30 | 90 | 'all') {
  if (period === 'all') return { p_from: null, p_to: null }
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Caracas' }))
  const from = new Date(today)
  from.setDate(from.getDate() - (period - 1))
  const date = (value: Date) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value)
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
    return `${get('year')}-${get('month')}-${get('day')}`
  }
  return { p_from: date(from), p_to: date(today) }
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireSupabase().rpc(name, args)
  if (error) throw new Error(error.message)
  return data as T
}

export async function getDashboardSummary(period: 7 | 30 | 90 | 'all'): Promise<DashboardSummary> {
  const rows = await rpc<DashboardSummary[]>('admin_dashboard_summary', datesFor(period))
  return rows[0] ?? { total_clients: 0, active_clients: 0, ready_clients: 0, tanks_registered: 0, rewards_redeemed: 0 }
}

export async function getDailyPurchases(period: 7 | 30 | 90 | 'all'): Promise<DailyPurchase[]> {
  return rpc<DailyPurchase[]>('admin_daily_purchases', datesFor(period))
}

export async function getFinancialSummary(period: 7 | 30 | 90 | 'all'): Promise<FinancialSummary> {
  const rows = await rpc<FinancialSummary[]>('admin_financial_summary', datesFor(period))
  return rows[0] ?? { trucks_registered: 0, tanks_registered: 0, revenue_usd: 0, revenue_ves: 0, revenue_usdt: 0, missing_rate_trucks: 0 }
}

export async function getDailyFinancials(period: 7 | 30 | 90 | 'all'): Promise<DailyFinancial[]> {
  return rpc<DailyFinancial[]>('admin_daily_financials', datesFor(period))
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
