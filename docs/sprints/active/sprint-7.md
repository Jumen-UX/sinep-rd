# Sprint 7 — Portal administrativo y experiencia de usuario

> Estado: activo
> Inicio: 2026-07-16
> Rama operativa: `main`
> Propietario: portal administrativo, diseño de interfaz y accesibilidad

## Objetivo

Consolidar el portal administrativo como una experiencia coherente, accesible, responsive y orientada al trabajo por rol, reutilizando los contratos funcionales ya estabilizados y sin duplicar lógica de negocio.

## Cola inicial

1. [x] S7-01 — Auditar el plan UX vigente, la implementación actual y los pendientes reales antes de modificar pantallas.
2. [ ] S7-02 — Definir la arquitectura de información y navegación administrativa por rol, permiso y alcance. **En validación:** contrato, registro, política, servicio, proveedor y shell implementados; CI verde y prueba E2E autenticada pendiente.
3. [ ] S7-03 — Consolidar el dashboard administrativo y sus acciones prioritarias.
4. [ ] S7-04 — Integrar KPIs contextuales por dimensión territorial, pastoral, administrativa y colegial.
5. [ ] S7-05 — Normalizar encabezados, breadcrumbs, estados vacíos, feedback y jerarquía visual.
6. [ ] S7-06 — Completar modo oscuro sobre todos los componentes administrativos.
7. [ ] S7-07 — Implementar y validar el acceso flotante a herramientas de accesibilidad.
8. [ ] S7-08 — Revisar responsive, teclado, foco, contraste y lectores de pantalla.
9. [ ] S7-09 — Reducir duplicación visual y consolidar componentes reutilizables.
10. [ ] S7-10 — Ejecutar pruebas visuales, accesibilidad, `pnpm check`, CI y cierre.

## Estado de ejecución

### S7-01 — Completada

Se contrastó el plan UX vigente con la implementación actual. El levantamiento identificó fundamentos existentes y brechas en navegación por permisos, alcance visible, modo oscuro, accesibilidad, búsqueda, navegación móvil y regresión visual.

### S7-02 — En validación

Se creó `docs/product/ADMIN_NAVIGATION_ARCHITECTURE.md` como contrato canónico para:

- navegación por permiso y alcance;
- estados `available`, `read_only`, `blocked` y `hidden`;
- registro único de rutas;
- selector de alcance;
- navegación móvil priorizada;
- integración posterior del dashboard;
- responsabilidades técnicas y pruebas obligatorias.

Quedaron implementados:

- `src/features/admin/navigation/admin-navigation-contract.ts`, con un único registro de secciones, destinos, permisos, restricciones de alcance y prioridades móviles;
- `src/features/admin/navigation/admin-navigation-policy.ts`, con reglas puras para visibilidad, lectura, operación, secciones, navegación móvil y rutas activas;
- `src/features/admin/navigation/admin-navigation-service.ts`, que centraliza sesión, asignaciones activas, permisos, módulos y resolución de nombres de alcance;
- `src/features/admin/navigation/AdminNavigationProvider.tsx`, que comparte el contexto y conserva el ámbito activo en URL y almacenamiento local;
- `src/features/appointments/services/canonical-incompatibility-queue.ts`, que retira la consulta RPC del componente visual;
- `src/app/(admin)/admin/AdminShell.tsx`, conectado al registro autorizado y sin listas paralelas de escritorio/móvil;
- `src/styles/admin-navigation.css`, con selector de ámbito, estados de carga/error y panel móvil `Más`;
- `tests/admin-navigation-policy.test.mjs`, con nueve escenarios de permisos, alcance, estados de acceso y prioridad móvil;
- `tests/admin-navigation-context.test.mjs`, con normalización de contexto, asignaciones vencidas y límites arquitectónicos del shell.

La capa pura confirmó nueve pruebas aprobadas y TypeScript sin errores en validación aislada. El `pnpm check` de GitHub Actions quedó confirmado en verde el 2026-07-16 después de alinear las pruebas antiguas con el registro canónico y los límites de servicio. El estado externo de Vercel continúa separado y condicionado por su límite de compilaciones.

S7-02 no se marca completada hasta realizar una prueba autenticada representativa de navegación para, al menos, un administrador y un perfil de consulta.

## Reglas del sprint

- Antes de rediseñar se debe revisar el plan UX ya existente y contrastarlo con el código actual.
- La UI no debe contener acceso directo a datos cuando exista un servicio de dominio.
- La navegación y las acciones visibles deben respetar permisos y alcance.
- Todos los cambios deben funcionar en modo claro y oscuro.
- Las mejoras deben mantener navegación por teclado, foco visible, contraste suficiente y etiquetas accesibles.
- No se deben introducir componentes duplicados para resolver variantes que puedan componerse desde una base común.
- Las rutas administrativas seguirán delegando en sus respectivas features.

## Criterios de cierre

- El portal administrativo presenta una estructura coherente y predecible.
- Cada rol ve acciones, alertas y KPIs relevantes para su alcance.
- Las pantallas principales funcionan correctamente en escritorio, tableta y móvil.
- Modo oscuro y accesibilidad quedan cubiertos por contratos y pruebas.
- No se introducen accesos directos a datos ni duplicación de lógica de negocio.
- CI valida documentación, TypeScript, pruebas y build.

## Punto de continuación

Ejecutar una prueba autenticada de visibilidad por perfil. Si la navegación responde correctamente para un administrador y un perfil de consulta, cerrar S7-02 e iniciar S7-03 conectando el dashboard y sus acciones al mismo contexto de navegación.
