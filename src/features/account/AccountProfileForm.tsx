'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
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

function normalizeProfile(profile: AccountProfile): FormState {
  return {
    fullName: profile.full_name.trim(),
    phone: profile.phone?.trim() ?? '',
    preferredLocale: profile.preferred_locale,
    timezone: profile.timezone,
    avatarUrl: profile.avatar_url?.trim() ?? '',
  }
}

function getInitials(value: string, email: string) {
  const words = value.trim().split(/\s+/).filter(Boolean)
  if (words.length > 0) return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join('')
  return email[0]?.toUpperCase() ?? 'U'
}

function validateAvatarUrl(value: string) {
  if (!value) return null
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') return 'La fotografía debe usar una URL HTTPS.'
    if (!IMAGE_PATH_PATTERN.test(parsed.href)) {
      return 'La URL debe apuntar directamente a una imagen JPG, PNG, WEBP, GIF o AVIF.'
    }
    return null
  } catch {
    return 'Escribe una URL válida para la fotografía.'
  }
}

export default function AccountProfileForm({ profile }: { profile: AccountProfile }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const initial = useMemo(() => normalizeProfile(profile), [profile])
  const [form, setForm] = useState<FormState>(initial)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const avatarError = useMemo(() => validateAvatarUrl(form.avatarUrl), [form.avatarUrl])
  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial])
  const completionFields = useMemo(() => [
    { label: 'Nombre', complete: Boolean(form.fullName.trim()) },
    { label: 'Correo', complete: Boolean(profile.email.trim()) },
    { label: 'Teléfono', complete: Boolean(form.phone.trim()) },
    { label: 'Idioma', complete: Boolean(form.preferredLocale.trim()) },
    { label: 'Zona horaria', complete: Boolean(form.timezone.trim()) },
    { label: 'Fotografía', complete: Boolean(form.avatarUrl.trim()) && !avatarError },
  ], [avatarError, form, profile.email])
  const completeCount = completionFields.filter((field) => field.complete).length
  const completionPercentage = Math.round((completeCount / completionFields.length) * 100)
  const pendingFields = completionFields.filter((field) => !field.complete)
  const initials = getInitials(form.fullName, profile.email)
  const canSubmit = isDirty && !saving && Boolean(form.fullName.trim()) && Boolean(form.timezone.trim()) && !avatarError

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setMessage(null)
    setError(null)
  }

  async function handleSubmit(formData: FormData) {
    if (!canSubmit) return
    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      await saveMyAccountProfile(supabase, {
        fullName: String(formData.get('full_name') ?? ''),
        phone: String(formData.get('phone') ?? ''),
        preferredLocale: String(formData.get('preferred_locale') ?? ''),
        timezone: String(formData.get('timezone') ?? ''),
        avatarUrl: String(formData.get('avatar_url') ?? ''),
      })
      setMessage('Tu perfil fue actualizado correctamente.')
      router.refresh()
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
            style={form.avatarUrl && !avatarError ? { backgroundImage: `url(${form.avatarUrl})`, color: 'transparent' } : undefined}
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
          <h2 id="profile-completion-title">{pendingFields.length === 0 ? 'Tu información está completa' : 'Datos que puedes completar'}</h2>
          <p>La vinculación con una ficha eclesial es opcional y no afecta este porcentaje.</p>
          {pendingFields.length > 0 ? (
            <ul className={styles.pendingList}>
              {pendingFields.map((field) => <li key={field.label}>{field.label}</li>)}
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
              <input
                autoComplete="name"
                maxLength={180}
                name="full_name"
                onChange={(event) => updateField('fullName', event.target.value)}
                required
                value={form.fullName}
              />
            </label>
            <label className={styles.field}>
              <span>Correo</span>
              <input disabled type="email" value={profile.email} />
              <small>El cambio de correo requiere un flujo de seguridad separado.</small>
            </label>
            <label className={styles.field}>
              <span>Teléfono</span>
              <input
                autoComplete="tel"
                maxLength={80}
                name="phone"
                onChange={(event) => updateField('phone', event.target.value)}
                type="tel"
                value={form.phone}
              />
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
              <select
                name="preferred_locale"
                onChange={(event) => updateField('preferredLocale', event.target.value)}
                value={form.preferredLocale}
              >
                <option value="es-419">Español latinoamericano</option>
                <option value="es-ES">Español</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Zona horaria</span>
              <input
                autoComplete="off"
                list="account-timezones"
                maxLength={80}
                name="timezone"
                onChange={(event) => updateField('timezone', event.target.value)}
                required
                value={form.timezone}
              />
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
            <div
              aria-label={form.avatarUrl && !avatarError ? 'Vista previa de la fotografía de perfil' : 'Vista previa con iniciales'}
              className={styles.photoPreview}
              role="img"
              style={form.avatarUrl && !avatarError ? { backgroundImage: `url(${form.avatarUrl})`, color: 'transparent' } : undefined}
            >
              {initials}
            </div>
            <div className={styles.photoActions}>
              <label className={styles.field}>
                <span>URL de la fotografía</span>
                <input
                  aria-describedby="avatar-help avatar-error"
                  aria-invalid={Boolean(avatarError)}
                  name="avatar_url"
                  onChange={(event) => updateField('avatarUrl', event.target.value)}
                  placeholder="https://sitio.example/foto.webp"
                  type="url"
                  value={form.avatarUrl}
                />
                <small id="avatar-help">Debe ser una URL HTTPS que apunte directamente a una imagen. La carga de archivos se añadirá en una fase posterior.</small>
                {avatarError ? <small className={styles.fieldError} id="avatar-error">{avatarError}</small> : null}
              </label>
              <button
                className={styles.removeButton}
                disabled={!form.avatarUrl}
                onClick={() => updateField('avatarUrl', '')}
                type="button"
              >
                Retirar fotografía
              </button>
            </div>
          </div>
        </section>

        <div className={styles.actions}>
          <p>{isDirty ? 'Tienes cambios sin guardar.' : 'No hay cambios pendientes.'}</p>
          <button className={styles.saveButton} disabled={!canSubmit} type="submit">
            {saving ? <><span aria-hidden="true" className={styles.spinner} />Guardando…</> : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
