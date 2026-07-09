import type { ReactNode } from 'react'
import AdminShell from './AdminShell'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        .site-shell > .site-header,
        .site-shell > .site-footer{display:none}
        .admin-area{min-height:100vh;background:#fbfaf7}
        .admin-sidebar-nav a[aria-current='page']{background:#fbf3f3;border-left:4px solid var(--primary)}
        .admin-workspace > #top{display:grid;gap:22px}
      `}</style>
      <AdminShell>{children}</AdminShell>
    </>
  )
}
