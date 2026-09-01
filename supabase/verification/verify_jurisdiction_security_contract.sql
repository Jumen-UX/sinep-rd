do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname like 'admin_%jurisdiction%'
    and p.prosecdef;
  if v_count <> 0 then
    raise exception 'Hay % funciones jurisdiccionales públicas SECURITY DEFINER', v_count;
  end if;

  select count(*) into v_count
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname like 'admin_%jurisdiction%'
    and has_function_privilege('anon',p.oid,'EXECUTE');
  if v_count <> 0 then
    raise exception 'Hay % funciones jurisdiccionales públicas ejecutables por anon', v_count;
  end if;

  if app_private.audit_permission_for_action('jurisdiction.create') <> 'jurisdictions.manage'
     or app_private.audit_permission_for_action('jurisdiction.suppression') <> 'jurisdictions.manage'
     or app_private.audit_permission_for_action('jurisdiction.administrative_correction') <> 'jurisdictions.manage' then
    raise exception 'El mapeo de auditoría jurisdiccional no usa jurisdictions.manage';
  end if;

  if not exists (
    select 1 from pg_class c
    where c.oid='public.public_countries'::regclass
      and 'security_invoker=true'=any(coalesce(c.reloptions,array[]::text[]))
  ) then
    raise exception 'public_countries no está configurada como security_invoker';
  end if;

  select count(*) into v_count
  from pg_policies
  where schemaname='public'
    and policyname in (
      'jurisdiction_change_operations_deny_direct',
      'jurisdiction_change_operation_accounts_deny_direct',
      'jurisdiction_change_effects_deny_direct'
    );
  if v_count <> 3 then
    raise exception 'Faltan políticas deny-direct en tablas operativas jurisdiccionales';
  end if;
end$$;

select p.key,r.key as role_key
from public.permissions p
join public.role_permissions rp on rp.permission_id=p.id
join public.roles r on r.id=rp.role_id
where p.key='jurisdictions.manage'
order by r.key;
