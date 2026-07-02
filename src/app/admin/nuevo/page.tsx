'use client'

import Link from 'next/link'

const items = [
  ['Nueva persona episcopal', 'Persona', 'Datos personales, perfil clerical, consagración, nombramiento y fuentes.'],
  ['Nuevo sacerdote', 'Persona', 'Datos personales, ordenación, cargo actual, historial y fuentes.'],
  ['Nueva jurisdicción', 'Entidad', 'Identidad, territorio, responsable principal, estadísticas y estructura.'],
  ['Nueva parroquia', 'Entidad', 'Identidad, dependencia territorial, responsables, contacto y pastorales.'],
  ['Nueva capilla', 'Entidad', 'Identidad, dependencia, responsable, ubicación y notas.'],
]

export default function AdminNuevoPage() {
  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink"><Link href="/admin">← Volver al panel administrativo</Link></div>
      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Asistente de registro</p>
          <h1>Agregar nueva ficha</h1>
          <p className="lead">Punto de entrada para crear fichas completas mediante procesos guiados. Cada asistente intentará completar la ficha y registrar qué datos quedan no identificados o no aplican.</p>
        </div>
      </section>
      <section className="grid admin-modules">
        {items.map(([title, type, description]) => (
          <article className="entity-card admin-module" key={title}>
            <p className="entity-type">{type}</p>
            <h2>{title}</h2>
            <p className="meta">{description}</p>
            <button className="button button-secondary" type="button" disabled>Asistente en preparación</button>
          </article>
        ))}
      </section>
    </main>
  )
}
