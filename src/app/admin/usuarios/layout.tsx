import Link from 'next/link'

export default function AdminUsersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="container detail-backlink" aria-label="Usuarios y seguridad">
        <Link href="/admin/usuarios">Usuarios y permisos</Link>
        <span aria-hidden="true"> · </span>
        <Link href="/admin/usuarios/invitar">Invitar usuario</Link>
      </nav>
      {children}
    </>
  )
}
