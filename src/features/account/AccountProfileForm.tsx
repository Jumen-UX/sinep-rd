'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { saveMyAccountProfile, type AccountProfile } from './services/account-service'
import styles from './account.module.css'

export default function AccountProfileForm({ profile }: { profile: AccountProfile }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
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
    <form action={handleSubmit} className={styles.profileForm}>
      {error ? <p className={styles.formError} role="alert">{error}</p> : null}
      {message ? <p className={styles.formSuccess} role="status">{message}</p> : null}

      <div className={styles.formGrid}>
        <label>
          <span>Nombre completo</span>
          <input defaultValue={profile.full_name} maxLength={180} name="full_name" required />
        </label>
        <label>
          <span>Correo</span>
          <input disabled type="email" value={profile.email} />
          <small>El cambio de correo requerirá un flujo de seguridad separado.</small>
        </label>
        <label>
          <span>Teléfono</span>
          <input defaultValue={profile.phone ?? ''} maxLength={80} name="phone" type="tel" />
        </label>
        <label>
          <span>Idioma</span>
          <select defaultValue={profile.preferred_locale} name="preferred_locale">
            <option value="es-419">Español latinoamericano</option>
            <option value="es-ES">Español</option>
            <option value="en">English</option>
          </select>
        </label>
        <label>
          <span>Zona horaria</span>
          <input defaultValue={profile.timezone} maxLength={80} name="timezone" required />
        </label>
        <label>
          <span>Fotografía</span>
          <input defaultValue={profile.avatar_url ?? ''} name="avatar_url" placeholder="https://..." type="url" />
          <small>Por ahora se admite una URL HTTPS. La carga directa se añadirá después.</small>
        </label>
      </div>

      <div className={styles.formActions}>
        <button disabled={saving} type="submit">{saving ? 'Guardando…' : 'Guardar cambios'}</button>
      </div>
    </form>
  )
}
