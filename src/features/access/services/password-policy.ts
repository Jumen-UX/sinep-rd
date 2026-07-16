export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_LONG_PASSPHRASE_LENGTH = 20

export type PasswordStrengthLevel = 'empty' | 'weak' | 'fair' | 'good' | 'strong'

export type PasswordEvaluation = {
  length: number
  categoryCount: number
  hasMinimumLength: boolean
  hasLongPassphrase: boolean
  hasLowercase: boolean
  hasUppercase: boolean
  hasNumber: boolean
  hasSymbol: boolean
  hasSafeWhitespace: boolean
  hasRequiredVariety: boolean
  isAcceptable: boolean
  level: PasswordStrengthLevel
  score: number
  percentage: number
}

function countCharacters(value: string) {
  return Array.from(value).length
}

export function evaluatePassword(password: string): PasswordEvaluation {
  const length = countCharacters(password)
  const hasLowercase = /[a-záéíóúüñ]/.test(password)
  const hasUppercase = /[A-ZÁÉÍÓÚÜÑ]/.test(password)
  const hasNumber = /\d/.test(password)
  const hasSymbol = /[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s]/.test(password)
  const categoryCount = [hasLowercase, hasUppercase, hasNumber, hasSymbol].filter(Boolean).length
  const hasMinimumLength = length >= PASSWORD_MIN_LENGTH
  const hasLongPassphrase = length >= PASSWORD_LONG_PASSPHRASE_LENGTH
  const hasSafeWhitespace = password === password.trim()
  const hasRequiredVariety = hasLongPassphrase || categoryCount >= 3

  let score = 0
  if (hasMinimumLength) score += 1
  if (length >= 16) score += 1
  if (hasLongPassphrase) score += 1
  if (categoryCount >= 2) score += 1
  if (categoryCount >= 3) score += 1
  if (!hasSafeWhitespace) score = Math.min(score, 1)

  const normalizedScore = Math.max(0, Math.min(5, score))
  const level: PasswordStrengthLevel = password.length === 0
    ? 'empty'
    : normalizedScore <= 1
      ? 'weak'
      : normalizedScore === 2
        ? 'fair'
        : normalizedScore <= 4
          ? 'good'
          : 'strong'

  return {
    length,
    categoryCount,
    hasMinimumLength,
    hasLongPassphrase,
    hasLowercase,
    hasUppercase,
    hasNumber,
    hasSymbol,
    hasSafeWhitespace,
    hasRequiredVariety,
    isAcceptable: hasMinimumLength && hasSafeWhitespace && hasRequiredVariety,
    level,
    score: normalizedScore,
    percentage: Math.round((normalizedScore / 5) * 100),
  }
}

export function getPasswordValidationError(password: string) {
  const evaluation = evaluatePassword(password)

  if (!password) return 'Escribe una contraseña nueva.'
  if (!evaluation.hasMinimumLength) return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`
  if (!evaluation.hasSafeWhitespace) return 'La contraseña no puede comenzar ni terminar con espacios.'
  if (!evaluation.hasRequiredVariety) {
    return `Usa una frase de ${PASSWORD_LONG_PASSPHRASE_LENGTH} caracteres o más, o combina al menos tres tipos: mayúsculas, minúsculas, números y símbolos.`
  }

  return null
}
