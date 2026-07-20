'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'

type AdminSearchResult = {
  result_type: 'person' | 'entity' | 'organization_unit'
  result_id: string
  title: string
  subtitle: string | null
  href: string
  rank: number
}

const resultLabels: Record<AdminSearchResult['result_type'], string> = {
  person: 'Persona',
  entity: 'Entidad',
  organization_unit: 'Unidad organizativa',
}

export default function AdminSearchPage() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q')?.trim() ?? ''
  const [input, setInput] = useState(initialQuery)
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<AdminSearchResult[]>([])
  const [loading, setLoading] = useState(initialQuery.length >= 2)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetch(`/api/admin/search?q=${encodeURIComponent(query)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json() as { results?: AdminSearchResult[]; error?: string }
        if (!response.ok) throw new Error(payload.error ?? 'No se pudo completar la búsqueda.')
        setResults(payload.results ?? [])
      })
      .catch((searchError: unknown) => {
        if (searchError instanceof DOMException && searchError.name === 'AbortError') return
        setResults([])
        setError(searchError instanceof Error ? searchError.message : 'No se pudo completar la búsqueda.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [query])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = input.trim().replace(/\s+/g, ' ')
    setQuery(normalized)
    window.history.replaceState(null, '', normalized ? `/admin/buscar?q=${encodeURIComponent(normalized)}` : '/admin/buscar')
  }

  return (
    <main className="container admin-dashboard" id="top">
      <PageHeader
        breadcrumbs={[{ label: 'Administración', href: '/admin' }, { label: 'Buscar' }]}
        eyebrow="Búsqueda administrativa"
        title="Buscar en el directorio interno"
        description="Consulta personas, entidades y unidades organizativas respetando tus permisos y el alcance activo."
        metadata={<StatusBadge tone="info" dot>{results.length} resultado{results.length === 1 ? '' : 's'}</StatusBadge>}
      />

      <section className="card dashboard-section" aria-labelledby="admin-search-heading">
        <form className="admin-dashboard-search" onSubmit={handleSubmit}>
          <label htmlFor="canonical-admin-search">Nombre o término</label>
          <input
            id="canonical-admin-search"
            minLength={2}
            maxLength={120}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Persona, diócesis, parroquia o unidad"
            type="search"
            value={input}
          />
          <Button disabled={input.trim().length < 2 || loading} type="submit">
            {loading ? 'Buscando…' : 'Buscar'}
          </Button>
        </form>
      </section>

      {error ? <EmptyState compact title="No se pudo completar la búsqueda" description={error} /> : null}

      {!error && query.length < 2 ? (
        <EmptyState compact title="Escribe al menos dos caracteres" description="La búsqueda no se ejecuta hasta que el término sea suficientemente específico." />
      ) : null}

      {!error && !loading && query.length >= 2 && results.length === 0 ? (
        <EmptyState compact title="Sin resultados disponibles" description="No se encontraron coincidencias visibles para tu alcance y permisos." />
      ) : null}

      {results.length > 0 ? (
        <section className="card dashboard-section" aria-labelledby="admin-search-results-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Resultados autorizados</p>
              <h2 id="admin-search-results-heading">Coincidencias para “{query}”</h2>
              <p className="meta">Los dominios sin permiso o fuera de alcance no aparecen en esta lista.</p>
            </div>
          </div>
          <div className="admin-quick-grid">
            {results.map((result) => (
              <a className="admin-quick-card" href={result.href} key={`${result.result_type}:${result.result_id}`}>
                <span className="admin-card-icon" aria-hidden="true">⌕</span>
                <span>
                  <strong>{result.title}</strong>
                  <small>{resultLabels[result.result_type]}{result.subtitle ? ` · ${result.subtitle}` : ''}</small>
                </span>
                <span className="admin-card-arrow" aria-hidden="true">→</span>
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  )
}
