alter table public.office_configurations
  add column if not exists required_ordination_degree text not null default 'none',
  add column if not exists allowed_episcopal_role_types text[] not null default '{}'::text[],
  add column if not exists allowed_clerical_statuses text[] not null default array['active','retired','emeritus','unknown']::text[],
  add column if not exists holder_cardinality text not null default 'single',
  add column if not exists max_current_holders integer default 1;

update public.office_configurations oc
set allowed_person_types = array(
  select distinct case when value = 'lay' then 'layperson' else value end
  from unnest(oc.allowed_person_types) value
)
where 'lay' = any(oc.allowed_person_types);

alter table public.office_configurations
  alter column allowed_person_types set default array['bishop','priest','deacon','religious','layperson']::text[];

alter table public.office_configurations
  add constraint office_configurations_required_ordination_degree_check
    check (required_ordination_degree in ('none','diaconate','presbyterate','episcopate')),
  add constraint office_configurations_allowed_person_types_check
    check (allowed_person_types <@ array['bishop','priest','deacon','religious','layperson']::text[]),
  add constraint office_configurations_allowed_episcopal_roles_check
    check (allowed_episcopal_role_types <@ array['diocesan','auxiliary','coadjutor','titular','emeritus','apostolic_administrator','apostolic_vicar','apostolic_prefect','other']::text[]),
  add constraint office_configurations_allowed_clerical_statuses_check
    check (allowed_clerical_statuses <@ array['active','retired','emeritus','suspended','restricted','inactive','deceased','lost_clerical_state','unknown']::text[]),
  add constraint office_configurations_holder_cardinality_check
    check (holder_cardinality in ('single','multiple')),
  add constraint office_configurations_max_current_holders_check
    check ((holder_cardinality = 'single' and max_current_holders = 1) or (holder_cardinality = 'multiple' and (max_current_holders is null or max_current_holders > 0)));

update public.office_configurations
set required_ordination_degree = case
  when 'bishop' = any(allowed_person_types)
       and not ('priest' = any(allowed_person_types))
       and not ('deacon' = any(allowed_person_types))
       and not ('religious' = any(allowed_person_types))
       and not ('layperson' = any(allowed_person_types)) then 'episcopate'
  when requires_clergy
       and ('priest' = any(allowed_person_types) or 'bishop' = any(allowed_person_types))
       and not ('deacon' = any(allowed_person_types)) then 'presbyterate'
  when requires_clergy then 'diaconate'
  else 'none'
end;

update public.office_configurations
set holder_cardinality = 'multiple', max_current_holders = null
where key in ('obispo_auxiliar','vicario_episcopal','vicario_parroquial','diacono_adscrito_parroquial');

update public.office_configurations
set allowed_episcopal_role_types = array['diocesan']::text[]
where key = 'obispo_diocesano';

update public.office_configurations
set allowed_episcopal_role_types = array['auxiliary']::text[]
where key = 'obispo_auxiliar';
