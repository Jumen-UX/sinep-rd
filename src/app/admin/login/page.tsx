'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError('No pudimos validar esas credenciales.')
      setLoading(false)
      return
    }

    router.push('/admin')
    router.refresh()
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
