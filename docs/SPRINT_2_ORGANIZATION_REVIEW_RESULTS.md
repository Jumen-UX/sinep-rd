# Sprint 2 — Cola de revisión de unidades organizativas

Fecha: 14 de julio de 2026.

## Resultado

Se añadió `/admin/organizacion/revision` como espacio específico para revisar las unidades organizativas vigentes que permanecen en estado `draft`.

La cola:

- filtra por diócesis, organigrama y área pastoral;
- muestra únicamente unidades vigentes en borrador;
- permite selección individual o de todos los resultados visibles;
- ejecuta la aprobación mediante `transitionOrganizationUnit(id, 'approve')`;
- mantiene la publicación como una acción posterior y separada;
- informa aprobaciones parciales sin ocultar los errores por unidad;
- conserva cada transición detrás del contrato auditado `admin_transition_organization_unit`.

## Regla funcional

Aprobar una unidad cambia su estado de `draft` a `active`, pero conserva su visibilidad interna. La publicación nunca forma parte de la aprobación masiva.

## Alcance pendiente

- Confirmar el CI de la nueva ruta y su prueba contractual.
- Definir criterios pastorales y administrativos de aprobación por tipo de organigrama.
- Validar el flujo con cuentas reales que separen edición, aprobación y publicación.
- Revisar las 181 unidades actuales antes de realizar cualquier aprobación masiva en producción.
