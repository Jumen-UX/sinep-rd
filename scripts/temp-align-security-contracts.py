from pathlib import Path

GUARD = r"""import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const roots = ['src', 'tests']
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs'])
const patterns = [/pastoral_entity/i, /PastoralEntity/, /pastoralEntities/]
const findings = []

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      await walk(absolute)
      continue
    }
    if (!extensions.has(path.extname(entry.name))) continue
    const content = await readFile(absolute, 'utf8')
    content.split(/\r?\n/).forEach((line, index) => {
      if (patterns.some((pattern) => pattern.test(line))) {
        findings.push(`${absolute}:${index + 1}: ${line.trim()}`)
      }
    })
  }
}

for (const root of roots) await walk(root)

if (findings.length > 0) {
  console.error('Se encontraron referencias al modelo pastoral heredado:')
  findings.forEach((finding) => console.error(`- ${finding}`))
  process.exit(1)
}

console.log('No se encontraron referencias al modelo pastoral heredado.')
"""

MIGRATION = r"""create or replace function app_private.current_user_can_publish_assignment_person(p_assignment_id uuid)
returns boolean
language plpgsql
stable security definer
set search_path to 'public','app_private','auth','pg_temp'
as $function$
declare
  v_assignment public.position_assignments%rowtype;
begin
  if auth.uid() is null or p_assignment_id is null then
    return false;
  end if;

  select * into v_assignment
  from public.position_assignments
  where id=p_assignment_id;

  if not found or v_assignment.person_id is null then
    return false;
  end if;

  if v_assignment.ecclesiastical_entity_id is not null then
    return app_private.current_user_can_manage_entity(
      'people.publish',
      v_assignment.ecclesiastical_entity_id
    );
  end if;

  if v_assignment.organization_unit_id is not null then
    return public.current_user_has_permission('people.publish')
       and public.current_user_has_scope_access(
         'organization_unit',
         v_assignment.organization_unit_id,
         null,
         null,
         v_assignment.organization_unit_id
       );
  end if;

  return public.current_user_is_super_or_national()
     and public.current_user_has_permission('people.publish');
end;
$function$;

revoke all on function app_private.current_user_can_publish_assignment_person(uuid) from public,anon,authenticated;

create or replace function app_private.admin_list_recent_audit_logs(p_limit integer default 100)
returns table(
  id uuid,
  actor_user_id uuid,
  actor_email text,
  actor_name text,
  action text,
  target_table text,
  target_id uuid,
  change_request_id uuid,
  created_at timestamptz
)
language plpgsql
stable security definer
set search_path to 'public','app_private','auth','pg_temp'
as $function$
begin
  if auth.uid() is null or not (
    app_private.current_user_has_permission('audit.view')
    or app_private.current_user_has_permission('security.view')
    or app_private.current_user_is_super_or_national()
  ) then
    raise exception 'No autorizado para ver auditoría' using errcode='42501';
  end if;

  return query
  select
    al.id,
    al.user_id,
    p.email::text,
    p.full_name::text,
    al.action,
    al.target_table,
    al.target_id,
    al.change_request_id,
    al.created_at
  from public.audit_logs al
  left join public.profiles p on p.id=al.user_id
  where app_private.current_user_is_super_or_national()
     or (
       al.scope_entity_id is not null
       and app_private.current_user_can_manage_entity('audit.view',al.scope_entity_id)
     )
     or (
       al.scope_type='organization_unit'
       and app_private.current_user_has_scope_access(
         'organization_unit',
         al.organization_unit_id,
         al.diocese_id,
         al.pastoral_area_id,
         al.organization_unit_id
       )
     )
     or (
       al.scope_type='pastoral_area'
       and app_private.current_user_has_scope_access(
         'pastoral_area',
         al.pastoral_area_id,
         al.diocese_id,
         al.pastoral_area_id,
         null
       )
     )
  order by al.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),250));
end;
$function$;

revoke all on function app_private.admin_list_recent_audit_logs(integer) from public,anon,authenticated;
"""

Path('scripts/check-no-legacy-pastoral.mjs').write_text(GUARD, encoding='utf-8')
Path('supabase/migrations/20260714022000_reassert_organization_unit_security_contracts.sql').write_text(MIGRATION, encoding='utf-8')

canonical = "../supabase/migrations/20260714022000_reassert_organization_unit_security_contracts.sql"
audit_path = Path('tests/audit-permission-scope-contract.test.mjs')
audit = audit_path.read_text(encoding='utf-8')
anchor = "  new URL('../supabase/migrations/20260713160611_seal_review_queue_private_rpc.sql', import.meta.url),"
addition = f"  new URL('{canonical}', import.meta.url),"
if addition not in audit:
    audit = audit.replace(anchor, anchor + '\n' + addition)
audit_path.write_text(audit, encoding='utf-8')

review_path = Path('tests/review-security-contracts.test.mjs')
review = review_path.read_text(encoding='utf-8')
old = "  const sql = await readRepoFile('supabase/migrations/20260710163459_harden_review_person_publication_scope.sql')"
replacement = "  const sql = `${await readRepoFile('supabase/migrations/20260714022000_reassert_organization_unit_security_contracts.sql')}\\n${await readRepoFile('supabase/migrations/20260710163459_harden_review_person_publication_scope.sql')}`"
review = review.replace(old, replacement, 1)
review_path.write_text(review, encoding='utf-8')
