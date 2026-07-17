import type { ReactNode } from 'react'
import '@/styles/admin-shell.css'
import '@/styles/admin-framework.css'
import '@/styles/admin-dashboard.css'
import '@/styles/admin-dashboard-brand.css'
import '@/styles/person-wizard-unified.css'
import '@/styles/admin-modules.css'
import '@/styles/admin-theme-compatibility.css'
import '@/styles/admin-embedded-theme-cleanup.css'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children
}
