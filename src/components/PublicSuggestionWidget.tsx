'use client'

import { FormEvent, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'

type TargetInfo = {
  target_table: string
  target_slug: string
  label: string
}

function targetFromPath(pathname: string): TargetInfo | null {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length !== 2) return null
  if (parts[0] === 'personas') return { target_table: 'persons', target_slug: parts[1], label: 'esta ficha de persona' }
  if (parts[0] === 'entidades') return { target_table: 'ecclesiastical_entities', target_slug: parts[1], label: 'esta ficha de entidad' }
  return null
}

export default function PublicSuggestionWidget() {
  const pathname = usePathname()
  const target = useMemo(() => targetFromPath(pathname ?? ''), [pathname])
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!target) return null

  async function submitSuggestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    setError(null)

    const form = new FormData(event.currentTarget)
    const title = String(form.get('title') ?? '').trim()
    const description = String(form.get('description') ?? '').trim()

    if (!title || !description) {
      setError('Indica un título y describe la sugerencia.')
      setSaving(false)
      return
    }

    const response = await fetch('/api/sugerencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_table: target.target_table,
        target_slug: target.target_slug,
        page_url: pathname,
        suggestion_type: form.get('suggestion_type'),
        title,
        description,
        field_name: form.get('field_name'),
        current_value: form.get('current_value'),
        proposed_value: form.get('proposed_value'),
        source_name: form.get('source_name'),
        source_url: form.get('source_url'),
        submitter_name: form.get('submitter_name'),
        submitter_email: form.get('submitter_email'),
        submitter_country: form.get('submitter_country'),
      }),
    })

    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      setError(result.error ?? 'No se pudo enviar la sugerencia.')
    } else {
      setMessage('Sugerencia enviada. Será revisada antes de publicarse.')
      event.currentTarget.reset()
    }

    setSaving(false)
  }

  return (
    <div className="public-suggestion-widget">
      <button className="button button-primary public-suggestion-toggle" type="button" onClick={() => setOpen((value) => !value)}>
        Sugerir cambio
      </button>

      {open && (
        <div className="public-suggestion-panel card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Revisión editorial</p>
              <h2>Sugerir cambio en {target.label}</h2>
            </div>
            <button className="button button-secondary" type="button" onClick={() => setOpen(false)}>Cerrar</button>
          </div>

          <p className="meta">Tu sugerencia no cambia la ficha inmediatamente. Queda pendiente para revisión y aprobación.</p>
          {message && <div className="empty-state">{message}</div>}
          {error && <div className="error-box">{error}</div>}

          <form className="admin-form admin-config-form" onSubmit={submitSuggestion}>
            <select name="suggestion_type" defaultValue="correction">
              <option value="correction">Corrección</option>
              <option value="addition">Agregar información</option>
              <option value="source">Agregar o corregir fuente</option>
              <option value="country_data">Información de otro país</option>
            </select>
            <input name="title" placeholder="Título breve de la sugerencia" />
            <input name="field_name" placeholder="Campo: teléfono, biografía, párroco, fuente..." />
            <textarea name="current_value" placeholder="Valor actual, si aplica" />
            <textarea name="proposed_value" placeholder="Valor propuesto" />
            <textarea name="description" placeholder="Explicación de la sugerencia" />
            <input name="source_name" placeholder="Fuente o documento" />
            <input name="source_url" placeholder="URL de fuente" />
            <input name="submitter_name" placeholder="Tu nombre" />
            <input name="submitter_email" placeholder="Tu correo" type="email" />
            <input name="submitter_country" placeholder="País" />
            <button className="button button-primary" disabled={saving}>{saving ? 'Enviando...' : 'Enviar a revisión'}</button>
          </form>
        </div>
      )}
    </div>
  )
}
