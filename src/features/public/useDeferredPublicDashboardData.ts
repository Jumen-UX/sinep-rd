import { useEffect, useState } from 'react'
import type {
  DashboardSummary,
  PublicDashboardData,
  PublicView,
} from '@/lib/public/dashboard'

type DeferredDataState = 'idle' | 'loading' | 'error'

type DeferredDashboardOptions = {
  activeView: PublicView
  initialData: PublicDashboardData
  initialDataComplete: boolean
  initialSummary: DashboardSummary
}

async function readJson<T>(response: Response, source: string): Promise<T> {
  if (!response.ok) throw new Error(`${source} request failed with ${response.status}`)
  return response.json() as Promise<T>
}

export function useDeferredPublicDashboardData({
  activeView,
  initialData,
  initialDataComplete,
  initialSummary,
}: DeferredDashboardOptions) {
  const [dashboardData, setDashboardData] = useState(initialData)
  const [dashboardSummary, setDashboardSummary] = useState(initialSummary)
  const [hasCompleteData, setHasCompleteData] = useState(initialDataComplete)
  const [deferredDataState, setDeferredDataState] = useState<DeferredDataState>('idle')
  const [loadAttempt, setLoadAttempt] = useState(0)

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
        if (error instanceof Error && error.name === 'AbortError') return
        console.error('Unable to load deferred public dashboard data', error)
        setDeferredDataState('error')
      }
    }

    void loadDeferredData()
    return () => controller.abort()
  }, [activeView, hasCompleteData, loadAttempt])

  function retryDeferredData() {
    setDeferredDataState('idle')
    setLoadAttempt((attempt) => attempt + 1)
  }

  return {
    dashboardData,
    dashboardSummary,
    deferredDataPending: activeView !== 'territorial' && !hasCompleteData && deferredDataState !== 'error',
    deferredDataError: activeView !== 'territorial' && !hasCompleteData && deferredDataState === 'error',
    retryDeferredData,
  }
}
