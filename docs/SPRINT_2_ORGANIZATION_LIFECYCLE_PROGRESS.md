# Sprint 2 · Avance del contrato organizativo

Fecha de corte: 14 de julio de 2026.

## Problema resuelto

Las unidades organizativas podían cambiar `status` y `visibility` dentro del guardado general. Aunque la RPC existente comprobaba permisos, aprobación y publicación no tenían una operación explícita propia en la API de aplicación.

## Contrato implementado

Se añadió `admin_transition_organization_unit(payload)` con acciones controladas:

- `approve`: `draft → active`, requiere `pastorals.approve`.
- `publish`: visibilidad pública, requiere `pastorals.publish` y una unidad activa/vigente.
- `unpublish`: devuelve la visibilidad a interna.
- `deactivate`: marca la unidad inactiva y retira visibilidad pública.
- `archive`: archiva, retira publicación, cierra vigencia y marca `is_current=false`.
- `restore_draft`: devuelve una unidad a borrador interno para nueva revisión.

Cada transición:

1. bloquea la fila;
2. valida acción, estado y alcance eclesiástico;
3. exige el permiso específico;
4. actualiza el ciclo de vida de forma atómica;
5. escribe auditoría con estado anterior y posterior.

La implementación privilegiada permanece en `app_private`; el cliente autenticado solo puede ejecutar la fachada pública.

## Frontera de aplicación

`PATCH /api/admin/organizacion` valida la acción, exige el permiso preliminar y llama exclusivamente a la RPC canónica. El servicio `transitionOrganizationUnit` encapsula esta operación para la interfaz.

## Estado de los datos

Las 181 unidades vigentes continúan en `draft`. No se realizó una activación masiva automática. La promoción debe ocurrir mediante revisión explícita para preservar la separación entre aprobación y publicación.

## Pendiente para cerrar S2-04

- Exponer acciones explícitas en la pantalla administrativa y retirar los selectores genéricos de estado/visibilidad del guardado ordinario.
- Definir una revisión por lotes segura para las 181 unidades importadas.
- Confirmar qué unidades deben quedar internas y cuáles pueden publicarse.
- Ejecutar el ciclo completo con cuentas reales que tengan permisos diferenciados.
