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
  type ChannelTypeOption,
  type CommunicationChannelRow,
  type EcclesialInstitutionRow,
  type EcclesiasticalPlaceRow,
  type InstitutionCategoryOption,
  type PlaceTypeOption,
  type RegistryOwnerKind,
  type RegistryOwnerOption,
} from '../services/ecclesial-registry-admin-service'
import {
  closeEcclesialInstitutionAffiliation,
  closeEcclesiasticalPlaceAffiliation,
  loadEcclesialInstitutionAffiliations,
  loadEcclesialInstitutionDetail,
  loadEcclesiasticalPlaceAffiliations,
  loadEcclesiasticalPlaceDetail,
  saveEcclesialInstitutionAffiliation,
  saveEcclesiasticalPlaceAffiliation,
  updateCommunicationChannel,
  updateEcclesialInstitution,
  updateEcclesiasticalPlace,
  type EcclesialInstitutionDetail,
  type EcclesiasticalPlaceDetail,
  type RegistryAffiliationRow,
  type RegistryAffiliationTargetKind,
} from '../services/ecclesial-registry-history-service'

type RegistryRecordKind = 'place' | 'institution' | 'channel'

const recordKinds: Array<{ key: RegistryRecordKind; label: string; description: string }> = [
  { key: 'place', label: 'Lugares', description: 'Templos, iglesias, santuarios y capillas' },
  { key: 'institution', label: 'Instituciones', description: 'Escuelas, obras, seminarios, salud y medios' },
  { key: 'channel', label: 'Canales', description: 'Teléfonos, web, redes, radio y publicaciones' },
]

const placeRelationshipOptions = [
  { value: 'owned_by', label: 'Propiedad de' },
  { value: 'administered_by', label: 'Administrado por' },
  { value: 'pastorally_served_by', label: 'Atendido pastoralmente por' },
  { value: 'used_by', label: 'Utilizado por' },
  { value: 'located_within', label: 'Ubicado dentro de' },
]

const institutionRelationshipOptions = [
  { value: 'owned_by', label: 'Propiedad de' },
  { value: 'administered_by', label: 'Administrado por' },
  { value: 'pastorally_attached_to', label: 'Adscrito pastoralmente a' },
  { value: 'sponsored_by', label: 'Patrocinado por' },
  { value: 'operated_by', label: 'Operado por' },
  { value: 'part_of', label: 'Forma parte de' },
  { value: 'located_within', label: 'Ubicado dentro de' },
]

const affiliationTargetKinds: Array<{ value: RegistryAffiliationTargetKind; label: string }> = [
  { value: 'entity', label: 'Entidad eclesial' },
  { value: 'organization_unit', label: 'Unidad organizativa' },
  { value: 'institution', label: 'Institución u obra' },
]

function formValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function readableValue(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function statusTone(value: string): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
  if (value === 'active') return 'success'
  if (value === 'under_review') return 'warning'
  if (value === 'closed' || value === 'archived') return 'danger'
  if (value === 'inactive') return 'neutral'
  return 'info'
}

function visibilityTone(value: string): 'neutral' | 'info' | 'warning' | 'danger' {
  if (value === 'public') return 'info'
  if (value === 'internal') return 'warning'
  if (value === 'private' || value === 'confidential') return 'danger'
  return 'neutral'
}

function ownerKindLabel(value: RegistryOwnerKind | RegistryAffiliationTargetKind) {
  if (value === 'entity') return 'Entidad eclesial'
  if (value === 'organization_unit') return 'Unidad organizativa'
  if (value === 'place') return 'Lugar físico'
  return 'Institución u obra'
}

function recordLabel(
  kind: RegistryRecordKind,
  row: EcclesiasticalPlaceRow | EcclesialInstitutionRow | CommunicationChannelRow,
) {
  if (kind === 'place') {
    const place = row as EcclesiasticalPlaceRow
    return `${place.name} · ${place.place_type_name} · ${place.country_iso2}`
  }
  if (kind === 'institution') {
    const institution = row as EcclesialInstitutionRow
    return `${institution.name} · ${institution.category_name} · ${institution.country_iso2}`
  }
  const channel = row as CommunicationChannelRow
  return `${channel.owner_name} · ${channel.channel_type_name} · ${channel.value}`
}

function editableStatus(current: string, canPublish: boolean) {
  if (canPublish) return current
  return current === 'active' ? 'under_review' : current
}

function editableVisibility(current: string, canPublish: boolean) {
  if (canPublish) return current
  return current === 'public' ? 'internal' : current
}

export default function EcclesialRegistryHistoryPage() {
  const supabase = useMemo(() => createClient(), [])
  const navigation = useAdminNavigation()
  const permissionKeys = useMemo(
    () => new Set(navigation.context?.permissionKeys ?? []),
    [navigation.context?.permissionKeys],
  )

  const canViewPlaces = permissionKeys.has('places.view')
  const canViewInstitutions = permissionKeys.has('institutions.view')
  const canViewChannels = permissionKeys.has('communications.view')
  const canEditPlaces = permissionKeys.has('places.update_proposal')
  const canEditInstitutions = permissionKeys.has('institutions.update_proposal')
  const canEditChannels = permissionKeys.has('communications.update_proposal')
  const canPublishPlaces = permissionKeys.has('places.publish')
  const canPublishInstitutions = permissionKeys.has('institutions.publish')

  const [kind, setKind] = useState<RegistryRecordKind>('place')
  const [places, setPlaces] = useState<EcclesiasticalPlaceRow[]>([])
  const [institutions, setInstitutions] = useState<EcclesialInstitutionRow[]>([])
  const [channels, setChannels] = useState<CommunicationChannelRow[]>([])
  const [placeTypes, setPlaceTypes] = useState<PlaceTypeOption[]>([])
  const [institutionCategories, setInstitutionCategories] = useState<InstitutionCategoryOption[]>([])
  const [channelTypes, setChannelTypes] = useState<ChannelTypeOption[]>([])
  const [ownerOptions, setOwnerOptions] = useState<RegistryOwnerOption[]>([])
  const [recordSearch, setRecordSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [placeDetail, setPlaceDetail] = useState<EcclesiasticalPlaceDetail | null>(null)
  const [institutionDetail, setInstitutionDetail] = useState<EcclesialInstitutionDetail | null>(null)
  const [affiliations, setAffiliations] = useState<RegistryAffiliationRow[]>([])
  const [affiliationTargetKind, setAffiliationTargetKind] = useState<RegistryAffiliationTargetKind>('entity')
  const [affiliationTargetId, setAffiliationTargetId] = useState('')
  const [channelOwnerKind, setChannelOwnerKind] = useState<RegistryOwnerKind>('entity')
  const [channelOwnerId, setChannelOwnerId] = useState('')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const activeScope = navigation.context?.activeScope ?? null
  const scope = useMemo(() => ({
    type: activeScope?.type ?? null,
    id: activeScope?.entityId ?? null,
  }), [activeScope?.entityId, activeScope?.type])

  const availableKinds = useMemo(
    () => recordKinds.filter((item) => (
      (item.key === 'place' && canViewPlaces)
      || (item.key === 'institution' && canViewInstitutions)
      || (item.key === 'channel' && canViewChannels)
    )),
    [canViewChannels, canViewInstitutions, canViewPlaces],
  )

  const selectedChannel = useMemo(
    () => channels.find((row) => row.id === selectedId) ?? null,
    [channels, selectedId],
  )

  const records = useMemo(() => {
    const source = kind === 'place' ? places : kind === 'institution' ? institutions : channels
    const normalizedSearch = recordSearch.trim().toLocaleLowerCase('es')
    if (!normalizedSearch) return source
    return source.filter((row) => recordLabel(kind, row).toLocaleLowerCase('es').includes(normalizedSearch))
  }, [channels, institutions, kind, places, recordSearch])

  const primaryEntityOptions = useMemo(
    () => ownerOptions.filter((option) => (
      option.owner_kind === 'entity'
      && (kind === 'place' ? option.allowed_for_places : option.allowed_for_institutions)
    )),
    [kind, ownerOptions],
  )

  const managingUnitOptions = useMemo(
    () => ownerOptions.filter((option) => (
      option.owner_kind === 'organization_unit'
      && (kind === 'place' ? option.allowed_for_places : option.allowed_for_institutions)
    )),
    [kind, ownerOptions],
  )

  const affiliationTargetOptions = useMemo(
    () => ownerOptions.filter((option) => {
      if (option.owner_kind !== affiliationTargetKind) return false
      if (kind === 'place' && !option.allowed_for_places) return false
      if (kind === 'institution' && !option.allowed_for_institutions) return false
      if (kind === 'institution' && option.owner_kind === 'institution' && option.owner_id === selectedId) return false
      return true
    }),
    [affiliationTargetKind, kind, ownerOptions, selectedId],
  )

  const channelOwnerOptions = useMemo(
    () => ownerOptions.filter((option) => (
      option.owner_kind === channelOwnerKind && option.allowed_for_communications
    )),
    [channelOwnerKind, ownerOptions],
  )

  const selectedPlaceType = useMemo(
    () => placeTypes.find((option) => option.key === placeDetail?.place_type_key) ?? null,
    [placeDetail?.place_type_key, placeTypes],
  )

  const loadRegistry = useCallback(async () => {
    if (!navigation.context || navigation.context.accessState !== 'ready') return
    setLoading(true)
    setError(null)

    try {
      const [catalogs, owners, placeRows, institutionRows, channelRows] = await Promise.all([
        loadRegistryCatalogs(supabase),
        loadRegistryOwnerOptions(supabase, scope),
        canViewPlaces
          ? loadEcclesiasticalPlaces(supabase, scope, { limit: 2000 })
          : Promise.resolve([]),
        canViewInstitutions
          ? loadEcclesialInstitutions(supabase, scope, { limit: 2000 })
          : Promise.resolve([]),
        canViewChannels
          ? loadCommunicationChannels(supabase, scope, { limit: 3000 })
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
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el registro editable.')
      setPlaces([])
      setInstitutions([])
      setChannels([])
    } finally {
      setLoading(false)
    }
  }, [canViewChannels, canViewInstitutions, canViewPlaces, navigation.context, scope, supabase])

  const loadSelection = useCallback(async () => {
    if (!selectedId) {
      setPlaceDetail(null)
      setInstitutionDetail(null)
      setAffiliations([])
      return
    }

    setDetailLoading(true)
    setError(null)
    try {
      if (kind === 'place') {
        const [detail, rows] = await Promise.all([
          loadEcclesiasticalPlaceDetail(supabase, selectedId),
          loadEcclesiasticalPlaceAffiliations(supabase, selectedId, true),
        ])
        setPlaceDetail(detail)
        setInstitutionDetail(null)
        setAffiliations(rows)
      } else if (kind === 'institution') {
        const [detail, rows] = await Promise.all([
          loadEcclesialInstitutionDetail(supabase, selectedId),
          loadEcclesialInstitutionAffiliations(supabase, selectedId, true),
        ])
        setInstitutionDetail(detail)
        setPlaceDetail(null)
        setAffiliations(rows)
      } else {
        setPlaceDetail(null)
        setInstitutionDetail(null)
        setAffiliations([])
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la ficha seleccionada.')
      setPlaceDetail(null)
      setInstitutionDetail(null)
      setAffiliations([])
    } finally {
      setDetailLoading(false)
    }
  }, [kind, selectedId, supabase])

  useEffect(() => {
    if (navigation.loading) return
    void loadRegistry()
  }, [loadRegistry, navigation.loading])

  useEffect(() => {
    if (availableKinds.some((item) => item.key === kind)) return
    if (availableKinds[0]) setKind(availableKinds[0].key)
  }, [availableKinds, kind])

  useEffect(() => {
    const source = kind === 'place' ? places : kind === 'institution' ? institutions : channels
    setSelectedId((current) => (
      current && source.some((row) => row.id === current) ? current : source[0]?.id ?? ''
    ))
    setRecordSearch('')
    setNotice(null)
    setError(null)
  }, [channels, institutions, kind, places])

  useEffect(() => {
    void loadSelection()
  }, [loadSelection])

  useEffect(() => {
    setAffiliationTargetId((current) => (
      current && affiliationTargetOptions.some((option) => option.owner_id === current)
        ? current
        : affiliationTargetOptions[0]?.owner_id ?? ''
    ))
  }, [affiliationTargetOptions])

  useEffect(() => {
    if (!selectedChannel) return
    setChannelOwnerKind(selectedChannel.owner_kind)
    setChannelOwnerId(selectedChannel.owner_id)
  }, [selectedChannel])

  useEffect(() => {
    setChannelOwnerId((current) => (
      current && channelOwnerOptions.some((option) => option.owner_id === current)
        ? current
        : channelOwnerOptions[0]?.owner_id ?? ''
    ))
  }, [channelOwnerOptions])

  async function refreshAfterMutation(message: string) {
    setNotice(message)
    await loadRegistry()
    await loadSelection()
  }

  async function handlePlaceUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!placeDetail) return
    const formData = new FormData(event.currentTarget)
    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      await updateEcclesiasticalPlace(supabase, {
        id: placeDetail.id,
        placeTypeKey: formValue(formData, 'place_type_key'),
        primaryEntityId: formValue(formData, 'primary_entity_id'),
        managingOrganizationUnitId: formValue(formData, 'managing_organization_unit_id'),
        name: formValue(formData, 'name'),
        officialName: formValue(formData, 'official_name'),
        description: formValue(formData, 'description'),
        dedicationTitle: formValue(formData, 'dedication_title'),
        patronName: formValue(formData, 'patron_name'),
        openedAt: formValue(formData, 'opened_at'),
        blessedAt: formValue(formData, 'blessed_at'),
        dedicatedAt: formValue(formData, 'dedicated_at'),
        consecratedAt: formValue(formData, 'consecrated_at'),
        closedAt: formValue(formData, 'closed_at'),
        capacity: formValue(formData, 'capacity'),
        province: formValue(formData, 'province'),
        municipality: formValue(formData, 'municipality'),
        sector: formValue(formData, 'sector'),
        address: formValue(formData, 'address'),
        latitude: formValue(formData, 'latitude'),
        longitude: formValue(formData, 'longitude'),
        sourceName: formValue(formData, 'source_name'),
        sourceUrl: formValue(formData, 'source_url'),
        sourceCheckedAt: formValue(formData, 'source_checked_at'),
        status: formValue(formData, 'status'),
        visibility: formValue(formData, 'visibility'),
        isPrimarySeat: formData.get('is_primary_seat') === 'on',
      })
      await refreshAfterMutation('Lugar actualizado. Cualquier cambio de entidad principal quedó registrado como transición histórica.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo actualizar el lugar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleInstitutionUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!institutionDetail) return
    const formData = new FormData(event.currentTarget)
    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      await updateEcclesialInstitution(supabase, {
        id: institutionDetail.id,
        categoryKey: formValue(formData, 'category_key'),
        primaryEntityId: formValue(formData, 'primary_entity_id'),
        managingOrganizationUnitId: formValue(formData, 'managing_organization_unit_id'),
        name: formValue(formData, 'name'),
        officialName: formValue(formData, 'official_name'),
        description: formValue(formData, 'description'),
        civilLegalName: formValue(formData, 'civil_legal_name'),
        civilRegistrationNumber: formValue(formData, 'civil_registration_number'),
        foundedAt: formValue(formData, 'founded_at'),
        canonicalErectedAt: formValue(formData, 'canonical_erected_at'),
        civilRegisteredAt: formValue(formData, 'civil_registered_at'),
        closedAt: formValue(formData, 'closed_at'),
        province: formValue(formData, 'province'),
        municipality: formValue(formData, 'municipality'),
        sector: formValue(formData, 'sector'),
        address: formValue(formData, 'address'),
        latitude: formValue(formData, 'latitude'),
        longitude: formValue(formData, 'longitude'),
        sourceName: formValue(formData, 'source_name'),
        sourceUrl: formValue(formData, 'source_url'),
        sourceCheckedAt: formValue(formData, 'source_checked_at'),
        status: formValue(formData, 'status'),
        visibility: formValue(formData, 'visibility'),
      })
      await refreshAfterMutation('Institución actualizada. El cambio de entidad principal preservó la afiliación anterior.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo actualizar la institución.')
    } finally {
      setSaving(false)
    }
  }

  async function handleChannelUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedChannel) return
    const formData = new FormData(event.currentTarget)
    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      await updateCommunicationChannel(supabase, {
        id: selectedChannel.id,
        channelTypeKey: formValue(formData, 'channel_type_key'),
        ownerKind: channelOwnerKind,
        ownerId: channelOwnerId,
        label: formValue(formData, 'label'),
        value: formValue(formData, 'value'),
        isPrimary: formData.get('is_primary') === 'on',
        verifiedAt: formValue(formData, 'verified_at'),
        status: formValue(formData, 'status'),
        visibility: formValue(formData, 'visibility'),
      })
      await refreshAfterMutation('Canal de comunicación actualizado y auditado.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo actualizar el canal.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAffiliationCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedId || kind === 'channel') return
    const form = event.currentTarget
    const formData = new FormData(form)
    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      if (kind === 'place') {
        await saveEcclesiasticalPlaceAffiliation(supabase, {
          placeId: selectedId,
          relationshipType: formValue(formData, 'relationship_type'),
          targetKind: affiliationTargetKind,
          targetId: affiliationTargetId,
          validFrom: formValue(formData, 'valid_from'),
          validTo: formValue(formData, 'valid_to'),
          notes: formValue(formData, 'notes'),
        })
      } else {
        await saveEcclesialInstitutionAffiliation(supabase, {
          institutionId: selectedId,
          relationshipType: formValue(formData, 'relationship_type'),
          targetKind: affiliationTargetKind,
          targetId: affiliationTargetId,
          validFrom: formValue(formData, 'valid_from'),
          validTo: formValue(formData, 'valid_to'),
          notes: formValue(formData, 'notes'),
        })
      }
      form.reset()
      await refreshAfterMutation('Relación secundaria agregada al historial del registro.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la relación.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAffiliationClose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const affiliationId = formValue(formData, 'affiliation_id')
    const validTo = formValue(formData, 'valid_to')
    const notes = formValue(formData, 'notes')
    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      if (kind === 'place') {
        await closeEcclesiasticalPlaceAffiliation(supabase, affiliationId, validTo, notes)
      } else if (kind === 'institution') {
        await closeEcclesialInstitutionAffiliation(supabase, affiliationId, validTo, notes)
      }
      await refreshAfterMutation('Relación cerrada; permanece disponible en la línea histórica.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo cerrar la relación.')
    } finally {
      setSaving(false)
    }
  }

  if (navigation.loading) {
    return <PageState compact kind="loading" title="Preparando edición e historial" description="Resolviendo permisos, país y ámbito activo." />
  }

  if (!navigation.context || navigation.context.accessState !== 'ready') {
    return <PageState kind="error" title="Edición no disponible" description="Necesitas un acceso administrativo activo para editar el registro eclesial." />
  }

  if (availableKinds.length === 0) {
    return <PageState kind="error" title="Sin permisos de consulta" description="Tu rol no permite consultar lugares, instituciones ni canales." />
  }

  const relationshipOptions = kind === 'place' ? placeRelationshipOptions : institutionRelationshipOptions
  const canEditSelected = kind === 'place' ? canEditPlaces : kind === 'institution' ? canEditInstitutions : canEditChannels

  return (
    <main className="container admin-dashboard">
      <PageHeader
        breadcrumbs={[
          { label: 'Administración', href: '/admin' },
          { label: 'Registro eclesial', href: '/admin/registro-eclesial' },
          { label: 'Edición e historial' },
        ]}
        eyebrow="Trazabilidad del registro"
        title="Editar fichas y conservar relaciones históricas"
        description="Actualiza lugares, instituciones y canales. Los cambios de entidad principal cierran la afiliación anterior y crean una nueva, sin reescribir el pasado."
        metadata={(
          <>
            <StatusBadge tone="info" dot>{activeScope?.label ?? 'Ámbito resuelto automáticamente'}</StatusBadge>
            <StatusBadge tone="neutral">{places.length} lugares</StatusBadge>
            <StatusBadge tone="neutral">{institutions.length} instituciones</StatusBadge>
            <StatusBadge tone="neutral">{channels.length} canales</StatusBadge>
          </>
        )}
        actions={(
          <Button asChild variant="secondary">
            <a href="/admin/registro-eclesial">Altas y directorio</a>
          </Button>
        )}
      />

      <section className="card admin-section" aria-labelledby="history-rule-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Regla de integridad</p>
            <h2 id="history-rule-heading">La afiliación primaria nunca se elimina desde la tabla de relaciones</h2>
            <p className="meta">
              Para cambiar la pertenencia principal, edita la entidad principal de la ficha. El sistema cerrará automáticamente la relación anterior y conservará sus fechas. Las relaciones de propiedad, administración, uso o atención pastoral se gestionan por separado.
            </p>
          </div>
          <StatusBadge tone="success">Historia protegida</StatusBadge>
        </div>
      </section>

      <section className="card admin-section" aria-label="Tipo de registro editable">
        <div className="button-row">
          {availableKinds.map((item) => (
            <Button
              aria-pressed={kind === item.key}
              key={item.key}
              onClick={() => setKind(item.key)}
              type="button"
              variant={kind === item.key ? 'default' : 'secondary'}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <p className="meta">{recordKinds.find((item) => item.key === kind)?.description}</p>
      </section>

      {error ? <PageState kind="error" title="No se pudo completar la operación" description={error} /> : null}
      {notice ? <Alert tone="success" title="Operación completada">{notice}</Alert> : null}

      <section className="card admin-section" aria-labelledby="registry-record-selector-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Registro seleccionado</p>
            <h2 id="registry-record-selector-heading">Elegir ficha dentro del ámbito activo</h2>
          </div>
          <StatusBadge tone={canEditSelected ? 'success' : 'warning'}>{canEditSelected ? 'Edición permitida' : 'Solo consulta'}</StatusBadge>
        </div>
        <div className="form-grid">
          <label>
            Filtrar opciones
            <input
              maxLength={120}
              onChange={(event) => setRecordSearch(event.target.value)}
              placeholder="Nombre, categoría, tipo o propietario"
              type="search"
              value={recordSearch}
            />
          </label>
          <label>
            Ficha
            <select onChange={(event) => setSelectedId(event.target.value)} value={selectedId}>
              {records.length === 0 ? <option value="">No hay registros disponibles</option> : null}
              {records.map((row) => (
                <option key={row.id} value={row.id}>{recordLabel(kind, row)}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {loading || detailLoading ? (
        <PageState compact kind="loading" title="Cargando ficha e historial" description="Consultando el registro seleccionado y sus relaciones." />
      ) : !selectedId ? (
        <PageState kind="empty" title="Sin fichas disponibles" description="No existen registros visibles para este tipo y ámbito." />
      ) : kind === 'place' && placeDetail ? (
        <section className="card admin-section" aria-labelledby="edit-place-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Ficha física</p>
              <h2 id="edit-place-heading">Editar {placeDetail.name}</h2>
              <p className="meta">Código: {placeDetail.slug} · País: {placeDetail.country_iso2}</p>
            </div>
            <div className="button-row">
              <StatusBadge tone={statusTone(placeDetail.status)}>{readableValue(placeDetail.status)}</StatusBadge>
              <StatusBadge tone={visibilityTone(placeDetail.visibility)}>{readableValue(placeDetail.visibility)}</StatusBadge>
            </div>
          </div>
          <form className="form-grid" key={`${placeDetail.id}-${placeDetail.updated_at}`} onSubmit={handlePlaceUpdate}>
            <label>
              Tipo de lugar
              <select defaultValue={placeDetail.place_type_key} disabled={!canEditPlaces} name="place_type_key" required>
                {placeTypes.map((option) => <option key={option.key} value={option.key}>{option.name}</option>)}
              </select>
            </label>
            <label>
              Entidad principal
              <select defaultValue={placeDetail.primary_entity_id} disabled={!canEditPlaces} name="primary_entity_id" required>
                {primaryEntityOptions.map((option) => <option key={option.owner_id} value={option.owner_id}>{option.label} · {option.country_iso2}</option>)}
              </select>
            </label>
            <label>
              Unidad administradora
              <select defaultValue={placeDetail.managing_organization_unit_id ?? ''} disabled={!canEditPlaces} name="managing_organization_unit_id">
                <option value="">Sin unidad administradora</option>
                {managingUnitOptions.map((option) => <option key={option.owner_id} value={option.owner_id}>{option.label}</option>)}
              </select>
            </label>
            <label>
              Nombre
              <input defaultValue={placeDetail.name} disabled={!canEditPlaces} maxLength={180} name="name" required />
            </label>
            <label>
              Nombre oficial
              <input defaultValue={placeDetail.official_name ?? ''} disabled={!canEditPlaces} maxLength={220} name="official_name" />
            </label>
            <label>
              Advocación o título
              <input defaultValue={placeDetail.dedication_title ?? ''} disabled={!canEditPlaces} maxLength={180} name="dedication_title" />
            </label>
            <label>
              Patrono
              <input defaultValue={placeDetail.patron_name ?? ''} disabled={!canEditPlaces} maxLength={180} name="patron_name" />
            </label>
            <label>
              Apertura
              <input defaultValue={placeDetail.opened_at ?? ''} disabled={!canEditPlaces} name="opened_at" type="date" />
            </label>
            <label>
              Bendición
              <input defaultValue={placeDetail.blessed_at ?? ''} disabled={!canEditPlaces} name="blessed_at" type="date" />
            </label>
            <label>
              Dedicación
              <input defaultValue={placeDetail.dedicated_at ?? ''} disabled={!canEditPlaces || !selectedPlaceType?.allows_dedication} name="dedicated_at" type="date" />
            </label>
            <label>
              Consagración
              <input defaultValue={placeDetail.consecrated_at ?? ''} disabled={!canEditPlaces || !selectedPlaceType?.allows_consecration} name="consecrated_at" type="date" />
            </label>
            <label>
              Cierre
              <input defaultValue={placeDetail.closed_at ?? ''} disabled={!canEditPlaces} name="closed_at" type="date" />
            </label>
            <label>
              Capacidad
              <input defaultValue={placeDetail.capacity ?? ''} disabled={!canEditPlaces} min={0} name="capacity" type="number" />
            </label>
            <label>
              Provincia
              <input defaultValue={placeDetail.province ?? ''} disabled={!canEditPlaces} maxLength={120} name="province" />
            </label>
            <label>
              Municipio
              <input defaultValue={placeDetail.municipality ?? ''} disabled={!canEditPlaces} maxLength={120} name="municipality" />
            </label>
            <label>
              Sector
              <input defaultValue={placeDetail.sector ?? ''} disabled={!canEditPlaces} maxLength={120} name="sector" />
            </label>
            <label className="full-width">
              Dirección
              <input defaultValue={placeDetail.address ?? ''} disabled={!canEditPlaces} maxLength={300} name="address" />
            </label>
            <label>
              Latitud
              <input defaultValue={placeDetail.latitude ?? ''} disabled={!canEditPlaces} name="latitude" step="any" type="number" />
            </label>
            <label>
              Longitud
              <input defaultValue={placeDetail.longitude ?? ''} disabled={!canEditPlaces} name="longitude" step="any" type="number" />
            </label>
            <label>
              Fuente
              <input defaultValue={placeDetail.source_name ?? ''} disabled={!canEditPlaces} maxLength={180} name="source_name" />
            </label>
            <label>
              URL de fuente
              <input defaultValue={placeDetail.source_url ?? ''} disabled={!canEditPlaces} maxLength={500} name="source_url" type="url" />
            </label>
            <label>
              Fuente verificada
              <input defaultValue={placeDetail.source_checked_at ?? ''} disabled={!canEditPlaces} name="source_checked_at" type="date" />
            </label>
            <label>
              Estado
              <select defaultValue={editableStatus(placeDetail.status, canPublishPlaces)} disabled={!canEditPlaces} name="status">
                <option value="under_review">En revisión</option>
                {canPublishPlaces ? <option value="active">Activo</option> : null}
                <option value="inactive">Inactivo</option>
                <option value="closed">Cerrado</option>
                <option value="archived">Archivado</option>
              </select>
            </label>
            <label>
              Visibilidad
              <select defaultValue={editableVisibility(placeDetail.visibility, canPublishPlaces)} disabled={!canEditPlaces} name="visibility">
                <option value="internal">Interna</option>
                {canPublishPlaces ? <option value="public">Pública</option> : null}
                <option value="private">Privada</option>
                <option value="confidential">Confidencial</option>
              </select>
            </label>
            <label className="full-width">
              Descripción
              <textarea defaultValue={placeDetail.description ?? ''} disabled={!canEditPlaces} maxLength={2000} name="description" rows={4} />
            </label>
            <label className="full-width">
              <input defaultChecked={placeDetail.is_primary_seat} disabled={!canEditPlaces} name="is_primary_seat" type="checkbox" /> Es sede principal de la entidad seleccionada
            </label>
            {canEditPlaces ? (
              <div className="button-row full-width">
                <Button disabled={saving} type="submit">{saving ? 'Guardando...' : 'Actualizar lugar'}</Button>
              </div>
            ) : null}
          </form>
        </section>
      ) : kind === 'institution' && institutionDetail ? (
        <section className="card admin-section" aria-labelledby="edit-institution-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Institución u obra</p>
              <h2 id="edit-institution-heading">Editar {institutionDetail.name}</h2>
              <p className="meta">Código: {institutionDetail.slug} · País: {institutionDetail.country_iso2}</p>
            </div>
            <div className="button-row">
              <StatusBadge tone={statusTone(institutionDetail.status)}>{readableValue(institutionDetail.status)}</StatusBadge>
              <StatusBadge tone={visibilityTone(institutionDetail.visibility)}>{readableValue(institutionDetail.visibility)}</StatusBadge>
            </div>
          </div>
          <form className="form-grid" key={`${institutionDetail.id}-${institutionDetail.updated_at}`} onSubmit={handleInstitutionUpdate}>
            <label>
              Categoría
              <select defaultValue={institutionDetail.category_key} disabled={!canEditInstitutions} name="category_key" required>
                {institutionCategories.map((option) => <option key={option.key} value={option.key}>{option.name} · {readableValue(option.domain)}</option>)}
              </select>
            </label>
            <label>
              Entidad principal
              <select defaultValue={institutionDetail.primary_entity_id} disabled={!canEditInstitutions} name="primary_entity_id" required>
                {primaryEntityOptions.map((option) => <option key={option.owner_id} value={option.owner_id}>{option.label} · {option.country_iso2}</option>)}
              </select>
            </label>
            <label>
              Unidad administradora
              <select defaultValue={institutionDetail.managing_organization_unit_id ?? ''} disabled={!canEditInstitutions} name="managing_organization_unit_id">
                <option value="">Sin unidad administradora</option>
                {managingUnitOptions.map((option) => <option key={option.owner_id} value={option.owner_id}>{option.label}</option>)}
              </select>
            </label>
            <label>
              Nombre
              <input defaultValue={institutionDetail.name} disabled={!canEditInstitutions} maxLength={180} name="name" required />
            </label>
            <label>
              Nombre oficial
              <input defaultValue={institutionDetail.official_name ?? ''} disabled={!canEditInstitutions} maxLength={220} name="official_name" />
            </label>
            <label>
              Razón civil
              <input defaultValue={institutionDetail.civil_legal_name ?? ''} disabled={!canEditInstitutions} maxLength={220} name="civil_legal_name" />
            </label>
            <label>
              Registro civil
              <input defaultValue={institutionDetail.civil_registration_number ?? ''} disabled={!canEditInstitutions} maxLength={120} name="civil_registration_number" />
            </label>
            <label>
              Fundación
              <input defaultValue={institutionDetail.founded_at ?? ''} disabled={!canEditInstitutions} name="founded_at" type="date" />
            </label>
            <label>
              Erección canónica
              <input defaultValue={institutionDetail.canonical_erected_at ?? ''} disabled={!canEditInstitutions} name="canonical_erected_at" type="date" />
            </label>
            <label>
              Registro civil
              <input defaultValue={institutionDetail.civil_registered_at ?? ''} disabled={!canEditInstitutions} name="civil_registered_at" type="date" />
            </label>
            <label>
              Cierre
              <input defaultValue={institutionDetail.closed_at ?? ''} disabled={!canEditInstitutions} name="closed_at" type="date" />
            </label>
            <label>
              Provincia
              <input defaultValue={institutionDetail.province ?? ''} disabled={!canEditInstitutions} maxLength={120} name="province" />
            </label>
            <label>
              Municipio
              <input defaultValue={institutionDetail.municipality ?? ''} disabled={!canEditInstitutions} maxLength={120} name="municipality" />
            </label>
            <label>
              Sector
              <input defaultValue={institutionDetail.sector ?? ''} disabled={!canEditInstitutions} maxLength={120} name="sector" />
            </label>
            <label className="full-width">
              Dirección
              <input defaultValue={institutionDetail.address ?? ''} disabled={!canEditInstitutions} maxLength={300} name="address" />
            </label>
            <label>
              Latitud
              <input defaultValue={institutionDetail.latitude ?? ''} disabled={!canEditInstitutions} name="latitude" step="any" type="number" />
            </label>
            <label>
              Longitud
              <input defaultValue={institutionDetail.longitude ?? ''} disabled={!canEditInstitutions} name="longitude" step="any" type="number" />
            </label>
            <label>
              Fuente
              <input defaultValue={institutionDetail.source_name ?? ''} disabled={!canEditInstitutions} maxLength={180} name="source_name" />
            </label>
            <label>
              URL de fuente
              <input defaultValue={institutionDetail.source_url ?? ''} disabled={!canEditInstitutions} maxLength={500} name="source_url" type="url" />
            </label>
            <label>
              Fuente verificada
              <input defaultValue={institutionDetail.source_checked_at ?? ''} disabled={!canEditInstitutions} name="source_checked_at" type="date" />
            </label>
            <label>
              Estado
              <select defaultValue={editableStatus(institutionDetail.status, canPublishInstitutions)} disabled={!canEditInstitutions} name="status">
                <option value="under_review">En revisión</option>
                {canPublishInstitutions ? <option value="active">Activo</option> : null}
                <option value="inactive">Inactivo</option>
                <option value="closed">Cerrado</option>
                <option value="archived">Archivado</option>
              </select>
            </label>
            <label>
              Visibilidad
              <select defaultValue={editableVisibility(institutionDetail.visibility, canPublishInstitutions)} disabled={!canEditInstitutions} name="visibility">
                <option value="internal">Interna</option>
                {canPublishInstitutions ? <option value="public">Pública</option> : null}
                <option value="private">Privada</option>
                <option value="confidential">Confidencial</option>
              </select>
            </label>
            <label className="full-width">
              Descripción
              <textarea defaultValue={institutionDetail.description ?? ''} disabled={!canEditInstitutions} maxLength={2000} name="description" rows={4} />
            </label>
            {canEditInstitutions ? (
              <div className="button-row full-width">
                <Button disabled={saving} type="submit">{saving ? 'Guardando...' : 'Actualizar institución'}</Button>
              </div>
            ) : null}
          </form>
        </section>
      ) : kind === 'channel' && selectedChannel ? (
        <section className="card admin-section" aria-labelledby="edit-channel-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Canal de comunicación</p>
              <h2 id="edit-channel-heading">Editar {selectedChannel.channel_type_name}</h2>
              <p className="meta">Propietario actual: {selectedChannel.owner_name} · {selectedChannel.country_iso2}</p>
            </div>
            <div className="button-row">
              <StatusBadge tone={statusTone(selectedChannel.status)}>{readableValue(selectedChannel.status)}</StatusBadge>
              <StatusBadge tone={visibilityTone(selectedChannel.visibility)}>{readableValue(selectedChannel.visibility)}</StatusBadge>
            </div>
          </div>
          <form className="form-grid" key={`${selectedChannel.id}-${selectedChannel.updated_at}`} onSubmit={handleChannelUpdate}>
            <label>
              Tipo de propietario
              <select disabled={!canEditChannels} onChange={(event) => setChannelOwnerKind(event.target.value as RegistryOwnerKind)} value={channelOwnerKind}>
                {(['entity', 'organization_unit', 'place', 'institution'] as RegistryOwnerKind[]).map((ownerKind) => (
                  <option key={ownerKind} value={ownerKind}>{ownerKindLabel(ownerKind)}</option>
                ))}
              </select>
            </label>
            <label>
              Propietario
              <select disabled={!canEditChannels} onChange={(event) => setChannelOwnerId(event.target.value)} value={channelOwnerId}>
                {channelOwnerOptions.map((option) => <option key={option.owner_id} value={option.owner_id}>{option.label} · {option.country_iso2}</option>)}
              </select>
            </label>
            <label>
              Tipo de canal
              <select defaultValue={selectedChannel.channel_type_key} disabled={!canEditChannels} name="channel_type_key">
                {channelTypes.map((option) => <option key={option.key} value={option.key}>{option.name}</option>)}
              </select>
            </label>
            <label>
              Etiqueta
              <input defaultValue={selectedChannel.label ?? ''} disabled={!canEditChannels} maxLength={120} name="label" />
            </label>
            <label className="full-width">
              Valor
              <input defaultValue={selectedChannel.value} disabled={!canEditChannels} maxLength={500} name="value" required />
            </label>
            <label>
              Verificado el
              <input defaultValue={selectedChannel.verified_at?.slice(0, 10) ?? ''} disabled={!canEditChannels} name="verified_at" type="date" />
            </label>
            <label>
              Estado
              <select defaultValue={selectedChannel.status} disabled={!canEditChannels} name="status">
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
                <option value="archived">Archivado</option>
              </select>
            </label>
            <label>
              Visibilidad
              <select defaultValue={selectedChannel.visibility} disabled={!canEditChannels} name="visibility">
                <option value="public">Pública</option>
                <option value="internal">Interna</option>
                <option value="private">Privada</option>
                <option value="confidential">Confidencial</option>
              </select>
            </label>
            <label>
              <input defaultChecked={selectedChannel.is_primary} disabled={!canEditChannels} name="is_primary" type="checkbox" /> Canal principal de este tipo
            </label>
            {canEditChannels ? (
              <div className="button-row full-width">
                <Button disabled={saving || !channelOwnerId} type="submit">{saving ? 'Guardando...' : 'Actualizar canal'}</Button>
              </div>
            ) : null}
          </form>
        </section>
      ) : null}

      {(kind === 'place' || kind === 'institution') && selectedId ? (
        <>
          {canEditSelected ? (
            <section className="card admin-section" aria-labelledby="new-affiliation-heading">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Relación secundaria</p>
                  <h2 id="new-affiliation-heading">Agregar propiedad, administración, uso o adscripción</h2>
                  <p className="meta">La pertenencia primaria no aparece entre estas opciones; se modifica desde la ficha superior.</p>
                </div>
              </div>
              <form className="form-grid" onSubmit={handleAffiliationCreate}>
                <label>
                  Tipo de relación
                  <select name="relationship_type" required>
                    {relationshipOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label>
                  Tipo de destino
                  <select onChange={(event) => setAffiliationTargetKind(event.target.value as RegistryAffiliationTargetKind)} value={affiliationTargetKind}>
                    {affiliationTargetKinds.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label>
                  Destino
                  <select onChange={(event) => setAffiliationTargetId(event.target.value)} required value={affiliationTargetId}>
                    {affiliationTargetOptions.length === 0 ? <option value="">No hay destinos autorizados</option> : null}
                    {affiliationTargetOptions.map((option) => <option key={option.owner_id} value={option.owner_id}>{option.label} · {option.country_iso2}</option>)}
                  </select>
                </label>
                <label>
                  Vigente desde
                  <input defaultValue={todayIso()} name="valid_from" type="date" />
                </label>
                <label>
                  Vigente hasta
                  <input name="valid_to" type="date" />
                </label>
                <label className="full-width">
                  Notas
                  <textarea maxLength={1000} name="notes" rows={3} />
                </label>
                <div className="button-row full-width">
                  <Button disabled={saving || !affiliationTargetId} type="submit">{saving ? 'Guardando...' : 'Agregar relación'}</Button>
                </div>
              </form>
            </section>
          ) : null}

          <section className="card admin-section" aria-labelledby="affiliation-history-heading">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Línea histórica</p>
                <h2 id="affiliation-history-heading">Relaciones vigentes y anteriores</h2>
                <p className="meta">Las relaciones cerradas permanecen visibles para conservar la evolución institucional y pastoral.</p>
              </div>
              <StatusBadge tone="neutral">{affiliations.length} relaciones</StatusBadge>
            </div>
            {affiliations.length === 0 ? (
              <PageState compact kind="empty" title="Sin relaciones registradas" description="La ficha no contiene afiliaciones visibles." />
            ) : (
              <DataTable caption="Historial de afiliaciones del registro seleccionado">
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHead>Relación</DataTableHead>
                    <DataTableHead>Destino</DataTableHead>
                    <DataTableHead>Vigencia</DataTableHead>
                    <DataTableHead>Estado</DataTableHead>
                    <DataTableHead>Fuente y notas</DataTableHead>
                    <DataTableHead>Acción</DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {affiliations.map((row) => (
                    <DataTableRow key={row.id}>
                      <DataTableCell>
                        <strong>{readableValue(row.relationship_type)}</strong><br />
                        <span className="text-[var(--text-muted)]">{ownerKindLabel(row.target_kind)}</span>
                      </DataTableCell>
                      <DataTableCell>{row.target_name}</DataTableCell>
                      <DataTableCell>
                        <div className="flex min-w-40 flex-col gap-1">
                          <span>Desde: {formatDate(row.valid_from)}</span>
                          <span>Hasta: {formatDate(row.valid_to)}</span>
                        </div>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="flex flex-col gap-2">
                          {row.is_primary_relation ? <StatusBadge tone="institutional">Primaria</StatusBadge> : null}
                          <StatusBadge tone={row.is_current ? 'success' : 'neutral'}>{row.is_current ? 'Vigente' : 'Histórica'}</StatusBadge>
                          <StatusBadge tone={statusTone(row.status)}>{readableValue(row.status)}</StatusBadge>
                        </div>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="flex min-w-48 flex-col gap-1">
                          <span>{row.source_document_title ?? 'Sin documento asociado'}</span>
                          {row.notes ? <span className="text-[var(--text-muted)]">{row.notes}</span> : null}
                        </div>
                      </DataTableCell>
                      <DataTableCell>
                        {row.is_current && !row.is_primary_relation && canEditSelected ? (
                          <form className="flex min-w-52 flex-col gap-2" onSubmit={handleAffiliationClose}>
                            <input name="affiliation_id" type="hidden" value={row.id} />
                            <label>
                              <span className="sr-only">Fecha de cierre</span>
                              <input aria-label={`Fecha de cierre de ${readableValue(row.relationship_type)}`} defaultValue={todayIso()} name="valid_to" required type="date" />
                            </label>
                            <label>
                              <span className="sr-only">Nota de cierre</span>
                              <input aria-label="Nota de cierre" maxLength={1000} name="notes" placeholder="Motivo opcional" />
                            </label>
                            <Button disabled={saving} size="sm" type="submit" variant="outline">Cerrar relación</Button>
                          </form>
                        ) : row.is_primary_relation ? (
                          <span className="text-[var(--text-muted)]">Editar desde la ficha</span>
                        ) : (
                          <span className="text-[var(--text-muted)]">Sin acción</span>
                        )}
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            )}
          </section>
        </>
      ) : null}
    </main>
  )
}
