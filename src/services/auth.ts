import type { Session } from '@supabase/supabase-js'
import { requireSupabase } from '../lib/supabase'

const adminEmail = import.meta.env.VITE_ADMIN_EMAIL?.trim()

export async function signInWithPin(pin: string): Promise<Session> {
  if (!adminEmail) throw new Error('Falta configurar VITE_ADMIN_EMAIL para el acceso administrativo.')
  const { data, error } = await requireSupabase().auth.signInWithPassword({ email: adminEmail, password: pin })
  if (error || !data.session) throw new Error('PIN incorrecto o acceso no autorizado.')
  return data.session
}

export async function getSession(): Promise<Session | null> {
  const { data } = await requireSupabase().auth.getSession()
  return data.session
}

export async function signOut(): Promise<void> {
  const { error } = await requireSupabase().auth.signOut()
  if (error) throw new Error(error.message)
}
