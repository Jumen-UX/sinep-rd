import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AccountProfileForm from '@/features/account/AccountProfileForm'
import { loadMyAccountContext } from '@/features/account/services/account-service'
import styles from '@/features/account/account.module.css'

export default async function AccountProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login?next=/cuenta/perfil')

  const { profile } = await loadMyAccountContext(supabase)

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Identidad de acceso</p>
          <h1>Mi perfil</h1>
          <p>Actualiza los datos personales y preferencias básicas asociados a tu cuenta.</p>
        </div>
      </header>
      <section className={styles.panel} aria-labelledby="profile-form-title">
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.eyebrow}>Datos personales</p>
            <h2 id="profile-form-title">Información de la cuenta</h2>
          </div>
        </div>
        <AccountProfileForm profile={profile} />
      </section>
    </main>
  )
}
