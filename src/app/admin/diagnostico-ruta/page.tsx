import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export default async function AdminRouteDiagnosticPage() {
  const requestHeaders = await headers()
  const pathname = requestHeaders.get('x-sinep-admin-pathname') ?? 'No recibido'
  const search = requestHeaders.get('x-sinep-admin-search') ?? ''
  const host = requestHeaders.get('host') ?? 'No recibido'
  const userAgent = requestHeaders.get('user-agent') ?? 'No recibido'

  return (
    <main className="container dashboard-page admin-config-page">
      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Diagnóstico de ruta administrativa</p>
          <h1>Ruta reconocida por Next</h1>
          <p className="lead">Esta página confirma si Render y Next están resolviendo subrutas dentro de /admin.</p>
        </div>
      </section>

      <section className="card admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Request</p>
            <h2>Información recibida</h2>
          </div>
        </div>
        <dl className="admin-system-card">
          <div><span>Path recibido</span><strong>{pathname}</strong></div>
          <div><span>Query string</span><strong>{search || 'Sin query'}</strong></div>
          <div><span>Host</span><strong>{host}</strong></div>
          <div><span>User agent</span><strong>{userAgent.slice(0, 120)}</strong></div>
        </dl>
        <p className="meta">Si esta página se muestra, las subrutas /admin sí están funcionando a nivel de App Router.</p>
      </section>
    </main>
  )
}
