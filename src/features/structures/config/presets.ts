import type { StructureKind, StructureKindKey, StructurePreset } from '../types'

export const fixedJurisdictionKeys = [
  'country',
  'ecclesiastical_province',
  'archdiocese',
  'diocese',
  'military_ordinariate',
] as const

export const allowedStructureKindKeys: StructureKindKey[] = [
  'territorial',
  'pastoral',
  'administrative',
  'organic',
]

export const fallbackStructureKinds: StructureKind[] = [
  {
    key: 'territorial',
    name: 'Territorial',
    description: 'Provincia, diócesis, vicarías, zonas, parroquias, sectores y capillas.',
  },
  {
    key: 'pastoral',
    name: 'Pastoral',
    description: 'Áreas, comisiones, movimientos, comunidades y servicios.',
  },
  {
    key: 'administrative',
    name: 'Administrativa',
    description: 'Curia, oficinas, departamentos y dependencias internas.',
  },
  {
    key: 'organic',
    name: 'Orgánica',
    description: 'Organigramas, unidades y líneas de responsabilidad.',
  },
]

export const structurePresets: StructurePreset[] = [
  {
    key: 'zona-parroquia',
    title: 'Zona pastoral → Parroquia',
    description: 'Para diócesis que organizan directamente sus parroquias por zonas pastorales.',
    levels: [
      { levelKey: 'zona-pastoral', name: 'Zona Pastoral', pluralName: 'Zonas Pastorales', scope: 'pastoral' },
      {
        levelKey: 'parroquia',
        name: 'Parroquia',
        pluralName: 'Parroquias',
        scope: 'ecclesial',
        entityTypeKeys: ['parish'],
      },
    ],
  },
  {
    key: 'vicaria-zona-parroquia',
    title: 'Vicaría → Zona → Parroquia',
    description: 'Para arquidiócesis o diócesis con vicarías como nivel intermedio superior.',
    levels: [
      { levelKey: 'vicaria', name: 'Vicaría', pluralName: 'Vicarías', scope: 'pastoral' },
      { levelKey: 'zona-pastoral', name: 'Zona Pastoral', pluralName: 'Zonas Pastorales', scope: 'pastoral' },
      {
        levelKey: 'parroquia',
        name: 'Parroquia',
        pluralName: 'Parroquias',
        scope: 'ecclesial',
        entityTypeKeys: ['parish'],
      },
    ],
  },
  {
    key: 'vicaria-zona-parroquia-sector',
    title: 'Vicaría → Zona → Parroquia → Sector',
    description: 'Para estructuras con sectores bajo parroquias o unidades territoriales menores.',
    levels: [
      { levelKey: 'vicaria', name: 'Vicaría', pluralName: 'Vicarías', scope: 'pastoral' },
      { levelKey: 'zona-pastoral', name: 'Zona Pastoral', pluralName: 'Zonas Pastorales', scope: 'pastoral' },
      {
        levelKey: 'parroquia',
        name: 'Parroquia',
        pluralName: 'Parroquias',
        scope: 'ecclesial',
        entityTypeKeys: ['parish'],
      },
      { levelKey: 'sector', name: 'Sector', pluralName: 'Sectores', scope: 'pastoral' },
    ],
  },
  {
    key: 'area-comision-equipo',
    title: 'Área pastoral → Comisión → Equipo',
    description: 'Para organizar unidades funcionales no territoriales, pastorales o administrativas.',
    levels: [
      { levelKey: 'area-pastoral', name: 'Área Pastoral', pluralName: 'Áreas Pastorales', scope: 'pastoral' },
      { levelKey: 'comision', name: 'Comisión', pluralName: 'Comisiones', scope: 'pastoral' },
      { levelKey: 'equipo', name: 'Equipo', pluralName: 'Equipos', scope: 'pastoral' },
    ],
  },
]

export function isStructureKindKey(value: string | null): value is StructureKindKey {
  return !!value && allowedStructureKindKeys.includes(value as StructureKindKey)
}

export function defaultStructureModelName(kind: StructureKindKey) {
  if (kind === 'territorial') return 'Catálogo territorial principal'
  if (kind === 'pastoral') return 'Catálogo pastoral principal'
  if (kind === 'administrative') return 'Catálogo administrativo principal'
  return 'Catálogo orgánico principal'
}
