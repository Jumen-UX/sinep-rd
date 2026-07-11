import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de cookies',
  description: 'Uso de cookies técnicas en SINEP RD.',
}

export default function CookiesPage() {
  return (
    <main className="container legal-page">
      <header>
        <p className="eyebrow">Información institucional</p>
        <h1>Política de cookies</h1>
        <p className="lead">SINEP RD utiliza cookies técnicas necesarias para mantener sesiones seguras y operar las funciones administrativas.</p>
      </header>

      <section aria-labelledby="esenciales">
        <h2 id="esenciales">Cookies esenciales</h2>
        <p>La autenticación administrativa puede almacenar cookies de sesión. Estas cookies son necesarias para identificar al usuario, renovar su sesión y proteger las rutas restringidas.</p>
      </section>

      <section aria-labelledby="analitica">
        <h2 id="analitica">Analítica y publicidad</h2>
        <p>Actualmente el proyecto no declara cookies publicitarias ni analítica no esencial. Si se incorporan, esta política deberá actualizarse y se solicitará consentimiento antes de activarlas cuando corresponda.</p>
      </section>

      <section aria-labelledby="control">
        <h2 id="control">Control desde el navegador</h2>
        <p>El navegador permite borrar o bloquear cookies. Bloquear las cookies esenciales puede impedir el inicio de sesión y el uso del área administrativa.</p>
      </section>

      <p className="meta">Última actualización: 10 de julio de 2026.</p>
    </main>
  )
}
