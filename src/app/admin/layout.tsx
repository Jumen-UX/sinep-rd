import type { ReactNode } from 'react'
import AdminShell from './AdminShell'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        .site-shell > .site-header,
        .site-shell > .site-footer{display:none}
        .admin-area{min-height:100vh;background:#fbfaf7}
      `}</style>
      <AdminShell>{children}</AdminShell>
    </>
  )
}
