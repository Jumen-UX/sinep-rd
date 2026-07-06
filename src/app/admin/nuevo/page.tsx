'use client'

import Link from 'next/link'

type FlowItem = {
  title: string
  type: string
  description: string
  href: string
  status: string
  note?: string
}

type FlowGroup = {
  title: string
  eyebrow: string
  description: string
  items: FlowItem[]
}

const flowGroups: FlowGroup[] = [
  {
    eyebrow: 'Personas y ministerio',
    title: 'Registrar historial de una persona',
    description: 'Usa estos flujos para evitar duplicados. Una misma persona puede avanzar de diácono a sacerdote y luego a obispo.',
    items: [
      {
        title: 'Registrar diácono',
        type: 'Inicio del historial clerical',
        description: 'Registra un diácono permanente, transitorio o externo. Este será el punto de partida para futuras promociones.',
        href: '/admin/nuevo/diacono',
        status: 'Pendiente',
        note: 'El formulario específico se agregará después de cerrar sacerdote.',
      },
      {
        title: 'Registrar sacerdote',
        type: 'Desde diácono o historial manual',
        description: 'Primero debe buscar si ya existe como diácono. Si existe, se completa su ordenación sacerdotal sin crear otra persona.',
        href: '/admin/nuevo/sacerdote',
        status: 'Disponible',
      },
      {
        title: 'Registrar obispo',
        type: 'Desde sacerdote existente',
        description: 'Primero debe buscar si ya existe como sacerdote. Si existe, se agregan los datos episcopales sobre la misma persona.',
        href: '/admin/nuevo/obispo',
        status: 'Pendiente de ajuste',
        note: 'Debe traer la información sacerdotal antes de pedir datos episcopales.',
      },
      {
        title: 'Registrar laico/a',
        type: 'Persona no clerical',
        description: 'Registra una persona laica con código interno LAICO, contacto privado y posibles servicios o responsabilidades.',
        href: '/admin/nuevo/laico',
        status: 'Pendiente',
      },
      {
        title: 'Registrar religioso/a',
        type: 'Vida consagrada',
        description: 'Distingue religioso sacerdote, religioso no ordenado y religiosa. No debe asumir automáticamente que pertenece al clero.',
        href: '/admin/nuevo/religioso',
        status: 'Pendiente',
      },
    ],
  },
  {
    eyebrow: 'Estructura eclesial',
    title: 'Registrar entidades',
    description: 'Usa estos flujos cuando vas a agregar jurisdicciones, parroquias, capillas o divisiones que dependen de una estructura previa.',
    items: [
      {
        title: 'Registrar jurisdicción',
        type: 'Diócesis, arquidiócesis u ordinariato',
        description: 'Crea o completa una jurisdicción eclesiástica con su dependencia territorial y datos institucionales.',
        href: '/admin/nuevo/jurisdiccion',
        status: 'Disponible',
      },
      {
        title: 'Registrar parroquia',
        type: 'Entidad territorial',
        description: 'Debe depender de una jurisdicción o división previa. Luego puede tener párroco, administrador o estado vacante.',
        href: '/admin/nuevo/parroquia',
        status: 'Disponible',
      },
      {
        title: 'Registrar capilla',
        type: 'Entidad dependiente',
        description: 'Debe depender de una parroquia, comunidad o entidad territorial existente.',
        href: '/admin/nuevo/capilla',
        status: 'Disponible',
      },
    ],
  },
]

export default function AdminNuevoPage() {
  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink"><Link href="/admin">← Volver al panel administrativo</Link></div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Asistente de registro</p>
          <h1>¿Qué quieres registrar?</h1>
          <p className="lead">
            Elige el flujo correcto para que el sistema no duplique personas ni entidades. En el clero, la historia debe crecer sobre la misma persona: diácono, sacerdote y obispo.
          </p>
        </div>
      </section>

      <section className="card admin-section">
        <p className="eyebrow">Regla principal</p>
        <h2>Una persona, una historia</h2>
        <p className="meta">
          Para registrar un sacerdote, primero se debe revisar si ya existe como diácono. Para registrar un obispo, primero se debe revisar si ya existe como sacerdote. Solo se crea una ficha nueva cuando la persona no existe en el sistema.
        </p>
      </section>

      {flowGroups.map((group) => (
        <section className="card admin-section" key={group.title}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">{group.eyebrow}</p>
              <h2>{group.title}</h2>
              <p className="meta">{group.description}</p>
            </div>
          </div>

          <div className="grid admin-modules">
            {group.items.map((item) => {
              const isAvailable = item.status === 'Disponible'
              return (
                <article className="entity-card admin-module" key={item.title}>
                  <p className="entity-type">{item.type}</p>
                  <h2>{item.title}</h2>
                  <p className="meta">{item.description}</p>
                  {item.note && <p className="meta">{item.note}</p>}
                  <p className="role-pill">{item.status}</p>
                  {isAvailable ? (
                    <Link className="button button-primary" href={item.href}>Iniciar asistente</Link>
                  ) : (
                    <Link className="button button-secondary" href={item.href}>Ver flujo pendiente</Link>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </main>
  )
}
