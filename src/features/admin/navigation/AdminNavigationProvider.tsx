'use client'

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  loadAdminNavigationContext,
  type AdminNavigationContext,
  type AdminNavigationScope,
} from './admin-navigation-service'
import {
  getMobileAdminNavigationItems,
  getVisibleAdminNavigationSections,
  type AdminNavigationPolicyContext,
  type ResolvedAdminNavigationItem,
  type ResolvedAdminNavigationSection,
} from './admin-navigation-policy'

const activeScopeStorageKey = 'sinep:admin:active-scope'

type AdminNavigationContextValue = {
  context: AdminNavigationContext | null
  policyContext: AdminNavigationPolicyContext
  sections: ResolvedAdminNavigationSection[]
  mobileItems: ResolvedAdminNavigationItem[]
  loading: boolean
  error: string | null
  selectScope: (scopeKey: string) => void
  refresh: () => Promise<void>
}

const emptyPolicyContext: AdminNavigationPolicyContext = {
  accessState: 'no_role',
  permissionKeys: [],
  activeScopeType: null,
  isUnrestricted: false,
}

const AdminNavigationContextObject = createContext<AdminNavigationContextValue | null>(null)

function requestedScopeKey(scopes: AdminNavigationScope[]) {
  if (typeof window === 'undefined') return null

  const url = new URL(window.location.href)
  const scopeType = url.searchParams.get('scope_type')
  const scopeId = url.searchParams.get('scope_id')
  const urlKey = scopeType ? `${scopeType}:${scopeId || 'all'}` : null
  if (urlKey && scopes.some((scope) => scope.key === urlKey)) return urlKey

  const storedKey = window.localStorage.getItem(activeScopeStorageKey)
  if (storedKey && scopes.some((scope) => scope.key === storedKey)) return storedKey

  return null
}

function withSelectedScope(
  context: AdminNavigationContext,
  scopeKey: string | null,
): AdminNavigationContext {
  const selected = context.availableScopes.find((scope) => scope.key === scopeKey)
    ?? context.availableScopes[0]
    ?? context.activeScope

  return { ...context, activeScope: selected }
}

function persistSelectedScope(scope: AdminNavigationScope) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(activeScopeStorageKey, scope.key)
  const url = new URL(window.location.href)

  if (scope.type === 'none') {
    url.searchParams.delete('scope_type')
    url.searchParams.delete('scope_id')
  } else {
    url.searchParams.set('scope_type', scope.type)
    if (scope.entityId) url.searchParams.set('scope_id', scope.entityId)
    else url.searchParams.delete('scope_id')
  }

  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}

export function AdminNavigationProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  const [context, setContext] = useState<AdminNavigationContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const loaded = await loadAdminNavigationContext(supabase)
      const selected = withSelectedScope(loaded, requestedScopeKey(loaded.availableScopes))
      setContext(selected)
      persistSelectedScope(selected.activeScope)
    } catch (loadError) {
      setContext(null)
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la navegación administrativa.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const selectScope = useCallback((scopeKey: string) => {
    setContext((current) => {
      if (!current) return current
      const next = withSelectedScope(current, scopeKey)
      persistSelectedScope(next.activeScope)
      return next
    })
  }, [])

  const policyContext = useMemo<AdminNavigationPolicyContext>(() => {
    if (!context) return emptyPolicyContext

    return {
      accessState: context.accessState,
      permissionKeys: context.permissionKeys,
      activeScopeType: context.activeScope.type,
      isUnrestricted: context.activeScope.isUnrestricted,
    }
  }, [context])

  const sections = useMemo(
    () => getVisibleAdminNavigationSections(policyContext),
    [policyContext],
  )
  const mobileItems = useMemo(
    () => getMobileAdminNavigationItems(policyContext),
    [policyContext],
  )
  const value = useMemo<AdminNavigationContextValue>(() => ({
    context,
    policyContext,
    sections,
    mobileItems,
    loading,
    error,
    selectScope,
    refresh,
  }), [context, policyContext, sections, mobileItems, loading, error, selectScope, refresh])

  return (
    <AdminNavigationContextObject.Provider value={value}>
      {children}
    </AdminNavigationContextObject.Provider>
  )
}

export function useAdminNavigation() {
  const value = useContext(AdminNavigationContextObject)
  if (!value) {
    throw new Error('useAdminNavigation debe utilizarse dentro de AdminNavigationProvider.')
  }
  return value
}
