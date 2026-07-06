'use client'

import Link from 'next/link'

const items = [
  { title: 'Nuevo obispo', type: 'Clero', description: 'Seleccionar sacerdote existente o crear obispo nuevo, con ordenación episcopal, sucesión y cargo.', href: '/admin/nuevo/obispo' },
  { title: 'Nuevo sacerdote', type: 'Clero', description: 'Datos personales, ordenación, cargo actual, historial y fuentes.', href: '/admin/nuevo/sacerdote' },
  { title: 'Nueva jurisdicción', type: 'Entidad', description: 'Provincia eclesiástica, arquidiócesis, diócesis, ordinariato o división territorial interna.', href: '/admin/nuevo/jurisdiccion' },
  { title: 'Nueva parroquia', type: 'Entidad', description: 'Identidad, dependencia territorial, responsables, contacto y pastorales.', href: '/admin/nuevo/parroquia' },
  { title: 'Nueva capilla', type: 'Entidad', description: 'Identidad, dependencia, responsable, ubicación y notas.', href: '/admin/nuevo/capilla' },
]

export default function AdminNuevoPage() {
  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink"><Link href="/admin">← Volver al panel administrativo</Link></div>
      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Asistente de registro</p>
          <h1>Agregar nueva ficha</h1>
          <p className="lead">Punto de entrada para crear fichas completas mediante procesos guiados. Cada asistente intenta completar la ficha y registrar qué datos quedan no identificados o no aplican.</p>
        </div>
      </section>
      <section className="grid admin-modules">
        {items.map((item) => (
          <article className="entity-card admin-module" key={item.title}>
            <p className="entity-type">{item.type}</p>
            <h2>{item.title}</h2>
            <p className="meta">{item.description}</p>
            <Link className="button button-primary" href={item.href}>Iniciar asistente</Link>
          </article>
        ))}
      </section>
    </main>
  )
}
