'use client'

import { useEffect, useMemo, useState } from 'react'
import type { OrganizationUnit, PublicView } from '@/lib/public/dashboard'
import { personTypeLabel, views, type PersonCard, type Props } from './PublicDashboardShared'
import { buildPublicDashboardScope } from './buildPublicDashboardScope'
import { buildPublicDashboardSearch } from './PublicDashboardUrlState'

export function usePublicDashboardModel({
  initialData,
  initialSummary,
  initialView,
  initialCountry,
  initialProvince,
  initialJurisdictionId,
}: Props) {
  const defaultCountry = useMemo(() => (
    initialData.countries.some((item) => item.key === 'DO')
      ? 'DO'
      : initialData.countries[0]?.key ?? 'DO'
  ), [initialData.countries])
  const [activeView, setActiveView] = useState<PublicView>(initialView)
  const [country, setCountry] = useState(initialCountry)
  const [province, setProvince] = useState(initialProvince)
  const [jurisdictionId, setJurisdictionId] = useState(initialJurisdictionId)
  const [personType, setPersonType] = useState('')
  const [pastoralLevel, setPastoralLevel] = useState('')

  useEffect(() => {
    const search = buildPublicDashboardSearch(window.location.search, {
      activeView,
      country,
      defaultCountry,
      province,
      jurisdictionId,
    })
    const nextUrl = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`

    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, '', nextUrl)
    }
  }, [activeView, country, defaultCountry, jurisdictionId, province])

  const scope = useMemo(
    () => buildPublicDashboardScope(initialData, country, province, jurisdictionId),
    [country, initialData, jurisdictionId, province],
  )
  const countryName = useMemo(
    () => initialData.countries.find((row) => row.key === country)?.name ?? 'República Dominicana',
    [country, initialData.countries],
  )
  const countryPeople = useMemo<PersonCard[]>(() => initialData.people.map((item) => ({
    id: item.id,
    name: item.display_name,
    slug: item.slug,
    personType: item.person_type,
    role: personTypeLabel(item.person_type),
    scope: countryName,
  })), [countryName, initialData.people])
  const territoriallyLinkedPeople = useMemo(() => Array.from(new Map(
    [...scope.ordinaryPeople, ...scope.assignmentPeople].map((item) => [item.id, item]),
  ).values()), [scope.assignmentPeople, scope.ordinaryPeople])
  const peopleBase = useMemo(() => (
    scope.scopeFiltered || country !== defaultCountry
      ? territoriallyLinkedPeople
      : countryPeople
  ), [country, countryPeople, defaultCountry, scope.scopeFiltered, territoriallyLinkedPeople])
  const visiblePeople = useMemo(
    () => peopleBase.filter((item) => !personType || item.personType === personType).slice(0, 24),
    [peopleBase, personType],
  )
  const { administrativeUnits, collegialUnits } = useMemo(() => {
    const administrative: OrganizationUnit[] = []
    const collegial: OrganizationUnit[] = []

    for (const item of initialData.organization_units) {
      if (/(consejo|comisi[oó]n|comit[eé]|colegio|equipo)/i.test(item.name)) collegial.push(item)
      else administrative.push(item)
    }

    return { administrativeUnits: administrative, collegialUnits: collegial }
  }, [initialData.organization_units])
  const scopeTitle = scope.selectedJurisdiction?.name
    || province
    || countryName
    || 'Ámbito seleccionado'
  const activeMeta = useMemo(
    () => views.find((item) => item.key === activeView) ?? views[0],
    [activeView],
  )

  function resetScope() {
    setProvince('')
    setJurisdictionId('')
    setPersonType('')
    setPastoralLevel('')
  }

  return {
    initialData,
    initialSummary,
    activeView,
    setActiveView,
    country,
    setCountry,
    province,
    setProvince,
    jurisdictionId,
    setJurisdictionId,
    personType,
    setPersonType,
    pastoralLevel,
    setPastoralLevel,
    ...scope,
    visiblePeople,
    peopleBase,
    administrativeUnits,
    collegialUnits,
    scopeTitle,
    activeMeta,
    resetScope,
  }
}

export type PublicDashboardModel = ReturnType<typeof usePublicDashboardModel>
