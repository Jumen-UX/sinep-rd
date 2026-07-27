'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  hasUserAccessSession,
  inviteUser,
  loadUserInvitationOptions,
  scopeNeedsEntity,
  userScopeTypes,
  type RoleMatrixRow,
  type ScopeOption,
} from '../services/user-access-admin-service'

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export default function InviteUserPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [roles, setRoles] = useState<RoleMatrixRow[]>([])
  const [scopeOptions, setScopeOptions] = useState<ScopeOption[]>([])
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [countryEntityId, setCountryEntityId] = useState('')
  const [roleId, setRoleId] = useState('')
  const [scopeType, setScopeType] = useState('national')
  const [scopeEntityId, setScopeEntityId] = useState('')
  const [accessConfirmed, setAccessConfirmed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const countryOptions = useMemo(
    () => scopeOptions.filter((option) => option.scope_type === 'national'),
    [scopeOptions],
  )
  const visibleScopes = useMemo(
    () => scopeOptions.filter((option) => option.scope_type === scopeType),
    [scopeOptions, scopeType],
  )
  const selectedRole = roles.find((role) => role.role_id === roleId) ?? null
  const selectedCountry = countryOptions.find((option) => option.scope_entity_id === countryEntityId) ?? null
  const selectedScope = scopeType === 'national'
    ? selectedCountry
    : visibleScopes.find((option) => option.scope_entity_id === scopeEntityId) ?? null

  useEffect(() => {
    let cancelled = false

    async function loadOptions() {
      try {
        if (!await hasUserAccessSession(supabase)) {
          router.replace('/admin/login')
          return
        }

        const data = await loadUserInvitationOptions(supabase)
        if (cancelled) return
        setRoles(data.roles)
        setScopeOptions(data.scopeOptions)
      } catch (loadError) {
        if (!cancelled) setError(errorMessage(loadError, 'No se pudieron cargar las opciones.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadOptions()
    return () => {
      cancelled = true
    }
  }, [router, supabase])

  useEffect(() => {
    setCountryEntityId((current) => {
      if (current && countryOptions.some((option) => option.scope_entity_id === current)) return current
      return countryOptions[0]?.scope_entity_id ?? ''
    })
  }, [countryOptions])

  useEffect(() => {
    setAccessConfirmed(false)

    if (!roleId || !scopeNeedsEntity(scopeType)) {
      setScopeEntityId('')
      return
    }

    if (scopeType === 'national') {
      setScopeEntityId(countryEntityId)
      return
    }

    setScopeEntityId((current) => {
      if (current && visibleScopes.some((option) => option.scope_entity_id === current)) return current
      return visibleScopes[0]?.scope_entity_id ?? ''
    })
  }, [countryEntityId, roleId, scopeType, visibleScopes])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)

    if (!countryEntityId) {
      setSaving(false)
      setError('Selecciona el país administrativo de la cuenta invitada.')
      return
    }

    if (roleId && scopeNeedsEntity(scopeType) && !scopeEntityId) {
      setSaving(false)
      setError('Selecciona la entidad concreta donde aplicará el rol inicial.')
      return
    }

    if (roleId && !accessConfirmed) {
      setSaving(false)
      setError('Confirma el rol y el alcance antes de enviar la invitación.')
      return
    }

    try {
      const result = await inviteUser({
        email,
        fullName,
        phone,
        countryEntityId,
        roleId,
        scopeType,
        scopeEntityId: roleId && scopeNeedsEntity(scopeType) ? scopeEntityId : null,
      })

      setNotice(result.warning
        ? `El acceso requiere revisión: ${result.warning}`
        : result.existingUser
          ? 'El usuario ya existía; su membresía de país y su acceso inicial fueron revisados.'
          : 'Invitación enviada correctamente. El usuario continuará por onboarding dentro del país seleccionado.')
      setEmail('')
      setFullName('')
      setPhone('')
      setRoleId('')
      setScopeType('national')
      setScopeEntityId(countryEntityId)
      setAccessConfirmed(false)
    } catch (inviteError) {
      setError(errorMessage(inviteError, 'No se pudo enviar la invitación.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <main className="container"><div className="empty-state">Cargando formulario de invitación...</div></main>
  }

  return (
    <main className="container admin-dashboard">
      <div className="admin-topbar">
        <div>
          <p className="eyebrow">Usuarios</p>
          <h1>Invitar usuario</h1>
          <p className="lead">Envía una invitación segura, registra el país administrativo y, opcionalmente, asigna el primer rol.</p>
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

          <label>
            Nombre completo
            <input autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </label>

          <label>
            Teléfono
            <input autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>

          <label>
            País administrativo
            <select value={countryEntityId} onChange={(event) => {
              setCountryEntityId(event.target.value)
              setAccessConfirmed(false)
            }} required>
              {countryOptions.length === 0 ? (
                <option value="">No hay países disponibles dentro de tu alcance</option>
              ) : countryOptions.map((country) => (
                <option key={country.scope_entity_id} value={country.scope_entity_id}>{country.label}</option>
              ))}
            </select>
            <span className="meta">La cuenta permanecerá asociada a este país incluso antes de recibir un rol.</span>
          </label>

          <label>
            Rol inicial opcional
            <select value={roleId} onChange={(event) => {
              setRoleId(event.target.value)
              setAccessConfirmed(false)
            }}>
              <option value="">Invitar sin rol inicial</option>
              {roles.map((role) => (
                <option key={role.role_id} value={role.role_id}>{role.role_name} · {role.role_key}</option>
              ))}
            </select>
          </label>

          {roleId && (
            <label>
              Tipo de alcance
              <select value={scopeType} onChange={(event) => {
                setScopeType(event.target.value)
                setAccessConfirmed(false)
              }} required>
                {userScopeTypes.map((scope) => (
                  <option key={scope.value} value={scope.value}>{scope.label}</option>
                ))}
              </select>
            </label>
          )}

          {roleId && scopeNeedsEntity(scopeType) && scopeType !== 'national' && (
            <label>
              Entidad del alcance
              <select value={scopeEntityId} onChange={(event) => {
                setScopeEntityId(event.target.value)
                setAccessConfirmed(false)
              }} required>
                {visibleScopes.length === 0 ? (
                  <option value="">No hay opciones activas</option>
                ) : visibleScopes.map((option) => (
                  <option key={option.scope_entity_id} value={option.scope_entity_id}>{option.label} · {option.description}</option>
                ))}
              </select>
            </label>
          )}

          {roleId && (
            <div className="empty-state" role="group" aria-label="Confirmación del acceso inicial">
              <strong>Acceso inicial por confirmar</strong>
              <p className="meta">
                {selectedRole?.role_name ?? 'Rol seleccionado'} · {scopeNeedsEntity(scopeType)
                  ? selectedScope?.label ?? 'Selecciona una entidad válida'
                  : userScopeTypes.find((scope) => scope.value === scopeType)?.label ?? scopeType}
                {' · '}{selectedCountry?.label ?? 'País pendiente'}
              </p>
              <label>
                <input
                  checked={accessConfirmed}
                  onChange={(event) => setAccessConfirmed(event.target.checked)}
                  required
                  type="checkbox"
                />
                Confirmo que este rol, alcance y país corresponden al usuario invitado.
              </label>
            </div>
          )}

          <button
            className="button button-primary"
            disabled={saving || !countryEntityId || Boolean(roleId && !accessConfirmed)}
            type="submit"
          >
            {saving ? 'Enviando...' : 'Enviar invitación'}
          </button>
        </form>
      </section>
    </main>
  )
}
