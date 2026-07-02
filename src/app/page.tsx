import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="container">
      <section className="hero">
        <div>
          <p className="eyebrow">República Dominicana</p>
          <h1>Sistema Nacional de Información Eclesiástica y Pastoral</h1>
          <p className="lead">
            Plataforma para organizar diócesis, parroquias, clero, pastorales,
            nombramientos, documentos y efemérides de la Iglesia en República Dominicana.
          </p>

          <div className="actions">
            <Link className="button button-primary" href="/diocesis">
              Ver diócesis
            </Link>
            <Link className="button button-secondary" href="/admin">
              Portal administrativo
            </Link>
          </div>
        </div>

        <aside className="card" aria-label="Resumen del sistema">
          <p className="eyebrow">Módulos iniciales</p>
          <div className="stat-grid">
            <div className="stat">
              <strong>01</strong>
              <span>Directorio eclesiástico nacional</span>
            </div>
            <div className="stat">
              <strong>02</strong>
              <span>Clero, nombramientos y movimientos históricos</span>
            </div>
            <div className="stat">
              <strong>03</strong>
              <span>Pastorales, documentos y calendario eclesial</span>
            </div>
          </div>
        </aside>
      </section>
    </main>
  )
}
