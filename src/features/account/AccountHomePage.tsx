import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadMyAccountContext } from './services/account-service'
import styles from './account.module.css'
import dashboardStyles from './account-dashboard.module.css'

const OPEN_REQUEST_STATUSES = ['submitted', 'under_review', 'information_required']

const LOCALE_LABELS: Record<string, string> = {
  'es-419': 'Español latinoamericano',
  es: 'Español',
  en: 'English',
}

function calculateProfileCompletion(profile: {
  email: string
  full_name: string
  phone: string | null
  preferred_locale: string
  timezone: string
  avatar_url: string | null
}) {
  const fields = [
    profile.email,
    profile.full_name,
    profile.phone,
    profile.preferred_locale,
    profile.timezone,
    profile.avatar_url,
  ]
  const completed = fields.filter(Boolean).length

  return {
    completed,
    total: fields.length,
    percentage: Math.round((completed / fields.length) * 100),
  }
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

function localeLabel(locale: string) {
  return LOCALE_LABELS[locale] ?? locale
}

function timezoneLabel(timezone: string) {
  const [, city = timezone] = timezone.split('/')
  return city.replaceAll('_', ' ')
}

export default async function AccountHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login?next=/cuenta')

  const context = await loadMyAccountContext(supabase)
  const { profile, roles, access_requests: requests } = context
  const openRequests = requests.filter((request) => OPEN_REQUEST_STATUSES.includes(request.status))
  const hasAdminAccess = roles.length > 0 && profile.status === 'active' && profile.onboarding_completed_at
  const completion = calculateProfileCompletion(profile)
  const incompleteProfileItems = [
    !profile.phone ? {
      label: 'Agregar un teléfono de contacto',
      detail: 'Facilita la recuperación y el contacto institucional.',
      href: '/cuenta/perfil#profile-phone-input',
    } : null,
    !profile.avatar_url ? {
      label: 'Agregar una fotografía',
      detail: 'Ayuda a identificar tu cuenta dentro del sistema.',
      href: '/cuenta/perfil#profile-photo-input',
    } : null,
  ].filter(Boolean) as Array<{ label: string; detail: string; href: string }>
  const nextProfileTask = incompleteProfileItems[0]

  return (
    <main className={styles.page}>
      <header className={`${styles.dashboardHero} ${dashboardStyles.hero}`}>
        <div className={styles.identitySummary}>
          <div className={dashboardStyles.avatarWrap}>
            {profile.avatar_url ? (
              <Image
                alt={`Fotografía de ${profile.full_name}`}
                className={dashboardStyles.heroAvatar}
                height={96}
                src={profile.avatar_url}
                unoptimized
                width={96}
              />
            ) : (
              <div className={`${styles.avatar} ${dashboardStyles.heroAvatarFallback}`} aria-hidden="true">{accountInitials(profile.full_name)}</div>
            )}
            <span className={dashboardStyles.activeDot} aria-hidden="true" />
            <span className={dashboardStyles.srOnly}>Cuenta activa</span>
          </div>
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
          <Link className={styles.primaryAction} href="/cuenta/perfil">Ir a mi perfil</Link>
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
        <Link className={styles.textAction} href="/cuenta/perfil">Revisar mi información</Link>
      </section>

      <section className={styles.summaryGrid} aria-label="Resumen de la cuenta">
        <article className={`${styles.summaryCard} ${dashboardStyles.metricCard}`}>
          <span className={dashboardStyles.metricIcon} aria-hidden="true">◉</span>
          <div>
            <span>Mi identidad</span>
            <strong>{completion.completed} de {completion.total}</strong>
            <div className={dashboardStyles.progressTrack} aria-hidden="true"><span style={{ width: `${completion.percentage}%` }} /></div>
            <small>{completion.percentage === 100 ? 'Tu perfil está completo' : `${incompleteProfileItems.length} elemento${incompleteProfileItems.length === 1 ? '' : 's'} pendiente${incompleteProfileItems.length === 1 ? '' : 's'}`}</small>
          </div>
        </article>
        <article className={`${styles.summaryCard} ${dashboardStyles.metricCard}`}>
          <span className={dashboardStyles.metricIcon} aria-hidden="true">◇</span>
          <div>
            <span>Mis accesos</span>
            <strong>{roles.length}</strong>
            <small>{roles.length ? 'Roles y ámbitos actualmente autorizados' : 'Puedes usar tu cuenta sin acceso administrativo'}</small>
          </div>
        </article>
        <article className={`${styles.summaryCard} ${dashboardStyles.metricCard}`}>
          <span className={dashboardStyles.metricIcon} aria-hidden="true">▤</span>
          <div>
            <span>Mi actividad</span>
            <strong>{openRequests.length}</strong>
            <small>{openRequests.length ? 'Hay trámites que requieren seguimiento' : 'No tienes solicitudes pendientes'}</small>
          </div>
        </article>
      </section>

      {nextProfileTask ? (
        <section className={dashboardStyles.profileTask} aria-labelledby="profile-suggestions-title">
          <span className={dashboardStyles.taskIcon} aria-hidden="true">!</span>
          <div>
            <p className={styles.eyebrow}>Siguiente paso</p>
            <h2 id="profile-suggestions-title">Solo falta {incompleteProfileItems.length === 1 ? 'una tarea' : `${incompleteProfileItems.length} tareas`}</h2>
            <p>{nextProfileTask.label}. {nextProfileTask.detail}</p>
          </div>
          <Link className={styles.primaryAction} href={nextProfileTask.href}>{nextProfileTask.label}</Link>
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
          <Link className={dashboardStyles.primaryQuickAction} href="/cuenta/perfil"><span aria-hidden="true">◉</span><strong>Actualizar mi perfil</strong><small>Nombre, teléfono, idioma, zona horaria y fotografía.</small><b aria-hidden="true">→</b></Link>
          <Link className={dashboardStyles.primaryQuickAction} href="/cuenta/solicitudes"><span aria-hidden="true">▤</span><strong>Gestionar solicitudes</strong><small>Consulta el estado de tus trámites personales.</small><b aria-hidden="true">→</b></Link>
          <Link href="/cuenta/accesos"><span aria-hidden="true">◇</span><strong>Revisar mis accesos</strong><small>Consulta los roles y ámbitos que tienes autorizados.</small><b aria-hidden="true">→</b></Link>
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
            <div><dt>Idioma</dt><dd>{localeLabel(profile.preferred_locale)}</dd></div>
            <div><dt>Zona horaria</dt><dd>{timezoneLabel(profile.timezone)}</dd></div>
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
