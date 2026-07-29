'use client'

import { useEffect, useMemo, useState } from 'react'
import type {
  DashboardSummary,
  OrganizationUnit,
  PublicDashboardData,
  PublicView,
} from '@/lib/public/dashboard'
import { personTypeLabel, views, type PersonCard, type Props } from './PublicDashboardShared'
import { buildPublicDashboardScope } from './buildPublicDashboardScope'
import { buildPublicDashboardSearch } from './PublicDashboardUrlState'

type DeferredDataState = 'idle' | 'loading' | 'error'

async function readJson<T>(response: Response, source: string): Promise<T> {
  if (!response.ok) throw new Error(`${source} request failed with ${response.status}`)
  return response.json() as Promise<T>
}

export function usePublicDashboardModel({
  initialData,
  initialDataComplete,
  initialSummary,
  initialView,
  initialCountry,
  initialProvince,
  initialJurisdictionId,
}: Props) {
  const [dashboardData, setDashboardData] = useState(initialData)
  const [dashboardSummary, setDashboardSummary] = useState(initialSummary)
  const [hasCompleteData, setHasCompleteData] = useState(initialDataComplete)
  const [deferredDataState, setDeferredDataState] = useState<DeferredDataState>('idle')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const defaultCountry = useMemo(() => (
    dashboardData.countries.some((item) => item.key === 'DO')
      ? 'DO'
      : dashboardData.countries[0]?.key ?? 'DO'
  ), [dashboardData.countries])
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

  useEffect(() => {
    if (activeView === 'territorial' || hasCompleteData) return

    const controller = new AbortController()
    setDeferredDataState('loading')

    async function loadDeferredData() {
      try {
        const requestOptions = {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        }
        const [dataResponse, summaryResponse] = await Promise.all([
          fetch('/api/dashboard/vistas', requestOptions),
          fetch('/api/dashboard/resumen', requestOptions),
        ])
        const [data, summary] = await Promise.all([
          readJson<PublicDashboardData>(dataResponse, 'Dashboard views'),
          readJson<DashboardSummary>(summaryResponse, 'Dashboard summary'),
        ])

        setDashboardData(data)
        setDashboardSummary(summary)
        setHasCompleteData(true)
        setDeferredDataState('idle')
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.error('Unable to load deferred public dashboard data', error)
        setDeferredDataState('error')
      }
    }

    void loadDeferredData()
    return () => controller.abort()
  }, [activeView, hasCompleteData, loadAttempt])

  const scope = useMemo(
    () => buildPublicDashboardScope(dashboardData, country, province, jurisdictionId),
    [country, dashboardData, jurisdictionId, province],
  )
  const countryName = useMemo(
    () => dashboardData.countries.find((row) => row.key === country)?.name ?? 'República Dominicana',
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

    for (const item of dashboardData.organization_units) {
      if (/(consejo|comisi[oó]n|comit[eé]|colegio|equipo)/i.test(item.name)) collegial.push(item)
      else administrative.push(item)
    }

    return { administrativeUnits: administrative, collegialUnits: collegial }
  }, [dashboardData.organization_units])
  const scopeTitle = scope.selectedJurisdiction?.name
    || province
    || countryName
    || 'Ámbito seleccionado'
  const activeMeta = useMemo(
    () => views.find((item) => item.key === activeView) ?? views[0],
    [activeView],
  )
  const deferredDataPending = activeView !== 'territorial' && !hasCompleteData && deferredDataState !== 'error'
  const deferredDataError = activeView !== 'territorial' && !hasCompleteData && deferredDataState === 'error'

  function resetScope() {
    setProvince('')
    setJurisdictionId('')
    setPersonType('')
    setPastoralLevel('')
  }

  function retryDeferredData() {
    setDeferredDataState('idle')
    setLoadAttempt((attempt) => attempt + 1)
  }

  return {
    initialData: dashboardData,
    initialSummary: dashboardSummary,
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
    deferredDataPending,
    deferredDataError,
    retryDeferredData,
    resetScope,
  }
}

export type PublicDashboardModel = ReturnType<typeof usePublicDashboardModel>
