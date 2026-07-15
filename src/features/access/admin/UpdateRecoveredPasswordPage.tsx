'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  updateRecoveredPassword,
  waitForPasswordRecoverySession,
} from '../services/authentication-admin-service'

export default function UpdateRecoveredPasswordPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [checking, setChecking] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void waitForPasswordRecoverySession(supabase)
      .then(() => { if (!cancelled) setReady(true) })
      .catch(() => { if (!cancelled) setError('El enlace es inválido, expiró o ya fue utilizado.') })
      .finally(() => { if (!cancelled) setChecking(false) })
    return () => { cancelled = true }
  }, [supabase])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password.length < 12) return setError('La contraseña debe tener al menos 12 caracteres.')
    if (password !== confirmation) return setError('Las contraseñas no coinciden.')

    setSaving(true)
    setError(null)
    try {
      await updateRecoveredPassword(supabase, password)
      router.replace('/admin/login?recovered=1')
      router.refresh()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'No se pudo actualizar la contraseña.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="container admin-auth-page">
      <section className="auth-card">
        <p className="eyebrow">Portal administrativo</p>
        <h1>Establecer nueva contraseña</h1>
        {checking && <div className="empty-state">Validando el enlace de recuperación...</div>}
        {!checking && error && !ready && <div className="error-box" role="alert">{error}</div>}

        {ready && (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              Nueva contraseña
              <input autoComplete="new-password" minLength={12} required type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <label>
              Confirmar contraseña
              <input autoComplete="new-password" minLength={12} required type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
            </label>
            {error && <div className="error-box" role="alert">{error}</div>}
            <button className="button button-primary auth-button" disabled={saving} type="submit">
              {saving ? 'Actualizando...' : 'Guardar nueva contraseña'}
            </button>
          </form>
        )}

        <p className="meta auth-note"><Link href="/admin/login">Volver al inicio de sesión</Link></p>
      </section>
    </main>
  )
}

