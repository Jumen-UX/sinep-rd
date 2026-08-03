import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadMyAccountContext } from './services/account-service'
import styles from './account.module.css'
import dashboardStyles from './account-dashboard.module.css'

const OPEN_REQUEST_STATUSES = ['submitted', 'under_review', 'information_required']

function calculateProfileCompletion(profile: {
  email: string
  full_name: string
  preferred_locale: string
  timezone: string
}) {
  const requiredValues = [profile.email, profile.full_name, profile.preferred_locale, profile.timezone]
  return Math.round((requiredValues.filter(Boolean).length / requiredValues.length) * 100)
}

function accountInitials(fullName: string) {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export default async function AccountHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login?next=/cuenta')

  const context = await loadMyAccountContext(supabase)
  const { profile, roles, access_requests: requests } = context
  const openRequests = requests.filter((request) => OPEN_REQUEST_STATUSES.includes(request.status))
  const hasAdminAccess = roles.length > 0 && profile.status === 'active' && profile.onboarding_completed_at
  const profileCompletion = calculateProfileCompletion(profile)
  const optionalProfileItems = [
    !profile.phone ? 'Agregar un teléfono de contacto' : null,
    !profile.avatar_url ? 'Agregar una fotografía' : null,
  ].filter(Boolean) as string[]

  return (
    <main className={styles.page}>
      <header className={styles.dashboardHero}>
        <div className={styles.identitySummary}>
          <div className={styles.avatar} aria-hidden="true">{accountInitials(profile.full_name)}</div>
          <div>
            <p className={styles.eyebrow}>Centro personal</p>
            <h1>{profile.full_name}</h1>
            <p>{profile.email}</p>
            <div className={dashboardStyles.identityBadges} aria-label="Estado de la cuenta">
              <span>{profile.status === 'active' ? 'Cuenta activa' : 'Cuenta con pasos pendientes'}</span>
              {roles.length ? <span>{roles[0].role_name}</span> : <span>Sin acceso administrativo</span>}
            </div>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.primaryAction} href="/cuenta/perfil">Editar perfil</Link>
          {hasAdminAccess ? <Link className={styles.secondaryAction} href="/admin">Ir a Administración</Link> : null}
        </div>
      </header>

      <section className={styles.accountStatusBanner} aria-label="Estado general de la cuenta">
        <div>
          <span className={styles.statusIndicator} aria-hidden="true" />
          <div>
            <strong>{profile.status === 'active' ? 'Tu cuenta está operativa' : 'Tu cuenta requiere completar pasos'}</strong>
            <p>{profile.onboarding_step === 'complete' ? 'Configuración inicial completada' : 'Configuración inicial pendiente'}</p>
          </div>
        </div>
        <Link className={styles.textAction} href="/cuenta/perfil">Revisar datos</Link>
      </section>

      <section className={styles.summaryGrid} aria-label="Resumen de la cuenta">
        <article className={styles.summaryCard}>
          <span>Datos básicos</span>
          <strong>{profileCompletion}%</strong>
          <div className={dashboardStyles.progressTrack} aria-hidden="true"><span style={{ width: `${profileCompletion}%` }} /></div>
          <small>{profileCompletion === 100 ? 'La información requerida está completa' : 'Hay datos requeridos pendientes'}</small>
        </article>
        <article className={styles.summaryCard}>
          <span>Accesos activos</span>
          <strong>{roles.length}</strong>
          <small>{roles.length ? 'Roles y ámbitos actualmente autorizados' : 'Puedes usar tu cuenta sin acceso administrativo'}</small>
        </article>
        <article className={styles.summaryCard}>
          <span>Solicitudes abiertas</span>
          <strong>{openRequests.length}</strong>
          <small>{openRequests.length ? 'Hay trámites que requieren seguimiento' : 'No tienes solicitudes pendientes'}</small>
        </article>
      </section>

      {optionalProfileItems.length ? (
        <section className={dashboardStyles.profileSuggestions} aria-labelledby="profile-suggestions-title">
          <div>
            <p className={styles.eyebrow}>Mejoras opcionales</p>
            <h2 id="profile-suggestions-title">Puedes enriquecer tu perfil</h2>
          </div>
          <ul>
            {optionalProfileItems.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <Link className={styles.secondaryAction} href="/cuenta/perfil">Completar ahora</Link>
        </section>
      ) : null}

      <section className={styles.quickActionsPanel} aria-labelledby="quick-actions-title">
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.eyebrow}>Acciones rápidas</p>
            <h2 id="quick-actions-title">¿Qué necesitas hacer?</h2>
          </div>
        </div>
        <div className={`${styles.quickActionsGrid} ${dashboardStyles.quickActionsGrid}`}>
          <Link href="/cuenta/perfil"><span aria-hidden="true">◉</span><strong>Actualizar mi perfil</strong><small>Nombre, teléfono, idioma, zona horaria y fotografía.</small><b aria-hidden="true">→</b></Link>
          <Link href="/cuenta/accesos"><span aria-hidden="true">◇</span><strong>Revisar mis accesos</strong><small>Consulta los roles y ámbitos que tienes autorizados.</small><b aria-hidden="true">→</b></Link>
          <Link href="/cuenta/solicitudes"><span aria-hidden="true">▤</span><strong>Gestionar solicitudes</strong><small>Consulta el estado de tus trámites personales.</small><b aria-hidden="true">→</b></Link>
          <Link href="/"><span aria-hidden="true">↗</span><strong>Ir al sitio público</strong><small>Consulta las fichas y directorios públicos de SINEP.</small><b aria-hidden="true">→</b></Link>
        </div>
      </section>

      <div className={styles.contentGrid}>
        <section className={styles.panel} aria-labelledby="identity-title">
          <div className={styles.panelHeader}>
            <div><p className={styles.eyebrow}>Identidad de acceso</p><h2 id="identity-title">Mi perfil</h2></div>
            <Link className={styles.textAction} href="/cuenta/perfil">Editar</Link>
          </div>
          <dl className={styles.detailList}>
            <div><dt>Nombre</dt><dd>{profile.full_name}</dd></div>
            <div><dt>Correo</dt><dd>{profile.email}</dd></div>
            <div><dt>Teléfono</dt><dd>{profile.phone || 'No registrado'}</dd></div>
            <div><dt>Idioma</dt><dd>{profile.preferred_locale}</dd></div>
            <div><dt>Zona horaria</dt><dd>{profile.timezone}</dd></div>
          </dl>
          {profile.person_id ? <p className={dashboardStyles.contextNote}>Esta cuenta tiene una vinculación personal verificada.</p> : null}
        </section>

        <section className={styles.panel} aria-labelledby="access-preview-title">
          <div className={styles.panelHeader}>
            <div><p className={styles.eyebrow}>Autorizaciones</p><h2 id="access-preview-title">Mis accesos</h2></div>
            <Link className={styles.textAction} href="/cuenta/accesos">Ver todos</Link>
          </div>
          {roles.length ? (
            <ul className={`${styles.accessList} ${dashboardStyles.accessList}`}>
              {roles.slice(0, 3).map((role) => (
                <li key={role.assignment_id}><strong>{role.role_name}</strong><span>{role.scope_type === 'global' ? 'Ámbito global' : role.scope_type}</span><small>Activo</small></li>
              ))}
            </ul>
          ) : (
            <div className={styles.emptyState}><h3>Sin acceso administrativo</h3><p>Tu cuenta personal sigue disponible aunque no tengas roles de administración.</p></div>
          )}
        </section>
      </div>
    </main>
  )
}
