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

export default function AccountRequestManager({ requests, roles }: { requests: AccountAccessRequest[]; roles: AccountRole[] }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [requestType, setRequestType] = useState<RequestType>(roles.length ? 'role_change' : 'initial_access')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(formData: FormData) {
    setBusyId('new'); setMessage(null); setError(null)
    try {
      await submitMyAccessRequest(supabase, { requestType, justification: String(formData.get('justification') ?? ''), requesterNotes: String(formData.get('requester_notes') ?? '') })
      setMessage('La solicitud fue enviada correctamente.')
      router.refresh()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo enviar la solicitud.') } finally { setBusyId(null) }
  }

  async function resend(request: AccountAccessRequest, formData: FormData) {
    setBusyId(request.id); setMessage(null); setError(null)
    try {
      await submitMyAccessRequest(supabase, { requestId: request.id, requestType: request.request_type as RequestType, justification: request.justification ?? 'Información complementaria', requesterNotes: String(formData.get('requester_notes') ?? '') })
      setMessage('La información adicional fue enviada.')
      router.refresh()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo reenviar la solicitud.') } finally { setBusyId(null) }
  }

  async function cancel(requestId: string) {
    setBusyId(requestId); setMessage(null); setError(null)
    try {
      await cancelMyAccessRequest(supabase, requestId)
      setMessage('La solicitud fue cancelada.')
      router.refresh()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo cancelar la solicitud.') } finally { setBusyId(null) }
  }

  const actionable = requests.filter((request) => ['submitted', 'information_required'].includes(request.status))

  return (
    <>
      {error ? <p className={styles.formError} role="alert">{error}</p> : null}
      {message ? <p className={styles.formSuccess} role="status">{message}</p> : null}

      <section className={styles.panel} aria-labelledby="new-request-title">
        <div className={styles.panelHeader}><div><p className={styles.eyebrow}>Nuevo trámite</p><h2 id="new-request-title">Crear una solicitud</h2></div></div>
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
          </div>
          <label><span>Motivo</span><textarea maxLength={1200} minLength={20} name="justification" required rows={5} /><small>Explica qué necesitas, para qué ámbito y quién puede validar la solicitud.</small></label>
          <label><span>Información adicional</span><textarea maxLength={2000} name="requester_notes" rows={4} /></label>
          <div className={styles.formActions}><button disabled={busyId !== null} type="submit">{busyId === 'new' ? 'Enviando…' : 'Enviar solicitud'}</button></div>
        </form>
      </section>

      {actionable.map((request) => (
        <section className={styles.panel} key={request.id} aria-labelledby={`request-action-${request.id}`}>
          <div className={styles.panelHeader}><div><p className={styles.eyebrow}>Acción disponible</p><h2 id={`request-action-${request.id}`}>{request.status === 'information_required' ? 'Aportar información' : 'Solicitud enviada'}</h2></div></div>
          {request.status === 'information_required' ? (
            <form action={(formData) => resend(request, formData)} className={requestStyles.requestForm}>
              <p>{request.reviewer_notes || 'El equipo revisor solicitó información adicional.'}</p>
              <label><span>Respuesta</span><textarea maxLength={2000} minLength={10} name="requester_notes" required rows={4} /></label>
              <div className={requestStyles.inlineActions}><button disabled={busyId !== null} type="submit">Reenviar solicitud</button><button disabled={busyId !== null} onClick={() => cancel(request.id)} type="button">Cancelar trámite</button></div>
            </form>
          ) : <div className={requestStyles.inlineActions}><button disabled={busyId !== null} onClick={() => cancel(request.id)} type="button">Cancelar solicitud</button></div>}
        </section>
      ))}
    </>
  )
}
