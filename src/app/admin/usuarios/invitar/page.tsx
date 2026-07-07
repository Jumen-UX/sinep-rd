'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type RoleRow = {
  role_id: string
  role_key: string
  role_name: string
}

type ScopeOption = {
  scope_type: string
  scope_entity_id: string
  label: string
  description: string | null
}

const scopeTypes = [
  { value: 'national', label: 'Nacional' },
  { value: 'diocese', label: 'Diócesis' },
  { value: 'vicariate', label: 'Vicaría' },
  { value: 'zone', label: 'Zona pastoral' },
  { value: 'parish', label: 'Parroquia' },
  { value: 'pastoral_area', label: 'Área pastoral' },
  { value: 'pastoral_entity', label: 'Entidad pastoral' },
  { value: 'entity', label: 'Entidad eclesial / nodo' },
  { value: 'global', label: 'Global técnico' },
]

function scopeNeedsEntity(scopeType: string) {
  return !['national', 'global'].includes(scopeType)
}

export default function InviteUserPage() {
  const router = useRouter()
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [scopeOptions, setScopeOptions] = useState<ScopeOption[]>([])
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [roleId, setRoleId] = useState('')
  const [scopeType, setScopeType] = useState('national')
  const [scopeEntityId, setScopeEntityId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const visibleScopes = useMemo(
    () => scopeOptions.filter((option) => option.scope_type === scopeType),
    [scopeOptions, scopeType],
  )

  useEffect(() => {
    const supabase = createClient()

    async function loadOptions() {
      const { data: userData } = await supabase.auth.getUser()

      if (!userData.user) {
        router.replace('/admin/login')
        return
      }

      const [rolesResponse, scopesResponse] = await Promise.all([
        supabase.rpc('admin_list_roles_with_permissions'),
        supabase.rpc('admin_list_role_scope_options', { p_scope_type: null }),
      ])

      if (rolesResponse.error || scopesResponse.error) {
        setError(rolesResponse.error?.message ?? scopesResponse.error?.message ?? 'No se pudieron cargar las opciones.')
        setLoading(false)
        return
      }

      setRoles((rolesResponse.data ?? []) as RoleRow[])
      setScopeOptions((scopesResponse.data ?? []) as ScopeOption[])
      setLoading(false)
    }

    loadOptions()
  }, [router])

  useEffect(() => {
    if (!scopeNeedsEntity(scopeType)) {
      setScopeEntityId('')
      return
    }

    setScopeEntityId((current) => {
      if (current && visibleScopes.some((option) => option.scope_entity_id === current)) return current
      return visibleScopes[0]?.scope_entity_id ?? ''
    })
  }, [scopeType, visibleScopes])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)

    const response = await fetch('/api/admin/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        full_name: fullName,
        phone,
        role_id: roleId || undefined,
        scope_type: roleId ? scopeType : undefined,
        scope_entity_id: roleId && scopeNeedsEntity(scopeType) ? scopeEntityId : undefined,
      }),
    })

    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      setError(result.error ?? 'No se pudo enviar la invitación.')
      setSaving(false)
      return
    }

    setNotice(result.warning ? `Usuario invitado, pero falta revisar el rol: ${result.warning}` : 'Invitación enviada correctamente.')
    setEmail('')
    setFullName('')
    setPhone('')
    setSaving(false)
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
          <p className="lead">Envía una invitación segura y, opcionalmente, deja asignado su primer rol administrativo.</p>
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
            Rol inicial opcional
            <select value={roleId} onChange={(event) => setRoleId(event.target.value)}>
              <option value="">Invitar sin rol inicial</option>
              {roles.map((role) => (
                <option key={role.role_id} value={role.role_id}>{role.role_name} · {role.role_key}</option>
              ))}
            </select>
          </label>

          {roleId && (
            <label>
              Tipo de alcance
              <select value={scopeType} onChange={(event) => setScopeType(event.target.value)} required>
                {scopeTypes.map((scope) => (
                  <option key={scope.value} value={scope.value}>{scope.label}</option>
                ))}
              </select>
            </label>
          )}

          {roleId && scopeNeedsEntity(scopeType) && (
            <label>
              Entidad del alcance
              <select value={scopeEntityId} onChange={(event) => setScopeEntityId(event.target.value)} required>
                {visibleScopes.length === 0 ? (
                  <option value="">No hay opciones activas</option>
                ) : visibleScopes.map((option) => (
                  <option key={option.scope_entity_id} value={option.scope_entity_id}>{option.label} · {option.description}</option>
                ))}
              </select>
            </label>
          )}

          <button className="button button-primary" disabled={saving} type="submit">
            {saving ? 'Enviando...' : 'Enviar invitación'}
          </button>
        </form>
      </section>
    </main>
  )
}
