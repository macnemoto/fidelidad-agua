import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), signInWithPin: vi.fn(), signOut: vi.fn(),
  createClient: vi.fn(), findClient: vi.fn(), getClientHistory: vi.fn(), redeemReward: vi.fn(), updateClient: vi.fn(), saveClientV2: vi.fn(),
  getDashboardSummary: vi.fn(), getDailyPurchases: vi.fn(), getFinancialSummary: vi.fn(), getDailyFinancials: vi.fn(), getDashboardActivity: vi.fn(), getDashboardClients: vi.fn(),
}))
const toastMocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), loading: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }))
vi.mock('sonner', () => ({ toast: toastMocks }))
vi.mock('./lib/supabase', () => ({ isSupabaseConfigured: true }))
vi.mock('./services/auth', () => mocks)
vi.mock('./services/clients', () => ({ createClient: mocks.createClient, findClient: mocks.findClient, getClientHistory: mocks.getClientHistory, redeemReward: mocks.redeemReward, updateClient: mocks.updateClient, saveClientV2: mocks.saveClientV2 }))
vi.mock('./services/dashboard', () => ({ caracasDate: () => '2026-07-20', getDashboardSummary: mocks.getDashboardSummary, getDailyPurchases: mocks.getDailyPurchases, getFinancialSummary: mocks.getFinancialSummary, getDailyFinancials: mocks.getDailyFinancials, getDashboardActivity: mocks.getDashboardActivity, getDashboardClients: mocks.getDashboardClients }))
vi.mock('./hooks/useCardExport', () => ({ useCardExport: () => ({ busy: false, imageUrl: null, isIOS: false, canSharePrepared: false, prepareDownload: vi.fn(), prepareShare: vi.fn(), sharePrepared: vi.fn(), closeModal: vi.fn() }) }))
import App from './App'

describe('acceso administrativo', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.getSession.mockResolvedValue(null); mocks.getDashboardSummary.mockResolvedValue({}); mocks.getDailyPurchases.mockResolvedValue([]); mocks.getFinancialSummary.mockResolvedValue({}); mocks.getDailyFinancials.mockResolvedValue([]); mocks.getDashboardActivity.mockResolvedValue([]); mocks.getDashboardClients.mockResolvedValue([]); mocks.getClientHistory.mockResolvedValue([])
  })
  it('solicita un PIN de ocho dígitos antes de mostrar el panel', async () => {
    render(<App />)
    expect(await screen.findByText('Introduce el PIN administrativo para continuar.')).toBeInTheDocument()
    const enter = screen.getByRole('button', { name: 'Entrar al panel' })
    expect(enter).toBeDisabled()
    fireEvent.change(screen.getByLabelText('PIN de 8 dígitos'), { target: { value: '12345678' } })
    expect(enter).toBeEnabled()
  })
  it('muestra el error de acceso sin revelar detalles', async () => {
    mocks.signInWithPin.mockRejectedValue(new Error('PIN incorrecto o acceso no autorizado.'))
    render(<App />)
    const pin = await screen.findByLabelText('PIN de 8 dígitos')
    fireEvent.change(pin, { target: { value: '12345678' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar al panel' }))
    await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith('PIN incorrecto o acceso no autorizado.', expect.objectContaining({ id: 'session-operation' })))
  })
})

describe('edición de fidelidad', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.getSession.mockResolvedValue({ user: { id: 'admin' } }); mocks.getDashboardSummary.mockResolvedValue({}); mocks.getDailyPurchases.mockResolvedValue([]); mocks.getFinancialSummary.mockResolvedValue({}); mocks.getDailyFinancials.mockResolvedValue([]); mocks.getDashboardActivity.mockResolvedValue([]); mocks.getClientHistory.mockResolvedValue([])
    mocks.getDashboardClients.mockResolvedValue([{ id: '1', cedula: '12345678', name: 'María Pérez', purchase_count: 9, updated_at: '' }])
    mocks.findClient.mockResolvedValue({ id: '1', cedula: '12345678', name: 'María Pérez', purchase_count: 9, created_at: '', updated_at: '' })
    mocks.saveClientV2.mockResolvedValue({ id: '1', cedula: '12345678', name: 'María Pérez', purchase_count: 10, created_at: '', updated_at: '' })
  })

  it('usa solo las gotas y habilita el canje después de guardar 10 marcas', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nueva compra' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clientes' }))
    fireEvent.click(await screen.findByRole('button', { name: /María Pérez/ }))
    expect(await screen.findByDisplayValue('María Pérez')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Marcar 10 compras' }))
    expect(screen.queryByRole('button', { name: '🎁 Canjear beneficio' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '💾 Guardar cambios' }))
    expect(await screen.findByRole('button', { name: '🎁 Canjear beneficio' })).toBeInTheDocument()
    expect(mocks.saveClientV2).toHaveBeenCalledWith('update', '12345678', 'María Pérez', 10, 9)
    expect(toastMocks.success).toHaveBeenCalledWith('Cambios guardados.', { id: 'client-operation', duration: 4000 })
  })

  it('permite consultar las ganancias de un día con el calendario', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Dashboard' })
    fireEvent.change(screen.getByLabelText('Período'), { target: { value: 'day' } })
    const calendar = await screen.findByLabelText('Día específico')
    fireEvent.change(calendar, { target: { value: '2026-07-19' } })
    await waitFor(() => expect(mocks.getFinancialSummary).toHaveBeenLastCalledWith({ mode: 'day', date: '2026-07-19' }))
  })
})
