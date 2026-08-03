'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import styles from './account-security.module.css'

const MIN_PASSWORD_LENGTH = 12

type PasswordChecks = ReturnType<typeof validatePassword>

function validatePassword(password: string) {
  return {
    length: password.length >= MIN_PASSWORD_LENGTH,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  }
}

function getStrength(checks: PasswordChecks, password: string) {
  if (!password) return { score: 0, label: 'Sin evaluar' }
  const score = Object.values(checks).filter(Boolean).length
  if (score <= 2) return { score, label: 'Débil' }
  if (score <= 3) return { score, label: 'Aceptable' }
  if (score === 4) return { score, label: 'Buena' }
  return { score, label: 'Excelente' }
}

export default function AccountSecurityManager({
  email,
  emailConfirmed,
}: {
  email: string
  emailConfirmed: boolean
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [busy, setBusy] = useState<'password' | 'sessions' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const checks = validatePassword(password)
  const strength = getStrength(checks, password)
  const passwordsMatch = password.length > 0 && password === confirmation
  const passwordValid = Object.values(checks).every(Boolean) && passwordsMatch

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
      setMessage('Tu contraseña fue actualizada correctamente. Esta sesión permanece activa.')
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
      setMessage('Las demás sesiones fueron cerradas. Esta sesión permanece activa.')
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
          <span className={styles.securityBadge}>Protección de acceso</span>
        </div>

        <form className={styles.form} onSubmit={changePassword}>
          <div className={styles.passwordField}>
            <label htmlFor="new-password">Nueva contraseña</label>
            <div className={styles.inputGroup}>
              <input id="new-password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} onChange={(event) => setPassword(event.target.value)} required type={showPassword ? 'text' : 'password'} value={password} />
              <button aria-label={showPassword ? 'Ocultar nueva contraseña' : 'Mostrar nueva contraseña'} className={styles.visibilityButton} onClick={() => setShowPassword((current) => !current)} type="button">
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          <div className={styles.strength} aria-live="polite">
            <div className={styles.strengthHeader}>
              <span>Fortaleza</span>
              <strong>{strength.label}</strong>
            </div>
            <div aria-label={`Fortaleza de contraseña: ${strength.label}`} className={styles.strengthTrack} role="progressbar" aria-valuemin={0} aria-valuemax={5} aria-valuenow={strength.score}>
              <span style={{ width: `${(strength.score / 5) * 100}%` }} />
            </div>
          </div>

          <ul className={styles.criteria} aria-label="Requisitos de contraseña">
            <li data-complete={checks.length}>Al menos {MIN_PASSWORD_LENGTH} caracteres</li>
            <li data-complete={checks.upper}>Una letra mayúscula</li>
            <li data-complete={checks.lower}>Una letra minúscula</li>
            <li data-complete={checks.number}>Un número</li>
            <li data-complete={checks.symbol}>Un símbolo especial</li>
          </ul>

          <div className={styles.passwordField}>
            <label htmlFor="confirm-password">Confirmar contraseña</label>
            <div className={styles.inputGroup}>
              <input id="confirm-password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} onChange={(event) => setConfirmation(event.target.value)} required type={showConfirmation ? 'text' : 'password'} value={confirmation} />
              <button aria-label={showConfirmation ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'} className={styles.visibilityButton} onClick={() => setShowConfirmation((current) => !current)} type="button">
                {showConfirmation ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <p className={styles.matchStatus} data-complete={passwordsMatch}>
              {passwordsMatch ? '✓ Las contraseñas coinciden' : '○ Confirma exactamente la nueva contraseña'}
            </p>
          </div>

          <aside className={styles.guidance}>
            <strong>Consejos de seguridad</strong>
            <p>No reutilices contraseñas, evita datos personales y considera usar un gestor de contraseñas.</p>
          </aside>

          <div className={styles.actions}>
            <button disabled={!passwordValid || busy !== null} type="submit">
              {busy === 'password' ? 'Actualizando…' : 'Actualizar contraseña'}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.panel} aria-labelledby="sessions-title">
        <div className={styles.sessionLayout}>
          <div>
            <p className={styles.eyebrow}>Sesiones</p>
            <h2 id="sessions-title">Control global de sesiones</h2>
            <p>Conserva esta sesión y cierra las demás sesiones abiertas de tu cuenta.</p>
          </div>
          <button className={styles.secondaryButton} disabled={busy !== null} onClick={closeOtherSessions} type="button">
            {busy === 'sessions' ? 'Cerrando…' : 'Cerrar otras sesiones'}
          </button>
        </div>
      </section>

      <section className={styles.statusGrid} aria-label="Estado de seguridad">
        <article>
          <div className={styles.statusHeading}>
            <span>Correo</span>
            <span className={emailConfirmed ? styles.statusGood : styles.statusPending}>{emailConfirmed ? 'Verificado' : 'Pendiente'}</span>
          </div>
          <strong>{email}</strong>
          <p>La verificación protege la recuperación de la cuenta.</p>
        </article>
        <article>
          <div className={styles.statusHeading}>
            <span>Autenticación en dos pasos</span>
            <span className={styles.statusPending}>No configurada</span>
          </div>
          <strong>MFA pendiente</strong>
          <p>La activación estará disponible cuando el flujo completo esté integrado y probado.</p>
        </article>
        <article>
          <div className={styles.statusHeading}>
            <span>Dispositivos y sesiones</span>
            <span className={styles.statusNeutral}>Control global</span>
          </div>
          <strong>Gestión disponible</strong>
          <p>Supabase no expone aquí un inventario confiable de dispositivos individuales.</p>
        </article>
      </section>
    </div>
  )
}
