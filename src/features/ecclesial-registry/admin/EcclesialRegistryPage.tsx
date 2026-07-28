'use client'

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@/components/ui/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { PageState } from '@/components/ui/page-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { useAdminNavigation } from '@/features/admin/navigation/AdminNavigationProvider'
import { createClient } from '@/lib/supabase/client'
import {
  loadCommunicationChannels,
  loadEcclesialInstitutions,
  loadEcclesiasticalPlaces,
  loadRegistryCatalogs,
  loadRegistryOwnerOptions,
  saveCommunicationChannel,
  saveEcclesialInstitution,
  saveEcclesiasticalPlace,
  type ChannelTypeOption,
  type CommunicationChannelRow,
  type EcclesialInstitutionRow,
  type EcclesiasticalPlaceRow,
  type InstitutionCategoryOption,
  type PlaceTypeOption,
  type RegistryOwnerKind,
  type RegistryOwnerOption,
} from '../services/ecclesial-registry-admin-service'

type RegistryTab = 'places' | 'institutions' | 'channels'

const registryTabs: Array<{ key: RegistryTab; label: string; description: string }> = [
  { key: 'places', label: 'Lugares', description: 'Templos, iglesias, santuarios y capillas' },
  { key: 'institutions', label: 'Instituciones', description: 'Escuelas, obras, seminarios, salud y medios' },
  { key: 'channels', label: 'Comunicación', description: 'Teléfonos, web, redes, radio y publicaciones' },
]

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'active', label: 'Activo' },
  { value: 'under_review', label: 'En revisión' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'closed', label: 'Cerrado' },
  { value: 'archived', label: 'Archivado' },
]

const visibilityOptions = [
  { value: '', label: 'Todas las visibilidades' },
  { value: 'public', label: 'Pública' },
  { value: 'internal', label: 'Interna' },
  { value: 'private', label: 'Privada' },
  { value: 'confidential', label: 'Confidencial' },
]

function formValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function readableValue(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(value: string | null) {
  if (!value) return 'No registrada'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

function visibilityTone(value: string): 'neutral' | 'info' | 'warning' | 'danger' {
  if (value === 'public') return 'info'
  if (value === 'internal') return 'warning'
  if (value === 'private' || value === 'confidential') return 'danger'
  return 'neutral'
}

function statusTone(value: string): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
  if (value === 'active') return 'success'
  if (value === 'under_review') return 'warning'
  if (value === 'closed' || value === 'archived') return 'danger'
  if (value === 'inactive') return 'neutral'
  return 'info'
}

function ownerKindLabel(value: RegistryOwnerKind) {
  if (value === 'entity') return 'Entidad eclesial'
  if (value === 'organization_unit') return 'Unidad organizativa'
  if (value === 'place') return 'Lugar físico'
  return 'Institución u obra'
}

function typeFilterOptions(
  tab: RegistryTab,
  placeTypes: PlaceTypeOption[],
  institutionCategories: InstitutionCategoryOption[],
  channelTypes: ChannelTypeOption[],
) {
  if (tab === 'places') return placeTypes.map((option) => ({ value: option.key, label: option.name }))
  if (tab === 'institutions') return institutionCategories.map((option) => ({ value: option.key, label: option.name }))
  return channelTypes.map((option) => ({ value: option.key, label: option.name }))
}

export default function EcclesialRegistryPage() {
  const supabase = useMemo(() => createClient(), [])
  const navigation = useAdminNavigation()
  const permissionKeys = useMemo(
    () => new Set(navigation.context?.permissionKeys ?? []),
    [navigation.context?.permissionKeys],
  )
  const canViewPlaces = permissionKeys.has('places.view')
  const canViewInstitutions = permissionKeys.has('institutions.view')
  const canViewChannels = permissionKeys.has('communications.view')
  const canCreatePlaces = permissionKeys.has('places.create_proposal')
  const canCreateInstitutions = permissionKeys.has('institutions.create_proposal')
  const canManageChannels = permissionKeys.has('communications.update_proposal')
  const canPublishPlaces = permissionKeys.has('places.publish')
  const canPublishInstitutions = permissionKeys.has('institutions.publish')
  const canWriteAnything = canCreatePlaces || canCreateInstitutions || canManageChannels

  const [tab, setTab] = useState<RegistryTab>('places')
  const [places, setPlaces] = useState<EcclesiasticalPlaceRow[]>([])
  const [institutions, setInstitutions] = useState<EcclesialInstitutionRow[]>([])
  const [channels, setChannels] = useState<CommunicationChannelRow[]>([])
  const [placeTypes, setPlaceTypes] = useState<PlaceTypeOption[]>([])
  const [institutionCategories, setInstitutionCategories] = useState<InstitutionCategoryOption[]>([])
  const [channelTypes, setChannelTypes] = useState<ChannelTypeOption[]>([])
  const [ownerOptions, setOwnerOptions] = useState<RegistryOwnerOption[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [typeKey, setTypeKey] = useState('')
  const [status, setStatus] = useState('')
  const [visibility, setVisibility] = useState('')
  const [channelOwnerKind, setChannelOwnerKind] = useState<RegistryOwnerKind>('entity')
  const [channelOwnerId, setChannelOwnerId] = useState('')
  const [selectedPlaceType, setSelectedPlaceType] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const activeScope = navigation.context?.activeScope ?? null
  const scope = useMemo(() => ({
    type: activeScope?.type ?? null,
    id: activeScope?.entityId ?? null,
  }), [activeScope?.entityId, activeScope?.type])

  const availableTabs = useMemo(
    () => registryTabs.filter((item) => (
      (item.key === 'places' && canViewPlaces)
      || (item.key === 'institutions' && canViewInstitutions)
      || (item.key === 'channels' && canViewChannels)
    )),
    [canViewChannels, canViewInstitutions, canViewPlaces],
  )

  const placeEntityOptions = useMemo(
    () => ownerOptions.filter((option) => option.owner_kind === 'entity' && option.allowed_for_places),
    [ownerOptions],
  )
  const institutionEntityOptions = useMemo(
    () => ownerOptions.filter((option) => option.owner_kind === 'entity' && option.allowed_for_institutions),
    [ownerOptions],
  )
  const channelOwnerOptions = useMemo(
    () => ownerOptions.filter((option) => (
      option.owner_kind === channelOwnerKind && option.allowed_for_communications
    )),
    [channelOwnerKind, ownerOptions],
  )
  const selectedPlaceTypeOption = useMemo(
    () => placeTypes.find((option) => option.key === selectedPlaceType) ?? null,
    [placeTypes, selectedPlaceType],
  )
  const currentTypeOptions = useMemo(
    () => typeFilterOptions(tab, placeTypes, institutionCategories, channelTypes),
    [channelTypes, institutionCategories, placeTypes, tab],
  )

  const loadData = useCallback(async () => {
    if (!navigation.context || navigation.context.accessState !== 'ready') return

    setLoading(true)
    setError(null)

    try {
      const [catalogs, owners, placeRows, institutionRows, channelRows] = await Promise.all([
        loadRegistryCatalogs(supabase),
        canWriteAnything ? loadRegistryOwnerOptions(supabase, scope) : Promise.resolve([]),
        canViewPlaces
          ? loadEcclesiasticalPlaces(supabase, scope, {
              search: appliedSearch || null,
              typeKey: tab === 'places' ? typeKey || null : null,
              status: status || null,
              visibility: visibility || null,
              limit: 750,
            })
          : Promise.resolve([]),
        canViewInstitutions
          ? loadEcclesialInstitutions(supabase, scope, {
              search: appliedSearch || null,
              typeKey: tab === 'institutions' ? typeKey || null : null,
              status: status || null,
              visibility: visibility || null,
              limit: 750,
            })
          : Promise.resolve([]),
        canViewChannels
          ? loadCommunicationChannels(supabase, scope, {
              search: appliedSearch || null,
              typeKey: tab === 'channels' ? typeKey || null : null,
              status: status || null,
              visibility: visibility || null,
              limit: 1500,
            })
          : Promise.resolve([]),
      ])

      setPlaceTypes(catalogs.placeTypes)
      setInstitutionCategories(catalogs.institutionCategories)
      setChannelTypes(catalogs.channelTypes)
      setOwnerOptions(owners)
      setPlaces(placeRows)
      setInstitutions(institutionRows)
      setChannels(channelRows)
    } catch (loadError) {
      setPlaces([])
      setInstitutions([])
      setChannels([])
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el registro eclesial.')
    } finally {
      setLoading(false)
    }
  }, [
    appliedSearch,
    canViewChannels,
    canViewInstitutions,
    canViewPlaces,
    canWriteAnything,
    navigation.context,
    scope,
    status,
    supabase,
    tab,
    typeKey,
    visibility,
  ])

  useEffect(() => {
    if (navigation.loading) return
    void loadData()
  }, [loadData, navigation.loading])

  useEffect(() => {
    if (availableTabs.some((item) => item.key === tab)) return
    if (availableTabs[0]) setTab(availableTabs[0].key)
  }, [availableTabs, tab])

  useEffect(() => {
    setTypeKey('')
  }, [tab])

  useEffect(() => {
    setSelectedPlaceType((current) => current || placeTypes[0]?.key || '')
  }, [placeTypes])

  useEffect(() => {
    setChannelOwnerId((current) => (
      current && channelOwnerOptions.some((option) => option.owner_id === current)
        ? current
        : channelOwnerOptions[0]?.owner_id ?? ''
    ))
  }, [channelOwnerOptions])

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAppliedSearch(searchInput.trim().replace(/\s+/g, ' '))
  }

  async function handlePlaceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      await saveEcclesiasticalPlace(supabase, {
        placeTypeKey: formValue(formData, 'place_type_key'),
        primaryEntityId: formValue(formData, 'primary_entity_id'),
        name: formValue(formData, 'name'),
        officialName: formValue(formData, 'official_name'),
        description: formValue(formData, 'description'),
        dedicationTitle: formValue(formData, 'dedication_title'),
        patronName: formValue(formData, 'patron_name'),
        dedicatedAt: formValue(formData, 'dedicated_at'),
        consecratedAt: formValue(formData, 'consecrated_at'),
        address: formValue(formData, 'address'),
        municipality: formValue(formData, 'municipality'),
        status: formValue(formData, 'status') || 'under_review',
        visibility: formValue(formData, 'visibility') || 'internal',
        isPrimarySeat: formData.get('is_primary_seat') === 'on',
      })
      form.reset()
      setSelectedPlaceType(placeTypes[0]?.key ?? '')
      setNotice('Lugar eclesiástico guardado y auditado correctamente.')
      await loadData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el lugar eclesiástico.')
    } finally {
      setSaving(false)
    }
  }

  async function handleInstitutionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      await saveEcclesialInstitution(supabase, {
        categoryKey: formValue(formData, 'category_key'),
        primaryEntityId: formValue(formData, 'primary_entity_id'),
        name: formValue(formData, 'name'),
        officialName: formValue(formData, 'official_name'),
        description: formValue(formData, 'description'),
        foundedAt: formValue(formData, 'founded_at'),
        canonicalErectedAt: formValue(formData, 'canonical_erected_at'),
        address: formValue(formData, 'address'),
        municipality: formValue(formData, 'municipality'),
        status: formValue(formData, 'status') || 'under_review',
        visibility: formValue(formData, 'visibility') || 'internal',
      })
      form.reset()
      setNotice('Institución u obra guardada y auditada correctamente.')
      await loadData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la institución.')
    } finally {
      setSaving(false)
    }
  }

  async function handleChannelSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      await saveCommunicationChannel(supabase, {
        channelTypeKey: formValue(formData, 'channel_type_key'),
        ownerKind: channelOwnerKind,
        ownerId: channelOwnerId,
        label: formValue(formData, 'label'),
        value: formValue(formData, 'value'),
        isPrimary: formData.get('is_primary') === 'on',
        visibility: formValue(formData, 'visibility') || 'public',
      })
      form.reset()
      setNotice('Canal de comunicación guardado y auditado correctamente.')
      await loadData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el canal.')
    } finally {
      setSaving(false)
    }
  }

  function clearFilters() {
    setSearchInput('')
    setAppliedSearch('')
    setTypeKey('')
    setStatus('')
    setVisibility('')
  }

  if (navigation.loading) {
    return <PageState compact kind="loading" title="Preparando el registro eclesial" description="Estamos resolviendo permisos, país y ámbito activo." />
  }

  if (!navigation.context || navigation.context.accessState !== 'ready') {
    return <PageState kind="error" title="Registro eclesial no disponible" description="Necesitas un acceso administrativo activo para consultar lugares, instituciones y medios." />
  }

  if (availableTabs.length === 0) {
    return <PageState kind="error" title="Sin permisos para el registro eclesial" description="Tu rol no incluye consulta de lugares, instituciones ni canales de comunicación." />
  }

  return (
    <main className="container admin-dashboard">
      <PageHeader
        breadcrumbs={[
          { label: 'Administración', href: '/admin' },
          { label: 'Registro eclesial' },
        ]}
        eyebrow="Directorio ampliado"
        title="Lugares, instituciones y medios"
        description="Gestiona edificios físicos, obras asociadas y canales de comunicación sin confundirlos con la entidad territorial o canónica a la que pertenecen."
        metadata={(
          <>
            <StatusBadge tone="info" dot>{activeScope?.label ?? 'Ámbito resuelto automáticamente'}</StatusBadge>
            <StatusBadge tone="neutral">{places.length} lugares</StatusBadge>
            <StatusBadge tone="neutral">{institutions.length} instituciones</StatusBadge>
            <StatusBadge tone="neutral">{channels.length} canales</StatusBadge>
          </>
        )}
      />

      <section className="card admin-section" aria-labelledby="registry-principle-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Modelo canónico</p>
            <h2 id="registry-principle-heading">Territorio, edificio, obra y canal son registros distintos</h2>
            <p className="meta">
              Una parroquia continúa siendo una entidad territorial; su iglesia parroquial es un lugar físico. Una emisora es una institución;
              su frecuencia, sitio web y redes son canales asociados. Las relaciones pueden conservar propiedad, administración, sede y atención pastoral.
            </p>
          </div>
          <StatusBadge tone="success">Ámbito por país activo</StatusBadge>
        </div>
      </section>

      <section className="card admin-section" aria-label="Secciones del registro eclesial">
        <div className="button-row">
          {availableTabs.map((item) => (
            <Button
              aria-pressed={tab === item.key}
              key={item.key}
              onClick={() => setTab(item.key)}
              type="button"
              variant={tab === item.key ? 'default' : 'secondary'}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <p className="meta">{registryTabs.find((item) => item.key === tab)?.description}</p>
      </section>

      {error ? <PageState kind="error" title="No se pudo completar la operación" description={error} /> : null}
      {notice ? <Alert tone="success" title="Operación completada">{notice}</Alert> : null}

      {tab === 'places' && canCreatePlaces ? (
        <section className="card admin-section" aria-labelledby="new-place-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Nuevo lugar físico</p>
              <h2 id="new-place-heading">Registrar templo, iglesia, santuario o capilla</h2>
              <p className="meta">La entidad principal define el país y la jurisdicción. Dedicación y consagración se guardan como hechos distintos.</p>
            </div>
            <StatusBadge tone={canPublishPlaces ? 'success' : 'warning'}>{canPublishPlaces ? 'Puede publicar' : 'Guarda en revisión'}</StatusBadge>
          </div>
          <form className="form-grid" onSubmit={handlePlaceSubmit}>
            <label>
              Tipo de lugar
              <select
                name="place_type_key"
                onChange={(event) => setSelectedPlaceType(event.target.value)}
                required
                value={selectedPlaceType}
              >
                {placeTypes.map((option) => <option key={option.key} value={option.key}>{option.name}</option>)}
              </select>
            </label>
            <label>
              Entidad principal
              <select name="primary_entity_id" required>
                {placeEntityOptions.length === 0 ? <option value="">No hay entidades disponibles</option> : null}
                {placeEntityOptions.map((option) => (
                  <option key={option.owner_id} value={option.owner_id}>{option.label} · {option.country_iso2}</option>
                ))}
              </select>
            </label>
            <label>
              Nombre
              <input maxLength={180} name="name" required />
            </label>
            <label>
              Nombre oficial
              <input maxLength={220} name="official_name" />
            </label>
            <label>
              Advocación o título
              <input maxLength={180} name="dedication_title" />
            </label>
            <label>
              Patrono
              <input maxLength={180} name="patron_name" />
            </label>
            <label>
              Fecha de dedicación
              <input disabled={!selectedPlaceTypeOption?.allows_dedication} name="dedicated_at" type="date" />
            </label>
            <label>
              Fecha de consagración
              <input disabled={!selectedPlaceTypeOption?.allows_consecration} name="consecrated_at" type="date" />
            </label>
            <label>
              Municipio
              <input maxLength={120} name="municipality" />
            </label>
            <label>
              Dirección
              <input maxLength={300} name="address" />
            </label>
            <label>
              Estado
              <select defaultValue={canPublishPlaces ? 'active' : 'under_review'} name="status">
                <option value="under_review">En revisión</option>
                {canPublishPlaces ? <option value="active">Activo</option> : null}
              </select>
            </label>
            <label>
              Visibilidad
              <select defaultValue={canPublishPlaces ? 'public' : 'internal'} name="visibility">
                <option value="internal">Interna</option>
                {canPublishPlaces ? <option value="public">Pública</option> : null}
              </select>
            </label>
            <label className="full-width">
              Descripción
              <textarea maxLength={2000} name="description" rows={3} />
            </label>
            <label className="full-width">
              <input name="is_primary_seat" type="checkbox" /> Es sede principal de la entidad seleccionada
            </label>
            <div className="button-row full-width">
              <Button disabled={saving || placeEntityOptions.length === 0 || !selectedPlaceType} type="submit">
                {saving ? 'Guardando...' : 'Guardar lugar'}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {tab === 'institutions' && canCreateInstitutions ? (
        <section className="card admin-section" aria-labelledby="new-institution-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Nueva institución u obra</p>
              <h2 id="new-institution-heading">Registrar escuela, seminario, monasterio, dispensario o medio</h2>
              <p className="meta">La categoría describe la obra; la entidad principal y las afiliaciones posteriores describen pertenencia y administración.</p>
            </div>
            <StatusBadge tone={canPublishInstitutions ? 'success' : 'warning'}>{canPublishInstitutions ? 'Puede publicar' : 'Guarda en revisión'}</StatusBadge>
          </div>
          <form className="form-grid" onSubmit={handleInstitutionSubmit}>
            <label>
              Categoría
              <select name="category_key" required>
                {institutionCategories.map((option) => (
                  <option key={option.key} value={option.key}>{option.name} · {readableValue(option.domain)}</option>
                ))}
              </select>
            </label>
            <label>
              Entidad principal
              <select name="primary_entity_id" required>
                {institutionEntityOptions.length === 0 ? <option value="">No hay entidades disponibles</option> : null}
                {institutionEntityOptions.map((option) => (
                  <option key={option.owner_id} value={option.owner_id}>{option.label} · {option.country_iso2}</option>
                ))}
              </select>
            </label>
            <label>
              Nombre
              <input maxLength={180} name="name" required />
            </label>
            <label>
              Nombre oficial
              <input maxLength={220} name="official_name" />
            </label>
            <label>
              Fecha de fundación
              <input name="founded_at" type="date" />
            </label>
            <label>
              Erección canónica
              <input name="canonical_erected_at" type="date" />
            </label>
            <label>
              Municipio
              <input maxLength={120} name="municipality" />
            </label>
            <label>
              Dirección
              <input maxLength={300} name="address" />
            </label>
            <label>
              Estado
              <select defaultValue={canPublishInstitutions ? 'active' : 'under_review'} name="status">
                <option value="under_review">En revisión</option>
                {canPublishInstitutions ? <option value="active">Activo</option> : null}
              </select>
            </label>
            <label>
              Visibilidad
              <select defaultValue={canPublishInstitutions ? 'public' : 'internal'} name="visibility">
                <option value="internal">Interna</option>
                {canPublishInstitutions ? <option value="public">Pública</option> : null}
              </select>
            </label>
            <label className="full-width">
              Descripción
              <textarea maxLength={2000} name="description" rows={3} />
            </label>
            <div className="button-row full-width">
              <Button disabled={saving || institutionEntityOptions.length === 0 || institutionCategories.length === 0} type="submit">
                {saving ? 'Guardando...' : 'Guardar institución'}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {tab === 'channels' && canManageChannels ? (
        <section className="card admin-section" aria-labelledby="new-channel-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Nuevo canal</p>
              <h2 id="new-channel-heading">Agregar contacto, red, frecuencia o publicación</h2>
              <p className="meta">El canal puede pertenecer a una entidad, unidad, lugar físico o institución. El país se deriva automáticamente.</p>
            </div>
          </div>
          <form className="form-grid" onSubmit={handleChannelSubmit}>
            <label>
              Propietario
              <select
                onChange={(event) => setChannelOwnerKind(event.target.value as RegistryOwnerKind)}
                value={channelOwnerKind}
              >
                {(['entity', 'organization_unit', 'place', 'institution'] as RegistryOwnerKind[]).map((kind) => (
                  <option key={kind} value={kind}>{ownerKindLabel(kind)}</option>
                ))}
              </select>
            </label>
            <label>
              Registro propietario
              <select
                onChange={(event) => setChannelOwnerId(event.target.value)}
                required
                value={channelOwnerId}
              >
                {channelOwnerOptions.length === 0 ? <option value="">No hay propietarios disponibles</option> : null}
                {channelOwnerOptions.map((option) => (
                  <option key={option.owner_id} value={option.owner_id}>{option.label} · {option.country_iso2}</option>
                ))}
              </select>
            </label>
            <label>
              Tipo de canal
              <select name="channel_type_key" required>
                {channelTypes.map((option) => <option key={option.key} value={option.key}>{option.name}</option>)}
              </select>
            </label>
            <label>
              Etiqueta
              <input maxLength={120} name="label" placeholder="Principal, oficina, transmisión en vivo..." />
            </label>
            <label className="full-width">
              Valor
              <input maxLength={500} name="value" placeholder="URL, correo, teléfono, frecuencia o referencia" required />
            </label>
            <label>
              Visibilidad
              <select defaultValue="public" name="visibility">
                <option value="public">Pública</option>
                <option value="internal">Interna</option>
              </select>
            </label>
            <label>
              <input name="is_primary" type="checkbox" /> Canal principal de este tipo
            </label>
            <div className="button-row full-width">
              <Button disabled={saving || !channelOwnerId || channelTypes.length === 0} type="submit">
                {saving ? 'Guardando...' : 'Guardar canal'}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="card admin-section" aria-labelledby="registry-filter-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Filtros</p>
            <h2 id="registry-filter-heading">Buscar dentro del ámbito activo</h2>
          </div>
        </div>
        <form className="form-grid" onSubmit={handleSearch}>
          <label className="full-width">
            Buscar
            <input
              maxLength={120}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Nombre, dirección, propietario, categoría o canal"
              type="search"
              value={searchInput}
            />
          </label>
          <label>
            Tipo o categoría
            <select onChange={(event) => setTypeKey(event.target.value)} value={typeKey}>
              <option value="">Todos</option>
              {currentTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Estado
            <select onChange={(event) => setStatus(event.target.value)} value={status}>
              {statusOptions.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Visibilidad
            <select onChange={(event) => setVisibility(event.target.value)} value={visibility}>
              {visibilityOptions.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <div className="button-row full-width">
            <Button type="submit">Aplicar filtros</Button>
            <Button onClick={clearFilters} type="button" variant="secondary">Limpiar</Button>
          </div>
        </form>
      </section>

      {loading ? (
        <PageState compact kind="loading" title="Cargando registro eclesial" description="Consultando lugares, instituciones y canales dentro del ámbito activo." />
      ) : tab === 'places' ? (
        places.length === 0 ? (
          <PageState kind="empty" title="Sin lugares visibles" description="No hay lugares eclesiásticos que coincidan con el ámbito y los filtros seleccionados." />
        ) : (
          <DataTable caption="Lugares eclesiásticos visibles">
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Lugar</DataTableHead>
                <DataTableHead>Entidad principal</DataTableHead>
                <DataTableHead>Historia litúrgica</DataTableHead>
                <DataTableHead>Estado</DataTableHead>
                <DataTableHead>Relaciones</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {places.map((row) => (
                <DataTableRow key={row.id}>
                  <DataTableCell>
                    <div className="flex min-w-64 flex-col gap-1">
                      <strong>{row.name}</strong>
                      <span className="text-[var(--text-muted)]">{row.place_type_name} · {row.country_iso2}</span>
                      {row.address ? <span className="text-[var(--text-muted)]">{row.address}</span> : null}
                    </div>
                  </DataTableCell>
                  <DataTableCell>{row.primary_entity_name}{row.is_primary_seat ? ' · Sede principal' : ''}</DataTableCell>
                  <DataTableCell>
                    <div className="flex min-w-48 flex-col gap-1">
                      <span>Dedicación: {formatDate(row.dedicated_at)}</span>
                      <span>Consagración: {formatDate(row.consecrated_at)}</span>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-col gap-2">
                      <StatusBadge tone={statusTone(row.status)}>{readableValue(row.status)}</StatusBadge>
                      <StatusBadge tone={visibilityTone(row.visibility)}>{readableValue(row.visibility)}</StatusBadge>
                    </div>
                  </DataTableCell>
                  <DataTableCell>{row.affiliation_count} afiliaciones · {row.channel_count} canales</DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )
      ) : tab === 'institutions' ? (
        institutions.length === 0 ? (
          <PageState kind="empty" title="Sin instituciones visibles" description="No hay obras o instituciones que coincidan con el ámbito y los filtros seleccionados." />
        ) : (
          <DataTable caption="Instituciones y obras eclesiales visibles">
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Institución</DataTableHead>
                <DataTableHead>Categoría</DataTableHead>
                <DataTableHead>Entidad principal</DataTableHead>
                <DataTableHead>Fechas</DataTableHead>
                <DataTableHead>Estado</DataTableHead>
                <DataTableHead>Relaciones</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {institutions.map((row) => (
                <DataTableRow key={row.id}>
                  <DataTableCell>
                    <div className="flex min-w-64 flex-col gap-1">
                      <strong>{row.name}</strong>
                      <span className="text-[var(--text-muted)]">{row.country_iso2}{row.address ? ` · ${row.address}` : ''}</span>
                    </div>
                  </DataTableCell>
                  <DataTableCell>{row.category_name}<br /><span className="text-[var(--text-muted)]">{readableValue(row.domain)}</span></DataTableCell>
                  <DataTableCell>{row.primary_entity_name}</DataTableCell>
                  <DataTableCell>
                    <div className="flex min-w-44 flex-col gap-1">
                      <span>Fundación: {formatDate(row.founded_at)}</span>
                      <span>Erección: {formatDate(row.canonical_erected_at)}</span>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-col gap-2">
                      <StatusBadge tone={statusTone(row.status)}>{readableValue(row.status)}</StatusBadge>
                      <StatusBadge tone={visibilityTone(row.visibility)}>{readableValue(row.visibility)}</StatusBadge>
                    </div>
                  </DataTableCell>
                  <DataTableCell>{row.affiliation_count} afiliaciones · {row.channel_count} canales</DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )
      ) : channels.length === 0 ? (
        <PageState kind="empty" title="Sin canales visibles" description="No hay canales de comunicación que coincidan con el ámbito y los filtros seleccionados." />
      ) : (
        <DataTable caption="Canales de comunicación visibles">
          <DataTableHeader>
            <DataTableRow>
              <DataTableHead>Propietario</DataTableHead>
              <DataTableHead>Canal</DataTableHead>
              <DataTableHead>Valor</DataTableHead>
              <DataTableHead>País</DataTableHead>
              <DataTableHead>Estado</DataTableHead>
            </DataTableRow>
          </DataTableHeader>
          <DataTableBody>
            {channels.map((row) => (
              <DataTableRow key={row.id}>
                <DataTableCell>
                  <strong>{row.owner_name}</strong><br />
                  <span className="text-[var(--text-muted)]">{ownerKindLabel(row.owner_kind)}</span>
                </DataTableCell>
                <DataTableCell>{row.channel_type_name}{row.is_primary ? ' · Principal' : ''}</DataTableCell>
                <DataTableCell>
                  {row.value.startsWith('http://') || row.value.startsWith('https://') ? (
                    <a href={row.value} rel="noopener noreferrer" target="_blank">{row.label || row.value}</a>
                  ) : row.label ? `${row.label}: ${row.value}` : row.value}
                </DataTableCell>
                <DataTableCell>{row.country_iso2}</DataTableCell>
                <DataTableCell>
                  <div className="flex flex-col gap-2">
                    <StatusBadge tone={statusTone(row.status)}>{readableValue(row.status)}</StatusBadge>
                    <StatusBadge tone={visibilityTone(row.visibility)}>{readableValue(row.visibility)}</StatusBadge>
                  </div>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}
    </main>
  )
}
