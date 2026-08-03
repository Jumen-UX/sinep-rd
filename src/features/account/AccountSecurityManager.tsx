'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import styles from './account-security.module.css'

const MIN_PASSWORD_LENGTH = 12

function validatePassword(password: string) {
  return {
    length: password.length >= MIN_PASSWORD_LENGTH,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  }
}

export default function AccountSecurityManager({ emailConfirmed }: { emailConfirmed: boolean }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState<'password' | 'sessions' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const checks = validatePassword(password)
  const passwordValid = Object.values(checks).every(Boolean) && password === confirmation

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!passwordValid) return
    setBusy('password')
    setMessage(null)
    setError(null)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setPassword('')
      setConfirmation('')
      setMessage('Tu contraseña fue actualizada correctamente.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo actualizar la contraseña.')
    } finally {
      setBusy(null)
    }
  }

  async function closeOtherSessions() {
    setBusy('sessions')
    setMessage(null)
    setError(null)
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' })
      if (signOutError) throw signOutError
      setMessage('Las demás sesiones fueron cerradas.')
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron cerrar las demás sesiones.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={styles.securityStack}>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {message ? <p className={styles.success} role="status">{message}</p> : null}

      <section className={styles.panel} aria-labelledby="password-title">
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.eyebrow}>Contraseña</p>
            <h2 id="password-title">Cambiar contraseña</h2>
            <p>Usa una contraseña exclusiva para SINEP y evita reutilizar credenciales.</p>
          </div>
        </div>
        <form className={styles.form} onSubmit={changePassword}>
          <label>
            <span>Nueva contraseña</span>
            <input autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          </label>
          <label>
            <span>Confirmar contraseña</span>
            <input autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} />
          </label>
          <ul className={styles.criteria} aria-label="Requisitos de contraseña">
            <li data-complete={checks.length}>Al menos {MIN_PASSWORD_LENGTH} caracteres</li>
            <li data-complete={checks.upper}>Una letra mayúscula</li>
            <li data-complete={checks.lower}>Una letra minúscula</li>
            <li data-complete={checks.number}>Un número</li>
            <li data-complete={checks.symbol}>Un símbolo</li>
            <li data-complete={password.length > 0 && password === confirmation}>Las contraseñas coinciden</li>
          </ul>
          <div className={styles.actions}>
            <button disabled={!passwordValid || busy !== null} type="submit">{busy === 'password' ? 'Actualizando…' : 'Actualizar contraseña'}</button>
          </div>
        </form>
      </section>

      <section className={styles.panel} aria-labelledby="sessions-title">
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.eyebrow}>Sesiones</p>
            <h2 id="sessions-title">Cerrar otras sesiones</h2>
            <p>Conserva esta sesión y cierra las demás sesiones abiertas de tu cuenta.</p>
          </div>
          <button className={styles.secondaryButton} disabled={busy !== null} onClick={closeOtherSessions} type="button">{busy === 'sessions' ? 'Cerrando…' : 'Cerrar otras sesiones'}</button>
        </div>
      </section>

      <section className={styles.statusGrid} aria-label="Estado de seguridad">
        <article>
          <span>Correo</span>
          <strong>{emailConfirmed ? 'Verificado' : 'Pendiente de verificación'}</strong>
          <p>La verificación protege la recuperación de la cuenta.</p>
        </article>
        <article>
          <span>Autenticación en dos pasos</span>
          <strong>No configurada</strong>
          <p>Se habilitará cuando el flujo MFA esté integrado y probado.</p>
        </article>
        <article>
          <span>Dispositivos y sesiones</span>
          <strong>Control global disponible</strong>
          <p>Supabase no expone aquí un inventario confiable de dispositivos individuales.</p>
        </article>
      </section>
    </div>
  )
}
