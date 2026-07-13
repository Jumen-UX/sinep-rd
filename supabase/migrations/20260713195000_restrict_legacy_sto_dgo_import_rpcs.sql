revoke all on function public.import_sto_dgo_parish_directory_rows(jsonb) from public;
revoke all on function public.import_sto_dgo_parish_directory_rows(jsonb) from anon;
revoke all on function public.import_sto_dgo_parish_directory_rows(jsonb) from authenticated;
grant execute on function public.import_sto_dgo_parish_directory_rows(jsonb) to service_role;

revoke all on function public.import_sto_dgo_parish_person_candidates(jsonb) from public;
revoke all on function public.import_sto_dgo_parish_person_candidates(jsonb) from anon;
revoke all on function public.import_sto_dgo_parish_person_candidates(jsonb) from authenticated;
grant execute on function public.import_sto_dgo_parish_person_candidates(jsonb) to service_role;
