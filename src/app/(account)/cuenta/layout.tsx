import type { ReactNode } from 'react'
import AccountShell from '@/features/account/AccountShell'
import { createClient } from '@/lib/supabase/server'
import { loadMyAccountContext } from '@/features/account/services/account-service'

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let identity: { fullName: string; email: string; avatarUrl: string | null; roleName: string } | null = null

  if (user) {
    const { profile, roles } = await loadMyAccountContext(supabase)
    identity = {
      fullName: profile.full_name,
      email: profile.email,
      avatarUrl: profile.avatar_url,
      roleName: roles[0]?.role_name ?? 'Cuenta personal',
    }
  }

  return <AccountShell identity={identity}>{children}</AccountShell>
}
