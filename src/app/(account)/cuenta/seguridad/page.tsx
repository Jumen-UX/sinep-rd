import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AccountSecurityManager from '@/features/account/AccountSecurityManager'
import styles from '@/features/account/account.module.css'
import overviewStyles from '@/features/account/account-security-overview.module.css'

export default async function AccountSecurityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login?next=/cuenta/seguridad')

  const emailConfirmed = Boolean(user.email_confirmed_at)

  return (
    <main className={styles.page}>
      <header className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>Protección de la cuenta</p>
          <h1>Seguridad</h1>
          <p>Protege tus credenciales, revisa los controles disponibles y administra las sesiones abiertas de tu cuenta.</p>
        </div>
      </header>

      <section className={overviewStyles.overview} aria-labelledby="security-overview-title">
        <div className={overviewStyles.summary}>
          <span className={overviewStyles.badge}>{emailConfirmed ? 'Protección disponible' : 'Revisión recomendada'}</span>
          <h2 id="security-overview-title">Tu cuenta cuenta con los controles básicos activos</h2>
          <p>El correo de recuperación y el cierre global de sesiones están disponibles. La autenticación en dos pasos aparecerá cuando el flujo completo esté integrado y probado.</p>
        </div>
        <ul className={overviewStyles.checks} aria-label="Controles de seguridad">
          <li>
            <span className={overviewStyles.icon} aria-hidden="true">✓</span>
            <div><strong>Correo de recuperación</strong><small>{emailConfirmed ? 'Verificado y listo para recuperación.' : 'Pendiente de verificación.'}</small></div>
          </li>
          <li>
            <span className={overviewStyles.icon} aria-hidden="true">✓</span>
            <div><strong>Control de sesiones</strong><small>Puedes cerrar todas las demás sesiones.</small></div>
          </li>
          <li className={overviewStyles.pending}>
            <span className={overviewStyles.icon} aria-hidden="true">○</span>
            <div><strong>Autenticación en dos pasos</strong><small>En preparación; todavía no está disponible.</small></div>
          </li>
        </ul>
      </section>

      <AccountSecurityManager email={user.email ?? 'Correo no disponible'} emailConfirmed={emailConfirmed} />
    </main>
  )
}
