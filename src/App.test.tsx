import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  findClient: vi.fn(),
  getClientHistory: vi.fn(),
  redeemReward: vi.fn(),
  updateClient: vi.fn(),
}))

vi.mock('./lib/supabase', () => ({ isSupabaseConfigured: true }))
vi.mock('./services/clients', () => mocks)
vi.mock('./hooks/useCardExport', () => ({ useCardExport: () => ({ busy: false, imageUrl: null, isIOS: false, canSharePrepared: false, prepareDownload: vi.fn(), prepareShare: vi.fn(), sharePrepared: vi.fn(), closeModal: vi.fn() }) }))

import App from './App'

describe('flujo de clientes', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.getClientHistory.mockResolvedValue([]) })

  it('crea un cliente con nombre, cédula y fidelidad', async () => {
    mocks.createClient.mockResolvedValue({ id: '1', cedula: '12345678', name: 'María Pérez', purchase_count: 3, created_at: '', updated_at: '' })
    render(<App />)
    fireEvent.change(screen.getByLabelText('Cédula venezolana'), { target: { value: '12345678' } })
    fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'María Pérez' } })
    fireEvent.click(screen.getByRole('button', { name: 'Marcar 3 compras' }))
    fireEvent.click(screen.getByRole('button', { name: '➕ Guardar nuevo cliente' }))
    await waitFor(() => expect(mocks.createClient).toHaveBeenCalledWith('12345678', 'María Pérez', 3))
    expect(await screen.findByText('Cliente creado correctamente.')).toBeInTheDocument()
    expect(screen.getByDisplayValue('María Pérez')).toBeInTheDocument()
  })

  it('busca, carga y actualiza un cliente sin editar su cédula', async () => {
    mocks.findClient.mockResolvedValue({ id: '1', cedula: '12345678', name: 'María Pérez', purchase_count: 6, created_at: '', updated_at: '' })
    mocks.updateClient.mockResolvedValue({ id: '1', cedula: '12345678', name: 'María P.', purchase_count: 7, created_at: '', updated_at: '' })
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: 'Buscar cliente' }))
    fireEvent.change(screen.getByLabelText('Cédula venezolana'), { target: { value: '12345678' } })
    fireEvent.click(screen.getByRole('button', { name: '🔎 Buscar cliente' }))
    expect(await screen.findByDisplayValue('María Pérez')).toBeInTheDocument()
    expect(screen.getByLabelText('Cédula', { exact: true })).toHaveAttribute('readonly')
    fireEvent.change(screen.getByDisplayValue('María Pérez'), { target: { value: 'María P.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Marcar 7 compras' }))
    fireEvent.click(screen.getByRole('button', { name: '💾 Guardar cambios' }))
    await waitFor(() => expect(mocks.updateClient).toHaveBeenCalledWith('12345678', 'María P.', 7))
  })
})
