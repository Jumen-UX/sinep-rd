export type CsvPreview = {
  headers: string[]
  rows: string[][]
  records: Record<string, string>[]
  totalRows: number
  missingColumns: string[]
  extraColumns: string[]
  truncated: boolean
}

function parseCsvRows(source: string) {
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

    if (character === ',' && !quoted) {
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

export function parseCsvPreview(source: string, expectedColumns: string[], limit = 25): CsvPreview {
  const rows = parseCsvRows(source.replace(/^\uFEFF/, ''))
  if (rows.length === 0) throw new Error('El archivo CSV está vacío.')

  const headers = rows[0].map((header) => header.trim())
  if (headers.some((header) => !header)) throw new Error('Todas las columnas del encabezado deben tener nombre.')

  const normalizedHeaders = headers.map((header) => header.toLocaleLowerCase('es'))
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length) throw new Error('El encabezado contiene columnas duplicadas.')

  const normalizedExpected = expectedColumns.map((column) => column.toLocaleLowerCase('es'))
  const missingColumns = expectedColumns.filter((_, index) => !normalizedHeaders.includes(normalizedExpected[index]))
  const extraColumns = headers.filter((header) => !normalizedExpected.includes(header.toLocaleLowerCase('es')))
  const dataRows = rows.slice(1)
  const normalizedRows = dataRows.map((dataRow) => headers.map((_, index) => dataRow[index] ?? ''))
  const records = normalizedRows.map((dataRow) => Object.fromEntries(headers.map((header, index) => [header, dataRow[index]])))

  return {
    headers,
    rows: normalizedRows.slice(0, limit),
    records,
    totalRows: dataRows.length,
    missingColumns,
    extraColumns,
    truncated: dataRows.length > limit,
  }
}
