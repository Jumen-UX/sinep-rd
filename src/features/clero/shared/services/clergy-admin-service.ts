export {
  loadAllowedOfficeIds,
  loadPersonPlacementCatalogs as loadClergyPlacementCatalogs,
  removePersonPhoto as removeClergyPhoto,
  uploadPersonPhoto as uploadClergyPhoto,
} from '@/features/personas/shared/services/person-placement-service'

export type {
  OfficeConfig,
  PersonPlacementCatalogs as ClergyPlacementCatalogs,
  UploadedPersonPhoto as UploadedClergyPhoto,
} from '@/features/personas/shared/services/person-placement-service'
