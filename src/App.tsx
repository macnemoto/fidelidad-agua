import { useCallback, useRef, useState } from 'react'
import { ClientHistory } from './components/ClientHistory'
import { LoyaltyCard } from './components/LoyaltyCard'
import { ShareModal } from './components/ShareModal'
import { useCardExport } from './hooks/useCardExport'
import { isSupabaseConfigured } from './lib/supabase'
import { createClient, findClient, getClientHistory, redeemReward, updateClient } from './services/clients'
import type { Client, ClientMovement } from './types/client'
import { formatCedula, isValidCedula, normalizeCedula } from './utils/cedula'

type Tab = 'create' | 'search'
type RequestState = 'idle' | 'creating' | 'searching' | 'updating' | 'redeeming'
type MessageKind = 'error' | 'success' | 'info'

interface Message {
  kind: MessageKind
  text: string
}

function validateClient(name: string, cedula: string): string | null {
  if (!name.trim()) return 'Escribe el nombre completo del cliente.'
  if (!isValidCedula(cedula)) return 'La cédula debe tener entre 5 y 8 números.'
  return null
}

export default function App() {
  const [tab, setTab] = useState<Tab>('create')
  const [createName, setCreateName] = useState('')
  const [createCedula, setCreateCedula] = useState('')
  const [createCount, setCreateCount] = useState(0)
  const [searchCedula, setSearchCedula] = useState('')
  const [client, setClient] = useState<Client | null>(null)
  const [editName, setEditName] = useState('')
  const [editCount, setEditCount] = useState(0)
  const [history, setHistory] = useState<ClientMovement[]>([])
  const [requestState, setRequestState] = useState<RequestState>('idle')
  const [message, setMessage] = useState<Message | null>(
    isSupabaseConfigured ? null : { kind: 'info', text: 'Configura Supabase para habilitar búsqueda y guardado. La tarjeta y exportación siguen disponibles.' },
  )
  const cardRef = useRef<HTMLDivElement>(null)

  const busy = requestState !== 'idle'
  const cardName = tab === 'create' ? createName : editName
  const cardCedula = tab === 'create' ? createCedula : client?.cedula ?? searchCedula
  const cardCount = tab === 'create' ? createCount : editCount

  const validateCard = useCallback(() => {
    const validationError = validateClient(cardName, cardCedula)
    if (validationError) setMessage({ kind: 'error', text: validationError })
    return !validationError
  }, [cardCedula, cardName])

  const exporter = useCardExport(cardRef, cardName, validateCard)

  const loadHistory = useCallback(async (cedula: string) => {
    setHistory(await getClientHistory(cedula))
  }, [])

  const switchTab = (nextTab: Tab) => {
    if (busy) return
    setTab(nextTab)
    setMessage(null)
  }

  const handleCreate = async () => {
    const validationError = validateClient(createName, createCedula)
    if (validationError) {
      setMessage({ kind: 'error', text: validationError })
      return
    }

    setRequestState('creating')
    setMessage({ kind: 'info', text: 'Guardando nuevo cliente…' })
    try {
      const created = await createClient(createCedula, createName, createCount)
      setClient(created)
      setEditName(created.name)
      setEditCount(created.purchase_count)
      setSearchCedula(created.cedula)
      await loadHistory(created.cedula)
      setTab('search')
      setMessage({ kind: 'success', text: 'Cliente creado correctamente.' })
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'No se pudo crear el cliente.' })
    } finally {
      setRequestState('idle')
    }
  }

  const handleSearch = async (event?: React.FormEvent) => {
    event?.preventDefault()
    if (!isSupabaseConfigured) {
      setMessage({ kind: 'error', text: 'Supabase no está configurado en este ambiente.' })
      return
    }
    if (!isValidCedula(searchCedula)) {
      setMessage({ kind: 'error', text: 'Escribe una cédula de entre 5 y 8 números.' })
      return
    }

    setRequestState('searching')
    setMessage({ kind: 'info', text: 'Buscando cliente…' })
    try {
      const found = await findClient(searchCedula)
      if (!found) {
        setClient(null)
        setEditName('')
        setEditCount(0)
        setHistory([])
        setMessage({ kind: 'info', text: `No hay registro para V-${formatCedula(searchCedula)}.` })
        return
      }

      setClient(found)
      setEditName(found.name)
      setEditCount(found.purchase_count)
      await loadHistory(found.cedula)
      setMessage({ kind: 'success', text: 'Cliente encontrado y cargado.' })
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'No se pudo buscar el cliente.' })
    } finally {
      setRequestState('idle')
    }
  }

  const prepareCreateFromSearch = () => {
    setCreateCedula(searchCedula)
    setCreateName('')
    setCreateCount(0)
    setTab('create')
    setMessage({ kind: 'info', text: `Completa los datos para registrar V-${formatCedula(searchCedula)}.` })
  }

  const handleUpdate = async () => {
    if (!client) return
    const validationError = validateClient(editName, client.cedula)
    if (validationError) {
      setMessage({ kind: 'error', text: validationError })
      return
    }

    setRequestState('updating')
    setMessage({ kind: 'info', text: 'Guardando cambios…' })
    try {
      const updated = await updateClient(client.cedula, editName, editCount)
      setClient(updated)
      setEditName(updated.name)
      setEditCount(updated.purchase_count)
      await loadHistory(updated.cedula)
      setMessage({ kind: 'success', text: 'Cambios guardados correctamente.' })
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'No se pudieron guardar los cambios.' })
    } finally {
      setRequestState('idle')
    }
  }

  const handleRedeem = async () => {
    if (!client || editCount !== 10) return
    if (!window.confirm('¿Confirmas que se aplicó el descuento de un (1) tanque y deseas reiniciar el progreso a 0?')) return

    setRequestState('redeeming')
    setMessage({ kind: 'info', text: 'Registrando el canje…' })
    try {
      const updated = await redeemReward(client.cedula)
      setClient(updated)
      setEditCount(updated.purchase_count)
      await loadHistory(updated.cedula)
      setMessage({ kind: 'success', text: 'Beneficio canjeado y progreso reiniciado a 0.' })
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'No se pudo canjear el beneficio.' })
    } finally {
      setRequestState('idle')
    }
  }

  const clearForm = () => {
    if (busy) return
    setCreateName('')
    setCreateCedula('')
    setCreateCount(0)
    setSearchCedula('')
    setClient(null)
    setEditName('')
    setEditCount(0)
    setHistory([])
    setTab('create')
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
        <p>Registra clientes, actualiza sus compras y comparte su tarjeta.</p>
      </div>

      <div className="client-tabs" role="tablist" aria-label="Operación de clientes">
        <button className={tab === 'create' ? 'active' : ''} role="tab" aria-selected={tab === 'create'} onClick={() => switchTab('create')} disabled={busy}>Nuevo cliente</button>
        <button className={tab === 'search' ? 'active' : ''} role="tab" aria-selected={tab === 'search'} onClick={() => switchTab('search')} disabled={busy}>Buscar cliente</button>
      </div>

      {message && <p className={`status global-status ${message.kind}`} role="status">{message.text}</p>}

      <div className="workspace">
        <section className="admin-panel" aria-label={tab === 'create' ? 'Nuevo cliente' : 'Buscar y editar cliente'} aria-busy={busy}>
          {tab === 'create' ? (
            <>
              <div className="section-heading compact"><h2>Nuevo cliente</h2><span className="record-badge new">Registro nuevo</span></div>
              <label htmlFor="create-cedula">Cédula venezolana</label>
              <div className="id-input"><span>V-</span><input id="create-cedula" inputMode="numeric" value={formatCedula(createCedula)} placeholder="12.345.678" disabled={busy} onChange={(event) => setCreateCedula(normalizeCedula(event.target.value))} /></div>
              <label htmlFor="create-name">Nombre completo</label>
              <input id="create-name" value={createName} maxLength={60} placeholder="Escribe el nombre" disabled={busy} onChange={(event) => setCreateName(event.target.value)} />
              <div className="progress-summary"><span>Fidelidad inicial</span><strong>{createCount}/10</strong></div>
              <button className="btn btn-save" type="button" disabled={busy || !isSupabaseConfigured} onClick={() => void handleCreate()}>{requestState === 'creating' ? 'Guardando…' : '➕ Guardar nuevo cliente'}</button>
            </>
          ) : (
            <>
              <div className="section-heading compact"><h2>Buscar cliente</h2><span className="record-badge found">Base de datos</span></div>
              <form onSubmit={(event) => void handleSearch(event)}>
                <label htmlFor="search-cedula">Cédula venezolana</label>
                <div className="id-input"><span>V-</span><input id="search-cedula" inputMode="numeric" value={formatCedula(searchCedula)} placeholder="12.345.678" disabled={busy} onChange={(event) => { setSearchCedula(normalizeCedula(event.target.value)); setClient(null); setHistory([]) }} /></div>
                <button className="btn btn-search" type="submit" disabled={busy || !isSupabaseConfigured}>{requestState === 'searching' ? 'Buscando…' : '🔎 Buscar cliente'}</button>
              </form>

              {!client && isValidCedula(searchCedula) && requestState === 'idle' && message?.text.startsWith('No hay registro') && (
                <button className="btn btn-secondary" type="button" onClick={prepareCreateFromSearch}>➕ Crear este cliente</button>
              )}

              {client && (
                <div className="edit-client-form">
                  <label htmlFor="edit-cedula">Cédula</label>
                  <div className="id-input readonly"><span>V-</span><input id="edit-cedula" value={formatCedula(client.cedula)} readOnly aria-readonly="true" /></div>
                  <label htmlFor="edit-name">Nombre completo</label>
                  <input id="edit-name" value={editName} maxLength={60} placeholder="Escribe el nombre" disabled={busy} onChange={(event) => setEditName(event.target.value)} />
                  <div className="progress-summary"><span>Fidelidad actual</span><strong>{editCount}/10</strong></div>
                  <button className="btn btn-save" type="button" disabled={busy} onClick={() => void handleUpdate()}>{requestState === 'updating' ? 'Guardando…' : '💾 Guardar cambios'}</button>
                  {editCount === 10 && <button className="btn btn-redeem" type="button" disabled={busy} onClick={() => void handleRedeem()}>{requestState === 'redeeming' ? 'Canjeando…' : '🎁 Canjear beneficio'}</button>}
                </div>
              )}
            </>
          )}
        </section>

        <LoyaltyCard ref={cardRef} name={cardName} cedula={cardCedula} purchaseCount={cardCount} onSelectCount={(count) => {
          if (busy) return
          if (tab === 'create') setCreateCount(count)
          else if (client) setEditCount(count)
        }} />
      </div>

      <div className="control-panel">
        <button className="btn btn-whatsapp" disabled={exporter.busy} onClick={() => void runExport(exporter.prepareShare)}>📤 Compartir imagen</button>
        <button className="btn btn-download" disabled={exporter.busy} onClick={() => void runExport(exporter.prepareDownload)}>📥 Descargar imagen</button>
        <button className="btn btn-reset" disabled={busy || exporter.busy} onClick={clearForm}>🧹 Limpiar formulario</button>
      </div>

      {tab === 'search' && client && <ClientHistory movements={history} />}
      <ShareModal imageUrl={exporter.imageUrl} canShare={exporter.canSharePrepared} isIOS={exporter.isIOS} onShare={() => void runExport(exporter.sharePrepared)} onClose={exporter.closeModal} />
    </main>
  )
}
