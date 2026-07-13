-- Endurece la superficie RPC del resolvedor de incompatibilidades canónicas.
-- La función conserva acceso para usuarios autenticados y service_role,
-- pero deja de ser ejecutable por PUBLIC/anon.

revoke execute
on function public.resolve_assignment_canonical_incompatibility(jsonb)
from public;

revoke execute
on function public.resolve_assignment_canonical_incompatibility(jsonb)
from anon;

grant execute
on function public.resolve_assignment_canonical_incompatibility(jsonb)
to authenticated;

grant execute
on function public.resolve_assignment_canonical_incompatibility(jsonb)
to service_role;
