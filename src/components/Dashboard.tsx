import { useEffect, useMemo, useState } from 'react'
import { getDashboardActivity, getDashboardSummary, getDailyFinancials, getFinancialSummary } from '../services/dashboard'
import type { DashboardActivity, DashboardSummary, DailyFinancial, FinancialSummary } from '../types/dashboard'

type Period = 7 | 30 | 90 | 'all'
const actionLabel: Record<string, string> = { created: 'Cliente creado', purchase_registered: 'Camión registrado', progress_updated: 'Progreso corregido', profile_updated: 'Nombre actualizado', reward_redeemed: 'Beneficio canjeado' }
const money = (value: number | null | undefined, currency: string) => value == null ? '—' : `${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ${currency}`

export function Dashboard({ onSelectClient }: { onSelectClient: (cedula: string) => void }) {
  const [period, setPeriod] = useState<Period>(30)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [financial, setFinancial] = useState<FinancialSummary | null>(null)
  const [daily, setDaily] = useState<DailyFinancial[]>([])
  const [activity, setActivity] = useState<DashboardActivity[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { let active = true; setLoading(true); setError(null); Promise.all([getDashboardSummary(period), getFinancialSummary(period), getDailyFinancials(period), getDashboardActivity()]).then(([nextSummary, nextFinancial, nextDaily, nextActivity]) => { if (active) { setSummary(nextSummary); setFinancial(nextFinancial); setDaily(nextDaily); setActivity(nextActivity) } }).catch((cause: unknown) => active && setError(cause instanceof Error ? cause.message : 'No se pudo cargar el resumen.')).finally(() => active && setLoading(false)); return () => { active = false } }, [period])
  const max = useMemo(() => Math.max(1, ...daily.map((item) => Math.abs(item.trucks_registered))), [daily])
  return <section className="dashboard-page" aria-busy={loading}>
    <div className="section-heading"><div><span className="eyebrow">Resumen operativo</span><h2>Dashboard</h2></div><label className="period-select">Período<select value={period} onChange={(event) => setPeriod(event.target.value === 'all' ? 'all' : Number(event.target.value) as Period)}><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="all">Todo el historial</option></select></label></div>
    {error && <p className="status error">{error}</p>}
    <p className="financial-note">Cada gota representa un camión de 3 tanques. Valor de referencia: USD 25 por camión.</p>
    <div className="metric-grid">
      <Metric label="Clientes registrados" value={summary?.total_clients} /> <Metric label="Camiones vendidos netos" value={financial?.trucks_registered} /> <Metric label="Tanques entregados netos" value={financial?.tanks_registered} /> <Metric label="Ingresos estimados USD" value={financial ? money(financial.revenue_usd, 'USD') : undefined} /> <Metric label="Ingresos estimados BCV" value={financial ? money(financial.revenue_ves, 'Bs.') : undefined} /> <Metric label="Equivalente Binance" value={financial ? money(financial.revenue_usdt, 'USDT') : undefined} /> <Metric label="Beneficios disponibles" value={summary?.ready_clients} emphasis /> <Metric label="Beneficios canjeados" value={summary?.rewards_redeemed} />
    </div>
    {financial && financial.missing_rate_trucks > 0 && <p className="status info">Hay {financial.missing_rate_trucks} camiones sin tasa registrada; sus ingresos en bolívares quedan pendientes.</p>}
    <div className="dashboard-grid"><section className="dashboard-card"><h3>Camiones vendidos por día</h3><div className="bar-chart" aria-label="Gráfica de camiones vendidos por día">{daily.length === 0 ? <p className="empty-state">Aún no hay ventas registradas en este período.</p> : daily.map((item) => { const negative = item.trucks_registered < 0; return <div className="bar-column" key={item.day} title={`${item.day}: ${item.trucks_registered} camiones`}><span className={`bar-value${negative ? ' negative' : ''}`}>{item.trucks_registered || ''}</span><span className="bar-area"><span className={`bar${negative ? ' negative' : ''}`} style={{ height: `${Math.max(4, Math.abs(item.trucks_registered) / max * 48)}%` }} /></span><time>{item.day.slice(8)}</time></div> })}</div></section>
    <section className="dashboard-card"><h3>Detalle diario de ingresos</h3>{daily.length === 0 ? <p className="empty-state">Todavía no hay movimientos financieros.</p> : <div className="financial-table-wrap"><table className="financial-table"><thead><tr><th>Día</th><th>Camiones</th><th>Tanques</th><th>BCV</th><th>Binance</th><th>USD</th><th>Bs.</th></tr></thead><tbody>{daily.map((item) => <tr key={item.day}><td>{item.day}</td><td>{item.trucks_registered}</td><td>{item.tanks_registered}</td><td>{item.bcv_rate?.toFixed(2) ?? '—'}</td><td>{item.binance_rate?.toFixed(2) ?? '—'}</td><td>{money(item.revenue_usd, 'USD')}</td><td>{money(item.revenue_ves, 'Bs.')}</td></tr>)}</tbody></table></div>}</section>
    <section className="dashboard-card"><h3>Actividad reciente</h3><ol className="activity-list">{activity.length === 0 ? <li className="empty-state">Todavía no hay actividad.</li> : activity.map((item) => <li key={item.id}><button onClick={() => onSelectClient(item.cedula)}><strong>{item.name}</strong><span>V-{item.cedula} · {actionLabel[item.action] ?? item.action}</span></button><small>{item.previous_count} → {item.new_count}</small></li>)}</ol></section></div>
    <p className="financial-disclaimer">Las tasas Binance P2P son referenciales. Los ingresos mostrados son estimados y no descuentan costos.</p>
  </section>
}

function Metric({ label, value, emphasis = false }: { label: string; value?: number | string; emphasis?: boolean }) { return <article className={`metric-card${emphasis ? ' emphasis' : ''}`}><span>{label}</span><strong>{value ?? '—'}</strong></article> }
