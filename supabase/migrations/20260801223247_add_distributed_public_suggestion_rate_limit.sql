create table if not exists public.public_suggestion_rate_limits (
  fingerprint text primary key,
  burst_window_started_at timestamptz not null,
  burst_request_count integer not null,
  daily_window_started_at timestamptz not null,
  daily_request_count integer not null,
  updated_at timestamptz not null default now(),
  constraint public_suggestion_rate_limits_fingerprint_check
    check (fingerprint ~ '^[0-9a-f]{64}$'),
  constraint public_suggestion_rate_limits_burst_count_check
    check (burst_request_count >= 0),
  constraint public_suggestion_rate_limits_daily_count_check
    check (daily_request_count >= 0)
);

create index if not exists public_suggestion_rate_limits_updated_at_idx
  on public.public_suggestion_rate_limits (updated_at);

alter table public.public_suggestion_rate_limits enable row level security;
alter table public.public_suggestion_rate_limits force row level security;

revoke all on table public.public_suggestion_rate_limits from public, anon, authenticated;

-- Las sugerencias deben atravesar la ruta de servidor que consume el límite
-- distribuido. Mantener INSERT directo permitiría evadirlo con la clave pública.
revoke insert on table public.public_change_suggestions from anon, authenticated;
drop policy if exists public_change_suggestions_public_insert
  on public.public_change_suggestions;

create or replace function public.consume_public_suggestion_rate_limit(
  p_fingerprint text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_burst_window timestamptz;
  v_daily_window timestamptz;
  v_accepted boolean := false;
  v_current public.public_suggestion_rate_limits%rowtype;
  v_retry_after integer;
begin
  if current_user <> 'service_role' then
    raise insufficient_privilege using
      message = 'Solo el servicio de sugerencias puede consumir este límite.';
  end if;

  if p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' then
    raise invalid_parameter_value using
      message = 'La huella del límite no es válida.';
  end if;

  v_burst_window := date_bin(
    interval '15 minutes',
    v_now,
    timestamptz '2000-01-01 00:00:00+00'
  );
  v_daily_window := date_bin(
    interval '1 day',
    v_now,
    timestamptz '2000-01-01 00:00:00+00'
  );

  insert into public.public_suggestion_rate_limits (
    fingerprint,
    burst_window_started_at,
    burst_request_count,
    daily_window_started_at,
    daily_request_count,
    updated_at
  ) values (
    p_fingerprint,
    v_burst_window,
    1,
    v_daily_window,
    1,
    v_now
  )
  on conflict (fingerprint) do update
  set burst_window_started_at = excluded.burst_window_started_at,
      burst_request_count = case
        when public.public_suggestion_rate_limits.burst_window_started_at < excluded.burst_window_started_at
          then 1
        else public.public_suggestion_rate_limits.burst_request_count + 1
      end,
      daily_window_started_at = excluded.daily_window_started_at,
      daily_request_count = case
        when public.public_suggestion_rate_limits.daily_window_started_at < excluded.daily_window_started_at
          then 1
        else public.public_suggestion_rate_limits.daily_request_count + 1
      end,
      updated_at = excluded.updated_at
  where (
      public.public_suggestion_rate_limits.burst_window_started_at < excluded.burst_window_started_at
      or public.public_suggestion_rate_limits.burst_request_count < 5
    )
    and (
      public.public_suggestion_rate_limits.daily_window_started_at < excluded.daily_window_started_at
      or public.public_suggestion_rate_limits.daily_request_count < 20
    )
  returning true into v_accepted;

  if coalesce(v_accepted, false) then
    -- Limpieza acotada y respaldada por índice; una fila por huella evita crecer
    -- por cada solicitud o ventana.
    if random() < 0.01 then
      delete from public.public_suggestion_rate_limits
      where updated_at < v_now - interval '35 days';
    end if;

    return jsonb_build_object(
      'allowed', true,
      'retry_after_seconds', 0
    );
  end if;

  select *
  into v_current
  from public.public_suggestion_rate_limits
  where fingerprint = p_fingerprint;

  v_retry_after := greatest(
    case
      when v_current.burst_window_started_at = v_burst_window
        and v_current.burst_request_count >= 5
      then ceil(extract(epoch from (
        v_burst_window + interval '15 minutes' - v_now
      )))::integer
      else 0
    end,
    case
      when v_current.daily_window_started_at = v_daily_window
        and v_current.daily_request_count >= 20
      then ceil(extract(epoch from (
        v_daily_window + interval '1 day' - v_now
      )))::integer
      else 0
    end,
    1
  );

  return jsonb_build_object(
    'allowed', false,
    'retry_after_seconds', v_retry_after
  );
end;
$$;

revoke all on function public.consume_public_suggestion_rate_limit(text)
  from public, anon, authenticated;
grant execute on function public.consume_public_suggestion_rate_limit(text)
  to service_role;

comment on table public.public_suggestion_rate_limits is
  'Contadores distribuidos y seudonimizados para limitar sugerencias públicas.';

comment on function public.consume_public_suggestion_rate_limit(text) is
  'Consume de forma atómica los límites de 5 sugerencias por 15 minutos y 20 por día.';

do $$
begin
  if has_table_privilege('anon', 'public.public_change_suggestions', 'INSERT')
    or has_table_privilege('authenticated', 'public.public_change_suggestions', 'INSERT') then
    raise exception 'La inserción pública directa de sugerencias continúa habilitada';
  end if;

  if has_table_privilege('anon', 'public.public_suggestion_rate_limits', 'SELECT')
    or has_table_privilege('authenticated', 'public.public_suggestion_rate_limits', 'SELECT') then
    raise exception 'Los contadores de sugerencias son visibles para roles públicos';
  end if;

  if has_function_privilege(
    'anon',
    'public.consume_public_suggestion_rate_limit(text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.consume_public_suggestion_rate_limit(text)',
    'EXECUTE'
  ) then
    raise exception 'El RPC de límite puede invocarse sin service_role';
  end if;
end;
$$;
