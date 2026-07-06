const MASK = '•••'

function onlyText(value: string | null | undefined) {
  return String(value ?? '').trim()
}

export function maskLast(value: string | null | undefined, visible = 4) {
  const text = onlyText(value)
  if (!text) return 'No indicado'
  const clean = text.replace(/\s+/g, '')
  if (clean.length <= visible) return `${MASK}${clean}`
  return `${MASK}${clean.slice(-visible)}`
}

export function maskPhone(value: string | null | undefined) {
  return maskLast(value, 4)
}

export function maskDocument(value: string | null | undefined) {
  return maskLast(value, 4)
}

export function maskInternalCode(value: string | null | undefined) {
  const text = onlyText(value)
  if (!text) return 'No indicado'
  const [prefix, number] = text.includes('-') ? text.split('-', 2) : ['', text]
  const maskedNumber = maskLast(number, 4)
  return prefix ? `${prefix}-${maskedNumber}` : maskedNumber
}

export function maskEmail(value: string | null | undefined) {
  const text = onlyText(value)
  if (!text) return 'No indicado'
  const [name, domain] = text.split('@')
  if (!name || !domain) return maskLast(text, 4)
  return `${name.slice(0, 1)}${MASK}@${domain}`
}
