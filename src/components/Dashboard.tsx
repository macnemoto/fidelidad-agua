import { useEffect, useMemo, useState } from 'react'
import { caracasDate, getDashboardActivity, getDashboardSummary, getDailyFinancials, getFinancialSummary } from '../services/dashboard'
import type { DashboardActivity, DashboardFilter, DashboardSummary, DailyFinancial, FinancialSummary } from '../types/dashboard'
import { showError, toastId } from '../lib/notifications'

type FilterChoice = '7' | '30' | '90' | 'all' | 'day' | 'range'
const actionLabel: Record<string, string> = { created: 'Cliente creado', purchase_registered: 'Camión registrado', progress_updated: 'Progreso corregido', profile_updated: 'Nombre actualizado', reward_redeemed: 'Beneficio canjeado' }
const money = (value: number | null | undefined, currency: string) => value == null ? '—' : `${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ${currency}`

export function Dashboard({ onSelectClient }: { onSelectClient: (cedula: string) => void }) {
  const today = useMemo(() => caracasDate(), [])
  const [choice, setChoice] = useState<FilterChoice>('30')
  const [selectedDay, setSelectedDay] = useState(today)
  const [range, setRange] = useState({ from: today, to: today })
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [financial, setFinancial] = useState<FinancialSummary | null>(null)
  const [daily, setDaily] = useState<DailyFinancial[]>([])
  const [activity, setActivity] = useState<DashboardActivity[]>([])
  const [loading, setLoading] = useState(true)
  const filter: DashboardFilter = useMemo(() => {
    if (choice === 'all') return { mode: 'all' }
    if (choice === 'day') return { mode: 'day', date: selectedDay }
    if (choice === 'range') return { mode: 'range', from: range.from, to: range.to }
    return { mode: 'preset', days: Number(choice) as 7 | 30 | 90 }
  }, [choice, range.from, range.to, selectedDay])
  const invalidRange = choice === 'range' && range.from > range.to
  useEffect(() => { if (invalidRange) return; let active = true; setLoading(true); Promise.all([getDashboardSummary(filter), getFinancialSummary(filter), getDailyFinancials(filter), getDashboardActivity()]).then(([nextSummary, nextFinancial, nextDaily, nextActivity]) => { if (active) { setSummary(nextSummary); setFinancial(nextFinancial); setDaily(nextDaily); setActivity(nextActivity) } }).catch((cause: unknown) => active && showError(cause instanceof Error ? cause.message : 'No se pudo cargar el resumen.', toastId.dashboard)).finally(() => active && setLoading(false)); return () => { active = false } }, [filter, invalidRange])
  useEffect(() => { if (invalidRange) showError('La fecha inicial no puede ser posterior a la fecha final.', toastId.dashboard) }, [invalidRange])
  const max = useMemo(() => Math.max(1, ...daily.map((item) => Math.abs(item.trucks_registered))), [daily])
  return <section className="dashboard-page" aria-busy={loading}>
    <div className="section-heading dashboard-heading"><div><span className="eyebrow">Resumen operativo</span><h2>Dashboard</h2></div><div className="dashboard-filters"><label className="period-select">Período<select aria-label="Período" value={choice} onChange={(event) => setChoice(event.target.value as FilterChoice)}><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="day">Día específico</option><option value="range">Rango personalizado</option><option value="all">Todo el historial</option></select></label>{choice === 'day' && <label className="period-select">Día<input aria-label="Día específico" type="date" max={today} value={selectedDay} onChange={(event) => setSelectedDay(event.target.value)} /></label>}{choice === 'range' && <div className="date-range"><label className="period-select">Desde<input aria-label="Desde" type="date" max={today} value={range.from} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} /></label><label className="period-select">Hasta<input aria-label="Hasta" type="date" min={range.from} max={today} value={range.to} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} /></label></div>}</div></div>
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
