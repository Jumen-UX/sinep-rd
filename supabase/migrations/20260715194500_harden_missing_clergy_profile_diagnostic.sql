-- Mueve la implementación privilegiada del diagnóstico fuera del esquema expuesto.

create or replace function internal.admin_count_missing_clergy_profiles()
returns bigint
language sql
stable
security definer
set search_path = public, internal, app_private, auth, pg_temp
as $$
  select count(distinct oe.person_id)
  from public.ordination_events oe
  join public.persons p
    on p.id = oe.person_id
   and p.status = 'active'
  left join public.clergy_profiles cp
    on cp.person_id = oe.person_id
  where oe.record_status = 'active'
    and oe.degree in ('diaconate', 'presbyterate', 'episcopate')
    and cp.person_id is null
    and auth.uid() is not null
    and (
      public.current_user_is_super_or_national()
      or app_private.current_user_can_manage_person('people.view_private', oe.person_id)
    );
$$;

revoke all on function internal.admin_count_missing_clergy_profiles() from public;
revoke all on function internal.admin_count_missing_clergy_profiles() from anon;
grant execute on function internal.admin_count_missing_clergy_profiles() to authenticated;

create or replace function public.admin_count_missing_clergy_profiles()
returns bigint
language sql
stable
security invoker
set search_path = public, internal, app_private, auth, pg_temp
as $$
  select internal.admin_count_missing_clergy_profiles();
$$;

revoke all on function public.admin_count_missing_clergy_profiles() from public;
revoke all on function public.admin_count_missing_clergy_profiles() from anon;
grant execute on function public.admin_count_missing_clergy_profiles() to authenticated;

comment on function internal.admin_count_missing_clergy_profiles() is
  'Implementación privada y acotada del diagnóstico de perfiles clericales faltantes.';

comment on function public.admin_count_missing_clergy_profiles() is
  'Fachada invocadora autenticada para contar perfiles clericales faltantes dentro del alcance administrativo.';
