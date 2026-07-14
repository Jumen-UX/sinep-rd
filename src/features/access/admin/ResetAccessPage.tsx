'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { requestAdminAccessReset } from '../services/authentication-admin-service'

export default function ResetAccessPage() {
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      await requestAdminAccessReset(email)
      setNotice('Correo de recuperación enviado correctamente.')
      setEmail('')
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'No se pudo reenviar acceso.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="container admin-dashboard">
      <div className="admin-topbar">
        <div>
          <p className="eyebrow">Usuarios</p>
          <h1>Reenviar acceso</h1>
          <p className="lead">Envía un enlace de recuperación de contraseña a un usuario que ya existe.</p>
        </div>
        <Link className="button button-secondary" href="/admin/usuarios">Volver a usuarios</Link>
      </div>

      {error && <div className="error-box">{error}</div>}
      {notice && <div className="empty-state">{notice}</div>}

      <section className="card admin-section">
        <form className="auth-form access-form" onSubmit={handleSubmit}>
          <label>
            Correo electrónico
            <input autoComplete="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <button className="button button-primary" disabled={saving} type="submit">
            {saving ? 'Enviando...' : 'Enviar recuperación'}
          </button>
        </form>
      </section>
    </main>
  )
}
