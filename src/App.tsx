import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ClientDirectory } from './components/ClientDirectory'
import { ClientHistory } from './components/ClientHistory'
import { Dashboard } from './components/Dashboard'
import { LoginScreen } from './components/LoginScreen'
import { LoyaltyCard } from './components/LoyaltyCard'
import { ShareModal } from './components/ShareModal'
import { signInWithPin, getSession, signOut } from './services/auth'
import { createClient, findClient, getClientHistory, redeemReward, updateClient } from './services/clients'
import { useCardExport } from './hooks/useCardExport'
import { isSupabaseConfigured } from './lib/supabase'
import type { Client, ClientMovement } from './types/client'
import { formatCedula, isValidCedula, normalizeCedula } from './utils/cedula'

type View = 'dashboard' | 'clients'
type Mode = 'create' | 'search'
type Message = { kind: 'error' | 'success' | 'info'; text: string }

const validate = (name: string, cedula: string) => !name.trim() ? 'Escribe el nombre completo del cliente.' : !isValidCedula(cedula) ? 'La cédula debe tener entre 5 y 8 números.' : null

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [view, setView] = useState<View>('dashboard')
  const [mode, setMode] = useState<Mode>('search')
  const [createName, setCreateName] = useState(''); const [createCedula, setCreateCedula] = useState(''); const [createCount, setCreateCount] = useState(0)
  const [searchCedula, setSearchCedula] = useState(''); const [client, setClient] = useState<Client | null>(null); const [editName, setEditName] = useState(''); const [editCount, setEditCount] = useState(0); const [history, setHistory] = useState<ClientMovement[]>([])
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState<Message | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (!isSupabaseConfigured) { setSession(null); return } getSession().then(setSession).catch(() => setSession(null)) }, [])
  const login = async (pin: string) => { setBusy(true); setLoginError(null); try { setSession(await signInWithPin(pin)) } catch (error) { setLoginError(error instanceof Error ? error.message : 'No se pudo iniciar sesión.') } finally { setBusy(false) } }
  const loadHistory = useCallback(async (cedula: string) => setHistory(await getClientHistory(cedula)), [])
  const loadClient = useCallback(async (cedula: string) => { const found = await findClient(cedula); if (!found) { setClient(null); setHistory([]); setMessage({ kind: 'info', text: `No hay registro para V-${formatCedula(cedula)}.` }); return null } setClient(found); setEditName(found.name); setEditCount(found.purchase_count); setSearchCedula(found.cedula); await loadHistory(found.cedula); return found }, [loadHistory])
  const selectClient = (cedula: string) => { setView('clients'); setMode('search'); setBusy(true); setMessage({ kind: 'info', text: 'Cargando cliente…' }); void loadClient(cedula).then(() => setMessage(null)).catch((error) => setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'No se pudo cargar el cliente.' })).finally(() => setBusy(false)) }
  const saveCreate = async () => { const error = validate(createName, createCedula); if (error) { setMessage({ kind: 'error', text: error }); return } setBusy(true); try { const saved = await createClient(createCedula, createName, createCount); setClient(saved); setEditName(saved.name); setEditCount(saved.purchase_count); await loadHistory(saved.cedula); setMode('search'); setSearchCedula(saved.cedula); setMessage({ kind: 'success', text: 'Cliente creado correctamente.' }) } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'No se pudo crear el cliente.' }) } finally { setBusy(false) } }
  const saveEdit = async () => { if (!client) return; const error = validate(editName, client.cedula); if (error) { setMessage({ kind: 'error', text: error }); return } setBusy(true); try { const saved = await updateClient(client.cedula, editName, editCount); setClient(saved); setEditName(saved.name); setEditCount(saved.purchase_count); await loadHistory(saved.cedula); setMessage({ kind: 'success', text: 'Cambios guardados.' }) } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'No se pudo guardar.' }) } finally { setBusy(false) } }
  const redeem = async () => { if (!client || editCount !== 10 || !window.confirm('¿Confirmas el canje del descuento de un tanque?')) return; setBusy(true); try { const saved = await redeemReward(client.cedula); setClient(saved); setEditCount(0); await loadHistory(saved.cedula); setMessage({ kind: 'success', text: 'Beneficio canjeado y progreso reiniciado.' }) } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'No se pudo canjear.' }) } finally { setBusy(false) } }
  const cardName = mode === 'create' ? createName : client?.name ?? editName; const cardCedula = mode === 'create' ? createCedula : client?.cedula ?? searchCedula; const cardCount = mode === 'create' ? createCount : editCount
  const exporter = useCardExport(cardRef, cardName, () => { const error = validate(cardName, cardCedula); if (error) setMessage({ kind: 'error', text: error }); return !error })
  const logout = async () => { await signOut(); setSession(null); setClient(null); setHistory([]); setView('dashboard') }
  if (session === undefined) return <main className="login-shell"><p>Comprobando acceso…</p></main>
  if (!session) return <LoginScreen onSubmit={(pin) => void login(pin)} busy={busy} error={loginError ?? (!isSupabaseConfigured ? 'Supabase no está configurado en este ambiente.' : null)} />
  return <main className="app-shell"><header className="app-header"><div><span className="eyebrow">Panel administrativo</span><h1>Control de fidelidad</h1></div><button className="logout" onClick={() => void logout()}>Salir</button></header><nav className="main-nav" aria-label="Navegación principal"><button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>Resumen</button><button className={view === 'clients' ? 'active' : ''} onClick={() => setView('clients')}>Clientes</button></nav>{message && <p className={`status global-status ${message.kind}`} role="status">{message.text}</p>}
    {view === 'dashboard' && <Dashboard onSelectClient={selectClient} />}
    {view === 'clients' && <><ClientDirectory onSelectClient={selectClient} /><div className="client-tabs" role="tablist"><button className={mode === 'search' ? 'active' : ''} onClick={() => setMode('search')}>Buscar y editar</button><button className={mode === 'create' ? 'active' : ''} onClick={() => { setMode('create'); setClient(null); setHistory([]) }}>Nuevo cliente</button></div><div className="workspace"><section className="admin-panel" aria-busy={busy}>{mode === 'create' ? <><h2>Nuevo cliente</h2><CedulaInput id="create-cedula" value={createCedula} onChange={setCreateCedula} /><label htmlFor="create-name">Nombre completo</label><input id="create-name" value={createName} onChange={(e) => setCreateName(e.target.value)} maxLength={60} /><ProgressReadout label="Progreso inicial" value={createCount} /><button className="btn btn-save" disabled={busy} onClick={() => void saveCreate()}>➕ Guardar nuevo cliente</button></> : <><h2>Buscar y editar</h2><CedulaInput id="search-cedula" value={searchCedula} onChange={(value) => { setSearchCedula(value); setClient(null) }} /><button className="btn btn-search" disabled={busy} onClick={() => { setBusy(true); void loadClient(searchCedula).catch((error) => setMessage({ kind: 'error', text: error.message })).finally(() => setBusy(false)) }}>🔎 Buscar cliente</button>{client && <div className="edit-client-form"><label htmlFor="edit-name">Nombre completo</label><input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={60} /><ProgressReadout label="Progreso actual" value={editCount} /><div className="edit-client-actions"><button className="btn btn-save" disabled={busy} onClick={() => void saveEdit()}>💾 Guardar cambios</button>{client.purchase_count === 10 && editCount === 10 && <button className="btn btn-redeem" disabled={busy} onClick={() => void redeem()}>🎁 Canjear beneficio</button>}</div></div>}</>}</section><LoyaltyCard ref={cardRef} name={cardName} cedula={cardCedula} purchaseCount={cardCount} onSelectCount={(count) => { if (mode === 'create') setCreateCount(count); else if (client) setEditCount(count) }} /></div>{client && <ClientHistory movements={history} />}</>}
    {view === 'clients' && <div className="control-panel"><button className="btn btn-whatsapp" disabled={exporter.busy} onClick={() => void exporter.prepareShare()}>📤 Compartir imagen</button><button className="btn btn-download" disabled={exporter.busy} onClick={() => void exporter.prepareDownload()}>📥 Descargar imagen</button></div>}
    <ShareModal imageUrl={exporter.imageUrl} canShare={exporter.canSharePrepared} isIOS={exporter.isIOS} onShare={() => void exporter.sharePrepared()} onClose={exporter.closeModal} />
  </main>
}

function CedulaInput({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) { return <><label htmlFor={id}>Cédula venezolana</label><div className="id-input"><span>V-</span><input id={id} inputMode="numeric" value={formatCedula(value)} placeholder="12.345.678" onChange={(e) => onChange(normalizeCedula(e.target.value))} /></div></> }
function ProgressReadout({ label, value }: { label: string; value: number }) { return <div className="progress-summary"><span>{label}</span><strong>{value}/10</strong></div> }
