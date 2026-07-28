create or replace function public.current_user_can(
  p_permission_key text,
  p_scope_type text default 'national',
  p_scope_entity_id uuid default null,
  p_diocese_id uuid default null,
  p_pastoral_area_id uuid default null,
  p_organization_unit_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog','public','app_private','auth','pg_temp'
as $$
  select app_private.current_user_can_manage_scope(
    p_permission_key,p_scope_type,p_scope_entity_id,p_diocese_id,
    p_pastoral_area_id,p_organization_unit_id,null
  );
$$;

revoke all on function public.current_user_can(text,text,uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.current_user_can(text,text,uuid,uuid,uuid,uuid) to authenticated;

comment on function public.current_user_can(text,text,uuid,uuid,uuid,uuid)
is 'Fachada de compatibilidad segura: despacha por permiso y alcance tipado; no concede alcance nacional sin entidad país.';