'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { PageState } from '@/components/ui/page-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { createClient } from '@/lib/supabase/client'
import {
  assignUserRole,
  endUserRole,
  formatUserAccessDate,
  getScopeLabel,
  getUserOnboardingLabel,
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

function profileStatusTone(status: string) {
  if (status === 'active') return 'success' as const
  if (status === 'suspended') return 'warning' as const
  return 'danger' as const
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
    const active = users.filter((user) => user.access_state === 'ready').length
    const pending = users.filter((user) => ['onboarding', 'no_role'].includes(user.access_state)).length
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

  if (loading) {
    return (
      <main className="container">
        <PageState
          compact
          kind="loading"
          title="Cargando usuarios y permisos"
          description="Estamos preparando las cuentas, roles, alcances y permisos efectivos."
        />
      </main>
    )
  }

  return (
    <main className="container admin-dashboard admin-access-page" id="top">
      <PageHeader
        breadcrumbs={[
          { label: 'Administración', href: '/admin' },
          { label: 'Configuración', href: '/admin/configuracion' },
          { label: 'Usuarios y permisos' },
        ]}
        eyebrow="Acceso administrativo"
        title="Usuarios, roles y permisos"
        description="Administra quién puede entrar al portal, qué nivel tiene y sobre qué alcance puede trabajar."
        metadata={(
          <>
            <StatusBadge tone="institutional" dot>{users.length} usuarios</StatusBadge>
            <StatusBadge tone="success" dot>{metrics.active} listos</StatusBadge>
            <StatusBadge tone="warning" dot>{metrics.pending} pendientes</StatusBadge>
            <StatusBadge tone="info" dot>{metrics.assignments} roles activos</StatusBadge>
          </>
        )}
        actions={(
          <>
            <Button asChild variant="secondary"><Link href="/admin/configuracion">Configuración</Link></Button>
            <Button asChild><Link href="/admin/usuarios/invitar">Invitar usuario</Link></Button>
          </>
        )}
      />

      <section className="admin-stat-strip" aria-label="Resumen de acceso">
        <a href="#users"><span aria-hidden="true">♙</span><strong>{users.length}</strong><small>Usuarios registrados</small></a>
        <a href="#users"><span aria-hidden="true">✓</span><strong>{metrics.active}</strong><small>Usuarios activos</small></a>
        <a href="#users"><span aria-hidden="true">!</span><strong>{metrics.pending}</strong><small>Pendientes de activación</small></a>
        <a href="#assign-role"><span aria-hidden="true">▣</span><strong>{metrics.assignments}</strong><small>Roles activos asignados</small></a>
        <a href="#roles"><span aria-hidden="true">◇</span><strong>{roles.length}</strong><small>Roles del sistema</small></a>
      </section>

      {error ? <PageState kind="error" title="No se pudo completar la operación" description={error} /> : null}
      {notice ? <Alert tone="success" title="Operación completada">{notice}</Alert> : null}

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

            <Button disabled={saving || users.length === 0 || roles.length === 0} type="submit">
              {saving ? 'Guardando...' : 'Asignar rol'}
            </Button>
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
            <div><strong>1</strong><span>Invitar y confirmar el rol y alcance inicial cuando corresponda.</span></div>
            <div><strong>2</strong><span>El usuario acepta la invitación y completa su perfil.</span></div>
            <div><strong>3</strong><span>El acceso se activa solo con onboarding y rol vigentes.</span></div>
            <div><strong>4</strong><span>Las asignaciones, cierres y cambios de estado quedan auditados.</span></div>
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
          {users.length === 0 ? (
            <PageState
              kind="empty"
              title="No hay usuarios visibles"
              description="No se encontraron cuentas dentro de tu alcance administrativo."
              action={<Button asChild><Link href="/admin/usuarios/invitar">Invitar usuario</Link></Button>}
            />
          ) : users.map((user) => (
            <article className="access-user-card entity-card" key={user.user_id}>
              <div className="access-user-main">
                <div>
                  <StatusBadge tone={profileStatusTone(user.profile_status)} dot>
                    {getUserStatusLabel(user.profile_status)}
                  </StatusBadge>
                  <h3>{user.full_name ?? user.email ?? 'Usuario sin nombre'}</h3>
                  <p className="meta">{user.email ?? 'Correo no registrado'} · Último acceso: {formatUserAccessDate(user.last_sign_in_at)}</p>
                  <p className="meta">{getUserOnboardingLabel(user)}</p>
                </div>
                <div className="access-actions actions">
                  <Button disabled={saving || user.profile_status === 'active'} onClick={() => handleStatusChange(user.user_id, 'active')} size="sm" type="button" variant="secondary">Activar</Button>
                  <Button disabled={saving || user.profile_status === 'suspended'} onClick={() => handleStatusChange(user.user_id, 'suspended')} size="sm" type="button" variant="secondary">Suspender</Button>
                  <Button disabled={saving || ['disabled', 'inactive'].includes(user.profile_status)} onClick={() => handleStatusChange(user.user_id, 'disabled')} size="sm" type="button" variant="destructive">Desactivar</Button>
                </div>
              </div>

              <div className="role-list">
                {user.active_roles.length === 0 ? (
                  <StatusBadge tone="warning">Sin rol activo</StatusBadge>
                ) : user.active_roles.map((role) => (
                  <StatusBadge key={role.assignment_id} tone="info">
                    {role.role_name} · {getScopeLabel(role.scope_type)}
                    <Button disabled={saving} onClick={() => handleEndRole(role.assignment_id)} size="sm" type="button" variant="ghost">Cerrar</Button>
                  </StatusBadge>
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
          {roles.length === 0 ? (
            <PageState
              kind="empty"
              title="No hay roles configurados"
              description="El catálogo de roles no devolvió opciones visibles para tu alcance."
            />
          ) : roles.map((role) => (
            <article className="entity-card admin-module" key={role.role_id}>
              <p className="entity-type">{role.role_key}</p>
              <h3>{role.role_name}</h3>
              <p className="meta">{role.description ?? 'Sin descripción registrada.'}</p>
              <p className="meta">{role.active_assignments_count} asignaciones activas · {role.permissions.length} permisos</p>
              <div className="role-list">
                {role.permissions.slice(0, 8).map((permission) => (
                  <StatusBadge key={permission.key}>{permission.key}</StatusBadge>
                ))}
                {role.permissions.length > 8 ? <StatusBadge tone="info">+{role.permissions.length - 8} permisos</StatusBadge> : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
