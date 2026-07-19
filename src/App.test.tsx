import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), signInWithPin: vi.fn(), signOut: vi.fn() }))
vi.mock('./lib/supabase', () => ({ isSupabaseConfigured: true }))
vi.mock('./services/auth', () => mocks)
vi.mock('./services/clients', () => ({ createClient: vi.fn(), findClient: vi.fn(), getClientHistory: vi.fn(), redeemReward: vi.fn(), updateClient: vi.fn() }))
vi.mock('./services/dashboard', () => ({ registerPurchase: vi.fn(), getDashboardSummary: vi.fn().mockResolvedValue({}), getDailyPurchases: vi.fn().mockResolvedValue([]), getDashboardActivity: vi.fn().mockResolvedValue([]), getDashboardClients: vi.fn().mockResolvedValue([]) }))
vi.mock('./hooks/useCardExport', () => ({ useCardExport: () => ({ busy: false, imageUrl: null, isIOS: false, canSharePrepared: false, prepareDownload: vi.fn(), prepareShare: vi.fn(), sharePrepared: vi.fn(), closeModal: vi.fn() }) }))
import App from './App'

describe('acceso administrativo', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.getSession.mockResolvedValue(null) })
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
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('PIN incorrecto o acceso no autorizado.'))
  })
})
