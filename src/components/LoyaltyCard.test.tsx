import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LoyaltyCard } from './LoyaltyCard'

describe('selección de gotas', () => {
  it('permite quitar la única gota y volver el progreso a cero', () => {
    const onSelectCount = vi.fn()
    render(<LoyaltyCard name="María" cedula="12345678" purchaseCount={1} onSelectCount={onSelectCount} />)

    fireEvent.click(screen.getByRole('button', { name: 'Marcar 1 compras' }))

    expect(onSelectCount).toHaveBeenCalledWith(0)
  })

  it('reduce una posición al tocar la última gota marcada', () => {
    const onSelectCount = vi.fn()
    render(<LoyaltyCard name="María" cedula="12345678" purchaseCount={5} onSelectCount={onSelectCount} />)

    fireEvent.click(screen.getByRole('button', { name: 'Marcar 5 compras' }))
    fireEvent.click(screen.getByRole('button', { name: 'Marcar 2 compras' }))

    expect(onSelectCount).toHaveBeenNthCalledWith(1, 4)
    expect(onSelectCount).toHaveBeenNthCalledWith(2, 2)
  })
})
