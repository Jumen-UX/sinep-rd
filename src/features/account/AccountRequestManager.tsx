'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  cancelMyAccessRequest,
  listAccountRequestScopes,
  submitMyAccessRequest,
  type AccountAccessRequest,
  type AccountRequestOptions,
  type AccountRequestScopeOption,
  type AccountRole,
  type AccountScopeType,
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
  initial_access: 'Solicita tu primera autorización administrativa dentro de un país habilitado en SINEP.',
  role_change: 'Selecciona el país y el rol que necesitas. La aprobación no asigna el rol automáticamente.',
  scope_change: 'Selecciona el país y el ámbito territorial, pastoral o institucional que necesitas gestionar.',
  account_closure: 'El cierre será revisado por un superadministrador o por un administrador nacional del país seleccionado.',
}

const SCOPE_OPTIONS: Array<{ value: AccountScopeType; label: string }> = [
  { value: 'national', label: 'Ámbito nacional' },
  { value: 'diocese', label: 'Diócesis o arquidiócesis' },
  { value: 'vicariate', label: 'Vicaría' },
  { value: 'zone', label: 'Zona pastoral' },
  { value: 'parish', label: 'Parroquia o cuasiparroquia' },
  { value: 'pastoral_area', label: 'Área pastoral' },
  { value: 'organization_unit', label: 'Unidad organizativa' },
  { value: 'entity', label: 'Otra entidad eclesiástica' },
]

export default function AccountRequestManager({
  requests,
  roles,
  requestOptions,
}: {
  requests: AccountAccessRequest[]
  roles: AccountRole[]
  requestOptions: AccountRequestOptions
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const defaultCountry = requestOptions.countries.some((country) => country.iso2 === 'DO')
    ? 'DO'
    : requestOptions.countries[0]?.iso2 ?? ''

  const [requestType, setRequestType] = useState<RequestType>(roles.length ? 'role_change' : 'initial_access')
  const [countryIso2, setCountryIso2] = useState(defaultCountry)
  const [requestedRoleId, setRequestedRoleId] = useState(requestOptions.roles[0]?.id ?? '')
  const [scopeType, setScopeType] = useState<AccountScopeType>('national')
  const [scopeOptions, setScopeOptions] = useState<AccountRequestScopeOption[]>([])
  const [requestedScopeId, setRequestedScopeId] = useState('')
  const [scopeLoading, setScopeLoading] = useState(false)
  const [scopeError, setScopeError] = useState<string | null>(null)
  const [showAdditional, setShowAdditional] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const countryOptions = requestOptions.countries.map((country) => ({
    value: country.iso2,
    label: `${country.flag_emoji ? `${country.flag_emoji} ` : ''}${country.name}`,
    keywords: country.iso2,
  }))
  const roleOptions = requestOptions.roles.map((role) => ({ value: role.id, label: role.name, keywords: role.key }))

  useEffect(() => {
    if (requestType !== 'scope_change' || !countryIso2 || scopeType === 'national') {
      setScopeOptions([])
      setRequestedScopeId('')
      setScopeError(null)
      setScopeLoading(false)
      return
    }

    let cancelled = false
    setScopeLoading(true)
    setScopeError(null)

    listAccountRequestScopes(supabase, countryIso2, scopeType)
      .then((options) => {
        if (cancelled) return
        setScopeOptions(options)
        setRequestedScopeId((current) => options.some((option) => option.id === current) ? current : options[0]?.id ?? '')
      })
      .catch((caught) => {
        if (cancelled) return
        setScopeOptions([])
        setRequestedScopeId('')
        setScopeError(caught instanceof Error ? caught.message : 'No se pudieron cargar los ámbitos disponibles.')
      })
      .finally(() => {
        if (!cancelled) setScopeLoading(false)
      })

    return () => { cancelled = true }
  }, [countryIso2, requestType, scopeType, supabase])

  const requiresScopeTarget = requestType === 'scope_change' && scopeType !== 'national'
  const canSubmit = Boolean(countryIso2)
    && (requestType !== 'role_change' || Boolean(requestedRoleId))
    && (!requiresScopeTarget || Boolean(requestedScopeId))

  async function submit(formData: FormData) {
    setBusyId('new'); setMessage(null); setError(null)
    if (!canSubmit) {
      setBusyId(null)
      setError('Completa el país y el destino específico de la solicitud antes de enviarla.')
      return
    }

    try {
      await submitMyAccessRequest(supabase, {
        requestType,
        countryIso2,
        requestedRoleId: requestType === 'role_change' ? requestedRoleId : null,
        requestedScopeType: requestType === 'scope_change' ? scopeType : null,
        requestedScopeId: requestType === 'scope_change' && scopeType !== 'national' ? requestedScopeId : null,
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
    if (request.request_type === 'person_link') return
    setBusyId(request.id); setMessage(null); setError(null)
    try {
      await submitMyAccessRequest(supabase, {
        requestId: request.id,
        requestType: request.request_type,
        countryIso2: request.requested_country_iso2 ?? countryIso2,
        requestedRoleId: request.requested_role_id,
        requestedScopeType: request.requested_scope_type,
        requestedScopeId: request.requested_scope_id,
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

  const actionable = requests.filter((request) =>
    request.request_type !== 'person_link' && ['submitted', 'information_required'].includes(request.status),
  )

  return (
    <>
      {error ? <p className={styles.formError} role="alert">{error}</p> : null}
      {message ? <p className={styles.formSuccess} role="status">{message}</p> : null}

      <section className={`${styles.panel} ${requestStyles.requestPanel}`} aria-labelledby="new-request-title">
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.eyebrow}>Nuevo trámite</p>
            <h2 id="new-request-title">Crear una solicitud</h2>
            <p className={requestStyles.intro}>Completa la información esencial. El país seleccionado determina qué administración nacional puede revisar el trámite.</p>
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

          <div className={requestStyles.field}>
            <span>País <em>Obligatorio</em></span>
            {countryOptions.length ? (
              <ProfileCombobox
                ariaLabel="País de la solicitud"
                id="request-country"
                onChange={setCountryIso2}
                options={countryOptions}
                searchable
                searchPlaceholder="Buscar país…"
                value={countryIso2}
              />
            ) : <p role="alert">No hay países habilitados para solicitudes.</p>}
            <small>El país define el ámbito territorial de revisión.</small>
          </div>

          {requestType === 'role_change' ? (
            <div className={requestStyles.field}>
              <span>Rol solicitado <em>Obligatorio</em></span>
              {roleOptions.length ? (
                <ProfileCombobox
                  ariaLabel="Rol solicitado"
                  id="request-role"
                  onChange={setRequestedRoleId}
                  options={roleOptions}
                  searchable
                  searchPlaceholder="Buscar rol…"
                  value={requestedRoleId}
                />
              ) : <p role="alert">No hay roles disponibles para solicitar.</p>}
              <small>El rol Superadministrador no puede solicitarse por autoservicio.</small>
            </div>
          ) : null}

          {requestType === 'scope_change' ? (
            <>
              <div className={requestStyles.field}>
                <span>Tipo de ámbito <em>Obligatorio</em></span>
                <ProfileCombobox
                  ariaLabel="Tipo de ámbito solicitado"
                  id="request-scope-type"
                  onChange={(value) => setScopeType(value as AccountScopeType)}
                  options={SCOPE_OPTIONS}
                  value={scopeType}
                />
              </div>

              {scopeType !== 'national' ? (
                <div className={requestStyles.field}>
                  <span>Ámbito solicitado <em>Obligatorio</em></span>
                  {scopeLoading ? <p role="status">Cargando ámbitos vigentes…</p> : null}
                  {!scopeLoading && scopeOptions.length ? (
                    <ProfileCombobox
                      ariaLabel="Ámbito solicitado"
                      emptyMessage="No hay ámbitos disponibles."
                      id="request-scope"
                      onChange={setRequestedScopeId}
                      options={scopeOptions.map((option) => ({ value: option.id, label: option.name }))}
                      searchable
                      searchPlaceholder="Buscar ámbito…"
                      value={requestedScopeId}
                    />
                  ) : null}
                  {!scopeLoading && !scopeOptions.length && !scopeError ? (
                    <p role="status">No hay ámbitos vigentes y públicos de este tipo para el país seleccionado.</p>
                  ) : null}
                  {scopeError ? <p role="alert">{scopeError}</p> : null}
                </div>
              ) : (
                <p className={requestStyles.intro}>El país seleccionado será el ámbito solicitado.</p>
              )}
            </>
          ) : null}

          <label className={requestStyles.field}>
            <span>Motivo <em>Obligatorio</em></span>
            <textarea
              maxLength={1200}
              minLength={20}
              name="justification"
              placeholder="Describe qué necesitas y quién puede validar la solicitud."
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
            <p>La solicitud será revisada por un administrador con permiso y alcance territorial válidos.</p>
            <button disabled={busyId !== null || !canSubmit} type="submit">
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
