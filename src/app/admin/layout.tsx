import type { ReactNode } from 'react'
import AdminShell from './AdminShell'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        .site-shell > .site-header,
        .site-shell > .site-footer{display:none}
        .admin-area{min-height:100vh;background:#fbfaf7}
        .admin-sidebar-nav a:first-child:not([aria-current='page']){background:transparent;border-left:1px solid transparent}
        .admin-sidebar-nav a[aria-current='page']{background:#fbf3f3;border-left:4px solid var(--primary)}
        .admin-workspace > #top{display:grid;gap:22px}
        .admin-workspace > main.container{display:grid;gap:22px;margin:0;max-width:none;padding:0;width:100%}
        .admin-workspace > main.container .dashboard-hero{border-radius:28px;box-shadow:0 20px 58px rgba(31,41,51,.06)}
        .admin-workspace .detail-backlink{margin:0}
        .admin-workspace .detail-backlink a{color:var(--primary);font-weight:900;text-decoration-color:rgba(122,31,31,.35);text-underline-offset:4px}
      `}</style>
      <AdminShell>{children}</AdminShell>
    </>
  )
}
