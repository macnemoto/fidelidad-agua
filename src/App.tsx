import { useCallback, useRef, useState } from 'react'
import { LoyaltyCard } from './components/LoyaltyCard'
import { ShareModal } from './components/ShareModal'
import { useCardExport } from './hooks/useCardExport'
import { formatCedula, isValidCedula, normalizeCedula } from './utils/cedula'

export default function App() {
  const [name, setName] = useState('')
  const [cedula, setCedula] = useState('')
  const [purchaseCount, setPurchaseCount] = useState(0)
  const [message, setMessage] = useState('')
  const cardRef = useRef<HTMLDivElement>(null)

  const validate = useCallback(() => {
    if (!name.trim()) {
      setMessage('Escribe el nombre completo del cliente.')
      return false
    }
    if (!isValidCedula(cedula)) {
      setMessage('La cédula debe tener entre 5 y 8 números.')
      return false
    }
    setMessage('')
    return true
  }, [cedula, name])

  const exporter = useCardExport(cardRef, name, validate)

  const clearForm = () => {
    setName('')
    setCedula('')
    setPurchaseCount(0)
    setMessage('')
    exporter.closeModal()
  }

  return (
    <main className="app-shell">
      <div className="page-heading">
        <span className="eyebrow">Panel administrativo</span>
        <h1>Control de fidelidad</h1>
        <p>Completa los datos, actualiza las compras y comparte la tarjeta con el cliente.</p>
      </div>

      <div className="workspace">
        <section className="admin-panel" aria-label="Datos del cliente">
          <h2>Datos del cliente</h2>
          <label htmlFor="client-name">Nombre completo</label>
          <input id="client-name" value={name} maxLength={60} placeholder="Escribe el nombre" onChange={(event) => setName(event.target.value)} />
          <label htmlFor="client-id">Cédula venezolana</label>
          <div className="id-input">
            <span>V-</span>
            <input id="client-id" inputMode="numeric" value={formatCedula(cedula)} placeholder="12.345.678" onChange={(event) => setCedula(normalizeCedula(event.target.value))} />
          </div>
          {message && <p className="status error" role="alert">{message}</p>}
          <div className="progress-summary"><span>Compras acumuladas</span><strong>{purchaseCount}/10</strong></div>
        </section>

        <LoyaltyCard ref={cardRef} name={name} cedula={cedula} purchaseCount={purchaseCount} onSelectCount={setPurchaseCount} />
      </div>

      <div className="control-panel">
        <button className="btn btn-whatsapp" disabled={exporter.busy} onClick={() => void exporter.prepareShare()}>📤 Compartir imagen</button>
        <button className="btn btn-download" disabled={exporter.busy} onClick={() => void exporter.prepareDownload()}>📥 Descargar imagen</button>
        <button className="btn btn-reset" disabled={exporter.busy} onClick={clearForm}>🧹 Limpiar formulario</button>
      </div>

      <ShareModal imageUrl={exporter.imageUrl} canShare={exporter.canSharePrepared} isIOS={exporter.isIOS} onShare={() => void exporter.sharePrepared()} onClose={exporter.closeModal} />
    </main>
  )
}
