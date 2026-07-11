-- The preceding noop migration uses array_agg(uuid)[1] instead of min(uuid).
-- PostgreSQL does not provide min(uuid) in the supported environment.
-- This migration is intentionally idempotent and guards the final deployed contract.
do $$
begin
  if to_regprocedure('app_private.promote_exact_import_matches_to_noop(uuid)') is null then
    raise exception 'promote_exact_import_matches_to_noop(uuid) is required';
  end if;
end;
$$;