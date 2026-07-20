export type ClientStatus = 'all' | 'empty' | 'active' | 'ready'

export interface DashboardSummary {
  total_clients: number
  active_clients: number
  ready_clients: number
  tanks_registered: number
  rewards_redeemed: number
}

export interface DailyPurchase {
  day: string
  tanks_registered: number
}

export interface FinancialSummary {
  trucks_registered: number
  tanks_registered: number
  revenue_usd: number
  revenue_ves: number
  revenue_usdt: number
  missing_rate_trucks: number
}

export interface DailyFinancial {
  day: string
  trucks_registered: number
  tanks_registered: number
  revenue_usd: number
  revenue_ves: number
  revenue_usdt: number
  bcv_rate: number | null
  binance_rate: number | null
  rate_status: 'live' | 'fallback' | 'missing' | 'legacy'
}

export interface DashboardClient {
  id: string
  cedula: string
  name: string
  purchase_count: number
  updated_at: string
}

export interface DashboardActivity {
  id: number
  action: string
  previous_count: number
  new_count: number
  created_at: string
  cedula: string
  name: string
}
