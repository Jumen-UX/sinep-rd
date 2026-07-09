export class ValidationError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'ValidationError'
    this.status = status
  }
}

export type JsonObject = Record<string, unknown>

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function parseJsonObjectBody(request: Request, invalidMessage = 'Solicitud invalida.'): Promise<JsonObject> {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    throw new ValidationError(invalidMessage)
  }

  if (!isJsonObject(body)) {
    throw new ValidationError(invalidMessage)
  }

  return body
}

export function optionalText(value: unknown, maxLength = 500) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

export function requiredText(value: unknown, fieldName: string, maxLength = 500) {
  const text = optionalText(value, maxLength)

  if (!text) {
    throw new ValidationError(`Falta ${fieldName}.`)
  }

  return text
}

export function optionalEmail(value: unknown) {
  const email = optionalText(value, 320).toLowerCase()

  if (!email) return ''

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError('Correo invalido.')
  }

  return email
}

export function requiredEmail(value: unknown) {
  const email = optionalEmail(value)

  if (!email) {
    throw new ValidationError('Correo invalido.')
  }

  return email
}

export function optionalUuid(value: unknown) {
  const text = optionalText(value, 36)

  if (!text) return ''

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new ValidationError('Identificador invalido.')
  }

  return text
}

export function requiredUuid(value: unknown, fieldName = 'identificador') {
  const uuid = optionalUuid(value)

  if (!uuid) {
    throw new ValidationError(`Falta ${fieldName}.`)
  }

  return uuid
}

export function oneOf<T extends readonly string[]>(value: unknown, allowed: T, fieldName: string): T[number] {
  const text = requiredText(value, fieldName, 100)

  if (!allowed.includes(text)) {
    throw new ValidationError(`${fieldName} no permitido.`)
  }

  return text
}

export function emailDomain(email: string) {
  return email.split('@')[1] ?? ''
}
