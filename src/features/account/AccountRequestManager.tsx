'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  cancelMyAccessRequest,
  submitMyAccessRequest,
  type AccountAccessRequest,
  type AccountRole,
} from './services/account-service'
import ProfileCombobox from './ProfileCombobox'
import styles from './account.module.css'
import requestStyles from './account-request.module.css'

const REQUEST_OPTIONS = [
  { value: 'initial_access', label: 'Solicitar acceso inicial' },
  { value: 'role_change', label: 'Solicitar cambio de rol' },
  { value: 'scope_change', label: 'Solicitar cambio de ámbito' },
  { value: 'account_closure', label: 'Solicitar cierre de cuenta' },
] as const

type RequestType = (typeof REQUEST_OPTIONS)[number]['value']

const REQUEST_HELP: Record<RequestType, string> = {
  initial_access: 'Solicita tu primera autorización administrativa dentro de SINEP.',
  role_change: 'Indica el rol actual, el rol solicitado y quién puede confirmar el cambio.',
  scope_change: 'Describe el ámbito territorial, pastoral o institucional que necesitas gestionar.',
  account_closure: 'Explica el motivo del cierre y cualquier información que deba conservarse.',
}

export default function AccountRequestManager({ requests, roles }: { requests: AccountAccessRequest[]; roles: AccountRole[] }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [requestType, setRequestType] = useState<RequestType>(roles.length ? 'role_change' : 'initial_access')
  const [showAdditional, setShowAdditional] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(formData: FormData) {
    setBusyId('new'); setMessage(null); setError(null)
    try {
      await submitMyAccessRequest(supabase, {
        requestType,
        justification: String(formData.get('justification') ?? ''),
        requesterNotes: String(formData.get('requester_notes') ?? ''),
      })
      setMessage('La solicitud fue enviada correctamente.')
      setShowAdditional(false)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo enviar la solicitud.')
    } finally {
      setBusyId(null)
    }
  }

  async function resend(request: AccountAccessRequest, formData: FormData) {
    setBusyId(request.id); setMessage(null); setError(null)
    try {
      await submitMyAccessRequest(supabase, {
        requestId: request.id,
        requestType: request.request_type as RequestType,
        justification: request.justification ?? 'Información complementaria',
        requesterNotes: String(formData.get('requester_notes') ?? ''),
      })
      setMessage('La información adicional fue enviada.')
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo reenviar la solicitud.')
    } finally {
      setBusyId(null)
    }
  }

  async function cancel(requestId: string) {
    setBusyId(requestId); setMessage(null); setError(null)
    try {
      await cancelMyAccessRequest(supabase, requestId)
      setMessage('La solicitud fue cancelada.')
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo cancelar la solicitud.')
    } finally {
      setBusyId(null)
    }
  }

  const actionable = requests.filter((request) => ['submitted', 'information_required'].includes(request.status))

  return (
    <>
      {error ? <p className={styles.formError} role="alert">{error}</p> : null}
      {message ? <p className={styles.formSuccess} role="status">{message}</p> : null}

      <section className={`${styles.panel} ${requestStyles.requestPanel}`} aria-labelledby="new-request-title">
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.eyebrow}>Nuevo trámite</p>
            <h2 id="new-request-title">Crear una solicitud</h2>
            <p className={requestStyles.intro}>Completa la información esencial. Podrás dar seguimiento desde esta misma página.</p>
          </div>
        </div>
        <form action={submit} className={requestStyles.requestForm}>
          <div className={requestStyles.field}>
            <span id="request-type-label">Tipo de solicitud</span>
            <ProfileCombobox
              ariaLabel="Tipo de solicitud"
              id="request-type"
              onChange={(value) => setRequestType(value as RequestType)}
              options={[...REQUEST_OPTIONS]}
              value={requestType}
            />
            <small>{REQUEST_HELP[requestType]}</small>
          </div>

          <label className={requestStyles.field}>
            <span>Motivo <em>Obligatorio</em></span>
            <textarea
              maxLength={1200}
              minLength={20}
              name="justification"
              placeholder="Describe qué necesitas, el ámbito relacionado y quién puede validar la solicitud."
              required
              rows={4}
            />
            <small>Mínimo 20 caracteres. Evita incluir contraseñas o información sensible.</small>
          </label>

          <div className={requestStyles.optionalSection}>
            <button
              aria-expanded={showAdditional}
              className={requestStyles.optionalToggle}
              onClick={() => setShowAdditional((current) => !current)}
              type="button"
            >
              <span>Información adicional <small>Opcional</small></span>
              <span aria-hidden="true">{showAdditional ? '−' : '+'}</span>
            </button>
            {showAdditional ? (
              <label className={requestStyles.field}>
                <span className="sr-only">Información adicional</span>
                <textarea
                  maxLength={2000}
                  name="requester_notes"
                  placeholder="Agrega referencias, fechas, nombres de responsables u otros datos que faciliten la revisión."
                  rows={3}
                />
              </label>
            ) : null}
          </div>

          <div className={requestStyles.submitRow}>
            <p>La solicitud será revisada por un administrador autorizado.</p>
            <button disabled={busyId !== null} type="submit">
              {busyId === 'new' ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          </div>
        </form>
      </section>

      {actionable.map((request) => (
        <section className={styles.panel} key={request.id} aria-labelledby={`request-action-${request.id}`}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Acción disponible</p>
              <h2 id={`request-action-${request.id}`}>{request.status === 'information_required' ? 'Aportar información' : 'Solicitud enviada'}</h2>
            </div>
          </div>
          {request.status === 'information_required' ? (
            <form action={(formData) => resend(request, formData)} className={requestStyles.requestForm}>
              <p>{request.reviewer_notes || 'El equipo revisor solicitó información adicional.'}</p>
              <label className={requestStyles.field}>
                <span>Respuesta</span>
                <textarea maxLength={2000} minLength={10} name="requester_notes" required rows={4} />
              </label>
              <div className={requestStyles.inlineActions}>
                <button disabled={busyId !== null} type="submit">Reenviar solicitud</button>
                <button disabled={busyId !== null} onClick={() => cancel(request.id)} type="button">Cancelar trámite</button>
              </div>
            </form>
          ) : (
            <div className={requestStyles.inlineActions}>
              <button disabled={busyId !== null} onClick={() => cancel(request.id)} type="button">Cancelar solicitud</button>
            </div>
          )}
        </section>
      ))}
    </>
  )
}
