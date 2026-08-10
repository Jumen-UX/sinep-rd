-- Read-only administrative projections for the current jurisdiction organigram.
-- The admin editor always operates on the present structure; historical regression is out of phase 1.

create or replace function public.admin_list_current_jurisdiction_tree()
returns table(
  account_id uuid,
  ecclesiastical_entity_id uuid,
  account_code text,
  name text,
  official_name text,
  latin_name text,
  slug text,
  account_type_key text,
  account_type_name text,
  parent_account_id uuid,
  parent_name text,
  relationship_type text,
  current_edge_id uuid,
  depth integer,
  path_ids uuid[],
  path_names text[],
  canonical_status text,
  visibility text,
  sort_order integer,
  valid_from date,
  updated_at timestamptz,
  cathedral_name text,
  territory_summary text,
  description text,
  source_name text,
  source_url text,
  source_checked_at date,
  notes text
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if auth.uid() is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para consultar el organigrama jurisdiccional' using errcode='42501';
  end if;

  return query
  with recursive tree as (
    select
      account.id account_id,
      account.ecclesiastical_entity_id,
      account.account_code,
      entity.name,
      entity.official_name,
      entity.latin_name,
      entity.slug,
      type.key account_type_key,
      type.name account_type_name,
      null::uuid parent_account_id,
      null::text parent_name,
      null::text relationship_type,
      null::uuid current_edge_id,
      0 depth,
      array[account.id]::uuid[] path_ids,
      array[entity.name]::text[] path_names,
      account.canonical_status,
      account.visibility,
      account.sort_order,
      account.valid_from,
      greatest(account.updated_at, entity.updated_at) updated_at,
      entity.cathedral_name,
      entity.territory_summary,
      entity.description,
      entity.source_name,
      entity.source_url,
      entity.source_checked_at,
      account.notes
    from public.jurisdiction_accounts account
    join public.ecclesiastical_entities entity on entity.id=account.ecclesiastical_entity_id
    join public.entity_types type on type.id=entity.entity_type_id
    where account.is_current and account.status='active'
      and not exists(
        select 1 from public.jurisdiction_account_edges edge
        where edge.child_account_id=account.id and edge.is_current and edge.status='active'
      )

    union all

    select
      child.id,
      child.ecclesiastical_entity_id,
      child.account_code,
      child_entity.name,
      child_entity.official_name,
      child_entity.latin_name,
      child_entity.slug,
      child_type.key,
      child_type.name,
      parent.account_id,
      parent.name,
      edge.relationship_type,
      edge.id,
      parent.depth+1,
      parent.path_ids||child.id,
      parent.path_names||child_entity.name,
      child.canonical_status,
      child.visibility,
      child.sort_order,
      child.valid_from,
      greatest(child.updated_at, child_entity.updated_at),
      child_entity.cathedral_name,
      child_entity.territory_summary,
      child_entity.description,
      child_entity.source_name,
      child_entity.source_url,
      child_entity.source_checked_at,
      child.notes
    from tree parent
    join public.jurisdiction_account_edges edge
      on edge.parent_account_id=parent.account_id and edge.is_current and edge.status='active'
    join public.jurisdiction_accounts child
      on child.id=edge.child_account_id and child.is_current and child.status='active'
    join public.ecclesiastical_entities child_entity on child_entity.id=child.ecclesiastical_entity_id
    join public.entity_types child_type on child_type.id=child_entity.entity_type_id
    where not child.id=any(parent.path_ids)
  )
  select tree.* from tree
  order by tree.path_names, tree.sort_order, tree.name;
end;
$$;

create or replace function public.admin_list_restorable_jurisdictions()
returns table(
  account_id uuid,
  ecclesiastical_entity_id uuid,
  account_code text,
  name text,
  account_type_key text,
  account_type_name text,
  canonical_status text,
  valid_to date,
  suppressed_at date
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if auth.uid() is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para consultar jurisdicciones históricas' using errcode='42501';
  end if;

  return query
  select account.id, account.ecclesiastical_entity_id, account.account_code, entity.name,
         type.key, type.name, account.canonical_status, account.valid_to, entity.suppressed_at
  from public.jurisdiction_accounts account
  join public.ecclesiastical_entities entity on entity.id=account.ecclesiastical_entity_id
  join public.entity_types type on type.id=entity.entity_type_id
  where not account.is_current
    and account.status in ('inactive','archived')
    and (account.canonical_status='suppressed' or entity.status='suppressed')
  order by entity.name;
end;
$$;

revoke execute on function public.admin_list_current_jurisdiction_tree() from public, anon;
revoke execute on function public.admin_list_restorable_jurisdictions() from public, anon;
grant execute on function public.admin_list_current_jurisdiction_tree() to authenticated;
grant execute on function public.admin_list_restorable_jurisdictions() to authenticated;

comment on function public.admin_list_current_jurisdiction_tree() is 'Administrative current-only jurisdiction organigram projection. No historical date parameter by design.';
