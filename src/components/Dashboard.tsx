import { useEffect, useMemo, useState } from 'react'
import { getDailyPurchases, getDashboardActivity, getDashboardSummary } from '../services/dashboard'
import type { DashboardActivity, DashboardSummary, DailyPurchase } from '../types/dashboard'

type Period = 7 | 30 | 90 | 'all'
const actionLabel: Record<string, string> = { created: 'Cliente creado', purchase_registered: 'Compra registrada', progress_updated: 'Progreso corregido', profile_updated: 'Nombre actualizado', reward_redeemed: 'Beneficio canjeado' }

export function Dashboard({ onSelectClient }: { onSelectClient: (cedula: string) => void }) {
  const [period, setPeriod] = useState<Period>(30)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [daily, setDaily] = useState<DailyPurchase[]>([])
  const [activity, setActivity] = useState<DashboardActivity[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { let active = true; setLoading(true); setError(null); Promise.all([getDashboardSummary(period), getDailyPurchases(period), getDashboardActivity()]).then(([nextSummary, nextDaily, nextActivity]) => { if (active) { setSummary(nextSummary); setDaily(nextDaily); setActivity(nextActivity) } }).catch((cause: unknown) => active && setError(cause instanceof Error ? cause.message : 'No se pudo cargar el resumen.')).finally(() => active && setLoading(false)); return () => { active = false } }, [period])
  const max = useMemo(() => Math.max(1, ...daily.map((item) => Math.abs(item.tanks_registered))), [daily])
  return <section className="dashboard-page" aria-busy={loading}>
    <div className="section-heading"><div><span className="eyebrow">Resumen operativo</span><h2>Dashboard</h2></div><label className="period-select">Período<select value={period} onChange={(event) => setPeriod(event.target.value === 'all' ? 'all' : Number(event.target.value) as Period)}><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="all">Todo el historial</option></select></label></div>
    {error && <p className="status error">{error}</p>}
    <div className="metric-grid">
      <Metric label="Clientes registrados" value={summary?.total_clients} /> <Metric label="Clientes activos" value={summary?.active_clients} /> <Metric label="Beneficios disponibles" value={summary?.ready_clients} emphasis /> <Metric label="Ventas netas" value={summary?.tanks_registered} /> <Metric label="Beneficios canjeados" value={summary?.rewards_redeemed} />
    </div>
    <div className="dashboard-grid"><section className="dashboard-card"><h3>Ventas netas por día</h3><div className="bar-chart" aria-label="Gráfica de ventas netas por día">{daily.length === 0 ? <p className="empty-state">Aún no hay ventas registradas en este período.</p> : daily.map((item) => { const negative = item.tanks_registered < 0; return <div className="bar-column" key={item.day} title={`${item.day}: ${item.tanks_registered}`}><span className={`bar-value${negative ? ' negative' : ''}`}>{item.tanks_registered || ''}</span><span className="bar-area"><span className={`bar${negative ? ' negative' : ''}`} style={{ height: `${Math.max(4, Math.abs(item.tanks_registered) / max * 48)}%` }} /></span><time>{item.day.slice(8)}</time></div> })}</div></section>
    <section className="dashboard-card"><h3>Actividad reciente</h3><ol className="activity-list">{activity.length === 0 ? <li className="empty-state">Todavía no hay actividad.</li> : activity.map((item) => <li key={item.id}><button onClick={() => onSelectClient(item.cedula)}><strong>{item.name}</strong><span>V-{item.cedula} · {actionLabel[item.action] ?? item.action}</span></button><small>{item.previous_count} → {item.new_count}</small></li>)}</ol></section></div>
  </section>
}

function Metric({ label, value, emphasis = false }: { label: string; value?: number; emphasis?: boolean }) { return <article className={`metric-card${emphasis ? ' emphasis' : ''}`}><span>{label}</span><strong>{value ?? '—'}</strong></article> }
