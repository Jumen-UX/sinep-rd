begin;

create or replace function app_private.validate_import_batch_with_contract(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_summary jsonb;
  v_import_type text;
  v_status text;
begin
  select import_type, status
    into v_import_type, v_status
  from public.import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'El lote de importación no existe.' using errcode = 'P0002';
  end if;

  if v_status in ('applying', 'applied', 'cancelled') then
    raise exception 'El lote ya no admite revalidación.' using errcode = '22023';
  end if;

  v_summary := app_private.validate_import_batch(p_batch_id);

  if v_import_type = 'personas' then
    return app_private.finalize_person_import_validation(p_batch_id);
  end if;

  return v_summary;
end;
$$;

revoke all on function app_private.validate_import_batch_with_contract(uuid) from public, anon;
grant execute on function app_private.validate_import_batch_with_contract(uuid) to authenticated;

commit;