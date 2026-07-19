import { requireSupabase } from '../lib/supabase'
import type { Client, ClientMovement } from '../types/client'
import { normalizeCedula } from '../utils/cedula'

function firstOrNull<T>(data: unknown): T | null {
  return Array.isArray(data) && data.length > 0 ? data[0] as T : null
}

export async function findClient(cedula: string): Promise<Client | null> {
  const { data, error } = await requireSupabase().rpc('find_client', { p_cedula: normalizeCedula(cedula) })
  if (error) throw new Error(error.message)
  return firstOrNull<Client>(data)
}

export async function saveClient(cedula: string, name: string, purchaseCount: number): Promise<Client> {
  const { data, error } = await requireSupabase().rpc('save_client', {
    p_cedula: normalizeCedula(cedula),
    p_name: name.trim(),
    p_purchase_count: purchaseCount,
  })
  if (error) throw new Error(error.message)
  const client = firstOrNull<Client>(data)
  if (!client) throw new Error('Supabase no devolvió el cliente guardado.')
  return client
}

export async function getClientHistory(cedula: string): Promise<ClientMovement[]> {
  const { data, error } = await requireSupabase().rpc('get_client_history', {
    p_cedula: normalizeCedula(cedula),
    p_limit: 10,
  })
  if (error) throw new Error(error.message)
  return Array.isArray(data) ? data as ClientMovement[] : []
}

export async function redeemReward(cedula: string): Promise<Client> {
  const { data, error } = await requireSupabase().rpc('redeem_reward', { p_cedula: normalizeCedula(cedula) })
  if (error) throw new Error(error.message)
  const client = firstOrNull<Client>(data)
  if (!client) throw new Error('Supabase no devolvió el cliente actualizado.')
  return client
}
