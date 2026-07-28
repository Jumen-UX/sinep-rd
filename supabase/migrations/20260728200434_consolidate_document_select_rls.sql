drop policy if exists documents_select_public on public.documents;
drop policy if exists documents_select_scoped_authenticated on public.documents;

create policy documents_select_public_anon
on public.documents
for select
to anon
using (
  visibility = 'public'
  and status in ('active', 'approved')
);

create policy documents_select_authenticated
on public.documents
for select
to authenticated
using (
  (
    visibility = 'public'
    and status in ('active', 'approved')
  )
  or app_private.current_user_can_view_document(id, visibility, status)
);

comment on policy documents_select_authenticated on public.documents
is 'Combina lectura pública y lectura administrativa territorial en una sola política para evitar evaluaciones permisivas duplicadas.';