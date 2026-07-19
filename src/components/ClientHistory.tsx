import type { ClientMovement, MovementAction } from '../types/client'

const actionLabels: Record<MovementAction, string> = {
  created: 'Cliente creado',
  purchase_registered: 'Venta registrada',
  progress_updated: 'Progreso actualizado',
  profile_updated: 'Nombre actualizado',
  reward_redeemed: 'Beneficio canjeado',
}

export function ClientHistory({ movements }: { movements: ClientMovement[] }) {
  return (
    <section className="history-panel" aria-labelledby="history-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Auditoría</span>
          <h2 id="history-title">Últimos movimientos</h2>
        </div>
        <span className="history-count">{movements.length}/10</span>
      </div>

      {movements.length === 0 ? (
        <p className="empty-state">Este cliente todavía no tiene movimientos registrados.</p>
      ) : (
        <ol className="history-list">
          {movements.map((movement) => (
            <li key={movement.id}>
              <div>
                <strong>{actionLabels[movement.action]}</strong>
                <time dateTime={movement.created_at}>
                  {new Intl.DateTimeFormat('es-VE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(movement.created_at))}
                </time>
              </div>
              <span className="movement-change">{movement.previous_count} → {movement.new_count}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
