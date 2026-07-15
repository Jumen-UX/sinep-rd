'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  loadAdminOnboardingContext,
  saveAdminOnboarding,
  type AdminOnboardingContext,
} from '../services/authentication-admin-service'
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
    const needsPassword = context?.profile_status === 'pending_invitation'
    if (needsPassword && password.length < 12) return setError('La contraseña debe tener al menos 12 caracteres.')
    if (needsPassword && password !== passwordConfirmation) return setError('Las contraseñas no coinciden.')

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
            {context?.profile_status === 'pending_invitation' && (
              <>
                <label>
                  Nueva contraseña
                  <input autoComplete="new-password" minLength={12} required type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
                </label>
                <label>
                  Confirmar contraseña
                  <input autoComplete="new-password" minLength={12} required type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} />
                </label>
              </>
            )}
            <button className="button button-primary" disabled={saving} type="submit">
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

