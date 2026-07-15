'use client'

import { type FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { requestOwnPasswordRecovery } from '../services/authentication-admin-service'

export default function RequestPasswordRecoveryPage() {
  const supabase = useMemo(() => createClient(), [])
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await requestOwnPasswordRecovery(supabase, email, window.location.origin)
      setSent(true)
      setEmail('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo iniciar la recuperación.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="container admin-auth-page">
      <section className="auth-card">
        <p className="eyebrow">Portal administrativo</p>
        <h1>Recuperar contraseña</h1>
        <p className="lead auth-lead">Te enviaremos un enlace temporal si el correo corresponde a una cuenta habilitada.</p>

        {sent ? (
          <div className="success-box" role="status">
            Si existe una cuenta habilitada para ese correo, recibirás instrucciones para continuar.
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              Correo electrónico
              <input autoComplete="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            {error && <div className="error-box" role="alert">{error}</div>}
            <button className="button button-primary auth-button" disabled={saving} type="submit">
              {saving ? 'Enviando...' : 'Enviar enlace de recuperación'}
            </button>
          </form>
        )}

        <p className="meta auth-note"><Link href="/admin/login">Volver al inicio de sesión</Link></p>
      </section>
    </main>
  )
}

