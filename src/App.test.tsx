import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findClient: vi.fn(),
  saveClient: vi.fn(),
  getClientHistory: vi.fn(),
  redeemReward: vi.fn(),
}))

vi.mock('./lib/supabase', () => ({ isSupabaseConfigured: true }))
vi.mock('./services/clients', () => mocks)
vi.mock('./hooks/useCardExport', () => ({
  useCardExport: () => ({
    busy: false,
    imageUrl: null,
    isIOS: false,
    canSharePrepared: false,
    prepareDownload: vi.fn(),
    prepareShare: vi.fn(),
    sharePrepared: vi.fn(),
    closeModal: vi.fn(),
  }),
}))

import App from './App'

describe('flujo de clientes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getClientHistory.mockResolvedValue([])
  })

  it('habilita la creación cuando la cédula no existe', async () => {
    mocks.findClient.mockResolvedValue(null)
    render(<App />)
    fireEvent.change(screen.getByLabelText('Cédula del cliente'), { target: { value: '12345678' } })
    fireEvent.click(screen.getByRole('button', { name: '🔎 Buscar' }))
    expect(await screen.findByText(/No hay registro para V-12\.345\.678/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '➕ Crear cliente' })).toBeEnabled()
  })

  it('carga un cliente y su progreso', async () => {
    mocks.findClient.mockResolvedValue({ id: '1', cedula: '12345678', name: 'María Pérez', purchase_count: 6, created_at: '', updated_at: '' })
    render(<App />)
    fireEvent.change(screen.getByLabelText('Cédula del cliente'), { target: { value: '12345678' } })
    fireEvent.click(screen.getByRole('button', { name: '🔎 Buscar' }))
    expect(await screen.findByDisplayValue('María Pérez')).toBeInTheDocument()
    expect(screen.getByText('6/10')).toBeInTheDocument()
    await waitFor(() => expect(mocks.getClientHistory).toHaveBeenCalledWith('12345678'))
  })
})
