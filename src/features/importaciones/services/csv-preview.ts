import { IMPORT_BATCH_LIMITS } from '../contracts/import-batch-contract'

export type CsvDelimiter = ',' | ';' | '\t'

export type CsvPreview = {
  headers: string[]
  rows: string[][]
  records: Record<string, string>[]
  totalRows: number
  missingColumns: string[]
  extraColumns: string[]
  truncated: boolean
  delimiter: CsvDelimiter
}

const supportedDelimiters: readonly CsvDelimiter[] = [',', ';', '\t']

function countUnquotedDelimiter(source: string, delimiter: CsvDelimiter) {
  let quoted = false
  let count = 0

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    const next = source[index + 1]
    if (character === '"') {
      if (quoted && next === '"') index += 1
      else quoted = !quoted
      continue
    }
    if (!quoted && character === delimiter) count += 1
  }

  return count
}

function detectDelimiter(source: string): CsvDelimiter {
  const firstLogicalLine = source.split(/\r?\n/, 1)[0] ?? ''
  const ranked = supportedDelimiters
    .map((delimiter) => ({ delimiter, count: countUnquotedDelimiter(firstLogicalLine, delimiter) }))
    .sort((left, right) => right.count - left.count)

  if (ranked[0].count === 0) {
    throw new Error('No se pudo detectar un delimitador CSV válido. Usa coma, punto y coma o tabulación.')
  }
  if (ranked[1] && ranked[1].count === ranked[0].count) {
    throw new Error('El encabezado usa delimitadores ambiguos. Conserva un único delimitador en todo el archivo.')
  }

  return ranked[0].delimiter
}

function parseCsvRows(source: string, delimiter: CsvDelimiter) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    const next = source[index + 1]

    if (character === '"') {
      if (quoted && next === '"') {
        field += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }

    if (character === delimiter && !quoted) {
      row.push(field.trim())
      field = ''
      continue
    }

    if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1
      row.push(field.trim())
      if (row.some((value) => value.length > 0)) rows.push(row)
      row = []
      field = ''
      continue
    }

    field += character
    if (field.length > IMPORT_BATCH_LIMITS.maxCellCharacters) {
      throw new Error(`Una celda supera el límite de ${IMPORT_BATCH_LIMITS.maxCellCharacters.toLocaleString('es-DO')} caracteres.`)
    }
  }

  if (quoted) throw new Error('El CSV contiene un campo entre comillas sin cerrar.')
  row.push(field.trim())
  if (row.some((value) => value.length > 0)) rows.push(row)
  return rows
}

export function buildCsvTemplate(columns: string[]) {
  return `\uFEFF${columns.join(',')}\r\n`
}

export async function sha256Hex(source: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', source)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function parseCsvPreview(source: string, expectedColumns: string[], limit = IMPORT_BATCH_LIMITS.previewRows): CsvPreview {
  const normalizedSource = source.replace(/^\uFEFF/, '')
  if (normalizedSource.includes('\0')) throw new Error('El archivo CSV contiene caracteres nulos no permitidos.')

  const delimiter = detectDelimiter(normalizedSource)
  const rows = parseCsvRows(normalizedSource, delimiter)
  if (rows.length === 0) throw new Error('El archivo CSV está vacío.')

  const headers = rows[0].map((header) => header.trim())
  if (headers.length > IMPORT_BATCH_LIMITS.maxColumns) {
    throw new Error(`El archivo supera el límite de ${IMPORT_BATCH_LIMITS.maxColumns} columnas.`)
  }
  if (headers.some((header) => !header)) throw new Error('Todas las columnas del encabezado deben tener nombre.')

  const normalizedHeaders = headers.map((header) => header.toLocaleLowerCase('es'))
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length) throw new Error('El encabezado contiene columnas duplicadas.')

  const normalizedExpected = expectedColumns.map((column) => column.toLocaleLowerCase('es'))
  const missingColumns = expectedColumns.filter((_, index) => !normalizedHeaders.includes(normalizedExpected[index]))
  const extraColumns = headers.filter((header) => !normalizedExpected.includes(header.toLocaleLowerCase('es')))
  const dataRows = rows.slice(1)

  dataRows.forEach((dataRow, index) => {
    if (dataRow.length !== headers.length) {
      throw new Error(`La fila ${index + 2} tiene ${dataRow.length} columnas; se esperaban ${headers.length}.`)
    }
  })

  const records = dataRows.map((dataRow) => Object.fromEntries(headers.map((header, index) => [header, dataRow[index]])))

  return {
    headers,
    rows: dataRows.slice(0, limit),
    records,
    totalRows: dataRows.length,
    missingColumns,
    extraColumns,
    truncated: dataRows.length > limit,
    delimiter,
  }
}
