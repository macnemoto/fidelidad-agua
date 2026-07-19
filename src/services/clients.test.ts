import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('../lib/supabase', () => ({ requireSupabase: () => ({ rpc }) }))

import { createClient, findClient, getClientHistory, updateClient } from './clients'

function mockRpcResponse(response: unknown) {
  rpc.mockReturnValue({ abortSignal: vi.fn().mockResolvedValue(response) })
}

describe('servicio de clientes', () => {
  beforeEach(() => rpc.mockReset())

  it('devuelve null cuando no existe la cédula', async () => {
    mockRpcResponse({ data: [], error: null })
    await expect(findClient('V-12.345.678')).resolves.toBeNull()
    expect(rpc).toHaveBeenCalledWith('admin_find_client', { p_cedula: '12345678' })
  })

  it('crea y actualiza mediante funciones separadas', async () => {
    const client = { id: '1', cedula: '12345678', name: 'María', purchase_count: 4, created_at: '', updated_at: '' }
    mockRpcResponse({ data: [client], error: null })
    await expect(createClient('12345678', ' María ', 4)).resolves.toEqual(client)
    expect(rpc).toHaveBeenLastCalledWith('admin_create_client', { p_cedula: '12345678', p_name: 'María', p_purchase_count: 4 })
    await expect(updateClient('12345678', ' María ', 4)).resolves.toEqual(client)
    expect(rpc).toHaveBeenLastCalledWith('admin_update_client', { p_cedula: '12345678', p_name: 'María', p_purchase_count: 4 })
  })

  it('limita el historial desde el servicio', async () => {
    mockRpcResponse({ data: [], error: null })
    await expect(getClientHistory('12345678')).resolves.toEqual([])
    expect(rpc).toHaveBeenCalledWith('admin_get_client_history', { p_cedula: '12345678', p_limit: 10 })
  })
})
