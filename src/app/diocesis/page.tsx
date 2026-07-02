const items = [
  { name: 'Arquidiocesis Metropolitana de Santiago de los Caballeros', type: 'Arquidiocesis', province: 'Provincia Eclesiastica de Santiago de los Caballeros', location: 'Santiago de los Caballeros, Santiago' },
  { name: 'Arquidiocesis Metropolitana de Santo Domingo', type: 'Arquidiocesis', province: 'Provincia Eclesiastica de Santo Domingo', location: 'Santo Domingo, Distrito Nacional' },
  { name: 'Diocesis de Bani', type: 'Diocesis', province: 'Provincia Eclesiastica de Santo Domingo', location: 'Bani, Peravia' },
  { name: 'Diocesis de Barahona', type: 'Diocesis', province: 'Provincia Eclesiastica de Santo Domingo', location: 'Barahona, Barahona' },
  { name: 'Diocesis de La Vega', type: 'Diocesis', province: 'Provincia Eclesiastica de Santiago de los Caballeros', location: 'La Vega, La Vega' },
  { name: 'Diocesis de Mao-Monte Cristi', type: 'Diocesis', province: 'Provincia Eclesiastica de Santiago de los Caballeros', location: 'Mao, Valverde' },
  { name: 'Diocesis de Nuestra Senora de la Altagracia en Higuey', type: 'Diocesis', province: 'Provincia Eclesiastica de Santo Domingo', location: 'Higuey, La Altagracia' },
  { name: 'Diocesis de Puerto Plata', type: 'Diocesis', province: 'Provincia Eclesiastica de Santiago de los Caballeros', location: 'Puerto Plata, Puerto Plata' },
  { name: 'Diocesis de San Francisco de Macoris', type: 'Diocesis', province: 'Provincia Eclesiastica de Santiago de los Caballeros', location: 'San Francisco de Macoris, Duarte' },
  { name: 'Diocesis de San Juan de la Maguana', type: 'Diocesis', province: 'Provincia Eclesiastica de Santo Domingo', location: 'San Juan de la Maguana, San Juan' },
  { name: 'Diocesis de San Pedro de Macoris', type: 'Diocesis', province: 'Provincia Eclesiastica de Santo Domingo', location: 'San Pedro de Macoris, San Pedro de Macoris' },
  { name: 'Diocesis de Stella Maris', type: 'Diocesis', province: 'Provincia Eclesiastica de Santo Domingo', location: 'Santo Domingo Este, Santo Domingo' },
  { name: 'Obispado Castrense de Republica Dominicana', type: 'Ordinariato Militar', province: 'Jurisdiccion nacional', location: 'Republica Dominicana' }
]

export default function DiocesisPage() {
  return (
    <main className="container">
      <div className="page-heading">
        <p className="eyebrow">Directorio</p>
        <h1>Diocesis</h1>
        <p className="lead">Listado inicial de arquidiocesis, diocesis y jurisdicciones especiales.</p>
      </div>
      <section className="grid">
        {items.map((item) => (
          <article className="entity-card" key={item.name}>
            <p className="entity-type">{item.type}</p>
            <h2>{item.name}</h2>
            <p className="meta">{item.province}</p>
            <p className="meta">{item.location}</p>
          </article>
        ))}
      </section>
    </main>
  )
}
