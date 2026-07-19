import { forwardRef } from 'react'
import { formatCedula } from '../utils/cedula'

interface LoyaltyCardProps {
  name: string
  cedula: string
  purchaseCount: number
  onSelectCount: (count: number) => void
}

function WaterDrop({ gold = false }: { gold?: boolean }) {
  return (
    <svg className="stamp-icon" viewBox="0 0 24 24" fill={gold ? '#d4af37' : '#00b4d8'} aria-hidden="true">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </svg>
  )
}

export const LoyaltyCard = forwardRef<HTMLDivElement, LoyaltyCardProps>(
  ({ name, cedula, purchaseCount, onSelectCount }, ref) => (
    <div className="card-container" id="loyalty-card" ref={ref}>
      <header className="card-header">
        <div className="brand-logo">💧 Tarjeta de Fidelidad</div>
      </header>

      <div className="card-body">
        <div className="client-summary" aria-label="Datos del titular">
          <div className="client-data">
            <span className="client-data-label">Nombre:</span>
            <strong className="client-data-value">{name.trim() || 'Pendiente'}</strong>
          </div>
          <div className="client-data">
            <span className="client-data-label">Cédula:</span>
            <strong className="client-data-value">{cedula ? `V-${formatCedula(cedula)}` : 'V- Pendiente'}</strong>
          </div>
        </div>

        <div className="grid-container" aria-label={`${purchaseCount} de 10 compras`}>
          {Array.from({ length: 10 }, (_, index) => {
            const number = index + 1
            const checked = number <= purchaseCount
            const reward = number === 10
            return (
              <button
                className={`stamp-box${checked ? ' checked' : ''}${reward ? ' gold-reward' : ''}`}
                key={number}
                type="button"
                aria-label={`Marcar ${number} compras`}
                aria-pressed={checked}
                onClick={() => onSelectCount(number)}
              >
                <span className="stamp-number">{number}</span>
                <WaterDrop gold={reward} />
              </button>
            )
          })}
        </div>
      </div>

      <footer className="card-footer">
        <div className="reward-message">
          Al completar 9 compras, en tu compra N.º 10 se descuenta del total el valor de <strong>un (1) tanque de agua</strong>.
        </div>
      </footer>
    </div>
  ),
)

LoyaltyCard.displayName = 'LoyaltyCard'
