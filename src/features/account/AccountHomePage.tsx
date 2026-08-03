import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadMyAccountContext } from './services/account-service'
import styles from './account.module.css'

const REQUEST_LABELS: Record<string, string> = {
  initial_access: 'Acceso inicial',
  person_link: 'Vinculación con persona',
  scope_change: 'Cambio de ámbito',
  role_change: 'Cambio de rol',
  account_closure: 'Cierre de cuenta',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  submitted: 'Enviada',
  under_review: 'En revisión',
  information_required: 'Información requerida',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
}

export default async function AccountHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login?next=/cuenta')

  const context = await loadMyAccountContext(supabase)
  const { profile, roles, access_requests: requests } = context
  const openRequests = requests.filter((request) => ['submitted', 'under_review', 'information_required'].includes(request.status))
  const hasAdminAccess = roles.length > 0 && profile.status === 'active' && profile.onboarding_completed_at

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Centro personal</p>
          <h1>Mi cuenta</h1>
          <p>Gestiona tu perfil, consulta tu acceso y revisa el estado de tus solicitudes.</p>
        </div>
        <div className={styles.headerActions}>
          {hasAdminAccess ? <Link className={styles.secondaryAction} href="/admin">Ir a Administración</Link> : null}
          <Link className={styles.primaryAction} href="/cuenta/perfil">Editar perfil</Link>
        </div>
      </header>

      <section className={styles.summaryGrid} aria-label="Resumen de la cuenta">
        <article className={styles.summaryCard}>
          <span>Estado de la cuenta</span>
          <strong>{profile.status === 'active' ? 'Activa' : 'Pendiente'}</strong>
          <small>{profile.email}</small>
        </article>
        <article className={styles.summaryCard}>
          <span>Accesos activos</span>
          <strong>{roles.length}</strong>
          <small>{roles.length ? 'Roles y ámbitos autorizados' : 'Todavía no tienes un rol administrativo'}</small>
        </article>
        <article className={styles.summaryCard}>
          <span>Solicitudes abiertas</span>
          <strong>{openRequests.length}</strong>
          <small>{openRequests.length ? 'Hay solicitudes que requieren seguimiento' : 'No tienes solicitudes pendientes'}</small>
        </article>
      </section>

      <div className={styles.contentGrid}>
        <section className={styles.panel} aria-labelledby="profile-title">
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Identidad de acceso</p>
              <h2 id="profile-title">Mi perfil</h2>
            </div>
            <span className={styles.statusBadge}>{profile.onboarding_step === 'complete' ? 'Completo' : 'Por completar'}</span>
          </div>
          <dl className={styles.detailList}>
            <div><dt>Nombre</dt><dd>{profile.full_name}</dd></div>
            <div><dt>Correo</dt><dd>{profile.email}</dd></div>
            <div><dt>Teléfono</dt><dd>{profile.phone || 'No registrado'}</dd></div>
            <div><dt>Idioma</dt><dd>{profile.preferred_locale}</dd></div>
            <div><dt>Zona horaria</dt><dd>{profile.timezone}</dd></div>
            <div><dt>Ficha eclesial</dt><dd>{profile.person_id ? 'Vinculada' : 'Sin vincular'}</dd></div>
          </dl>
        </section>

        <section className={styles.panel} aria-labelledby="access-title">
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Autorizaciones</p>
              <h2 id="access-title">Mi acceso</h2>
            </div>
          </div>
          {roles.length ? (
            <ul className={styles.accessList}>
              {roles.map((role) => (
                <li key={role.assignment_id}>
                  <strong>{role.role_name}</strong>
                  <span>{role.scope_type}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.emptyState}>
              <h3>Acceso administrativo pendiente</h3>
              <p>Puedes usar este centro personal, pero un administrador debe aprobar una solicitud y asignarte un rol y ámbito.</p>
            </div>
          )}
        </section>
      </div>

      <section className={styles.panel} aria-labelledby="requests-title">
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.eyebrow}>Seguimiento</p>
            <h2 id="requests-title">Mis solicitudes</h2>
          </div>
          <span className={styles.statusBadge}>{requests.length} total</span>
        </div>
        {requests.length ? (
          <div className={styles.requestList}>
            {requests.map((request) => (
              <article key={request.id} className={styles.requestItem}>
                <div>
                  <strong>{REQUEST_LABELS[request.request_type] ?? request.request_type}</strong>
                  <p>{request.justification || 'Sin descripción'}</p>
                </div>
                <span className={styles.requestStatus}>{STATUS_LABELS[request.status] ?? request.status}</span>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <h3>Aún no tienes solicitudes</h3>
            <p>En el siguiente bloque podrás solicitar acceso inicial o vincular tu cuenta con una persona existente.</p>
          </div>
        )}
      </section>
    </main>
  )
}
