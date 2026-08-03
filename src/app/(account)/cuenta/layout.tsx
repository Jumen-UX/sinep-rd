import type { ReactNode } from 'react'
import AccountShell from '@/features/account/AccountShell'

export default function AccountLayout({ children }: { children: ReactNode }) {
  return <AccountShell>{children}</AccountShell>
}
