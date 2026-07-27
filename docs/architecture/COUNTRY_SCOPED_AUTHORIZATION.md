# Autorización administrativa por país

> Estado: fase 1 aplicada; fase 2 pendiente
> Última revisión: 2026-07-27
> Alcance: roles administrativos, navegación, auditoría y transición multi-país

## Problema

El modelo inicial de SINEP interpretaba simultáneamente como irrestrictos:

- el rol `super_admin`;
- el rol `national_admin`;
- los alcances `global` y `national`.

Esa equivalencia era válida mientras el producto operaba únicamente con República Dominicana, pero no es segura en un sistema multi-país. Un administrador nacional debe administrar un país concreto. Solo el superadministrador técnico puede operar transversalmente entre países.

Además, las asignaciones históricas de roles nacionales no almacenaban una entidad país ni un código ISO. La navegación mostraba «Ámbito nacional» sin identificar qué país estaba activo, y múltiples funciones privadas utilizaban `current_user_is_super_or_national()` como atajo global.

## Principios

1. **Rol y alcance son conceptos distintos.** `national_admin` expresa capacidad; `country_iso2` y la entidad país expresan dónde puede ejercerla.
2. **Solo `super_admin` es global.** Los demás roles deben tener país cuando su alcance sea nacional.
3. **La entidad país es canónica.** El código ISO se deriva de `ecclesiastical_entities` de tipo `country` y se valida contra `country_catalog`.
4. **La auditoría conserva el país.** Toda mutación con contexto territorial debe registrar `country_iso2` cuando pueda resolverse.
5. **La transición es incremental.** No se retira de una vez el atajo heredado porque decenas de RPC lo consumen; cada escritor y lector debe migrarse con pruebas.
6. **La ausencia de país falla cerrada en nuevos alcances nacionales.** No se permiten nuevas asignaciones `national` sin una entidad país activa.

## Fase 1 — Contexto canónico y escritores seguros

Aplicada mediante:

- `20260727204813_add_country_context_to_authorization.sql`;
- `20260727205540_enforce_country_anchored_role_assignments.sql`.

### Esquema

Se añadió `country_iso2 char(2)` a:

- `user_role_assignments`;
- `audit_logs`.

Ambas columnas tienen clave foránea hacia `country_catalog(iso2)`. Los índices parciales nuevos soportan consultas de asignaciones activas y auditoría por país; su utilidad deberá evaluarse después de disponer de carga representativa.

### Derivación

Los helpers privados:

- `resolve_entity_country_iso2(uuid)`;
- `resolve_scope_country_iso2(text, uuid, uuid, uuid, uuid)`;
- `current_user_country_iso2s()`;
- `current_user_can_access_country(char(2))`;

permiten resolver el país desde entidades, nodos estructurales, diócesis y unidades organizativas. Ninguno se concede directamente a clientes.

### Backfill

Las asignaciones históricas no globales con `scope_type='national'` fueron vinculadas a la entidad país de República Dominicana y recibieron `country_iso2='DO'`. `super_admin` permanece sin país forzado.

El backfill no altera la semántica completa de las funciones heredadas. Su objetivo es introducir el dato canónico necesario para migrarlas de forma controlada.

### Integridad de nuevas escrituras

El trigger `derive_role_assignment_country_context` garantiza que:

- `super_admin` conserva `country_iso2=null`;
- un rol distinto de `super_admin` no puede guardar alcance `global`;
- `national` exige `scope_entity_id` de una entidad activa de tipo `country`;
- el código ISO declarado debe coincidir con la entidad seleccionada.

Las RPC `admin_list_role_scope_options`, `validate_admin_role_scope` y `admin_assign_user_role` ahora:

- incluyen países como opciones nacionales;
- filtran opciones mediante `current_user_can_access_country`;
- exigen una entidad país para alcance nacional;
- impiden que un administrador no global asigne alcance global;
- escriben y auditan `country_iso2`;
- mantienen idempotencia diferenciando también el país.

Las áreas pastorales históricas no tienen todavía una relación canónica suficiente para derivar país. Durante esta fase solo el superadministrador puede seleccionarlas como alcance de rol. Esto es una restricción deliberada y temporal, no una solución final.

### Navegación

`admin-navigation-service.ts` carga `country_iso2`, resuelve el nombre de la entidad país y solo marca como irrestricto:

- `super_admin`;
- `scope_type='global'`;
- alcances nacionales heredados sin país, únicamente como compatibilidad temporal.

Un administrador nacional respaldado por país ve, por ejemplo, «República Dominicana» y no «Ámbito nacional» global.

## Fase 2 — Eliminación del bypass nacional heredado

**Pendiente.** La fase 1 no autoriza a declarar terminada la separación multi-país.

Más de cincuenta funciones privadas o públicas consumen directa o indirectamente `current_user_is_super_or_national()`. Deben clasificarse y migrarse por dominio:

1. usuarios, roles, invitaciones y onboarding;
2. entidades y estructuras territoriales;
3. personas, nombramientos y cargos;
4. unidades pastorales, administrativas y colegiales;
5. eventos y calendarios;
6. importaciones, revisión y aplicación;
7. documentos, auditoría, reportes y búsqueda;
8. configuración y catálogos.

Para cada consumidor se requiere:

- identificar la entidad o país objetivo antes de autorizar;
- reemplazar el bypass por `super_admin OR current_user_can_access_country(...)` o por un helper territorial más específico;
- añadir pruebas A↔B entre dos países;
- verificar lectura y escritura;
- comprobar que el superadministrador conserva operación global;
- registrar cualquier dominio que todavía no tenga una ruta confiable hacia país.

No debe modificarse `current_user_is_super_or_national()` para devolver únicamente superadministradores hasta completar ese inventario. Cambiarlo de forma central sin migrar consumidores produciría bloqueos funcionales impredecibles.

## Fase 3 — Normalización definitiva de tipos de alcance

Después de completar la fase 2:

1. introducir `scope_type='country'` como valor canónico;
2. migrar asignaciones históricas `national` a `country`;
3. reservar `global` exclusivamente a `super_admin`;
4. retirar la compatibilidad `national` sin país;
5. endurecer constraints para exigir combinaciones exactas por tipo;
6. actualizar contratos de API, formularios, filtros, reportes y manuales;
7. retirar o redefinir `current_user_is_super_or_national()`.

## Criterios de aceptación de la separación multi-país

La arquitectura solo podrá considerarse cerrada cuando exista evidencia de que:

- un administrador de República Dominicana no puede leer ni modificar Colombia;
- un administrador de Colombia no puede leer ni modificar República Dominicana;
- ambos ven únicamente catálogos y entidades de su país;
- las asignaciones e invitaciones exigen país;
- auditoría, importaciones, eventos, búsqueda y reportes conservan país;
- `super_admin` puede operar globalmente sin convertirse en una cuenta nacional;
- la matriz E2E incluye aislamiento bidireccional entre países además del aislamiento entre diócesis;
- no quedan consumidores de autorización que equiparen `national_admin` con acceso global.

## Riesgos y deuda controlada

- El bypass heredado continúa activo en funciones todavía no migradas; esta es la principal deuda de seguridad de la fase 2.
- `pastoral_areas` necesita una relación territorial canónica antes de habilitarse para administradores nacionales.
- Los índices nuevos aparecen inicialmente como no utilizados por el bajo volumen y la ausencia de carga; no deben eliminarse sin estadísticas representativas.
- Los registros de auditoría antiguos solo reciben país cuando su alcance histórico permite derivarlo con certeza.
- El alcance `national` sin país se conserva únicamente para compatibilidad de lectura y debe desaparecer en la fase 3.

## Regla de operación

Hasta completar la fase 2, no se deben crear administradores nacionales de otros países para uso real. Pueden utilizarse cuentas QA controladas con entidades `test-*`, siempre con pruebas A↔B, contraseñas rotadas y suspensión posterior.
