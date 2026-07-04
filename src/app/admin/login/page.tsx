'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const LOGIN_TIMEOUT_MS = 15_000

function getSafeNextPath() {
  if (typeof window === 'undefined') return '/admin'

  const next = new URLSearchParams(window.location.search).get('next')

  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return '/admin'
  }

  return next
}

function withTimeout<T>(promise: Promise<T>, timeoutMessage: string) {
  let timeoutId: ReturnType<typeof setTimeout>

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), LOGIN_TIMEOUT_MS)
  })

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId))
}

function getLoginErrorMessage(error: unknown) {
  if (error instanceof Error && error.message === 'login-timeout') {
    return 'Supabase no respondió a tiempo. Revisa la conexión y la configuración del despliegue.'
  }

  if (error instanceof Error && error.message.startsWith('Missing environment variable')) {
    return 'La configuración de Supabase no está completa en el despliegue.'
  }

  return 'No pudimos completar el inicio de sesión. Intenta de nuevo.'
}

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
      const { error: signInError } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        }),
        'login-timeout',
      )

      if (signInError) {
        setError('No pudimos validar esas credenciales.')
        setLoading(false)
        return
      }

      router.push(getSafeNextPath())
      router.refresh()
    } catch (loginError) {
      console.error('Admin login failed', loginError)
      setError(getLoginErrorMessage(loginError))
      setLoading(false)
    }
  }

  return (
    <main className="container admin-auth-page">
      <section className="auth-card">
        <p className="eyebrow">Portal administrativo</p>
        <h1>Iniciar sesión</h1>
        <p className="lead auth-lead">
          Accede con el usuario registrado en Supabase para administrar SINEP RD.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Correo electrónico
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </label>

          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
          </label>

          {error && <div className="error-box">{error}</div>}

          <button className="button button-primary auth-button" disabled={loading} type="submit">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="meta auth-note">
          <Link href="/">Volver al portal público</Link>
        </p>
      </section>
    </main>
  )
}
