export type ImportReferenceType = 'person' | 'entity' | 'office' | 'event_type'

export type ImportRowFieldKind = 'text' | 'email' | 'date' | 'select' | 'textarea' | 'boolean' | 'reference'

export type ImportRowFieldContract = {
  label: string
  kind: ImportRowFieldKind
  options?: Array<{ value: string; label: string; description?: string }>
  help?: string
  referenceType?: ImportReferenceType
}

const visibilityOptions = [
  { value: 'public', label: 'Pública' },
  { value: 'internal', label: 'Interna' },
  { value: 'private', label: 'Privada' },
  { value: 'confidential', label: 'Confidencial' },
]

const activeStatusOptions = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'retired', label: 'Retirado' },
  { value: 'suspended', label: 'Suspendido' },
  { value: 'unknown', label: 'Desconocido' },
]

const commonFields: Record<string, ImportRowFieldContract> = {
  email: { label: 'Correo electrónico', kind: 'email' },
  fecha_nacimiento: { label: 'Fecha de nacimiento', kind: 'date' },
  fecha_inicio: { label: 'Fecha de inicio', kind: 'date' },
  fecha_fin: { label: 'Fecha de finalización', kind: 'date' },
  fecha_efectiva: { label: 'Fecha efectiva', kind: 'date' },
  fecha_ereccion: { label: 'Fecha de erección', kind: 'date' },
  visibilidad: { label: 'Visibilidad', kind: 'select', options: visibilityOptions },
  descripcion: { label: 'Descripción', kind: 'textarea' },
  notas: { label: 'Notas', kind: 'textarea' },
  es_actual: {
    label: 'Asignación actual',
    kind: 'boolean',
    options: [
      { value: 'true', label: 'Sí' },
      { value: 'false', label: 'No' },
    ],
  },
}

const domainFields: Record<string, Record<string, ImportRowFieldContract>> = {
  personas: {
    primer_nombre: { label: 'Primer nombre', kind: 'text' },
    segundo_nombre: { label: 'Segundo nombre', kind: 'text' },
    apellidos: { label: 'Apellidos', kind: 'text' },
    tipo_persona: {
      label: 'Dimensión de registro',
      kind: 'select',
      options: [
        { value: 'bishop', label: 'Obispo' },
        { value: 'priest', label: 'Sacerdote' },
        { value: 'deacon', label: 'Diácono' },
        { value: 'religious', label: 'Religioso/a' },
        { value: 'layperson', label: 'Laico/a' },
      ],
      help: 'La condición clerical definitiva se deriva de las dimensiones canónicas registradas.',
    },
    estado: { label: 'Estado', kind: 'select', options: activeStatusOptions },
    entidad: {
      label: 'Entidad de referencia',
      kind: 'reference',
      referenceType: 'entity',
      help: 'Busca una entidad dentro del alcance del lote. Mientras no exista catálogo cargado, se admite una referencia textual exacta.',
    },
  },
  parroquias: {
    nombre: { label: 'Nombre', kind: 'text' },
    nombre_oficial: { label: 'Nombre oficial', kind: 'text' },
    tipo_estructura: { label: 'Tipo de estructura', kind: 'text' },
    entidad_padre: {
      label: 'Estructura superior',
      kind: 'reference',
      referenceType: 'entity',
      help: 'Debe resolverse dentro de la jerarquía y alcance del lote.',
    },
    estado: { label: 'Estado', kind: 'select', options: activeStatusOptions },
  },
  asignaciones: {
    persona: {
      label: 'Persona',
      kind: 'reference',
      referenceType: 'person',
      help: 'Busca una identidad canónica inequívoca para evitar asignar el cargo a otra persona.',
    },
    cargo: { label: 'Cargo', kind: 'reference', referenceType: 'office' },
    entidad: { label: 'Entidad', kind: 'reference', referenceType: 'entity' },
  },
  eventos: {
    entidad: { label: 'Entidad participante', kind: 'reference', referenceType: 'entity' },
    tipo_evento: {
      label: 'Tipo canónico de evento',
      kind: 'reference',
      referenceType: 'event_type',
      help: 'Debe corresponder a un tipo canónico activo.',
    },
    titulo: { label: 'Título', kind: 'text' },
    descripcion: { label: 'Descripción', kind: 'textarea' },
    fuente_documental: { label: 'Fuente documental', kind: 'textarea' },
  },
}

function humanizeFieldName(fieldName: string) {
  return fieldName
    .replace(/_/g, ' ')
    .replace(/^./, (character) => character.toUpperCase())
}

export function getImportRowFieldContract(importType: string, fieldName: string): ImportRowFieldContract {
  return domainFields[importType]?.[fieldName]
    ?? commonFields[fieldName]
    ?? { label: humanizeFieldName(fieldName), kind: 'text' }
}
