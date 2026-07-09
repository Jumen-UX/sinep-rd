-- Fix priest creation failure: internal.admin_save_priest uses unaccent() to build fallback slugs.
-- Without this extension, saving a priest can fail with: function unaccent(text) does not exist.

create extension if not exists unaccent with schema public;

grant execute on function public.unaccent(text) to authenticated;
grant execute on function public.unaccent(regdictionary, text) to authenticated;
