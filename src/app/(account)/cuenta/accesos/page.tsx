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

  return (
    <main className={styles.page}>
      <header className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>Autorizaciones</p>
          <h1>Mis accesos</h1>
          <p>Consulta los roles y ámbitos que determinan qué puedes ver y gestionar dentro de SINEP.</p>
        </div>
      </header>

      <section className={styles.accountStatusBanner} aria-label="Estado del acceso">
        <div>
          <span className={styles.statusIndicator} aria-hidden="true" />
          <div>
            <strong>{roles.length ? 'Tienes acceso administrativo activo' : 'No tienes acceso administrativo asignado'}</strong>
            <p>{profile.email}</p>
          </div>
        </div>
        <span>{roles.length} autorización{roles.length === 1 ? '' : 'es'} activa{roles.length === 1 ? '' : 's'}</span>
      </section>

      <section className={styles.panel} aria-labelledby="active-access-title">
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.eyebrow}>Acceso vigente</p>
            <h2 id="active-access-title">Roles y ámbitos autorizados</h2>
          </div>
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
                  {role.scope_entity_id ? <small>Referencia de ámbito: {role.scope_entity_id}</small> : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <h3>Acceso pendiente</h3>
            <p>Tu cuenta puede utilizar el Centro Personal, pero todavía no tiene roles ni ámbitos administrativos asignados.</p>
          </div>
        )}
      </section>

      <section className={styles.informationPanel} aria-labelledby="access-help-title">
        <h2 id="access-help-title">¿Qué significa esta información?</h2>
        <p>Los roles definen las operaciones permitidas y los ámbitos limitan dónde pueden realizarse. Solo un administrador autorizado puede modificar estas asignaciones.</p>
      </section>
    </main>
  )
}
