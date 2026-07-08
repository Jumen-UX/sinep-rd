import type { ReactNode } from 'react'
import Link from 'next/link'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        .site-shell > .site-header,
        .site-shell > .site-footer{display:none}
        .admin-area{min-height:100vh;background:#fbfaf7}
        .admin-area-header{background:#fff;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:20}
        .admin-area-nav{align-items:center;display:flex;gap:18px;justify-content:space-between;margin:0 auto;max-width:1180px;padding:14px 24px}
        .admin-area-brand{color:var(--primary);display:grid;font-weight:900;text-decoration:none}
        .admin-area-brand span:last-child{color:var(--muted);font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
        .admin-area-links{align-items:center;display:flex;flex-wrap:wrap;gap:10px}
        .admin-area-links a{background:#fbf8f1;border:1px solid var(--border);border-radius:999px;color:var(--primary);font-size:13px;font-weight:900;padding:8px 11px;text-decoration:none}
        @media(max-width:820px){.admin-area-nav{align-items:flex-start;display:grid}.admin-area-links{gap:7px}}
      `}</style>
      <div className="admin-area">
        <header className="admin-area-header">
          <nav className="admin-area-nav" aria-label="Navegación administrativa">
            <Link className="admin-area-brand" href="/admin">
              <span>SINEP RD</span>
              <span>Portal administrativo</span>
            </Link>
            <div className="admin-area-links">
              <Link href="/admin">Inicio</Link>
              <Link href="/admin/eventos">Registro histórico</Link>
              <Link href="/admin/jurisdicciones">Gobierno eclesial</Link>
              <Link href="/admin/estructura">Estructura</Link>
              <Link href="/admin/usuarios">Usuarios</Link>
              <Link href="/">Portal público</Link>
            </div>
          </nav>
        </header>
        {children}
      </div>
    </>
  )
}
