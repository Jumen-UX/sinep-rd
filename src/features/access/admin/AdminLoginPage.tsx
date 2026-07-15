'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  getAdminLoginErrorMessage,
  getSafeAdminNextPath,
  resolveAdminEntryPath,
  signInAdmin,
} from '../services/authentication-admin-service'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      await signInAdmin(supabase, email, password)
      const search = typeof window === 'undefined' ? '' : window.location.search
      const requestedPath = getSafeAdminNextPath(search)
      router.push(await resolveAdminEntryPath(supabase, requestedPath))
      router.refresh()
    } catch (loginError) {
      if (loginError instanceof Error && loginError.message === 'invalid-admin-credentials') {
        setError('No pudimos validar esas credenciales.')
      } else {
        console.error('Admin login failed', loginError)
        setError(getAdminLoginErrorMessage(loginError))
      }
      setLoading(false)
    }
  }

  return (
    <main className="container admin-auth-page">
      <section className="auth-card">
        <p className="eyebrow">Portal administrativo</p>
        <h1>Iniciar sesión</h1>
        <p className="lead auth-lead">Accede con el usuario registrado en Supabase para administrar SINEP RD.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Correo electrónico
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
          </label>
          <label>
            Contraseña
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
          </label>
          {error && <div className="error-box">{error}</div>}
          <button className="button button-primary auth-button" disabled={loading} type="submit">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="meta auth-note"><Link href="/admin/recuperar/solicitar">¿Olvidaste tu contraseña?</Link></p>
        <p className="meta auth-note"><Link href="/">Volver al portal público</Link></p>
      </section>
    </main>
  )
}

