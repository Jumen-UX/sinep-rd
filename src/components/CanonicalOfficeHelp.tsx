'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type CanonicalHelpRow = {
  office_configuration_key: string | null
  canonical_name: string | null
  short_definition: string | null
  full_definition: string | null
  canon_reference: string | null
  requires_priest: boolean | null
  requires_bishop: boolean | null
  canonical_context: string | null
  source_title: string | null
  source_url: string | null
}

type Props = {
  officeConfigurationKey?: string | null
  title?: string | null
}

export default function CanonicalOfficeHelp({ officeConfigurationKey, title }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [help, setHelp] = useState<CanonicalHelpRow | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadHelp() {
      if (!officeConfigurationKey) return
      const { data } = await supabase
        .from('public_office_canonical_help')
        .select('office_configuration_key,canonical_name,short_definition,full_definition,canon_reference,requires_priest,requires_bishop,canonical_context,source_title,source_url')
        .eq('office_configuration_key', officeConfigurationKey)
        .maybeSingle()

      if (!cancelled && data?.canonical_name) setHelp(data as CanonicalHelpRow)
    }

    loadHelp()
    return () => {
      cancelled = true
    }
  }, [officeConfigurationKey, supabase])

  if (!help) return null

  return (
    <span className="canonical-help-inline">
      <button
        className="canonical-help-button"
        type="button"
        title={help.short_definition ?? 'Ver definición canónica'}
        aria-label={`Ver definición canónica de ${title ?? help.canonical_name}`}
        onClick={() => setOpen((value) => !value)}
      >
        ⓘ
      </button>
      {open && (
        <span className="canonical-help-popover card">
          <strong>{help.canonical_name}</strong>
          <span>{help.short_definition}</span>
          {help.full_definition && <small>{help.full_definition}</small>}
          <small><b>Base:</b> {help.canon_reference}</small>
          {help.canonical_context && <small><b>Contexto:</b> {help.canonical_context}</small>}
          <small>{help.requires_bishop ? 'Requiere obispo.' : help.requires_priest ? 'Requiere sacerdote.' : 'Requisitos según derecho universal o particular.'}</small>
          {help.source_url && <a href={help.source_url} target="_blank" rel="noreferrer">Código de Derecho Canónico</a>}
        </span>
      )}
    </span>
  )
}
