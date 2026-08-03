import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AccountSecurityManager from '@/features/account/AccountSecurityManager'
import styles from '@/features/account/account.module.css'

export default async function AccountSecurityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login?next=/cuenta/seguridad')

  return (
    <main className={styles.page}>
      <header className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>Protección de la cuenta</p>
          <h1>Seguridad</h1>
          <p>Actualiza tu contraseña, revisa el estado de verificación y controla las sesiones de tu cuenta.</p>
        </div>
      </header>
      <AccountSecurityManager email={user.email ?? 'Correo no disponible'} emailConfirmed={Boolean(user.email_confirmed_at)} />
    </main>
  )
}
