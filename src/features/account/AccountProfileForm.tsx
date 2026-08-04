'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { saveMyAccountProfile, type AccountProfile } from './services/account-service'
import styles from './account-profile.module.css'

const TIMEZONE_OPTIONS = [
  'America/Santo_Domingo',
  'America/Puerto_Rico',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Caracas',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/Sao_Paulo',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/London',
  'Africa/Abidjan',
  'Africa/Johannesburg',
  'Asia/Jerusalem',
  'Asia/Manila',
  'UTC',
]

const IMAGE_PATH_PATTERN = /\.(?:avif|gif|jpe?g|png|webp)(?:$|[?#])/i

type FormState = {
  fullName: string
  phone: string
  preferredLocale: string
  timezone: string
  avatarUrl: string
}

function normalizeValue(value: string | null | undefined) {
  return value?.trim() ?? ''
}

function normalizeProfile(profile: AccountProfile): FormState {
  return {
    fullName: normalizeValue(profile.full_name),
    phone: normalizeValue(profile.phone),
    preferredLocale: normalizeValue(profile.preferred_locale) || 'es-419',
    timezone: normalizeValue(profile.timezone),
    avatarUrl: normalizeValue(profile.avatar_url),
  }
}

function normalizeForm(form: FormState): FormState {
  return {
    fullName: normalizeValue(form.fullName),
    phone: normalizeValue(form.phone),
    preferredLocale: normalizeValue(form.preferredLocale) || 'es-419',
    timezone: normalizeValue(form.timezone),
    avatarUrl: normalizeValue(form.avatarUrl),
  }
}

function getInitials(value: string, email: string) {
  const words = value.trim().split(/\s+/).filter(Boolean)
  if (words.length > 0) return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join('')
  return email[0]?.toUpperCase() ?? 'U'
}

function inspectAvatarUrl(value: string) {
  if (!value) return { error: null, warning: null, previewable: false }
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') {
      return { error: 'La fotografía debe usar una URL HTTPS.', warning: null, previewable: false }
    }
    if (!IMAGE_PATH_PATTERN.test(parsed.href)) {
      return {
        error: null,
        warning: 'La URL es válida, pero no parece apuntar directamente a una imagen. La fotografía no contará como completa hasta usar un archivo JPG, PNG, WEBP, GIF o AVIF.',
        previewable: false,
      }
    }
    return { error: null, warning: null, previewable: true }
  } catch {
    return { error: 'Escribe una URL válida para la fotografía.', warning: null, previewable: false }
  }
}

export default function AccountProfileForm({ profile }: { profile: AccountProfile }) {
  const supabase = useMemo(() => createClient(), [])
  const profileState = useMemo(() => normalizeProfile(profile), [profile])
  const [form, setForm] = useState<FormState>(profileState)
  const [baseline, setBaseline] = useState<FormState>(profileState)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setForm(profileState)
    setBaseline(profileState)
  }, [profileState])

  const avatarInspection = useMemo(() => inspectAvatarUrl(form.avatarUrl), [form.avatarUrl])
  const normalizedForm = useMemo(() => normalizeForm(form), [form])
  const isDirty = useMemo(
    () => JSON.stringify(normalizedForm) !== JSON.stringify(normalizeForm(baseline)),
    [baseline, normalizedForm],
  )
  const completionFields = useMemo(() => [
    { label: 'Nombre', complete: Boolean(normalizedForm.fullName) },
    { label: 'Correo', complete: Boolean(profile.email.trim()) },
    { label: 'Teléfono', complete: Boolean(normalizedForm.phone) },
    { label: 'Idioma', complete: Boolean(normalizedForm.preferredLocale) },
    { label: 'Zona horaria', complete: Boolean(normalizedForm.timezone) },
    { label: 'Fotografía', complete: Boolean(normalizedForm.avatarUrl) && avatarInspection.previewable },
  ], [avatarInspection.previewable, normalizedForm, profile.email])
  const completeCount = completionFields.filter((field) => field.complete).length
  const completionPercentage = Math.round((completeCount / completionFields.length) * 100)
  const pendingFields = completionFields.filter((field) => !field.complete)
  const initials = getInitials(form.fullName, profile.email)
  const canSubmit = isDirty && !saving && Boolean(normalizedForm.fullName) && Boolean(normalizedForm.timezone) && !avatarInspection.error

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setMessage(null)
    setError(null)
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      const context = await saveMyAccountProfile(supabase, normalizedForm)
      const saved = normalizeProfile(context.profile)
      setForm(saved)
      setBaseline(saved)
      setMessage('Tu perfil fue actualizado correctamente.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar tu perfil.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.profileLayout}>
      <section className={styles.identityCard} aria-labelledby="profile-identity-title">
        <div className={styles.identityMain}>
          <div
            aria-hidden="true"
            className={styles.avatar}
            style={avatarInspection.previewable ? { backgroundImage: `url(${form.avatarUrl})`, color: 'transparent' } : undefined}
          >
            {initials}
          </div>
          <div className={styles.identityText}>
            <h2 id="profile-identity-title">{form.fullName || 'Tu perfil'}</h2>
            <p>{profile.email}</p>
            <div className={styles.identityMeta}>
              <span className={styles.badge}>Cuenta activa</span>
              <span className={styles.badge}>{completionPercentage}% completado</span>
            </div>
          </div>
        </div>
        <div className={styles.identityProgress} aria-label={`Perfil completado al ${completionPercentage}%`}>
          <strong>{completionPercentage}%</strong>
          <span>Completitud del perfil</span>
          <div className={styles.progressTrack} aria-hidden="true">
            <div className={styles.progressBar} style={{ width: `${completionPercentage}%` }} />
          </div>
        </div>
      </section>

      <section className={styles.completionCard} aria-labelledby="profile-completion-title">
        <div className={styles.completionScore}>
          <span>Perfil completado</span>
          <strong>{completionPercentage}%</strong>
          <div className={styles.progressTrack} aria-hidden="true">
            <div className={styles.progressBar} style={{ width: `${completionPercentage}%` }} />
          </div>
        </div>
        <div className={styles.completionDetails}>
          <h2 id="profile-completion-title">{pendingFields.length === 0 ? 'Tu información está completa' : 'Datos pendientes'}</h2>
          <p>La vinculación con una ficha eclesial es opcional y no afecta este porcentaje.</p>
          {pendingFields.length > 0 ? (
            <ul className={styles.pendingList}>
              {pendingFields.map((field) => <li key={field.label}><span aria-hidden="true">○</span>{field.label}</li>)}
            </ul>
          ) : null}
        </div>
      </section>

      <form action={handleSubmit} className={styles.form}>
        {error ? <p className={styles.status} role="alert">{error}</p> : null}
        {message ? <p className={styles.status} role="status">{message}</p> : null}

        <section className={styles.sectionCard} aria-labelledby="identity-contact-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Identidad y contacto</p>
              <h2 id="identity-contact-title">Información básica</h2>
            </div>
          </div>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span>Nombre completo</span>
              <input autoComplete="name" maxLength={180} name="full_name" onChange={(event) => updateField('fullName', event.target.value)} required value={form.fullName} />
            </label>
            <label className={styles.field}>
              <span>Correo</span>
              <input disabled type="email" value={profile.email} />
              <small>El cambio de correo requiere un flujo de seguridad separado.</small>
            </label>
            <label className={styles.field}>
              <span>Teléfono</span>
              <input autoComplete="tel" maxLength={80} name="phone" onChange={(event) => updateField('phone', event.target.value)} type="tel" value={form.phone} />
              <small>Incluye el código de país cuando corresponda.</small>
            </label>
          </div>
        </section>

        <section className={styles.sectionCard} aria-labelledby="preferences-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Preferencias regionales</p>
              <h2 id="preferences-title">Idioma y zona horaria</h2>
            </div>
          </div>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span>Idioma</span>
              <select name="preferred_locale" onChange={(event) => updateField('preferredLocale', event.target.value)} value={form.preferredLocale}>
                <option value="es-419">Español latinoamericano</option>
                <option value="es-ES">Español</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Zona horaria</span>
              <input autoComplete="off" list="account-timezones" maxLength={80} name="timezone" onChange={(event) => updateField('timezone', event.target.value)} required value={form.timezone} />
              <datalist id="account-timezones">
                {TIMEZONE_OPTIONS.map((timezone) => <option key={timezone} value={timezone} />)}
              </datalist>
              <small>Selecciona una zona IANA, por ejemplo America/Santo_Domingo.</small>
            </label>
          </div>
        </section>

        <section className={styles.sectionCard} aria-labelledby="photo-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Fotografía</p>
              <h2 id="photo-title">Imagen de perfil</h2>
            </div>
          </div>
          <div className={styles.photoGrid}>
            <div aria-label={avatarInspection.previewable ? 'Vista previa de la fotografía de perfil' : 'Vista previa con iniciales'} className={styles.photoPreview} role="img" style={avatarInspection.previewable ? { backgroundImage: `url(${form.avatarUrl})`, color: 'transparent' } : undefined}>{initials}</div>
            <div className={styles.photoActions}>
              <label className={styles.field}>
                <span>URL de la fotografía</span>
                <input aria-describedby="avatar-help avatar-feedback" aria-invalid={Boolean(avatarInspection.error)} name="avatar_url" onChange={(event) => updateField('avatarUrl', event.target.value)} placeholder="https://sitio.example/foto.webp" type="url" value={form.avatarUrl} />
                <small id="avatar-help">Debe ser una URL HTTPS. Para mostrar vista previa y contar como completa, debe apuntar directamente a una imagen.</small>
                {avatarInspection.error ? <small className={styles.fieldError} id="avatar-feedback">{avatarInspection.error}</small> : null}
                {avatarInspection.warning ? <small className={styles.fieldWarning} id="avatar-feedback">{avatarInspection.warning}</small> : null}
              </label>
              <button className={styles.removeButton} disabled={!form.avatarUrl} onClick={() => updateField('avatarUrl', '')} type="button">Retirar fotografía</button>
            </div>
          </div>
        </section>

        {(isDirty || saving) ? (
          <div className={styles.actions}>
            <p>{saving ? 'Guardando los cambios…' : 'Tienes cambios sin guardar.'}</p>
            <button className={styles.saveButton} disabled={!canSubmit} type="submit">
              {saving ? <><span aria-hidden="true" className={styles.spinner} />Guardando…</> : 'Guardar cambios'}
            </button>
          </div>
        ) : null}
      </form>
    </div>
  )
}
