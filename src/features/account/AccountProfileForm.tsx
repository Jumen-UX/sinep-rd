'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  optimizeProfileAvatar,
  removeMyProfileAvatar,
  saveMyAccountProfile,
  uploadMyProfileAvatar,
  type AccountProfile,
} from './services/account-service'
import styles from './account-profile.module.css'
import modernStyles from './account-profile-modern.module.css'

const TIMEZONE_OPTIONS = [
  'America/Santo_Domingo', 'America/Puerto_Rico', 'America/New_York', 'America/Chicago',
  'America/Denver', 'America/Los_Angeles', 'America/Mexico_City', 'America/Bogota',
  'America/Lima', 'America/Caracas', 'America/Santiago', 'America/Argentina/Buenos_Aires',
  'America/Sao_Paulo', 'Europe/Madrid', 'Europe/Rome', 'Europe/London', 'Africa/Abidjan',
  'Africa/Johannesburg', 'Asia/Jerusalem', 'Asia/Manila', 'UTC',
]

type FormState = { fullName: string; phone: string; preferredLocale: string; timezone: string; avatarUrl: string }
type AvatarStage = 'idle' | 'preparing' | 'uploading' | 'saving' | 'removing'

function normalizeValue(value: string | null | undefined) { return value?.trim() ?? '' }
function normalizeProfile(profile: AccountProfile): FormState { return { fullName: normalizeValue(profile.full_name), phone: normalizeValue(profile.phone), preferredLocale: normalizeValue(profile.preferred_locale) || 'es-419', timezone: normalizeValue(profile.timezone) || 'America/Santo_Domingo', avatarUrl: normalizeValue(profile.avatar_url) } }
function normalizeForm(form: FormState): FormState { return { fullName: normalizeValue(form.fullName), phone: normalizeValue(form.phone), preferredLocale: normalizeValue(form.preferredLocale) || 'es-419', timezone: normalizeValue(form.timezone), avatarUrl: normalizeValue(form.avatarUrl) } }
function getInitials(value: string, email: string) { const words = value.trim().split(/\s+/).filter(Boolean); if (words.length > 0) return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join(''); return email[0]?.toUpperCase() ?? 'U' }
function LockIcon() { return <svg aria-hidden="true" className={styles.lockIcon} viewBox="0 0 24 24"><path d="M7 10V8a5 5 0 0 1 10 0v2m-9 0h8a2 2 0 0 1 2 2v7H6v-7a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg> }
function CameraIcon() { return <svg aria-hidden="true" className={modernStyles.cameraIcon} viewBox="0 0 24 24"><path d="M4 8.5h3l1.4-2h7.2l1.4 2h3v10H4v-10Zm8 2.2a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg> }

export default function AccountProfileForm({ profile }: { profile: AccountProfile }) {
  const supabase = useMemo(() => createClient(), [])
  const profileState = useMemo(() => normalizeProfile(profile), [profile])
  const [form, setForm] = useState<FormState>(profileState)
  const [baseline, setBaseline] = useState<FormState>(profileState)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFileName, setAvatarFileName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [avatarStage, setAvatarStage] = useState<AvatarStage>('idle')
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setForm(profileState); setBaseline(profileState); setAvatarPreview(null); setAvatarFileName(null); setAvatarError(null); setAvatarStage('idle') }, [profileState])
  useEffect(() => () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview) }, [avatarPreview])
  useEffect(() => { if (!message) return; const timer = window.setTimeout(() => setMessage(null), 4000); return () => window.clearTimeout(timer) }, [message])

  const normalizedForm = useMemo(() => normalizeForm(form), [form])
  const avatarSaving = avatarStage !== 'idle'
  const hasAvatar = Boolean(normalizedForm.avatarUrl) || Boolean(avatarPreview)
  const isDirty = useMemo(() => JSON.stringify(normalizedForm) !== JSON.stringify(normalizeForm(baseline)), [baseline, normalizedForm])
  const completionFields = useMemo(() => [
    { label: 'Nombre', complete: Boolean(normalizedForm.fullName), target: '#profile-name' },
    { label: 'Correo', complete: Boolean(profile.email.trim()), target: '#profile-email' },
    { label: 'Teléfono', complete: Boolean(normalizedForm.phone), target: '#profile-phone' },
    { label: 'Idioma', complete: Boolean(normalizedForm.preferredLocale), target: '#profile-locale' },
    { label: 'Zona horaria', complete: Boolean(normalizedForm.timezone), target: '#profile-timezone' },
    { label: 'Fotografía', complete: hasAvatar, target: '#profile-photo-input' },
  ], [hasAvatar, normalizedForm, profile.email])
  const completeCount = completionFields.filter((field) => field.complete).length
  const completionPercentage = Math.round((completeCount / completionFields.length) * 100)
  const pendingFields = completionFields.filter((field) => !field.complete)
  const initials = getInitials(form.fullName, profile.email)
  const canSubmit = isDirty && !saving && !avatarSaving && Boolean(normalizedForm.fullName) && Boolean(normalizedForm.timezone)
  const completionLabel = completionPercentage === 100 ? 'Perfil completo' : completionPercentage >= 80 ? 'Perfil casi completo' : 'Perfil en progreso'
  const displayedAvatar = avatarPreview ?? (normalizedForm.avatarUrl || null)

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) { setForm((current) => ({ ...current, [key]: value })); setMessage(null); setError(null) }

  async function handleAvatarSelection(file: File | undefined) {
    if (!file || avatarSaving) return
    setAvatarFileName(file.name)
    setAvatarError(null)
    setMessage(null)

    const temporaryUrl = URL.createObjectURL(file)
    setAvatarPreview((current) => { if (current) URL.revokeObjectURL(current); return temporaryUrl })

    try {
      setAvatarStage('preparing')
      const preparedFile = await optimizeProfileAvatar(file)
      setAvatarStage('uploading')
      const uploadedUrl = await uploadMyProfileAvatar(supabase, preparedFile, normalizedForm.avatarUrl)
      setAvatarStage('saving')
      const context = await saveMyAccountProfile(supabase, { ...normalizedForm, avatarUrl: uploadedUrl })
      const saved = normalizeProfile(context.profile)
      setForm(saved)
      setBaseline(saved)
      setAvatarPreview((current) => { if (current) URL.revokeObjectURL(current); return null })
      setMessage('Tu fotografía fue actualizada correctamente.')
    } catch (caught) {
      setAvatarPreview((current) => { if (current) URL.revokeObjectURL(current); return null })
      setAvatarError(caught instanceof Error ? caught.message : 'No se pudo subir la fotografía.')
    } finally {
      setAvatarStage('idle')
    }
  }

  async function handleAvatarRemoval() {
    if (!normalizedForm.avatarUrl || avatarSaving) return
    setAvatarStage('removing')
    setMessage(null)
    setAvatarError(null)
    try {
      const context = await saveMyAccountProfile(supabase, { ...normalizedForm, avatarUrl: '' })
      await removeMyProfileAvatar(supabase, normalizedForm.avatarUrl)
      const saved = normalizeProfile(context.profile)
      setForm(saved)
      setBaseline(saved)
      setAvatarFileName(null)
      setMessage('Tu fotografía fue eliminada correctamente.')
    } catch (caught) {
      setAvatarError(caught instanceof Error ? caught.message : 'No se pudo eliminar la fotografía.')
    } finally {
      setAvatarStage('idle')
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setSaving(true); setMessage(null); setError(null)
    try {
      const context = await saveMyAccountProfile(supabase, normalizedForm)
      const saved = normalizeProfile(context.profile)
      setForm(saved); setBaseline(saved)
      setMessage('Tu perfil fue actualizado correctamente.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo guardar tu perfil.') }
    finally { setSaving(false) }
  }

  const avatarStatus = avatarStage === 'preparing'
    ? 'Preparando y optimizando la fotografía…'
    : avatarStage === 'uploading'
      ? 'Subiendo la fotografía a tu cuenta…'
      : avatarStage === 'saving'
        ? 'Guardando la fotografía en tu perfil…'
        : avatarStage === 'removing'
          ? 'Eliminando la fotografía…'
          : null

  return <div className={styles.profileLayout}>
    <section className={styles.identityCard} aria-labelledby="profile-identity-title">
      <div className={styles.identityMain}>
        <div className={modernStyles.avatarCluster}>
          <div aria-hidden="true" className={modernStyles.avatarSurface} style={displayedAvatar ? { backgroundImage: `url(${displayedAvatar})`, color: 'transparent' } : undefined}>{initials}</div>
          <a className={modernStyles.avatarEditButton} href="#profile-photo-input"><CameraIcon />Editar fotografía</a>
        </div>
        <div className={styles.identityText}><h2 id="profile-identity-title">{form.fullName || 'Tu perfil'}</h2><p>{profile.email}</p><div className={styles.identityMeta}><span className={styles.badge}>Cuenta activa</span><span className={styles.badge}>{completionLabel}</span></div></div>
      </div>
      <div className={styles.identityProgress} aria-label={`Perfil completado al ${completionPercentage}%`}><div className={styles.progressHeading}><strong>{completionPercentage}%</strong><span>{completionLabel}</span></div><div className={styles.progressTrack} aria-hidden="true"><div className={styles.progressBar} style={{ width: `${completionPercentage}%` }} /></div><small>{pendingFields.length === 0 ? 'Tu información principal está completa.' : `Solo falta ${pendingFields.map((field) => field.label.toLowerCase()).join(', ')}.`}</small></div>
    </section>

    <section className={styles.completionCard} aria-labelledby="profile-completion-title"><div className={styles.completionHeading}><div><p className={styles.eyebrow}>Estado del perfil</p><h2 id="profile-completion-title">{pendingFields.length === 0 ? 'Tu información está completa' : 'Revisión de datos'}</h2></div><span className={styles.pendingCount}>{pendingFields.length === 0 ? 'Sin pendientes' : `${pendingFields.length} ${pendingFields.length === 1 ? 'elemento pendiente' : 'elementos pendientes'}`}</span></div><p className={styles.optionalNote}>La vinculación con una ficha eclesial es opcional y no afecta este porcentaje.</p><ul className={styles.checklist}>{completionFields.map((field) => <li key={field.label} className={field.complete ? styles.checkComplete : styles.checkPending}><span aria-hidden="true">{field.complete ? '✓' : '○'}</span><span>{field.label}</span>{!field.complete ? <a href={field.target}>Completar →</a> : <small>Completado</small>}</li>)}</ul></section>

    <form action={handleSubmit} className={styles.form}>
      {error ? <p className={styles.status} role="alert">{error}</p> : null}
      <section className={styles.sectionCard} aria-labelledby="identity-contact-title"><div className={styles.sectionHeader}><div><p className={styles.eyebrow}>Identidad y contacto</p><h2 id="identity-contact-title">Información básica</h2></div></div><div className={styles.grid}><label className={`${styles.field} ${styles.dataCard}`} htmlFor="profile-name"><span>Nombre completo</span><input id="profile-name" autoComplete="name" maxLength={180} name="full_name" onChange={(event) => updateField('fullName', event.target.value)} required value={form.fullName} /></label><div className={`${styles.dataCard} ${styles.protectedField}`} id="profile-email"><div className={styles.protectedHeading}><span>Correo</span><span className={styles.protectedBadge}><LockIcon />Protegido</span></div><strong className={styles.protectedValue}>{profile.email}</strong><small>El cambio de correo requiere un flujo de seguridad separado.</small></div><label className={`${styles.field} ${styles.dataCard}`} htmlFor="profile-phone"><span>Teléfono</span><input id="profile-phone" autoComplete="tel" maxLength={80} name="phone" onChange={(event) => updateField('phone', event.target.value)} type="tel" value={form.phone} /><small>Incluye el código de país cuando corresponda.</small></label></div></section>

      <section className={styles.sectionCard} aria-labelledby="preferences-title"><div className={styles.sectionHeader}><div><p className={styles.eyebrow}>Preferencias regionales</p><h2 id="preferences-title">Idioma y zona horaria</h2></div></div><div className={styles.grid}><label className={`${styles.field} ${styles.dataCard}`} htmlFor="profile-locale"><span>Idioma</span><select className={modernStyles.controlSurface} id="profile-locale" name="preferred_locale" onChange={(event) => updateField('preferredLocale', event.target.value)} value={form.preferredLocale}><option value="es-419">Español latinoamericano</option><option value="es-ES">Español</option><option value="en">English</option></select></label><label className={`${styles.field} ${styles.dataCard}`} htmlFor="profile-timezone"><span>Zona horaria</span><select className={modernStyles.controlSurface} id="profile-timezone" name="timezone" onChange={(event) => updateField('timezone', event.target.value)} required value={form.timezone}>{TIMEZONE_OPTIONS.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}</select><small>Las fechas y notificaciones se mostrarán usando esta zona.</small></label></div></section>

      <section className={styles.sectionCard} aria-labelledby="photo-title"><div className={styles.sectionHeader}><div><p className={styles.eyebrow}>Fotografía</p><h2 id="photo-title">Imagen de perfil</h2></div></div><div className={styles.photoGrid}><div aria-label={displayedAvatar ? 'Vista previa de la fotografía de perfil' : 'Vista previa con iniciales'} className={modernStyles.photoSurface} role="img" style={displayedAvatar ? { backgroundImage: `url(${displayedAvatar})`, color: 'transparent' } : undefined}>{initials}</div><div className={styles.photoActions}><div className={modernStyles.uploadPanel}><div><strong>{normalizedForm.avatarUrl ? 'Fotografía actual' : 'Añade una fotografía'}</strong><p id="profile-photo-help">JPG, PNG o WEBP. Hasta 20 MB; las imágenes grandes se optimizan automáticamente.</p>{avatarFileName ? <small className={modernStyles.fileName}>Archivo: {avatarFileName}</small> : null}</div><input accept="image/jpeg,image/png,image/webp" aria-describedby="profile-photo-help profile-photo-feedback" className={modernStyles.fileChooser} disabled={avatarSaving} id="profile-photo-input" onChange={(event) => { const input = event.currentTarget; void handleAvatarSelection(input.files?.[0]).finally(() => { input.value = '' }) }} type="file" /></div>{avatarStatus ? <p aria-live="polite" className={modernStyles.uploadStatus} id="profile-photo-feedback" role="status"><span aria-hidden="true" className={styles.spinner} />{avatarStatus}</p> : null}{avatarError ? <p className={modernStyles.uploadError} id="profile-photo-feedback" role="alert">{avatarError}</p> : null}{normalizedForm.avatarUrl ? <button className={modernStyles.removeButton} disabled={avatarSaving} onClick={() => void handleAvatarRemoval()} type="button">{avatarStage === 'removing' ? 'Eliminando…' : 'Eliminar fotografía'}</button> : null}</div></div></section>

      {(isDirty || saving) ? <div className={styles.actions}><p>{saving ? 'Guardando los cambios…' : 'Tienes cambios sin guardar.'}</p><button className={styles.saveButton} disabled={!canSubmit} type="submit">{saving ? <><span aria-hidden="true" className={styles.spinner} />Guardando…</> : 'Guardar cambios'}</button></div> : null}
    </form>
    {message ? <div aria-live="polite" className={styles.toast} role="status">✓ {message}</div> : null}
  </div>
}
