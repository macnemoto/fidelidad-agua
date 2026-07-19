import { requireSupabase } from '../lib/supabase'
import type { Client, ClientMovement } from '../types/client'
import { normalizeCedula } from '../utils/cedula'

const REQUEST_TIMEOUT_MS = 15_000

function firstOrNull<T>(data: unknown): T | null {
  return Array.isArray(data) && data.length > 0 ? data[0] as T : null
}

async function runRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const { data, error } = await requireSupabase().rpc(name, args).abortSignal(controller.signal)
    if (error) {
      if (error.code === '23505') throw new Error('Esta cédula ya está registrada. Utiliza Buscar cliente.')
      throw new Error(error.message)
    }
    return data as T
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La solicitud tardó demasiado. Verifica tu conexión e inténtalo de nuevo.')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function findClient(cedula: string): Promise<Client | null> {
  return firstOrNull<Client>(await runRpc<unknown>('find_client', { p_cedula: normalizeCedula(cedula) }))
}

export async function createClient(cedula: string, name: string, purchaseCount: number): Promise<Client> {
  const client = firstOrNull<Client>(await runRpc<unknown>('create_client', {
    p_cedula: normalizeCedula(cedula), p_name: name.trim(), p_purchase_count: purchaseCount,
  }))
  if (!client) throw new Error('Supabase no devolvió el cliente creado.')
  return client
}

export async function updateClient(cedula: string, name: string, purchaseCount: number): Promise<Client> {
  const client = firstOrNull<Client>(await runRpc<unknown>('update_client', {
    p_cedula: normalizeCedula(cedula), p_name: name.trim(), p_purchase_count: purchaseCount,
  }))
  if (!client) throw new Error('Supabase no devolvió el cliente actualizado.')
  return client
}

export async function getClientHistory(cedula: string): Promise<ClientMovement[]> {
  const data = await runRpc<unknown>('get_client_history', { p_cedula: normalizeCedula(cedula), p_limit: 10 })
  return Array.isArray(data) ? data as ClientMovement[] : []
}

export async function redeemReward(cedula: string): Promise<Client> {
  const client = firstOrNull<Client>(await runRpc<unknown>('redeem_reward', { p_cedula: normalizeCedula(cedula) }))
  if (!client) throw new Error('Supabase no devolvió el cliente actualizado.')
  return client
}
