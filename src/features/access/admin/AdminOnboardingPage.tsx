'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PasswordSecurityPanel from '../components/PasswordSecurityPanel'
import {
  loadAdminOnboardingContext,
  saveAdminOnboarding,
  type AdminOnboardingContext,
} from '../services/authentication-admin-service'
import {
  evaluatePassword,
  getPasswordValidationError,
  PASSWORD_MIN_LENGTH,
} from '../services/password-policy'
import { getScopeLabel } from '../services/user-access-admin-service'

export default function AdminOnboardingPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [context, setContext] = useState<AdminOnboardingContext | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const needsPassword = context?.profile_status === 'pending_invitation'
  const passwordEvaluation = evaluatePassword(password)
  const passwordConfirmationMatches = passwordConfirmation.length > 0 && password === passwordConfirmation
  const canSubmit = !saving && (!needsPassword || (passwordEvaluation.isAcceptable && passwordConfirmationMatches))

  useEffect(() => {
    let cancelled = false
    void loadAdminOnboardingContext(supabase)
      .then((next) => {
        if (cancelled) return
        if (next.onboarding_completed_at) {
          router.replace('/admin')
          return
        }
        setContext(next)
        setFullName(next.full_name ?? '')
        setPhone(next.phone ?? '')
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el primer acceso.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [router, supabase])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!fullName.trim()) return setError('Confirma tu nombre completo.')

    if (needsPassword) {
      const validationError = getPasswordValidationError(password)
      if (validationError) return setError(validationError)
      if (!passwordConfirmationMatches) return setError('Las contraseñas no coinciden.')
    }

    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const complete = Boolean(context?.roles.length)
      const next = await saveAdminOnboarding(supabase, {
        fullName,
        phone,
        password: needsPassword ? password : undefined,
        complete,
      })
      setContext(next)
      if (next.onboarding_completed_at) {
        router.replace('/admin')
        router.refresh()
      } else {
        setNotice('Tus datos quedaron guardados. Un administrador debe asignarte un rol y alcance para completar el acceso.')
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el primer acceso.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <main className="container"><div className="empty-state">Preparando tu primer acceso...</div></main>

  return (
    <main className="container admin-dashboard">
      <div className="admin-topbar">
        <div>
          <p className="eyebrow">Primer acceso</p>
          <h1>Confirma tu perfil administrativo</h1>
          <p className="lead">Revisa tus datos y el ámbito asignado antes de entrar a SINEP RD.</p>
        </div>
      </div>

      {error && <div className="error-box" role="alert">{error}</div>}
      {notice && <div className="success-box" role="status">{notice}</div>}

      <section className="grid two-panel-grid">
        <article className="card admin-section">
          <p className="eyebrow">Tu información</p>
          <form className="auth-form access-form" onSubmit={handleSubmit}>
            <label>
              Correo electrónico
              <input disabled type="email" value={context?.email ?? ''} />
            </label>
            <label>
              Nombre completo
              <input autoComplete="name" required value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </label>
            <label>
              Teléfono
              <input autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </label>
            {needsPassword && (
              <>
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
                    aria-invalid={passwordConfirmation.length > 0 && !passwordConfirmationMatches}
                    autoComplete="new-password"
                    minLength={PASSWORD_MIN_LENGTH}
                    required
                    type="password"
                    value={passwordConfirmation}
                    onChange={(event) => {
                      setPasswordConfirmation(event.target.value)
                      setError(null)
                    }}
                  />
                </label>
                <PasswordSecurityPanel password={password} confirmation={passwordConfirmation} />
              </>
            )}
            <button className="button button-primary" disabled={!canSubmit} type="submit">
              {saving ? 'Guardando...' : context?.roles.length ? 'Confirmar y entrar' : 'Guardar perfil'}
            </button>
          </form>
        </article>

        <article className="card admin-section">
          <p className="eyebrow">Rol y alcance</p>
          <h2>Acceso asignado</h2>
          {context?.roles.length ? (
            <div className="access-flow">
              {context.roles.map((role) => (
                <div key={role.assignment_id}>
                  <strong>{role.role_name}</strong>
                  <span>{getScopeLabel(role.scope_type)} · {role.scope_label}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              Tu invitación todavía no tiene un rol activo. Puedes guardar tu perfil, pero no puedes asignarte permisos ni elegir un ámbito.
            </div>
          )}
        </article>
      </section>
    </main>
  )
}
