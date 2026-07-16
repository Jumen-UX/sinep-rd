import type { ReactNode } from 'react'
import { evaluatePassword } from '../services/password-policy'
import styles from './PasswordSecurity.module.css'

type PasswordSecurityPanelProps = {
  password: string
  confirmation?: string
  id?: string
}

type PasswordRuleProps = {
  valid: boolean
  children: ReactNode
  detail?: string
}

const strengthLabels = {
  empty: 'Sin evaluar',
  weak: 'Débil',
  fair: 'Mejorable',
  good: 'Adecuada',
  strong: 'Fuerte',
} as const

function PasswordRule({ valid, children, detail }: PasswordRuleProps) {
  return (
    <li className={styles.rule} data-valid={valid}>
      <span aria-hidden="true" className={styles.ruleIcon}>{valid ? '✓' : '·'}</span>
      <span className={styles.ruleCopy}>
        <span>{children}</span>
        {detail && <small>{detail}</small>}
        <strong>{valid ? 'Cumplido' : 'Pendiente'}</strong>
      </span>
    </li>
  )
}

function CharacterType({ valid, children }: { valid: boolean; children: ReactNode }) {
  return (
    <span className={styles.characterType} data-valid={valid}>
      <span aria-hidden="true">{valid ? '✓' : '·'}</span>
      {children}
    </span>
  )
}

export default function PasswordSecurityPanel({
  password,
  confirmation,
  id = 'password-security-guidance',
}: PasswordSecurityPanelProps) {
  const evaluation = evaluatePassword(password)
  const hasValue = password.length > 0
  const confirmationStarted = typeof confirmation === 'string' && confirmation.length > 0
  const confirmationMatches = confirmationStarted && password === confirmation
  const varietyDetail = evaluation.hasLongPassphrase
    ? 'La frase larga de 20 caracteres ya cumple la alternativa de variedad.'
    : `${evaluation.categoryCount} de 4 tipos de caracteres detectados.`

  return (
    <section
      aria-live="polite"
      className={styles.panel}
      data-strength={evaluation.level}
      id={id}
    >
      <div className={styles.heading}>
        <strong>Seguridad de la contraseña</strong>
        <span className={styles.strengthLabel}>{strengthLabels[evaluation.level]}</span>
      </div>

      <div
        aria-label={`Nivel de seguridad: ${strengthLabels[evaluation.level]}`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={evaluation.percentage}
        aria-valuetext={strengthLabels[evaluation.level]}
        className={styles.meter}
        role="progressbar"
      >
        <span className={styles.meterFill} style={{ width: `${evaluation.percentage}%` }} />
      </div>

      <p className={styles.intro}>
        Los requisitos se actualizan mientras escribes. Para la variedad, basta una frase de 20 caracteres o tres tipos de caracteres.
      </p>

      <ul className={styles.ruleList}>
        <PasswordRule valid={hasValue && evaluation.hasMinimumLength}>
          12 caracteres como mínimo.
        </PasswordRule>
        <PasswordRule valid={hasValue && evaluation.hasSafeWhitespace}>
          Sin espacios al inicio ni al final.
        </PasswordRule>
        <PasswordRule valid={hasValue && evaluation.hasRequiredVariety} detail={varietyDetail}>
          Variedad suficiente de caracteres.
        </PasswordRule>
        {typeof confirmation === 'string' && (
          <PasswordRule valid={confirmationMatches}>
            La confirmación coincide con la contraseña.
          </PasswordRule>
        )}
      </ul>

      <div aria-label="Tipos de caracteres detectados" className={styles.characterGrid}>
        <CharacterType valid={hasValue && evaluation.hasLowercase}>Minúsculas</CharacterType>
        <CharacterType valid={hasValue && evaluation.hasUppercase}>Mayúsculas</CharacterType>
        <CharacterType valid={hasValue && evaluation.hasNumber}>Números</CharacterType>
        <CharacterType valid={hasValue && evaluation.hasSymbol}>Símbolos</CharacterType>
      </div>

      <p className={`meta ${styles.note}`}>
        Una frase larga y difícil de adivinar puede ser más segura y fácil de recordar que una contraseña corta y compleja.
      </p>
    </section>
  )
}
