import { useCallback, useRef, useState } from 'react'
import { ClientHistory } from './components/ClientHistory'
import { LoyaltyCard } from './components/LoyaltyCard'
import { ShareModal } from './components/ShareModal'
import { useCardExport } from './hooks/useCardExport'
import { isSupabaseConfigured } from './lib/supabase'
import { findClient, getClientHistory, redeemReward, saveClient } from './services/clients'
import type { Client, ClientMovement } from './types/client'
import { formatCedula, isValidCedula, normalizeCedula } from './utils/cedula'

type ClientMode = 'idle' | 'searching' | 'not_found' | 'loaded' | 'saving' | 'redeeming'
type MessageKind = 'error' | 'success' | 'info'

interface Message {
  kind: MessageKind
  text: string
}

export default function App() {
  const [name, setName] = useState('')
  const [cedula, setCedula] = useState('')
  const [searchedCedula, setSearchedCedula] = useState<string | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [purchaseCount, setPurchaseCount] = useState(0)
  const [history, setHistory] = useState<ClientMovement[]>([])
  const [mode, setMode] = useState<ClientMode>('idle')
  const [message, setMessage] = useState<Message | null>(
    isSupabaseConfigured ? null : { kind: 'info', text: 'Configura Supabase para habilitar búsqueda y guardado. La tarjeta y exportación siguen disponibles.' },
  )
  const cardRef = useRef<HTMLDivElement>(null)

  const dbBusy = mode === 'searching' || mode === 'saving' || mode === 'redeeming'
  const recordReady = searchedCedula === cedula && (mode === 'loaded' || mode === 'not_found')

  const validateCard = useCallback(() => {
    if (!name.trim()) {
      setMessage({ kind: 'error', text: 'Escribe el nombre completo del cliente.' })
      return false
    }
    if (!isValidCedula(cedula)) {
      setMessage({ kind: 'error', text: 'La cédula debe tener entre 5 y 8 números.' })
      return false
    }
    return true
  }, [cedula, name])

  const exporter = useCardExport(cardRef, name, validateCard)

  const loadHistory = useCallback(async (clientCedula: string) => {
    const movements = await getClientHistory(clientCedula)
    setHistory(movements)
  }, [])

  const handleCedulaChange = (value: string) => {
    const normalized = normalizeCedula(value)
    setCedula(normalized)
    if (normalized !== searchedCedula) {
      setSearchedCedula(null)
      setClient(null)
      setName('')
      setPurchaseCount(0)
      setHistory([])
      setMode('idle')
      setMessage(null)
    }
  }

  const handleSearch = async (event?: React.FormEvent) => {
    event?.preventDefault()
    if (!isSupabaseConfigured) {
      setMessage({ kind: 'error', text: 'Supabase no está configurado en este ambiente.' })
      return
    }
    if (!isValidCedula(cedula)) {
      setMessage({ kind: 'error', text: 'Escribe una cédula de entre 5 y 8 números.' })
      return
    }

    setMode('searching')
    setMessage({ kind: 'info', text: 'Buscando cliente…' })
    try {
      const found = await findClient(cedula)
      setSearchedCedula(cedula)
      if (!found) {
        setClient(null)
        setName('')
        setPurchaseCount(0)
        setHistory([])
        setMode('not_found')
        setMessage({ kind: 'info', text: `No hay registro para V-${formatCedula(cedula)}. Completa el nombre para crearlo.` })
        return
      }

      setClient(found)
      setName(found.name)
      setPurchaseCount(found.purchase_count)
      setMode('loaded')
      setMessage({ kind: 'success', text: 'Cliente encontrado y cargado.' })
      await loadHistory(found.cedula)
    } catch (error) {
      setMode('idle')
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'No se pudo buscar el cliente.' })
    }
  }

  const handleSave = async () => {
    if (!recordReady) {
      setMessage({ kind: 'error', text: 'Busca primero la cédula antes de guardar.' })
      return
    }
    if (!validateCard()) return

    setMode('saving')
    setMessage({ kind: 'info', text: 'Guardando cliente…' })
    try {
      const saved = await saveClient(cedula, name, purchaseCount)
      setClient(saved)
      setName(saved.name)
      setPurchaseCount(saved.purchase_count)
      setSearchedCedula(saved.cedula)
      setMode('loaded')
      setMessage({ kind: 'success', text: client ? 'Cambios guardados correctamente.' : 'Cliente creado correctamente.' })
      await loadHistory(saved.cedula)
    } catch (error) {
      setMode(client ? 'loaded' : 'not_found')
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'No se pudo guardar el cliente.' })
    }
  }

  const handleRedeem = async () => {
    if (!client || purchaseCount !== 10) return
    if (!window.confirm('¿Confirmas que se aplicó el descuento de un (1) tanque y deseas reiniciar el progreso a 0?')) return

    setMode('redeeming')
    setMessage({ kind: 'info', text: 'Registrando el canje…' })
    try {
      const updated = await redeemReward(client.cedula)
      setClient(updated)
      setPurchaseCount(updated.purchase_count)
      setMode('loaded')
      setMessage({ kind: 'success', text: 'Beneficio canjeado y progreso reiniciado a 0.' })
      await loadHistory(updated.cedula)
    } catch (error) {
      setMode('loaded')
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'No se pudo canjear el beneficio.' })
    }
  }

  const clearForm = () => {
    setName('')
    setCedula('')
    setSearchedCedula(null)
    setClient(null)
    setPurchaseCount(0)
    setHistory([])
    setMode('idle')
    setMessage(isSupabaseConfigured ? null : { kind: 'info', text: 'Configura Supabase para habilitar búsqueda y guardado. La tarjeta y exportación siguen disponibles.' })
    exporter.closeModal()
  }

  const runExport = async (action: () => Promise<void>) => {
    try {
      await action()
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'No se pudo generar la imagen.' })
    }
  }

  return (
    <main className="app-shell">
      <div className="page-heading">
        <span className="eyebrow">Panel administrativo</span>
        <h1>Control de fidelidad</h1>
        <p>Busca por cédula, actualiza las compras y comparte la tarjeta con el cliente.</p>
      </div>

      <section className="search-panel" aria-labelledby="search-title">
        <div>
          <span className="eyebrow">Supabase</span>
          <h2 id="search-title">Buscar cliente</h2>
        </div>
        <form className="search-form" onSubmit={(event) => void handleSearch(event)}>
          <div className="id-input search-input">
            <span>V-</span>
            <input
              aria-label="Cédula del cliente"
              inputMode="numeric"
              value={formatCedula(cedula)}
              placeholder="12.345.678"
              onChange={(event) => handleCedulaChange(event.target.value)}
            />
          </div>
          <button className="btn btn-search" type="submit" disabled={dbBusy || !isSupabaseConfigured}>
            {mode === 'searching' ? 'Buscando…' : '🔎 Buscar'}
          </button>
        </form>
      </section>

      {message && <p className={`status global-status ${message.kind}`} role="status">{message.text}</p>}

      <div className="workspace">
        <section className="admin-panel" aria-label="Datos del cliente">
          <div className="section-heading compact">
            <h2>{client ? 'Cliente registrado' : 'Nuevo cliente'}</h2>
            {recordReady && <span className={`record-badge ${client ? 'found' : 'new'}`}>{client ? 'Encontrado' : 'Sin registro'}</span>}
          </div>

          <label htmlFor="client-name">Nombre completo</label>
          <input
            id="client-name"
            value={name}
            maxLength={60}
            placeholder="Escribe el nombre"
            disabled={!recordReady || dbBusy}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="progress-summary"><span>Compras acumuladas</span><strong>{purchaseCount}/10</strong></div>

          <button className="btn btn-save" type="button" disabled={!recordReady || dbBusy} onClick={() => void handleSave()}>
            {mode === 'saving' ? 'Guardando…' : client ? '💾 Guardar cambios' : '➕ Crear cliente'}
          </button>
          {client && purchaseCount === 10 && (
            <button className="btn btn-redeem" type="button" disabled={dbBusy} onClick={() => void handleRedeem()}>
              {mode === 'redeeming' ? 'Canjeando…' : '🎁 Canjear beneficio'}
            </button>
          )}
        </section>

        <LoyaltyCard
          ref={cardRef}
          name={name}
          cedula={cedula}
          purchaseCount={purchaseCount}
          onSelectCount={(count) => recordReady && !dbBusy && setPurchaseCount(count)}
        />
      </div>

      <div className="control-panel">
        <button className="btn btn-whatsapp" disabled={exporter.busy} onClick={() => void runExport(exporter.prepareShare)}>📤 Compartir imagen</button>
        <button className="btn btn-download" disabled={exporter.busy} onClick={() => void runExport(exporter.prepareDownload)}>📥 Descargar imagen</button>
        <button className="btn btn-reset" disabled={dbBusy || exporter.busy} onClick={clearForm}>🧹 Limpiar formulario</button>
      </div>

      {recordReady && <ClientHistory movements={history} />}

      <ShareModal
        imageUrl={exporter.imageUrl}
        canShare={exporter.canSharePrepared}
        isIOS={exporter.isIOS}
        onShare={() => void runExport(exporter.sharePrepared)}
        onClose={exporter.closeModal}
      />
    </main>
  )
}
