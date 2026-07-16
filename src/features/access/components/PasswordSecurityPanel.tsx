import { evaluatePassword } from '../services/password-policy'

type PasswordSecurityPanelProps = {
  password: string
  confirmation?: string
  id?: string
}

const strengthLabels = {
  empty: 'Sin evaluar',
  weak: 'Débil',
  fair: 'Mejorable',
  good: 'Adecuada',
  strong: 'Fuerte',
} as const

export default function PasswordSecurityPanel({
  password,
  confirmation,
  id = 'password-security-guidance',
}: PasswordSecurityPanelProps) {
  const evaluation = evaluatePassword(password)
  const confirmationStarted = typeof confirmation === 'string' && confirmation.length > 0
  const confirmationMatches = confirmationStarted && password === confirmation

  return (
    <section
      aria-live="polite"
      className="password-security-panel"
      data-strength={evaluation.level}
      id={id}
    >
      <div className="password-security-heading">
        <strong>Seguridad de la contraseña</strong>
        <span>{strengthLabels[evaluation.level]}</span>
      </div>

      <div
        aria-label={`Nivel de seguridad: ${strengthLabels[evaluation.level]}`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={evaluation.percentage}
        aria-valuetext={strengthLabels[evaluation.level]}
        className="password-strength-meter"
        role="progressbar"
      >
        <span style={{ width: `${evaluation.percentage}%` }} />
      </div>

      <ul className="password-rule-list">
        <li data-valid={evaluation.hasMinimumLength}>12 caracteres como mínimo.</li>
        <li data-valid={evaluation.hasSafeWhitespace}>Sin espacios al inicio ni al final.</li>
        <li data-valid={evaluation.hasRequiredVariety}>
          Usa 20 caracteres o más, o combina al menos tres tipos: mayúsculas, minúsculas, números y símbolos.
        </li>
        {typeof confirmation === 'string' && (
          <li data-valid={confirmationMatches}>La confirmación coincide con la contraseña.</li>
        )}
      </ul>

      <p className="meta password-security-note">
        Una frase larga y difícil de adivinar puede ser más segura y fácil de recordar que una contraseña corta y compleja.
      </p>
    </section>
  )
}
