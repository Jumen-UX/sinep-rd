# Sprint 1 — Avance de arquitectura por dominios

Fecha de corte: 14 de julio de 2026.

## Objetivo

Mantener las rutas de Next.js como puntos de entrada delgados y concentrar interfaz, acceso a datos y reglas de aplicación dentro de `src/features`.

## Trabajo completado

- `/admin` delega en `features/admin/dashboard`.
- `/admin/personas` delega en `features/personas`.
- `/admin/asignaciones` delega en `features/appointments`.
- `/admin/nuevo/sacerdote` delega en `features/clero/priest`.
- `/admin/configuracion/cargos` fue movida desde una página monolítica a `features/appointments`.
- El acceso a catálogos y configuraciones de cargos quedó encapsulado en `office-configuration-admin-service.ts`.
- La creación de configuraciones de cargos dejó de escribir directamente en `office_configurations` y ahora usa `admin_save_office_configuration`, RPC atómica y auditada.
- `/admin/usuarios` y `/admin/usuarios/invitar` delegan en `features/access`.
- La carga de usuarios, roles, permisos y alcances quedó centralizada en `user-access-admin-service.ts`.
- La asignación y cierre de roles, los cambios de estado y el envío de invitaciones dejaron de ejecutarse desde las rutas.
- `/admin/revision` delega en `features/review`.
- La carga de la cola y las decisiones de revisión quedaron centralizadas en `review-admin-service.ts`, manteniendo el endpoint administrativo validado como frontera de escritura.
- `/admin/estructura` delega en `features/structures` y `/admin/organizacion` delega en `features/organizacion`; ambos dominios ya usan servicios canónicos y RPC protegidas.
- Todas las rutas operativas de eventos delegan en `features/events`: registro, asistente, cola, revisión, plan, contrato y verificación.
- El registro histórico consume `get_event_registry_summary` y `get_event_registry_stream` exclusivamente mediante `event-registry-admin-service.ts`.
- Los catálogos del asistente y la creación de borradores quedaron centralizados en `event-draft-admin-service.ts` mediante `admin_create_event_draft`.
- La cola operativa, la ficha de revisión, las decisiones y la verificación de salud quedaron centralizadas en `event-workflow-admin-service.ts`.
- La generación y configuración del plan, los conflictos relacionales, el contrato y la aplicación organizativa quedaron centralizados en `event-application-admin-service.ts`.
- Las rutas heredadas de `/admin/estructura/eventos` funcionan como alias del dominio canónico y ya no ejecutan el motor paralelo de evolución estructural.
- La verificación heredada redirige a `/admin/eventos/verificacion`; al momento del corte, `structure_events` y `structure_event_actions` no contienen registros, mientras `canonical_events` conserva el evento piloto.
- `/admin/importar`, `/admin/importar/lotes` y `/admin/importar/[batchId]` delegan en `features/importaciones`.
- Preparación, historial, corrección por fila, revalidación, revisión y aplicación de lotes permanecen detrás de `batch-import-admin-service.ts`.
- `/admin/solicitudes` y `/admin/solicitudes/[id]` delegan en `features/requests`.
- La carga de solicitudes internas, sugerencias públicas, detalle de propuestas y decisiones de aprobación o rechazo quedó centralizada en `request-admin-service.ts`.
- La revisión de propuestas canónicas por identidad, sacramento, estado, incardinación, vida consagrada, función episcopal y dignidades permanece en `ChangeRequestReviewPage.tsx`.
- `/admin/nuevo/jurisdiccion`, `/admin/nuevo/parroquia` y `/admin/nuevo/capilla` delegan en `features/entities`.
- Los asistentes de alta conservaron la revisión de duplicados, los catálogos de países, la jerarquía territorial y los endpoints administrativos dentro del dominio de entidades, fuera de `src/app`.
- `/admin/alertas`, `/admin/alertas/jurisdicciones` y `/admin/estado-fichas` delegan en `features/data-quality`.
- Las alertas de responsabilidad estructural, sede vacante y completitud de fichas quedaron fuera de `src/app`, incluyendo la clasificación de datos no identificados o no aplicables.
- Las consultas de alertas, completitud y clasificación de excepciones quedaron encapsuladas en `data-quality-admin-service.ts`; las pantallas del feature ya no conocen tablas o vistas de Supabase.
- `/admin/configuracion` delega en `features/configuration` y su verificación de sesión quedó encapsulada en `configuration-admin-service.ts`.
- El centro de configuración enlaza el panel operativo de estado de fichas y mantiene los módulos futuros como tarjetas no interactivas, sin enlaces muertos.
- Se añadieron pruebas contractuales para impedir que las rutas de nombramientos, cargos, acceso, revisión, eventos, importaciones, solicitudes, altas de entidades, calidad de datos y configuración recuperen consultas, RPC o llamadas HTTP directas.

## Regla arquitectónica aplicada

Las rutas bajo `src/app` pueden resolver parámetros, autenticación inicial y composición, pero no deben contener consultas de dominio, mutaciones directas ni reglas de negocio. Las operaciones críticas deben pasar por servicios de feature y RPC auditadas.

## Pendientes para cerrar Sprint 1

1. Extraer las rutas restantes identificadas por `audit:routes`, priorizando cargos estructurales y operaciones de cuenta.
2. Separar en servicios compartidos los catálogos y la persistencia repetida de los asistentes de jurisdicción, parroquia y capilla.
3. Confirmar que cada RPC crítica tenga un único servicio consumidor por dominio.
4. Eliminar utilidades duplicadas de normalización, manejo de errores y alcance.
5. Ampliar las pruebas contractuales de límites de ruta sobre cualquier ruta crítica detectada por el inventario.
6. Ejecutar `pnpm audit:routes:strict` y cerrar formalmente el sprint cuando no queden rutas críticas monolíticas.

## Criterio de cierre

Sprint 1 se considerará cerrado cuando las rutas críticas deleguen en features, no existan escrituras de dominio directas desde páginas y la separación esté protegida por pruebas automatizadas.
