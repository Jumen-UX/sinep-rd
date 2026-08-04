'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import styles from './account-security.module.css'
import lowerStyles from './account-security-lower.module.css'

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

function getPasswordHint(checks: PasswordChecks, password: string) {
  if (!password) return 'Escribe una contraseña para evaluar su fortaleza.'
  if (!checks.length) return `Agrega al menos ${MIN_PASSWORD_LENGTH - password.length} caracteres más.`
  if (!checks.upper) return 'Agrega una letra mayúscula.'
  if (!checks.lower) return 'Agrega una letra minúscula.'
  if (!checks.number) return 'Agrega un número.'
  if (!checks.symbol) return 'Agrega un símbolo especial, por ejemplo: ! @ # $ %.'
  return 'La contraseña cumple todos los requisitos.'
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
      <path d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.2A10.8 10.8 0 0112 4c5.4 0 9 5 9 5a16.8 16.8 0 01-3.1 3.6M6.2 6.2C4.1 7.6 3 9 3 9s3.6 5 9 5c1 0 1.9-.2 2.7-.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
      <path d="M3 12s3.6-5 9-5 9 5 9 5-3.6 5-9 5-9-5-9-5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
      <rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10V7a4 4 0 018 0v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export default function AccountSecurityManager({ email, emailConfirmed }: { email: string; emailConfirmed: boolean }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const confirmationDialogRef = useRef<HTMLDialogElement>(null)
  const cancelDialogButtonRef = useRef<HTMLButtonElement>(null)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [confirmSessions, setConfirmSessions] = useState(false)
  const [busy, setBusy] = useState<'password' | 'sessions' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const checks = validatePassword(password)
  const strength = getStrength(checks, password)
  const strengthHint = getPasswordHint(checks, password)
  const passwordsMatch = password.length > 0 && password === confirmation
  const confirmationStarted = confirmation.length > 0
  const passwordValid = Object.values(checks).every(Boolean) && passwordsMatch

  useEffect(() => {
    const dialog = confirmationDialogRef.current
    if (!dialog) return
    if (confirmSessions && !dialog.open) {
      dialog.showModal()
      requestAnimationFrame(() => cancelDialogButtonRef.current?.focus())
    }
    if (!confirmSessions && dialog.open) dialog.close()
  }, [confirmSessions])

  useEffect(() => {
    if (!message) return
    const timeout = window.setTimeout(() => setMessage(null), 4000)
    return () => window.clearTimeout(timeout)
  }, [message])

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
      setConfirmSessions(false)
      setMessage('Todas las demás sesiones fueron cerradas correctamente. Esta sesión permanece activa.')
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
      {message ? <p className={`${styles.success} ${lowerStyles.toast}`} role="status">{message}</p> : null}

      <section className={styles.panel} aria-labelledby="password-title">
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.eyebrow}>Contraseña</p>
            <h2 id="password-title">Cambiar contraseña</h2>
            <p>Usa una contraseña exclusiva para SINEP y evita reutilizar credenciales.</p>
          </div>
        </div>

        <form className={styles.form} onSubmit={changePassword}>
          <div className={styles.passwordField}>
            <label htmlFor="new-password">Nueva contraseña</label>
            <div className={styles.inputGroup}>
              <input id="new-password" aria-describedby="password-strength password-requirements" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} onChange={(event) => setPassword(event.target.value)} placeholder="Escribe una contraseña nueva" required type={showPassword ? 'text' : 'password'} value={password} />
              <button aria-label={showPassword ? 'Ocultar nueva contraseña' : 'Mostrar nueva contraseña'} aria-pressed={showPassword} className={styles.visibilityButton} onClick={() => setShowPassword((current) => !current)} type="button"><EyeIcon hidden={showPassword} /><span>{showPassword ? 'Ocultar' : 'Mostrar'}</span></button>
            </div>
          </div>

          <div className={styles.strength} id="password-strength" aria-live="polite">
            <div className={styles.strengthHeader}><span>Fortaleza de la contraseña</span><strong className={styles.strengthBadge} data-score={strength.score}>{strength.label}</strong></div>
            <div aria-label={`Fortaleza de contraseña: ${strength.label}`} className={styles.strengthTrack} data-score={strength.score} role="progressbar" aria-valuemin={0} aria-valuemax={5} aria-valuenow={strength.score}><span style={{ width: `${(strength.score / 5) * 100}%` }} /></div>
            <p className={styles.strengthHint}>{strengthHint}</p>
          </div>

          <div className={styles.requirements} id="password-requirements">
            <strong>Requisitos</strong>
            <ul className={styles.criteria} aria-label="Requisitos de contraseña"><li data-complete={checks.length}>Al menos {MIN_PASSWORD_LENGTH} caracteres</li><li data-complete={checks.upper}>Una letra mayúscula</li><li data-complete={checks.lower}>Una letra minúscula</li><li data-complete={checks.number}>Un número</li><li data-complete={checks.symbol}>Un símbolo especial</li></ul>
          </div>

          <div className={styles.passwordField}>
            <label htmlFor="confirm-password">Confirmar contraseña</label>
            <div className={styles.inputGroup}>
              <input id="confirm-password" aria-describedby="password-match-status" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} onChange={(event) => setConfirmation(event.target.value)} placeholder="Repite la nueva contraseña" required type={showConfirmation ? 'text' : 'password'} value={confirmation} />
              <button aria-label={showConfirmation ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'} aria-pressed={showConfirmation} className={styles.visibilityButton} onClick={() => setShowConfirmation((current) => !current)} type="button"><EyeIcon hidden={showConfirmation} /><span>{showConfirmation ? 'Ocultar' : 'Mostrar'}</span></button>
            </div>
            <p className={styles.matchStatus} data-complete={passwordsMatch} data-error={confirmationStarted && !passwordsMatch} id="password-match-status" aria-live="polite">{!confirmationStarted ? 'Escribe nuevamente la contraseña.' : passwordsMatch ? '✓ Las contraseñas coinciden.' : '✕ Las contraseñas no coinciden.'}</p>
          </div>

          <aside className={styles.guidance} aria-label="Consejos de seguridad"><div className={styles.guidanceIcon} aria-hidden="true">i</div><div><strong>Consejos de seguridad</strong><ul><li>No reutilices contraseñas de otros servicios.</li><li>Evita nombres, fechas y datos personales fáciles de adivinar.</li><li>Considera utilizar un gestor de contraseñas.</li></ul></div></aside>

          <div className={styles.actions}><button className={lowerStyles.passwordAction} disabled={!passwordValid || busy !== null} type="submit">{busy === 'password' ? 'Actualizando…' : 'Actualizar contraseña'}</button>{!passwordValid ? <small>Completa todos los requisitos y confirma la contraseña para continuar.</small> : null}</div>
        </form>
      </section>

      <section className={styles.panel} aria-labelledby="sessions-title">
        <div className={styles.sessionLayout}>
          <div><p className={styles.eyebrow}>Sesiones</p><h2 id="sessions-title">Control global de sesiones</h2><p>Conserva esta sesión y cierra todas las demás sesiones abiertas de tu cuenta.</p></div>
          <button className={styles.secondaryButton} disabled={busy !== null} onClick={() => setConfirmSessions(true)} type="button">{busy === 'sessions' ? 'Cerrando…' : 'Cerrar otras sesiones'}</button>
        </div>
      </section>

      <section className={`${styles.statusGrid} ${lowerStyles.statusGrid}`} aria-label="Estado de protección de la cuenta">
        <article><div className={styles.statusHeading}><span>Correo</span><span className={emailConfirmed ? styles.statusGood : styles.statusPending}>{emailConfirmed ? 'Verificado' : 'Pendiente'}</span></div><strong>{email}</strong><p>{emailConfirmed ? 'Tu correo está listo para los procesos de recuperación de la cuenta.' : 'Verifica tu correo para proteger la recuperación de la cuenta.'}</p></article>
        <article><div className={styles.statusHeading}><span>Autenticación en dos pasos</span><span className={styles.statusPending}>Próximamente</span></div><strong>Aún no disponible</strong><p>La activación se habilitará cuando el flujo de enrolamiento, verificación y recuperación esté integrado y probado.</p></article>
        <article><div className={styles.statusHeading}><span>Control de sesiones</span><span className={styles.statusNeutral}>Control global</span></div><strong>Cierre global disponible</strong><p>Puedes cerrar las demás sesiones. El detalle individual de dispositivos todavía no está disponible.</p></article>
      </section>

      <dialog className={lowerStyles.confirmDialog} onCancel={(event) => { if (busy === 'sessions') event.preventDefault(); else setConfirmSessions(false) }} onClose={() => setConfirmSessions(false)} ref={confirmationDialogRef}>
        <form method="dialog" className={lowerStyles.dialogContent} onSubmit={(event) => event.preventDefault()}>
          <div className={lowerStyles.dialogIcon} aria-hidden="true">!</div>
          <div><p className={styles.eyebrow}>Confirmación de seguridad</p><h2>Cerrar otras sesiones</h2><p>Se cerrarán todas las demás sesiones de tu cuenta. Esta sesión permanecerá activa.</p></div>
          <div className={lowerStyles.dialogActions}>
            <button ref={cancelDialogButtonRef} className={lowerStyles.cancelButton} disabled={busy === 'sessions'} onClick={() => setConfirmSessions(false)} type="button">Cancelar</button>
            <button className={lowerStyles.confirmButton} disabled={busy === 'sessions'} onClick={closeOtherSessions} type="button"><LockIcon />{busy === 'sessions' ? <><span className={lowerStyles.spinner} aria-hidden="true" /> Cerrando sesiones…</> : 'Cerrar otras sesiones'}</button>
          </div>
        </form>
      </dialog>
    </div>
  )
}
