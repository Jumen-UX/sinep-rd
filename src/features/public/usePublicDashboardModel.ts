'use client'

import { useEffect, useMemo, useReducer, useState } from 'react'
import type { OrganizationUnit } from '@/lib/public/dashboard'
import { personTypeLabel, views, type PersonCard, type Props } from './PublicDashboardShared'
import { buildPublicDashboardScope } from './buildPublicDashboardScope'
import {
  createPublicDashboardHierarchyState,
  publicDashboardHierarchyReducer,
} from './PublicDashboardHierarchyState'
import { buildPublicDashboardSearch } from './PublicDashboardUrlState'
import { useDeferredPublicDashboardData } from './useDeferredPublicDashboardData'

export function usePublicDashboardModel({
  initialData,
  initialDataComplete,
  initialSummary,
  initialView,
  initialCountry,
  initialProvince,
  initialJurisdictionId,
  initialStructureNodeId,
  initialParishId,
}: Props) {
  const [hierarchy, dispatchHierarchy] = useReducer(
    publicDashboardHierarchyReducer,
    createPublicDashboardHierarchyState({
      activeView: initialView,
      country: initialCountry,
      province: initialProvince,
      jurisdictionId: initialJurisdictionId,
      structureNodeId: initialStructureNodeId,
      parishId: initialParishId,
    }),
  )
  const { activeView, country, province, jurisdictionId, structureNodeId, parishId } = hierarchy
  const [personType, setPersonType] = useState('')
  const [pastoralLevel, setPastoralLevel] = useState('')
  const {
    dashboardData,
    dashboardSummary,
    deferredDataPending,
    deferredDataError,
    retryDeferredData,
  } = useDeferredPublicDashboardData({
    activeView,
    initialData,
    initialDataComplete,
    initialSummary,
  })
  const defaultCountry = ''

  useEffect(() => {
    const search = buildPublicDashboardSearch(window.location.search, {
      activeView,
      country,
      defaultCountry,
      province,
      jurisdictionId,
      structureNodeId,
      parishId,
    })
    const nextUrl = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`

    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, '', nextUrl)
    }
  }, [activeView, country, jurisdictionId, parishId, province, structureNodeId])

  const scope = useMemo(
    () => buildPublicDashboardScope(dashboardData, country, province, jurisdictionId, parishId),
    [country, dashboardData, jurisdictionId, parishId, province],
  )
  const countryName = useMemo(
    () => country
      ? dashboardData.countries.find((row) => row.key === country)?.name ?? 'País seleccionado'
      : 'Todos los países',
    [country, dashboardData.countries],
  )
  const countryPeople = useMemo<PersonCard[]>(() => dashboardData.people.map((item) => ({
    id: item.id,
    name: item.display_name,
    slug: item.slug,
    personType: item.person_type,
    role: personTypeLabel(item.person_type),
    scope: countryName,
  })), [countryName, dashboardData.people])
  const territoriallyLinkedPeople = useMemo(() => Array.from(new Map(
    [...scope.ordinaryPeople, ...scope.assignmentPeople].map((item) => [item.id, item]),
  ).values()), [scope.assignmentPeople, scope.ordinaryPeople])
  const peopleBase = useMemo(() => (
    scope.scopeFiltered
      ? territoriallyLinkedPeople
      : countryPeople
  ), [countryPeople, scope.scopeFiltered, territoriallyLinkedPeople])
  const visiblePeople = useMemo(
    () => peopleBase.filter((item) => !personType || item.personType === personType).slice(0, 24),
    [peopleBase, personType],
  )
  const { administrativeUnits, collegialUnits } = useMemo(() => {
    const administrative: OrganizationUnit[] = []
    const collegial: OrganizationUnit[] = []

    for (const item of dashboardData.organization_units) {
      if (/(consejo|comisi[oó]n|comit[eé]|colegio|equipo)/i.test(item.name)) collegial.push(item)
      else administrative.push(item)
    }

    return { administrativeUnits: administrative, collegialUnits: collegial }
  }, [dashboardData.organization_units])
  const scopeTitle = scope.selectedParish?.name
    || scope.selectedJurisdiction?.name
    || province
    || countryName
    || 'Ámbito seleccionado'
  const activeMeta = useMemo(
    () => views.find((item) => item.key === activeView) ?? views[0],
    [activeView],
  )

  function resetScope() {
    dispatchHierarchy({ type: 'reset_scope' })
    setPersonType('')
    setPastoralLevel('')
  }

  return {
    initialData: dashboardData,
    initialSummary: dashboardSummary,
    hierarchy,
    activeView,
    setActiveView: (value: typeof activeView) => dispatchHierarchy({ type: 'set_view', value }),
    country,
    setCountry: (value: string) => dispatchHierarchy({ type: 'set_country', value }),
    province,
    setProvince: (value: string) => dispatchHierarchy({ type: 'set_province', value }),
    jurisdictionId,
    setJurisdictionId: (value: string) => dispatchHierarchy({ type: 'set_jurisdiction', value }),
    structureNodeId,
    setStructureNodeId: (value: string) => dispatchHierarchy({ type: 'set_structure_node', value }),
    parishId,
    setParishId: (value: string) => dispatchHierarchy({ type: 'set_parish', value }),
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
    deferredDataPending,
    deferredDataError,
    retryDeferredData,
    resetScope,
  }
}

export type PublicDashboardModel = ReturnType<typeof usePublicDashboardModel>
