import type { Handler } from '@netlify/functions'

type Body = { action: 'create' | 'update'; cedula: string; name: string; purchaseCount: number; previousCount?: number }
type Rate = { market: string; mid?: number; updated_at?: string }
type RateResponse = { rates?: Rate[]; fetched_at?: string }

let cachedRate: { id: number; bcv: number; binance: number; bcvUpdatedAt?: string; binanceUpdatedAt?: string; fetchedAt: string } | null = null

const json = (statusCode: number, body: unknown) => ({ statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) })

function env(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Falta configurar ${name} en Netlify.`)
  return value
}

async function supabaseRpc(name: string, args: Record<string, unknown>, token: string): Promise<unknown> {
  const response = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: env('SUPABASE_PUBLISHABLE_KEY'), Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(args),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(typeof payload?.message === 'string' ? payload.message : 'Supabase rechazó la operación.')
  return payload
}

async function latestFallback(token: string) {
  const rows = await supabaseRpc('admin_get_latest_rate_snapshot', { p_max_age_minutes: 1440 }, token)
  const row = Array.isArray(rows) ? rows[0] : null
  if (!row || Number(row.bcv_rate) <= 0 || Number(row.binance_rate) <= 0) return null
  return { id: Number(row.id), bcv: Number(row.bcv_rate), binance: Number(row.binance_rate), bcvUpdatedAt: row.bcv_updated_at, binanceUpdatedAt: row.binance_updated_at, fetchedAt: row.fetched_at }
}

async function rateForSave(token: string) {
  if (cachedRate && Date.now() - Date.parse(cachedRate.fetchedAt) < 5 * 60 * 1000) return { snapshot: cachedRate, status: 'live' as const }
  try {
    const response = await fetch('https://api.cotizave.com/v1/fx/rates', { headers: { 'X-API-Key': env('COTIZAVE_API_KEY'), accept: 'application/json' }, signal: AbortSignal.timeout(5000) })
    if (!response.ok) throw new Error('Cotizave no respondió correctamente.')
    const payload = await response.json() as RateResponse
    // Cotizave identifica la tasa oficial BCV como "reference" y el mercado
    // P2P de Binance como "binance". Conservamos los alias anteriores para
    // que la integración siga siendo compatible si el proveedor los expone.
    const bcv = payload.rates?.find((rate) => rate.market === 'reference' || rate.market === 'bcv')
    const binance = payload.rates?.find((rate) => rate.market === 'binance' || rate.market === 'binance_p2p')
    if (!bcv?.mid || !binance?.mid || bcv.mid <= 0 || binance.mid <= 0) throw new Error('La respuesta no contiene BCV y Binance válidos.')
    const inserted = await supabaseRpc('admin_record_rate_snapshot', { p_bcv_rate: bcv.mid, p_binance_rate: binance.mid, p_bcv_updated_at: bcv.updated_at ?? null, p_binance_updated_at: binance.updated_at ?? null, p_status: 'live' }, token)
    const row = Array.isArray(inserted) ? inserted[0] : null
    if (!row) throw new Error('Supabase no devolvió el snapshot de tasas.')
    cachedRate = { id: Number(row.id), bcv: Number(row.bcv_rate), binance: Number(row.binance_rate), bcvUpdatedAt: row.bcv_updated_at, binanceUpdatedAt: row.binance_updated_at, fetchedAt: row.fetched_at }
    return { snapshot: cachedRate, status: 'live' as const }
  } catch {
    const fallback = await latestFallback(token).catch(() => null)
    return fallback ? { snapshot: fallback, status: 'fallback' as const } : { snapshot: null, status: 'missing' as const }
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { message: 'Método no permitido.' })
  const authorization = event.headers.authorization ?? event.headers.Authorization
  if (!authorization?.startsWith('Bearer ')) return json(401, { message: 'Sesión requerida.' })
  let body: Body
  try { body = JSON.parse(event.body ?? '') as Body } catch { return json(400, { message: 'Solicitud inválida.' }) }
  const cedula = body.cedula?.replace(/\D/g, '')
  const name = body.name?.trim()
  if (!['create', 'update'].includes(body.action) || !/^\d{5,8}$/.test(cedula) || !name || name.length < 2 || name.length > 60 || !Number.isInteger(body.purchaseCount) || body.purchaseCount < 0 || body.purchaseCount > 10 || (body.action === 'update' && (!Number.isInteger(body.previousCount) || body.previousCount! < 0 || body.previousCount! > 10))) {
    return json(422, { message: 'Los datos del cliente no son válidos.' })
  }
  try {
    const token = authorization.slice('Bearer '.length)
    const hasProgressChange = body.action === 'create' ? body.purchaseCount !== 0 : body.previousCount !== body.purchaseCount
    const rate = hasProgressChange ? await rateForSave(token) : { snapshot: null, status: 'missing' as const }
    const rpcName = body.action === 'create' ? 'admin_create_client_v2' : 'admin_update_client_v2'
    const result = await supabaseRpc(rpcName, { p_cedula: cedula, p_name: name, p_purchase_count: body.purchaseCount, p_rate_snapshot_id: rate.snapshot?.id ?? null, p_rate_status: rate.status }, token)
    const client = Array.isArray(result) ? result[0] : null
    if (!client) return json(502, { message: 'Supabase no devolvió el cliente actualizado.' })
    return json(200, { client, rateStatus: rate.status, rateFetchedAt: rate.snapshot?.fetchedAt ?? null })
  } catch (error) {
    return json(400, { message: error instanceof Error ? error.message : 'No se pudo guardar el cliente.' })
  }
}
