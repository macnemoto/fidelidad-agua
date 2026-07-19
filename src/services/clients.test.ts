import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('../lib/supabase', () => ({ requireSupabase: () => ({ rpc }) }))

import { findClient, getClientHistory, saveClient } from './clients'

describe('servicio de clientes', () => {
  beforeEach(() => rpc.mockReset())

  it('devuelve null cuando no existe la cédula', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    await expect(findClient('V-12.345.678')).resolves.toBeNull()
    expect(rpc).toHaveBeenCalledWith('find_client', { p_cedula: '12345678' })
  })

  it('guarda mediante la función transaccional', async () => {
    const client = { id: '1', cedula: '12345678', name: 'María', purchase_count: 4, created_at: '', updated_at: '' }
    rpc.mockResolvedValue({ data: [client], error: null })
    await expect(saveClient('12345678', ' María ', 4)).resolves.toEqual(client)
  })

  it('limita el historial desde el servicio', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    await expect(getClientHistory('12345678')).resolves.toEqual([])
    expect(rpc).toHaveBeenCalledWith('get_client_history', { p_cedula: '12345678', p_limit: 10 })
  })
})
