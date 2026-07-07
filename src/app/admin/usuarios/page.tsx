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

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  active: 'Activo',
  suspended: 'Suspendido',
  disabled: 'Desactivado',
}

const scopeOptions = [
  { value: 'national', label: 'Nacional' },
  { value: 'diocese', label: 'Diócesis' },
  { value: 'vicariate', label: 'Vicaría' },
  { value: 'zone', label: 'Zona pastoral' },
  { value: 'parish', label: 'Parroquia' },
  { value: 'pastoral_area', label: 'Área pastoral' },
  { value: 'pastoral_entity', label: 'Entidad pastoral' },
  { value: 'entity', label: 'Entidad eclesial' },
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

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<UserRow[]>([])
  const [roles, setRoles] = useState<RoleMatrixRow[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [selectedScopeType, setSelectedScopeType] = useState('national')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function loadAccessData() {
    const supabase = createClient()
    setError(null)

    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      router.replace('/admin/login')
      return
    }

    const [{ data: userRows, error: usersError }, { data: roleRows, error: rolesError }] = await Promise.all([
      supabase.rpc('admin_list_users'),
      supabase.rpc('admin_list_roles_with_permissions'),
    ])

    if (usersError || rolesError) {
      setError(usersError?.message ?? rolesError?.message ?? 'No pudimos cargar usuarios y permisos.')
      setLoading(false)
      return
    }

    const normalizedUsers = ((userRows ?? []) as UserRow[]).map((user) => ({
      ...user,
      active_roles: parseJsonArray<RoleAssignment>(user.active_roles),
      active_permissions: parseJsonArray<EffectivePermission>(user.active_permissions),
    }))

    const normalizedRoles = ((roleRows ?? []) as RoleMatrixRow[]).map((role) => ({
      ...role,
      permissions: parseJsonArray<EffectivePermission>(role.permissions),
    }))

    setUsers(normalizedUsers)
    setRoles(normalizedRoles)
    setSelectedUserId((current) => current || normalizedUsers[0]?.user_id || '')
    setSelectedRoleId((current) => current || normalizedRoles[0]?.role_id || '')
    setLoading(false)
  }

  useEffect(() => {
    loadAccessData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const metrics = useMemo(() => {
    const active = users.filter((user) => user.profile_status === 'active').length
    const pending = users.filter((user) => user.profile_status === 'pending').length
    const restricted = users.filter((user) => ['suspended', 'disabled'].includes(user.profile_status)).length
    const assignments = users.reduce((total, user) => total + parseJsonArray<RoleAssignment>(user.active_roles).length, 0)

    return { active, pending, restricted, assignments }
  }, [users])

  async function handleAssignRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedUserId || !selectedRoleId) {
      setError('Selecciona usuario y rol antes de guardar.')
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

  if (loading) {
    return (
      <main className="container">
        <div className="empty-state">Cargando usuarios, roles y permisos...</div>
      </main>
    )
  }

  return (
    <main className="container admin-dashboard">
      <div className="admin-topbar">
        <div>
          <p className="eyebrow">Seguridad y acceso</p>
          <h1>Usuarios, roles y permisos</h1>
          <p className="lead">
            Administra quién puede entrar al portal, qué nivel tiene y sobre qué alcance puede trabajar.
          </p>
        </div>
        <Link className="button button-secondary" href="/admin">Volver al panel</Link>
      </div>

      <section className="dashboard-grid">
        <div className="metric-card"><strong>{users.length}</strong><span>Usuarios registrados</span></div>
        <div className="metric-card"><strong>{metrics.active}</strong><span>Usuarios activos</span></div>
        <div className="metric-card"><strong>{metrics.pending}</strong><span>Pendientes de activación</span></div>
        <div className="metric-card"><strong>{metrics.assignments}</strong><span>Roles activos asignados</span></div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {notice && <div className="empty-state">{notice}</div>}

      <section className="grid two-panel-grid">
        <article className="card admin-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Asignación rápida</p>
              <h2>Asignar rol a usuario</h2>
              <p className="meta">El alcance define dónde aplica el permiso. Más adelante se conectará al selector jerárquico de diócesis, vicaría, zona o parroquia.</p>
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
              Alcance
              <select value={selectedScopeType} onChange={(event) => setSelectedScopeType(event.target.value)} required>
                {scopeOptions.map((scope) => (
                  <option key={scope.value} value={scope.value}>{scope.label}</option>
                ))}
              </select>
            </label>

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
            <div><strong>3</strong><span>Asignar rol y alcance: nacional, diocesano, vicarial, zonal o parroquial.</span></div>
            <div><strong>4</strong><span>Auditar cambios de acceso desde los registros internos.</span></div>
          </div>
        </article>
      </section>

      <section className="card admin-section">
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
              <article className="access-user-card" key={user.user_id}>
                <div className="access-user-main">
                  <div>
                    <p className="entity-type">{getStatusLabel(user.profile_status)}</p>
                    <h2>{user.full_name ?? user.email ?? 'Usuario sin nombre'}</h2>
                    <p className="meta">{user.email ?? 'Correo no registrado'} · Último acceso: {formatDate(user.last_sign_in_at)}</p>
                  </div>
                  <div className="access-actions">
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

      <section className="card admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Matriz de seguridad</p>
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
