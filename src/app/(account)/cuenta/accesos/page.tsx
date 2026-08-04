import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadMyAccountContext } from '@/features/account/services/account-service'
import styles from '@/features/account/account.module.css'

function formatScope(scopeType: string) {
  if (scopeType === 'global') return 'Ámbito global'
  if (scopeType === 'country') return 'Ámbito nacional'
  if (scopeType === 'entity') return 'Jurisdicción o entidad'
  if (scopeType === 'structure_node') return 'Nivel territorial'
  if (scopeType === 'organization_unit') return 'Unidad organizativa'
  return scopeType
}

export default async function AccountAccessPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login?next=/cuenta/accesos')

  const { profile, roles } = await loadMyAccountContext(supabase)
  const globalRoles = roles.filter((role) => role.scope_type === 'global').length
  const scopedRoles = roles.length - globalRoles

  return (
    <main className={styles.page}>
      <header className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>Autorizaciones</p>
          <h1>Mis accesos</h1>
          <p>Consulta qué puedes gestionar, en qué ámbito y cómo solicitar una modificación cuando tus responsabilidades cambien.</p>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.primaryAction} href="/cuenta/solicitudes">Solicitar un cambio</Link>
        </div>
      </header>

      <section className={styles.accountStatusBanner} aria-label="Estado del acceso">
        <div>
          <span className={styles.statusIndicator} aria-hidden="true" />
          <div>
            <strong>{roles.length ? 'Tu acceso administrativo está activo' : 'Tu cuenta no tiene acceso administrativo asignado'}</strong>
            <p>{profile.email}</p>
          </div>
        </div>
        <span>{roles.length} autorización{roles.length === 1 ? '' : 'es'} activa{roles.length === 1 ? '' : 's'}</span>
      </section>

      <section className={styles.summaryGrid} aria-label="Resumen de autorizaciones">
        <article className={styles.summaryCard}>
          <span>Autorizaciones</span>
          <strong>{roles.length}</strong>
          <small>Roles y ámbitos actualmente vigentes</small>
        </article>
        <article className={styles.summaryCard}>
          <span>Alcance global</span>
          <strong>{globalRoles}</strong>
          <small>Asignaciones que aplican a toda la plataforma</small>
        </article>
        <article className={styles.summaryCard}>
          <span>Alcance delimitado</span>
          <strong>{scopedRoles}</strong>
          <small>Asignaciones limitadas por país, entidad o estructura</small>
        </article>
      </section>

      <section className={styles.panel} aria-labelledby="active-access-title">
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.eyebrow}>Acceso vigente</p>
            <h2 id="active-access-title">Roles y ámbitos autorizados</h2>
          </div>
          <span className={styles.statusBadge}>{roles.length ? 'Activo' : 'Sin asignaciones'}</span>
        </div>
        {roles.length ? (
          <div className={styles.authorizationGrid}>
            {roles.map((role) => (
              <article className={styles.authorizationCard} key={role.assignment_id}>
                <div className={styles.authorizationIcon} aria-hidden="true">◇</div>
                <div>
                  <span>Rol</span>
                  <h3>{role.role_name}</h3>
                  <p>{formatScope(role.scope_type)}</p>
                  {role.scope_entity_id ? <small>Referencia de ámbito: {role.scope_entity_id}</small> : <small>Sin restricción adicional de entidad</small>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <h3>Acceso pendiente</h3>
            <p>Tu cuenta puede utilizar el Centro Personal, pero todavía no tiene roles ni ámbitos administrativos asignados.</p>
            <Link className={styles.textAction} href="/cuenta/solicitudes">Solicitar acceso inicial →</Link>
          </div>
        )}
      </section>

      <details className={styles.informationPanel}>
        <summary><strong>Más información sobre roles y ámbitos</strong></summary>
        <div>
          <p className={styles.eyebrow}>Cómo funciona</p>
          <h2>Roles, ámbitos y cambios</h2>
          <p>Los roles definen las operaciones permitidas y los ámbitos limitan dónde pueden realizarse. Solo un administrador autorizado puede modificar estas asignaciones; cualquier cambio debe tramitarse desde tus solicitudes.</p>
        </div>
      </details>
    </main>
  )
}
