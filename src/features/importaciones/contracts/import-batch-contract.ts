export const IMPORT_BATCH_TYPES = ['personas', 'parroquias', 'asignaciones', 'eventos'] as const
export const IMPORT_FILE_EXTENSIONS = ['csv', 'xlsx', 'xls'] as const
export const PROCESSABLE_IMPORT_FILE_EXTENSIONS = ['csv'] as const

export type ImportBatchType = (typeof IMPORT_BATCH_TYPES)[number]
export type ImportFileExtension = (typeof IMPORT_FILE_EXTENSIONS)[number]
export type ProcessableImportFileExtension = (typeof PROCESSABLE_IMPORT_FILE_EXTENSIONS)[number]

export const IMPORT_BATCH_LIMITS = {
  maxFileSizeBytes: 10 * 1024 * 1024,
  maxRows: 5000,
  previewRows: 25,
  maxColumns: 100,
  maxCellCharacters: 10_000,
} as const

export const IMPORT_TEMPLATE_VERSION = 1

export type ImportDomainContract = {
  key: ImportBatchType
  eyebrow: string
  title: string
  description: string
  icon: string
  columns: readonly string[]
  requiredColumns: readonly string[]
  notes: readonly string[]
}

export const IMPORT_DOMAIN_CONTRACTS: Record<ImportBatchType, ImportDomainContract> = {
  personas: {
    key: 'personas',
    eyebrow: 'Personas',
    title: 'Personas y agentes',
    description: 'Carga inicial de obispos, sacerdotes, diáconos, religiosos y laicos con datos básicos y estado.',
    icon: '◉',
    columns: ['codigo_referencia', 'tipo_persona', 'primer_nombre', 'primer_apellido', 'nombre_publico', 'estado', 'visibilidad', 'entidad_actual'],
    requiredColumns: ['tipo_persona', 'primer_nombre', 'primer_apellido'],
    notes: [
      'codigo_referencia es opcional para altas nuevas; úsalo para enlazar de forma idempotente una persona ya registrada.',
      'Usa catálogos para tipo de persona y estado.',
      'El sistema valida coincidencias exactas por código interno antes de aplicar.',
      'Los datos privados no deben ir en plantillas públicas.',
    ],
  },
  parroquias: {
    key: 'parroquias',
    eyebrow: 'Estructura',
    title: 'Parroquias, capillas y comunidades',
    description: 'Carga territorial por diócesis o zona con jerarquía flexible y posibilidad de revisión antes de aplicar.',
    icon: '✚',
    columns: ['pais_iso2', 'diocesis', 'nivel_padre', 'tipo_entidad', 'nombre', 'direccion', 'visibilidad'],
    requiredColumns: ['pais_iso2', 'diocesis', 'nivel_padre', 'tipo_entidad', 'nombre'],
    notes: [
      'Los nombres repetidos se revisan por diócesis y nivel.',
      'La jerarquía se debe resolver antes de publicar.',
      'Las entidades nuevas entran en revisión.',
    ],
  },
  asignaciones: {
    key: 'asignaciones',
    eyebrow: 'Nombramientos',
    title: 'Cargos y nombramientos',
    description: 'Importación controlada de cargos actuales o históricos con fecha de inicio, entidad y persona.',
    icon: '▣',
    columns: ['persona', 'cargo', 'entidad', 'fecha_inicio', 'fecha_fin', 'actual', 'fuente'],
    requiredColumns: ['persona', 'cargo', 'entidad', 'fecha_inicio'],
    notes: [
      'Los cargos actuales deben cerrar cargos previos incompatibles.',
      'Toda asignación debe apuntar a persona y entidad resueltas.',
      'La fuente ayuda a revisión editorial.',
    ],
  },
  eventos: {
    key: 'eventos',
    eyebrow: 'Historial',
    title: 'Eventos históricos',
    description: 'Carga por lotes de erecciones, divisiones, fusiones, nombramientos y hechos verificables.',
    icon: '◷',
    columns: ['tipo_evento', 'fecha_efectiva', 'entidad', 'descripcion', 'titulo', 'fuente', 'url_fuente'],
    requiredColumns: ['tipo_evento', 'fecha_efectiva', 'entidad', 'descripcion'],
    notes: [
      'Cada evento debe ser trazable.',
      'Los eventos pueden quedar en cola de revisión.',
      'No se deben aplicar cambios estructurales sin validación.',
    ],
  },
}

export const IMPORT_DOMAIN_OPTIONS = IMPORT_BATCH_TYPES.map((type) => IMPORT_DOMAIN_CONTRACTS[type])
export const IMPORT_FILE_ACCEPT = PROCESSABLE_IMPORT_FILE_EXTENSIONS.map((extension) => `.${extension}`).join(',')

export function isImportBatchType(value: unknown): value is ImportBatchType {
  return typeof value === 'string' && (IMPORT_BATCH_TYPES as readonly string[]).includes(value)
}

export function isImportFileExtension(value: unknown): value is ImportFileExtension {
  return typeof value === 'string' && (IMPORT_FILE_EXTENSIONS as readonly string[]).includes(value)
}

export function isProcessableImportFileExtension(value: unknown): value is ProcessableImportFileExtension {
  return typeof value === 'string' && (PROCESSABLE_IMPORT_FILE_EXTENSIONS as readonly string[]).includes(value)
}

export function getImportDomainContract(type: ImportBatchType): ImportDomainContract {
  return IMPORT_DOMAIN_CONTRACTS[type]
}
