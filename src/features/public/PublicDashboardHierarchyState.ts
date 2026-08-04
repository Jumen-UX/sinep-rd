import type { PublicView } from '@/lib/public/dashboard'

export type PublicDashboardHierarchyState = {
  activeView: PublicView
  country: string
  province: string
  jurisdictionId: string
  structureNodeId: string
  parishId: string
}

export type PublicDashboardHierarchyAction =
  | { type: 'set_view'; value: PublicView }
  | { type: 'set_country'; value: string }
  | { type: 'set_province'; value: string }
  | { type: 'set_jurisdiction'; value: string }
  | { type: 'set_structure_node'; value: string }
  | { type: 'set_parish'; value: string }
  | { type: 'reset_scope' }

export function createPublicDashboardHierarchyState(input: {
  activeView: PublicView
  country?: string
  province?: string
  jurisdictionId?: string
  structureNodeId?: string
  parishId?: string
}): PublicDashboardHierarchyState {
  return {
    activeView: input.activeView,
    country: input.country ?? '',
    province: input.province ?? '',
    jurisdictionId: input.jurisdictionId ?? '',
    structureNodeId: input.structureNodeId ?? '',
    parishId: input.parishId ?? '',
  }
}

export function publicDashboardHierarchyReducer(
  state: PublicDashboardHierarchyState,
  action: PublicDashboardHierarchyAction,
): PublicDashboardHierarchyState {
  switch (action.type) {
    case 'set_view':
      return { ...state, activeView: action.value }
    case 'set_country':
      return {
        ...state,
        country: action.value,
        province: '',
        jurisdictionId: '',
        structureNodeId: '',
        parishId: '',
      }
    case 'set_province':
      return {
        ...state,
        province: action.value,
        jurisdictionId: '',
        structureNodeId: '',
        parishId: '',
      }
    case 'set_jurisdiction':
      return {
        ...state,
        jurisdictionId: action.value,
        structureNodeId: '',
        parishId: '',
      }
    case 'set_structure_node':
      return {
        ...state,
        structureNodeId: action.value,
        parishId: '',
      }
    case 'set_parish':
      return { ...state, parishId: action.value }
    case 'reset_scope':
      return {
        ...state,
        country: '',
        province: '',
        jurisdictionId: '',
        structureNodeId: '',
        parishId: '',
      }
  }
}
