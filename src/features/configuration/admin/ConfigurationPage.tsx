'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { hasConfigurationAdminSession } from '../services/configuration-admin-service'

type ConfigCard = {
  href: string
  label: string
  title: string
  description: string
  icon: string
  status?: 'active' | 'planned'
  items: string[]
}

type ConfigSection = {
  title: string
  eyebrow: string
  description: string
  icon: string
  items: ConfigCard[]
}

const configSections: ConfigSection[] = [
  {
    eyebrow: 'Usuarios y seguridad',
    title: 'Acceso administrativo',
    description: 'Controla accesos administrativos, roles, permisos efectivos, estados de cuenta y auditoría.',
    icon: '♙',
    items: [
      {
        href: '/admin/usuarios',
        label: 'Activo',
        title: 'Usuarios, roles y permisos',
        description: 'Ver usuarios, activar o suspender cuentas, asignar niveles de acceso y cerrar roles activos.',
        icon: '♙',
        items: ['Usuarios', 'Roles', 'Alcances'],
      },
      {
        href: '/admin/usuarios',
        label: 'Activo',
        title: 'Asignación de roles',
        description: 'Asignar roles por alcance nacional, diócesis, parroquia, entidad pastoral o nodo estructural.',
        icon: '◇',
        items: ['Rol', 'Entidad', 'Permisos'],
      },
      {
        href: '/admin/revision',
        label: 'Activo',
        title: 'Revisión administrativa',
        description: 'Consultar pendientes de validación, fichas incompletas y cambios que requieren decisión.',
        icon: '!',
        items: ['Pendientes', 'Corrección', 'Validación'],
      },
    ],
  },
  {
    eyebrow: 'Cargos y nombramientos',
    title: 'Oficios, cargos y sucesión',
    description: 'Define cómo se usan los cargos y registra asignaciones vigentes, vacantes, reemplazos e historial.',
    icon: '▣',
    items: [
      {
        href: '/admin/asignaciones',
        label: 'Activo',
        title: 'Cargos y nombramientos',
        description: 'Registrar cargos vigentes, vacantes, reemplazos, predecesores y sucesores.',
        icon: '▣',
        items: ['Cargo', 'Persona', 'Historial'],
      },
      {
        href: '/admin/configuracion',
        label: 'Próximo',
        title: 'Catálogo de oficios',
        description: 'Administrar definiciones de cargos como párroco, vicario general, obispo auxiliar o director pastoral.',
        icon: '▤',
        status: 'planned',
        items: ['Cargos', 'Niveles', 'Reglas'],
      },
      {
        href: '/admin/configuracion',
        label: 'Próximo',
        title: 'Referencias canónicas',
        description: 'Consultar referencias y definiciones para orientar el uso correcto de los cargos.',
        icon: '§',
        status: 'planned',
        items: ['Canon', 'Referencia', 'Criterio'],
      },
    ],
  },
  {
    eyebrow: 'Estructura institucional',
    title: 'Territorio, pastoral y administración',
    description: 'Organiza diócesis, parroquias, zonas, vicarías, pastorales y unidades administrativas.',
    icon: '▦',
    items: [
      {
        href: '/admin/estructura',
        label: 'Activo',
        title: 'Estructura flexible',
        description: 'Administrar cómo se ordenan las entidades y divisiones internas de cada jurisdicción.',
        icon: '▦',
        items: ['Niveles', 'Nodos', 'Modelos'],
      },
      {
        href: '/admin/paises',
        label: 'Activo',
        title: 'Países ISO',
        description: 'Habilitar países, banderas y visibilidad pública condicionada por datos registrados.',
        icon: '◎',
        items: ['ISO2', 'ISO3', 'Banderas'],
      },
      {
        href: '/admin/estructura/eventos',
        label: 'Activo',
        title: 'Evolución estructural',
        description: 'Registrar creación, división, fusión o supresión de estructuras y entidades.',
        icon: '◷',
        items: ['Eventos', 'Fechas', 'Fuentes'],
      },
    ],
  },
  {
    eyebrow: 'Control editorial',
    title: 'Calidad, fuentes y publicación',
    description: 'Revisa cambios, datos incompletos y solicitudes antes de publicarlos.',
    icon: '✓',
    items: [
      {
        href: '/admin/eventos/pendientes',
        label: 'Activo',
        title: 'Eventos pendientes',
        description: 'Revisar, aprobar, devolver o cancelar eventos pendientes de aplicación.',
        icon: '!',
        items: ['Aprobación', 'Corrección', 'Aplicación'],
      },
      {
        href: '/admin/eventos',
        label: 'Activo',
        title: 'Registro histórico',
        description: 'Explorar eventos históricos y trazabilidad de hechos registrados.',
        icon: '◷',
        items: ['Hechos', 'Cronología', 'Evidencia'],
      },
      {
        href: '/admin/estado-fichas',
        label: 'Activo',
        title: 'Estado de fichas',
        description: 'Revisar campos faltantes, datos no identificados y fichas incompletas desde un panel dedicado.',
        icon: '✓',
        items: ['Calidad', 'Completitud', 'Publicación'],
      },
    ],
  },
]

function ConfigModuleCard({ item }: { item: ConfigCard }) {
  const content = (
    <>
      <div className="admin-module-card-head">
        <span className="admin-module-icon">{item.icon}</span>
        <span className={`admin-status-pill ${item.status === 'planned' ? 'planned' : 'active'}`}>{item.label}</span>
      </div>
      <p className="entity-type">Configuración</p>
      <h3>{item.title}</h3>
      <p className="meta">{item.description}</p>
      <ul>
        {item.items.map((detail) => <li key={detail}>{detail}</li>)}
      </ul>
      <span className={`admin-module-action ${item.status === 'planned' ? 'disabled' : ''}`}>{item.status === 'planned' ? 'Pendiente' : 'Abrir módulo'} <span aria-hidden="true">→</span></span>
    </>
  )

  if (item.status === 'planned') return <article className="admin-module-card is-planned">{content}</article>
  return <Link className="admin-module-card is-active" href={item.href}>{content}</Link>
}

export default function ConfigurationPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function checkSession() {
      try {
        const authenticated = await hasConfigurationAdminSession(supabase)
        if (!authenticated) {
          router.replace('/admin/login')
          return
        }
        setLoading(false)
      } catch (sessionError) {
        setError(sessionError instanceof Error ? sessionError.message : 'No se pudo comprobar la sesión administrativa.')
        setLoading(false)
      }
    }

    checkSession()
  }, [router, supabase])

  if (loading) return <div className="empty-state">Cargando configuración...</div>
  if (error) return <div className="error-box">{error}</div>

  return (
    <main className="admin-config-page" id="top">
      <header className="admin-top-header">
        <div className="admin-top-title">
          <span className="admin-mini-mark">AJUSTES</span>
          <strong>Configuración</strong>
        </div>
        <div className="admin-top-actions">
          <Link className="button button-secondary" href="/admin">Volver al panel</Link>
          <Link className="button button-secondary" href="/admin/revision">Pendientes</Link>
        </div>
      </header>

      <section className="admin-welcome-panel">
        <div>
          <p className="eyebrow">Centro de configuración</p>
          <h1>Ajustes del sistema</h1>
          <p className="lead">Agrupa los ajustes que definen cómo funciona SINEP RD: accesos, cargos, estructura, catálogos, reglas editoriales y validación.</p>
          <div className="role-list admin-role-list">
            <span className="role-pill">Módulos activos</span>
            <span className="role-pill">Próximas fases</span>
            <span className="role-pill">Sin enlaces muertos</span>
          </div>
        </div>
        <div className="admin-welcome-illustration" aria-hidden="true">⚙</div>
      </section>

      {configSections.map((section) => (
        <section className="admin-module-group" key={section.title}>
          <div className="admin-group-heading">
            <span>{section.icon}</span>
            <div>
              <p className="eyebrow">{section.eyebrow}</p>
              <h2>{section.title}</h2>
              <p className="meta">{section.description}</p>
            </div>
            <Link href="#top">Subir</Link>
          </div>

          <div className="admin-module-grid">
            {section.items.map((item) => <ConfigModuleCard item={item} key={`${item.title}-${item.label}`} />)}
          </div>
        </section>
      ))}
    </main>
  )
}
