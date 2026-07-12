export const importDomainKeys = ['personas', 'parroquias', 'asignaciones', 'eventos'] as const

export type ImportDomainKey = (typeof importDomainKeys)[number]

type ImportDomainContract = {
  singular: string
  plural: string
  applicationAction: string
  applicationDescription: string
  confirmation: string
}

export const importDomainContracts: Record<ImportDomainKey, ImportDomainContract> = {
  personas: {
    singular: 'persona',
    plural: 'personas',
    applicationAction: 'Aplicar lote de personas',
    applicationDescription: 'creará o enlazará identidades y dimensiones canónicas de personas',
    confirmation: 'Esta acción aplicará el lote de personas mediante el motor canónico y dejará auditoría por cada fila. ¿Deseas continuar?',
  },
  parroquias: {
    singular: 'estructura',
    plural: 'estructuras',
    applicationAction: 'Aplicar lote de estructuras',
    applicationDescription: 'creará nodos y entidades mediante el motor canónico de estructuras',
    confirmation: 'Esta acción aplicará el lote de estructuras mediante una operación transaccional y dejará auditoría por cada fila. ¿Deseas continuar?',
  },
  asignaciones: {
    singular: 'asignación',
    plural: 'asignaciones',
    applicationAction: 'Aplicar lote de asignaciones',
    applicationDescription: 'registrará cargos y sucesiones mediante el motor canónico de asignaciones',
    confirmation: 'Esta acción aplicará el lote de asignaciones, evaluará elegibilidad y sucesión, y dejará auditoría por cada fila. ¿Deseas continuar?',
  },
  eventos: {
    singular: 'evento',
    plural: 'eventos',
    applicationAction: 'Aplicar lote de eventos',
    applicationDescription: 'creará eventos canónicos pendientes de revisión sin modificar directamente el estado estructural',
    confirmation: 'Esta acción creará eventos canónicos pendientes de revisión y dejará auditoría por cada fila. No modificará directamente el estado estructural. ¿Deseas continuar?',
  },
}

export function getImportDomainContract(value: string): ImportDomainContract {
  if (importDomainKeys.includes(value as ImportDomainKey)) {
    return importDomainContracts[value as ImportDomainKey]
  }

  return {
    singular: 'registro',
    plural: 'registros',
    applicationAction: 'Aplicar lote',
    applicationDescription: 'aplicará los registros mediante el contrato disponible para este dominio',
    confirmation: 'Esta acción aplicará el lote mediante una operación transaccional y dejará auditoría por cada fila. ¿Deseas continuar?',
  }
}
