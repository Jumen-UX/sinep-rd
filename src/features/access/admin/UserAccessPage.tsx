'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  assignUserRole,
  endUserRole,
  formatUserAccessDate,
  getScopeLabel,
  getUserStatusLabel,
  hasUserAccessSession,
  loadUserAccessData,
  scopeNeedsEntity,
  updateUserProfileStatus,
  userScopeTypes,
  type RoleMatrixRow,
  type ScopeOption,
  type UserProfileStatus,
  type UserRow,
} from '../services/user-access-admin-service'

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export default function UserAccessPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
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
    setError(null)

    try {
      if (!await hasUserAccessSession(supabase)) {
        router.replace('/admin/login')
        return
      }

      const data = await loadUserAccessData(supabase)
      setUsers(data.users)
      setRoles(data.roles)
      setScopeOptions(data.scopeOptions)
      setSelectedUserId((current) => current || data.users[0]?.user_id || '')
      setSelectedRoleId((current) => current || data.roles[0]?.role_id || '')
    } catch (loadError) {
      setError(errorMessage(loadError, 'No pudimos cargar usuarios y permisos.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAccessData()
    // loadAccessData uses a stable Supabase client and the router.
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
    const pending = users.filter((user) => ['pending', 'pending_invitation'].includes(user.profile_status)).length
    const assignments = users.reduce((total, user) => total + user.active_roles.length, 0)

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

    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      await assignUserRole(supabase, {
        userId: selectedUserId,
        roleId: selectedRoleId,
        scopeType: selectedScopeType,
        scopeEntityId: scopeNeedsEntity(selectedScopeType) ? selectedScopeEntityId : null,
      })
      setNotice('Rol asignado correctamente.')
      await loadAccessData()
    } catch (assignError) {
      setError(errorMessage(assignError, 'No se pudo asignar el rol.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(userId: string, status: UserProfileStatus) {
    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      await updateUserProfileStatus(supabase, userId, status)
      setNotice(`Usuario marcado como ${getUserStatusLabel(status).toLowerCase()}.`)
      await loadAccessData()
    } catch (statusError) {
      setError(errorMessage(statusError, 'No se pudo actualizar el estado del usuario.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleEndRole(assignmentId: string) {
    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      await endUserRole(supabase, assignmentId)
      setNotice('Rol cerrado correctamente.')
      await loadAccessData()
    } catch (endError) {
      setError(errorMessage(endError, 'No se pudo cerrar el rol.'))
    } finally {
      setSaving(false)
    }
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
          <Link className="button button-primary" href="/admin/usuarios/invitar">Invitar usuario</Link>
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
              <p className="meta">El alcance puede apuntar a una diócesis, parroquia, nodo estructural, área pastoral o unidad organizativa.</p>
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
                {userScopeTypes.map((scope) => (
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
            <div><strong>1</strong><span>Invitar usuario desde el formulario administrativo.</span></div>
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
          {users.map((user) => (
            <article className="access-user-card entity-card" key={user.user_id}>
              <div className="access-user-main">
                <div>
                  <p className="entity-type">{getUserStatusLabel(user.profile_status)}</p>
                  <h2>{user.full_name ?? user.email ?? 'Usuario sin nombre'}</h2>
                  <p className="meta">{user.email ?? 'Correo no registrado'} · Último acceso: {formatUserAccessDate(user.last_sign_in_at)}</p>
                </div>
                <div className="access-actions actions">
                  <button className="button button-secondary" disabled={saving || user.profile_status === 'active'} onClick={() => handleStatusChange(user.user_id, 'active')} type="button">Activar</button>
                  <button className="button button-secondary" disabled={saving || user.profile_status === 'suspended'} onClick={() => handleStatusChange(user.user_id, 'suspended')} type="button">Suspender</button>
                  <button className="button button-secondary" disabled={saving || ['disabled', 'inactive'].includes(user.profile_status)} onClick={() => handleStatusChange(user.user_id, 'disabled')} type="button">Desactivar</button>
                </div>
              </div>

              <div className="role-list">
                {user.active_roles.length === 0 ? (
                  <span className="role-pill">Sin rol activo</span>
                ) : user.active_roles.map((role) => (
                  <span className="role-pill" key={role.assignment_id}>
                    {role.role_name} · {getScopeLabel(role.scope_type)}
                    <button disabled={saving} onClick={() => handleEndRole(role.assignment_id)} type="button">Cerrar</button>
                  </span>
                ))}
              </div>

              <p className="meta">Permisos efectivos: {user.active_permissions.length}</p>
            </article>
          ))}
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
          {roles.map((role) => (
            <article className="entity-card admin-module" key={role.role_id}>
              <p className="entity-type">{role.role_key}</p>
              <h2>{role.role_name}</h2>
              <p className="meta">{role.description ?? 'Sin descripción registrada.'}</p>
              <p className="meta">{role.active_assignments_count} asignaciones activas · {role.permissions.length} permisos</p>
              <div className="role-list">
                {role.permissions.slice(0, 8).map((permission) => (
                  <span className="role-pill" key={permission.key}>{permission.key}</span>
                ))}
                {role.permissions.length > 8 && <span className="role-pill">+{role.permissions.length - 8} permisos</span>}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
