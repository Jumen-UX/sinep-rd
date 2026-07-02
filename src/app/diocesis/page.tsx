const items = [
  { name: 'Arquidiocesis de Santo Domingo', type: 'Arquidiocesis' },
  { name: 'Diocesis de Bani', type: 'Diocesis' }
]

export default function DiocesisPage() {
  return (
    <main className="container">
      <div className="page-heading">
        <p className="eyebrow">Directorio</p>
        <h1>Diocesis</h1>
        <p className="lead">Listado inicial.</p>
      </div>
      <section className="grid">
        {items.map((item) => (
          <article className="entity-card" key={item.name}>
            <p className="entity-type">{item.type}</p>
            <h2>{item.name}</h2>
          </article>
        ))}
      </section>
    </main>
  )
}
