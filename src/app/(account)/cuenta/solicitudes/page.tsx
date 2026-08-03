import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AccountRequestManager from '@/features/account/AccountRequestManager'
import { loadMyAccountContext } from '@/features/account/services/account-service'
import styles from '@/features/account/account.module.css'

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

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha registrada'
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default async function AccountRequestsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login?next=/cuenta/solicitudes')

  const { access_requests: requests, roles } = await loadMyAccountContext(supabase)
  const openCount = requests.filter((request) => ['submitted', 'under_review', 'information_required'].includes(request.status)).length
  const finalizedCount = requests.filter((request) => ['approved', 'rejected', 'cancelled'].includes(request.status)).length

  return (
    <main className={styles.page}>
      <header className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>Seguimiento</p>
          <h1>Mis solicitudes</h1>
          <p>Crea trámites personales, aporta información y consulta las decisiones del equipo revisor.</p>
        </div>
      </header>

      <section className={styles.summaryGrid} aria-label="Resumen de solicitudes">
        <article className={styles.summaryCard}>
          <span>Total</span>
          <strong>{requests.length}</strong>
          <small>Solicitudes registradas en tu cuenta</small>
        </article>
        <article className={styles.summaryCard}>
          <span>Abiertas</span>
          <strong>{openCount}</strong>
          <small>Enviadas, en revisión o con información requerida</small>
        </article>
        <article className={styles.summaryCard}>
          <span>Finalizadas</span>
          <strong>{finalizedCount}</strong>
          <small>Aprobadas, rechazadas o canceladas</small>
        </article>
      </section>

      <AccountRequestManager requests={requests} roles={roles} />

      <section className={styles.panel} aria-labelledby="request-history-title">
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.eyebrow}>Historial</p>
            <h2 id="request-history-title">Trámites de mi cuenta</h2>
          </div>
          <span className={styles.statusBadge}>{requests.length} total</span>
        </div>

        {requests.length ? (
          <div className={styles.requestTimeline}>
            {requests.map((request) => (
              <article className={styles.requestHistoryCard} key={request.id}>
                <div className={styles.requestHistoryHeader}>
                  <div>
                    <span>{REQUEST_LABELS[request.request_type] ?? request.request_type}</span>
                    <h3>{request.justification || 'Solicitud sin descripción'}</h3>
                  </div>
                  <span className={styles.requestStatus}>{STATUS_LABELS[request.status] ?? request.status}</span>
                </div>
                <dl className={styles.requestMetadata}>
                  <div><dt>Creada</dt><dd>{formatDate(request.created_at)}</dd></div>
                  <div><dt>Enviada</dt><dd>{formatDate(request.submitted_at)}</dd></div>
                  <div><dt>Revisada</dt><dd>{formatDate(request.reviewed_at)}</dd></div>
                </dl>
                {request.reviewer_notes ? (
                  <div className={styles.reviewerNote}>
                    <strong>Observación del revisor</strong>
                    <p>{request.reviewer_notes}</p>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <h3>Aún no tienes solicitudes</h3>
            <p>Usa el formulario anterior para iniciar un trámite relacionado con tu cuenta.</p>
          </div>
        )}
      </section>
    </main>
  )
}
