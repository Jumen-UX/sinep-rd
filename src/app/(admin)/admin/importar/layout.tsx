import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

export default function AdminImportLayout({ children }: Props) {
  return (
    <>
      <nav aria-label="Navegación de importaciones" className="admin-top-actions">
        <a className="button button-secondary" href="/admin/importar">Preparar lote</a>
        <a className="button button-secondary" href="/admin/importar/lotes">Historial y revisión</a>
      </nav>
      {children}
    </>
  )
}
