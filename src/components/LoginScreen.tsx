import { useState } from 'react'

export function LoginScreen({ onSubmit, busy, error }: { onSubmit: (pin: string) => void; busy: boolean; error: string | null }) {
  const [pin, setPin] = useState('')
  return <main className="login-shell"><section className="login-card" aria-labelledby="login-title">
    <span className="eyebrow">Acceso privado</span><h1 id="login-title">Control de fidelidad</h1>
    <p>Introduce el PIN administrativo para continuar.</p>
    <form onSubmit={(event) => { event.preventDefault(); onSubmit(pin) }}>
      <label htmlFor="admin-pin">PIN de 8 dígitos</label>
      <input id="admin-pin" inputMode="numeric" autoComplete="current-password" type="password" maxLength={8} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))} placeholder="••••••••" disabled={busy} />
      {error && <p className="status error" role="alert">{error}</p>}
      <button className="btn btn-save" type="submit" disabled={busy || pin.length !== 8}>{busy ? 'Verificando…' : 'Entrar al panel'}</button>
    </form>
  </section></main>
}
