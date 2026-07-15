'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  loadAdminEntryContext,
  signOutAdmin,
  type AdminEntryContext,
} from '../services/authentication-admin-service'

export default function AdminAccessStatusPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [context, setContext] = useState<AdminEntryContext | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadAdminEntryContext(supabase)
      .then((next) => {
        if (cancelled) return
        if (next.access_state === 'ready') return router.replace('/admin')
        if (next.access_state === 'onboarding') return router.replace('/admin/onboarding')
        setContext(next)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo confirmar el estado de tu acceso.')
      })
    return () => { cancelled = true }
  }, [router, supabase])

  async function handleSignOut() {
    await signOutAdmin(supabase)
    router.replace('/admin/login')
    router.refresh()
  }

  const blocked = context?.access_state === 'blocked'

  return (
    <main className="container admin-auth-page">
      <section className="auth-card">
        <p className="eyebrow">Estado de acceso</p>
        <h1>{blocked ? 'Acceso administrativo bloqueado' : 'Acceso pendiente de asignación'}</h1>
        {error ? (
          <div className="error-box" role="alert">{error}</div>
        ) : context ? (
          <p className="lead auth-lead">
            {blocked
              ? 'Tu perfil está suspendido o inactivo. Contacta al administrador responsable para solicitar una revisión.'
              : 'Tu perfil está confirmado, pero no tiene un rol administrativo activo. Un administrador debe asignarte rol y alcance.'}
          </p>
        ) : (
          <p className="lead auth-lead">Verificando tu cuenta...</p>
        )}
        <button className="button button-secondary auth-button" onClick={handleSignOut} type="button">
          Cerrar sesión
        </button>
      </section>
    </main>
  )
}
