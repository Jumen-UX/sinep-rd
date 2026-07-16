'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PasswordSecurityPanel from '../components/PasswordSecurityPanel'
import {
  updateRecoveredPassword,
  waitForPasswordRecoverySession,
} from '../services/authentication-admin-service'
import {
  evaluatePassword,
  getPasswordValidationError,
  PASSWORD_MIN_LENGTH,
} from '../services/password-policy'

export default function UpdateRecoveredPasswordPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [checking, setChecking] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const passwordEvaluation = evaluatePassword(password)
  const confirmationMatches = confirmation.length > 0 && password === confirmation
  const canSubmit = ready && passwordEvaluation.isAcceptable && confirmationMatches && !saving

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
    const validationError = getPasswordValidationError(password)
    if (validationError) return setError(validationError)
    if (!confirmationMatches) return setError('Las contraseñas no coinciden.')

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
        <p className="meta auth-note">
          La contraseña debe alcanzar un nivel adecuado antes de poder guardarse.
        </p>
        {checking && <div className="empty-state">Validando el enlace de recuperación...</div>}
        {!checking && error && !ready && <div className="error-box" role="alert">{error}</div>}

        {ready && (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              Nueva contraseña
              <input
                aria-describedby="password-security-guidance"
                aria-invalid={password.length > 0 && !passwordEvaluation.isAcceptable}
                autoComplete="new-password"
                minLength={PASSWORD_MIN_LENGTH}
                required
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setError(null)
                }}
              />
            </label>
            <label>
              Confirmar contraseña
              <input
                aria-describedby="password-security-guidance"
                aria-invalid={confirmation.length > 0 && !confirmationMatches}
                autoComplete="new-password"
                minLength={PASSWORD_MIN_LENGTH}
                required
                type="password"
                value={confirmation}
                onChange={(event) => {
                  setConfirmation(event.target.value)
                  setError(null)
                }}
              />
            </label>

            <PasswordSecurityPanel password={password} confirmation={confirmation} />

            {error && <div className="error-box" role="alert">{error}</div>}
            <button className="button button-primary auth-button" disabled={!canSubmit} type="submit">
              {saving ? 'Actualizando...' : 'Guardar nueva contraseña'}
            </button>
          </form>
        )}

        <p className="meta auth-note"><Link href="/admin/login">Volver al inicio de sesión</Link></p>
      </section>
    </main>
  )
}
