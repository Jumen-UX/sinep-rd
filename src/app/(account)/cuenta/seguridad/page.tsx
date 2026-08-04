import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AccountSecurityManager from '@/features/account/AccountSecurityManager'
import styles from '@/features/account/account.module.css'

export default async function AccountSecurityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login?next=/cuenta/seguridad')

  const emailConfirmed = Boolean(user.email_confirmed_at)
  const availableControlsComplete = emailConfirmed ? 2 : 1

  return (
    <main className={styles.page}>
      <header className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>Protección de la cuenta</p>
          <h1>Seguridad</h1>
          <p>Protege tus credenciales, revisa los controles disponibles y administra las sesiones abiertas de tu cuenta.</p>
        </div>
      </header>

      <section className={styles.summaryGrid} aria-label="Resumen de seguridad">
        <article className={styles.summaryCard}>
          <span>Controles disponibles</span>
          <strong>{availableControlsComplete}/2</strong>
          <small>{emailConfirmed ? 'Correo verificado y control global de sesiones disponibles' : 'Verifica tu correo para completar los controles disponibles'}</small>
        </article>
        <article className={styles.summaryCard}>
          <span>Correo de recuperación</span>
          <strong>{emailConfirmed ? 'Listo' : 'Pendiente'}</strong>
          <small>{emailConfirmed ? 'Puede utilizarse en procesos de recuperación' : 'La verificación todavía no está completa'}</small>
        </article>
        <article className={styles.summaryCard}>
          <span>Protección adicional</span>
          <strong>En preparación</strong>
          <small>La autenticación en dos pasos se mostrará cuando esté integrada y probada</small>
        </article>
      </section>

      <AccountSecurityManager email={user.email ?? 'Correo no disponible'} emailConfirmed={emailConfirmed} />
    </main>
  )
}
