'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type RoleAssignment = {
  assignment_id: string
  role_id: string
  role_key: string
  role_name: string
  scope_type: string
  scope_entity_id: string | null
  diocese_id: string | null
  pastoral_area_id: string | null
  pastoral_entity_id: string | null
  starts_at: string | null
  ends_at: string | null
  status: string
}

type EffectivePermission = {
  key: string
  module: string
  description: string | null
}

type UserRow = {
  user_id: string
  email: string | null
  full_name: string | null
  phone: string | null
  profile_status: 'pending' | 'active' | 'suspended' | 'disabled' | string
  auth_created_at: string | null
  email_confirmed_at: string | null
  last_sign_in_at: string | null
  active_roles: RoleAssignment[] | string | null
  active_permissions: EffectivePermission[] | string | null
}

type RoleMatrixRow = {
  role_id: string
  role_key: string
  role_name: string
  description: string | null
  is_system_role: boolean
  active_assignments_count: number
  permissions: EffectivePermission[] | string | null
}

type ScopeOption = {
  scope_type: string
  scope_entity_id: string
  label: string
  description: string | null
  source_table: string
  diocese_id: string | null
  parent_id: string | null
}

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  active: 'Activo',
  suspended: 'Suspendido',
  disabled: 'Desactivado',
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

function parseJsonArray<T>(value: T[] | string | null | undefined): T[] {
  if (Array.isArray(value)) return value

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? (parsed as T[]) : []
    } catch {
      return []
    }
  }

  return []
}

function formatDate(value: string | null) {
  if (!value) return 'No registrado'

  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function getStatusLabel(status: string) {
  return statusLabels[status] ?? status
}

function scopeNeedsEntity(scopeType: string) {
  return !['national', 'global'].includes(scopeType)
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<UserRow[]>([])
  const [roles, setRoles] = useState<RoleMatrixRow[]>([])
  const [scopeOptions, setScopeOptions] = useState<ScopeOption[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [selectedScopeType, setSelectedScopeType] = useState('national')
  const [selectedScopeEntityId, setSelectedScopeEntityId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const visibleScopeOptions = useMemo(
    () => scopeOptions.filter((option) => option.scope_type === selectedScopeType),
    [scopeOptions, selectedScopeType],
  )

  async function loadAccessData() {
    const supabase = createClient()
    setError(null)

    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      router.replace('/admin/login')
      return
    }

    const [usersResponse, rolesResponse, scopesResponse] = await Promise.all([
      supabase.rpc('admin_list_users'),
      supabase.rpc('admin_list_roles_with_permissions'),
      supabase.rpc('admin_list_role_scope_options', { p_scope_type: null }),
    ])

    if (usersResponse.error || rolesResponse.error || scopesResponse.error) {
      setError(
        usersResponse.error?.message
          ?? rolesResponse.error?.message
          ?? scopesResponse.error?.message
          ?? 'No pudimos cargar usuarios y permisos.',
      )
      setLoading(false)
      return
    }

    const normalizedUsers = ((usersResponse.data ?? []) as UserRow[]).map((user) => ({
      ...user,
      active_roles: parseJsonArray<RoleAssignment>(user.active_roles),
      active_permissions: parseJsonArray<EffectivePermission>(user.active_permissions),
    }))

    const normalizedRoles = ((rolesResponse.data ?? []) as RoleMatrixRow[]).map((role) => ({
      ...role,
      permissions: parseJsonArray<EffectivePermission>(role.permissions),
    }))

    const normalizedScopes = (scopesResponse.data ?? []) as ScopeOption[]

    setUsers(normalizedUsers)
    setRoles(normalizedRoles)
    setScopeOptions(normalizedScopes)
    setSelectedUserId((current) => current || normalizedUsers[0]?.user_id || '')
    setSelectedRoleId((current) => current || normalizedRoles[0]?.role_id || '')
    setLoading(false)
  }

  useEffect(() => {
    loadAccessData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!scopeNeedsEntity(selectedScopeType)) {
      setSelectedScopeEntityId('')
      return
    }

    setSelectedScopeEntityId((current) => {
      if (current && visibleScopeOptions.some((option) => option.scope_entity_id === current)) return current
      return visibleScopeOptions[0]?.scope_entity_id ?? ''
    })
  }, [selectedScopeType, visibleScopeOptions])

  const metrics = useMemo(() => {
    const active = users.filter((user) => user.profile_status === 'active').length
    const pending = users.filter((user) => user.profile_status === 'pending').length
    const assignments = users.reduce((total, user) => total + parseJsonArray<RoleAssignment>(user.active_roles).length, 0)

    return { active, pending, assignments }
  }, [users])

  async function handleAssignRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedUserId || !selectedRoleId) {
      setError('Selecciona usuario y rol antes de guardar.')
      return
    }

    if (scopeNeedsEntity(selectedScopeType) && !selectedScopeEntityId) {
      setError('Selecciona la entidad concreta donde aplicará el rol.')
      return
    }

    const supabase = createClient()
    setSaving(true)
    setError(null)
    setNotice(null)

    const { error: assignError } = await supabase.rpc('admin_assign_user_role', {
      payload: {
        user_id: selectedUserId,
        role_id: selectedRoleId,
        scope_type: selectedScopeType,
        scope_entity_id: scopeNeedsEntity(selectedScopeType) ? selectedScopeEntityId : null,
      },
    })

    if (assignError) {
      setError(assignError.message)
      setSaving(false)
      return
    }

    setNotice('Rol asignado correctamente.')
    await loadAccessData()
    setSaving(false)
  }

  async function handleStatusChange(userId: string, status: 'active' | 'suspended' | 'disabled') {
    const supabase = createClient()
    setSaving(true)
    setError(null)
    setNotice(null)

    const { error: statusError } = await supabase.rpc('admin_update_user_profile_status', {
      payload: { user_id: userId, status },
    })

    if (statusError) {
      setError(statusError.message)
      setSaving(false)
      return
    }

    setNotice(`Usuario marcado como ${getStatusLabel(status).toLowerCase()}.`)
    await loadAccessData()
    setSaving(false)
  }

  async function handleEndRole(assignmentId: string) {
    const supabase = createClient()
    setSaving(true)
    setError(null)
    setNotice(null)

    const { error: endError } = await supabase.rpc('admin_end_user_role', {
      payload: { assignment_id: assignmentId },
    })

    if (endError) {
      setError(endError.message)
      setSaving(false)
      return
    }

    setNotice('Rol cerrado correctamente.')
    await loadAccessData()
    setSaving(false)
  }

  if (loading) return <div className="empty-state">Cargando usuarios, roles y permisos...</div>

  return (
    <main className="admin-access-page" id="top">
      <header className="admin-top-header">
        <div className="admin-top-title">
          <span className="admin-mini-mark">ACCESO</span>
          <strong>Usuarios, roles y permisos</strong>
        </div>
        <div className="admin-top-actions">
          <Link className="button button-secondary" href="/admin">Volver al panel</Link>
          <Link className="button button-secondary" href="/admin/configuracion">Configuración</Link>
        </div>
      </header>

      <section className="admin-welcome-panel">
        <div>
          <p className="eyebrow">Acceso administrativo</p>
          <h1>Control de usuarios</h1>
          <p className="lead">Administra quién puede entrar al portal, qué nivel tiene y sobre qué alcance puede trabajar.</p>
          <div className="role-list admin-role-list">
            <span className="role-pill">Alcances jerárquicos</span>
            <span className="role-pill">Roles activos</span>
            <span className="role-pill">Permisos efectivos</span>
          </div>
        </div>
        <div className="admin-welcome-illustration" aria-hidden="true">♙</div>
      </section>

      <section className="admin-stat-strip" aria-label="Resumen de acceso">
        <a href="#users"><span>♙</span><strong>{users.length}</strong><small>Usuarios registrados</small></a>
        <a href="#users"><span>✓</span><strong>{metrics.active}</strong><small>Usuarios activos</small></a>
        <a href="#users"><span>!</span><strong>{metrics.pending}</strong><small>Pendientes de activación</small></a>
        <a href="#assign-role"><span>▣</span><strong>{metrics.assignments}</strong><small>Roles activos asignados</small></a>
        <a href="#roles"><span>◇</span><strong>{roles.length}</strong><small>Roles del sistema</small></a>
      </section>

      {error && <div className="error-box">{error}</div>}
      {notice && <div className="success-box">{notice}</div>}

      <section className="grid two-panel-grid" id="assign-role">
        <article className="card admin-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Asignación rápida</p>
              <h2>Asignar rol a usuario</h2>
              <p className="meta">El alcance puede apuntar a una diócesis, parroquia, nodo de estructura o entidad pastoral real.</p>
            </div>
          </div>

          <form className="auth-form access-form" onSubmit={handleAssignRole}>
            <label>
              Usuario
              <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} required>
                {users.map((user) => (
                  <option key={user.user_id} value={user.user_id}>{user.full_name ?? user.email ?? user.user_id}</option>
                ))}
              </select>
            </label>

            <label>
              Rol
              <select value={selectedRoleId} onChange={(event) => setSelectedRoleId(event.target.value)} required>
                {roles.map((role) => (
                  <option key={role.role_id} value={role.role_id}>{role.role_name} · {role.role_key}</option>
                ))}
              </select>
            </label>

            <label>
              Tipo de alcance
              <select value={selectedScopeType} onChange={(event) => setSelectedScopeType(event.target.value)} required>
                {scopeTypes.map((scope) => (
                  <option key={scope.value} value={scope.value}>{scope.label}</option>
                ))}
              </select>
            </label>

            {scopeNeedsEntity(selectedScopeType) && (
              <label>
                Entidad del alcance
                <select value={selectedScopeEntityId} onChange={(event) => setSelectedScopeEntityId(event.target.value)} required>
                  {visibleScopeOptions.length === 0 ? (
                    <option value="">No hay opciones activas para este alcance</option>
                  ) : visibleScopeOptions.map((option) => (
                    <option key={option.scope_entity_id} value={option.scope_entity_id}>{option.label} · {option.description}</option>
                  ))}
                </select>
              </label>
            )}

            <button className="button button-primary" disabled={saving || users.length === 0 || roles.length === 0} type="submit">
              {saving ? 'Guardando...' : 'Asignar rol'}
            </button>
          </form>
        </article>

        <article className="card admin-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Registro de usuarios</p>
              <h2>Flujo recomendado</h2>
              <p className="meta">La contraseña vive en Supabase Auth. SINEP crea o actualiza el perfil interno automáticamente y aquí se activa el acceso administrativo.</p>
            </div>
          </div>

          <div className="access-flow">
            <div><strong>1</strong><span>Crear o invitar usuario en Supabase Auth.</span></div>
            <div><strong>2</strong><span>Verificar que aparezca en esta pantalla como pendiente o activo.</span></div>
            <div><strong>3</strong><span>Asignar rol, tipo de alcance y entidad concreta.</span></div>
            <div><strong>4</strong><span>Auditar cambios de acceso desde los registros internos.</span></div>
          </div>
        </article>
      </section>

      <section className="card admin-section" id="users">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Usuarios</p>
            <h2>Accesos activos y estado de cuenta</h2>
          </div>
        </div>

        <div className="access-user-list">
          {users.map((user) => {
            const activeRoles = parseJsonArray<RoleAssignment>(user.active_roles)
            const activePermissions = parseJsonArray<EffectivePermission>(user.active_permissions)
            return (
              <article className="access-user-card entity-card" key={user.user_id}>
                <div className="access-user-main">
                  <div>
                    <p className="entity-type">{getStatusLabel(user.profile_status)}</p>
                    <h2>{user.full_name ?? user.email ?? 'Usuario sin nombre'}</h2>
                    <p className="meta">{user.email ?? 'Correo no registrado'} · Último acceso: {formatDate(user.last_sign_in_at)}</p>
                  </div>
                  <div className="access-actions actions">
                    <button className="button button-secondary" disabled={saving || user.profile_status === 'active'} onClick={() => handleStatusChange(user.user_id, 'active')} type="button">Activar</button>
                    <button className="button button-secondary" disabled={saving || user.profile_status === 'suspended'} onClick={() => handleStatusChange(user.user_id, 'suspended')} type="button">Suspender</button>
                    <button className="button button-secondary" disabled={saving || user.profile_status === 'disabled'} onClick={() => handleStatusChange(user.user_id, 'disabled')} type="button">Desactivar</button>
                  </div>
                </div>

                <div className="role-list">
                  {activeRoles.length === 0 ? (
                    <span className="role-pill">Sin rol activo</span>
                  ) : activeRoles.map((role) => (
                    <span className="role-pill" key={role.assignment_id}>
                      {role.role_name} · {role.scope_type}
                      <button disabled={saving} onClick={() => handleEndRole(role.assignment_id)} type="button">Cerrar</button>
                    </span>
                  ))}
                </div>

                <p className="meta">Permisos efectivos: {activePermissions.length}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="card admin-section" id="roles">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Matriz de acceso</p>
            <h2>Roles del sistema</h2>
            <p className="meta">Cada rol agrupa permisos; los permisos se aplican junto al alcance asignado al usuario.</p>
          </div>
        </div>

        <div className="grid admin-modules">
          {roles.map((role) => {
            const permissions = parseJsonArray<EffectivePermission>(role.permissions)
            return (
              <article className="entity-card admin-module" key={role.role_id}>
                <p className="entity-type">{role.role_key}</p>
                <h2>{role.role_name}</h2>
                <p className="meta">{role.description ?? 'Sin descripción registrada.'}</p>
                <p className="meta">{role.active_assignments_count} asignaciones activas · {permissions.length} permisos</p>
                <div className="role-list">
                  {permissions.slice(0, 8).map((permission) => (
                    <span className="role-pill" key={permission.key}>{permission.key}</span>
                  ))}
                  {permissions.length > 8 && <span className="role-pill">+{permissions.length - 8} permisos</span>}
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </main>
  )
}
