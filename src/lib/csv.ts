export type CsvCell = string | number | boolean | null | undefined

function normalizeCsvCell(value: CsvCell) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  return String(value)
}

export function protectCsvCell(value: CsvCell) {
  const normalized = normalizeCsvCell(value)
  return /^[\t\r ]*[=+\-@]/.test(normalized) ? `'${normalized}` : normalized
}

function escapeCsvCell(value: CsvCell) {
  const protectedValue = protectCsvCell(value)
  return `"${protectedValue.replaceAll('"', '""')}"`
}

export function createCsv(
  headers: readonly string[],
  rows: readonly (readonly CsvCell[])[],
) {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ]

  return `\uFEFF${lines.join('\r\n')}\r\n`
}

export function downloadCsv(filename: string, content: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('La descarga CSV solo está disponible en el navegador.')
  }

  const safeFilename = filename.trim().replace(/[^a-zA-Z0-9._-]+/g, '-') || 'export.csv'
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = safeFilename.endsWith('.csv') ? safeFilename : `${safeFilename}.csv`
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
