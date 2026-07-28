# Autorización administrativa por país

> Estado: fase 2 en progreso; usuarios, entidades, estructuras y unidades organizativas migrados
> Última revisión: 2026-07-28
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
5. **Una cuenta puede pertenecer a varios países.** La pertenencia administrativa se modela como relación usuario↔país y no como una columna única en `profiles`.
6. **La transición es incremental.** No se retira de una vez el atajo heredado porque decenas de RPC lo consumen; cada escritor y lector debe migrarse con pruebas.
7. **La ausencia de país falla cerrada.** No se permiten nuevas asignaciones nacionales ni invitaciones administrativas sin una entidad país activa.
8. **El país se hereda de la jerarquía.** Una entidad subordinada no puede declarar un país distinto del de su entidad superior.
9. **La edición ordinaria no cambia el contexto estructural.** Los traslados de diócesis, plantilla, entidad u organigrama requieren un evento canónico y auditado.
10. **Lo público y lo administrativo usan contratos distintos.** Las vistas públicas exponen columnas sanitizadas; las tablas base y RPC administrativas aplican RLS territorial.
11. **Los helpers de autorización devuelven booleanos estrictos.** La ausencia de claims nunca debe convertirse en `NULL` y debilitar una condición negativa.

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

Las RPC `admin_list_role_scope_options`, `validate_admin_role_scope` y `admin_assign_user_role`:

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

## Fase 2A — Usuarios, invitaciones y roles

Aplicada mediante:

- `20260727214448_user_country_memberships.sql`;
- `20260727215540_deny_direct_user_country_membership_access.sql`.

### Membresía administrativa usuario↔país

La pertenencia administrativa vive en el esquema interno `app_private`:

- `user_country_memberships` almacena la relación activa o inactiva entre una cuenta y un país;
- `user_country_membership_sources` registra por qué la membresía existe.

Los orígenes admitidos son:

- `invitation`: la cuenta fue invitada expresamente para ese país;
- `role_assignment`: una asignación vigente exige acceso a ese país;
- `backfill`: compatibilidad documentada para cuentas anteriores al modelo multi-país;
- `manual`: alta administrativa excepcional y auditada.

Una membresía solo se inactiva cuando ya no conserva ninguna fuente activa. Esto permite cerrar un rol sin perder la cuenta pendiente, su historial de invitación o una responsabilidad adicional en el mismo país.

### Seguridad de las tablas internas

Las dos tablas:

- están fuera del esquema público;
- tienen RLS habilitado;
- no conceden privilegios a `anon` ni `authenticated`;
- poseen políticas restrictivas explícitas con `using (false)` y `with check (false)`;
- solo se modifican mediante funciones y triggers internos auditados.

Las únicas fachadas nuevas expuestas a usuarios autenticados son:

- `validate_admin_country_scope(jsonb)`;
- `admin_register_user_country_membership(jsonb)`.

Ambas validan sesión, permiso, país disponible y protección especial de `super_admin` antes de ejecutar una operación.

### Sincronización con roles

El trigger `sync_role_assignment_country_membership`:

- crea o reactiva una fuente `role_assignment` al insertar o activar un rol con país;
- desactiva esa fuente cuando la asignación termina, cambia de usuario o cambia de país;
- mantiene la membresía activa mientras exista otra fuente vigente.

Las asignaciones históricas se convirtieron en fuentes de membresía. Las cuentas existentes recibieron además una fuente `backfill` para República Dominicana; esta decisión queda identificada y puede retirarse posteriormente de forma controlada.

### Invitaciones y onboarding

La invitación exige un **país administrativo** incluso cuando todavía no se asigna un rol. El flujo:

1. valida que el actor pueda administrar el país;
2. valida opcionalmente el rol y su alcance;
3. rechaza combinaciones donde el rol pertenezca a otro país;
4. crea o recupera la cuenta de Supabase Auth;
5. prepara el perfil;
6. registra la membresía `invitation`;
7. asigna el rol opcional;
8. audita país, alcance y resultado.

La interfaz reutiliza el país administrativo como entidad del alcance cuando el rol inicial es nacional. Para diócesis, parroquias, estructuras y unidades organizativas mantiene un selector adicional restringido a las opciones permitidas.

### Listados y mutaciones de usuarios

El helper `current_user_can_manage_user(uuid)` autoriza únicamente cuando:

- el actor es `super_admin`; o
- el usuario objetivo no es superadministrador y existe al menos un país activo compartido.

Con este helper:

- `admin_list_users` filtra cuentas y roles por país;
- `admin_list_user_onboarding_progress` filtra cuentas pendientes, en onboarding o sin rol;
- `admin_list_roles_with_permissions` oculta `super_admin` y limita conteos a administradores no globales;
- `admin_update_user_profile_status` no permite modificar cuentas de otro país;
- `admin_end_user_role` no permite cerrar asignaciones de otro país.

La verificación directa confirmó que el administrador nacional de República Dominicana enumera una sola cuenta y no puede enumerar al superadministrador, mientras el superadministrador conserva visibilidad de ambas cuentas existentes.

## Fase 2B — Autorización base de entidades y jurisdicciones

Aplicada mediante:

- `20260727220252_scope_entity_management_by_country.sql`.

### Helper territorial

`current_user_can_manage_entity(text, uuid)` dejó de retornar acceso irrestricto por poseer el rol `national_admin`.

El comportamiento vigente es:

- `super_admin` conserva acceso global;
- los demás actores requieren perfil activo;
- la entidad objetivo debe tener un país resoluble;
- el actor debe tener acceso a ese país;
- una asignación activa del mismo país debe conceder el permiso solicitado;
- el alcance debe ser nacional del país, la propia entidad, su diócesis o un nodo ascendente de la estructura.

La condición heredada `scope_type in ('global','national')` fue sustituida por un alcance nacional con `assignment.country_iso2` coincidente. Los alcances globales no superadministradores dejan de participar en la autorización territorial.

### Creación de entidades y jurisdicciones

Las fachadas `admin_save_ecclesiastical_entity` y `admin_save_jurisdiction`:

- exigen permiso efectivo o `super_admin`;
- exigen entidad o jurisdicción superior para actores no globales;
- validan que la entidad superior esté dentro del alcance administrable;
- derivan el país desde la jerarquía;
- rechazan un `country_iso2` contradictorio;
- reservan la creación de una entidad `country` a `super_admin`;
- conservan país y alcance en auditoría.

### Importaciones

`import_entity_matches(text)` ya no combina el buscador con `current_user_is_super_or_national()`. Todas las coincidencias pasan por `current_user_can_manage_entity('imports.prepare', entity_id)`, por lo que un administrador nacional solo obtiene resultados de su país.

### Evidencia directa

Con el contexto autenticado del administrador nacional de República Dominicana:

- `entities.create_proposal` sobre `DO`: `true`;
- `entities.create_proposal` sobre `CO`: `false`;
- `imports.prepare` sobre `DO`: `true`;
- `imports.prepare` sobre `CO`: `false`.

Con el contexto de `super_admin`, las mismas comprobaciones retornan `true` para ambos países.

## Fase 2C — Estructuras y unidades organizativas

Aplicada mediante:

- `20260728131743_scope_internal_structure_reads.sql`;
- `20260728131927_harden_structure_unit_writer_context.sql`;
- `20260728132202_fix_structure_policy_helper_execution.sql`;
- `20260728132613_allow_organization_unit_audit_scope.sql`.

### Lecturas internas y públicas

Las políticas RLS distinguen entre datos públicos y administrativos:

- una unidad organizativa activa y pública continúa visible públicamente;
- una unidad interna, privada, en borrador o archivada requiere `pastorals.view` dentro de su entidad y alcance territorial;
- una plantilla activa continúa disponible como catálogo público;
- una plantilla inactiva requiere `structures.manage` en su diócesis;
- los niveles heredan la visibilidad de su plantilla;
- los nodos públicos continúan visibles;
- los nodos autenticados o internos requieren `entities.view`, `pastorals.view` o `structures.manage` dentro del alcance efectivo;
- una arista solo es visible si sus nodos padre e hijo son visibles.

Los helpers RLS de propósito específico reciben `EXECUTE` únicamente para los roles que necesitan evaluarlos. El helper general `current_user_can_manage_entity(text, uuid)` no fue expuesto directamente.

La RPC administrativa `get_structure_node_detail(uuid)` exige alcance sobre el nodo aunque ese nodo tenga una representación pública en otro canal.

### Guardas contra IDOR y cambios de contexto

Las fachadas ordinarias bloquean cambios que antes podían intentarse combinando un identificador existente con un contexto autorizado distinto:

- una unidad organizativa no puede cambiar de entidad eclesiástica u organigrama mediante edición ordinaria;
- una plantilla no puede cambiar de diócesis;
- un nivel no puede cambiar de plantilla y su nivel superior debe pertenecer a la misma plantilla;
- un nodo no puede cambiar de plantilla;
- el nivel y el nodo superior deben pertenecer a la misma plantilla y diócesis;
- una entidad o unidad vinculada debe pertenecer al mismo país;
- cuando la diócesis vinculada puede resolverse, también debe coincidir con la diócesis de la plantilla.

Las implementaciones anteriores fueron renombradas como funciones `*_unscoped` y permanecen sin `EXECUTE` para clientes. Las nuevas fachadas validan el contexto antes de delegar al escritor canónico.

### Eventos y auditoría

`admin_apply_organization_unit_event` exige sesión, permiso `events.apply` o `super_admin`, alcance territorial resoluble y permiso efectivo sobre la autoridad del evento.

El contrato `audit_logs_scope_type_check` incorporó `organization_unit`, que ya era emitido por `resolve_audit_scope`. `pastoral_entity` se conserva temporalmente por compatibilidad histórica.

### Evidencia transaccional

Las pruebas directas, ejecutadas con datos temporales y `ROLLBACK`, confirmaron:

- un administrador DO ve una unidad interna DO y no una interna CO;
- conserva acceso a unidades y nodos públicos CO por el contrato público;
- no ve una plantilla inactiva, nivel ni nodo interno CO;
- la RPC administrativa de detalle rechaza un nodo público CO por falta de alcance;
- los intentos de trasladar una unidad, plantilla, nivel o nodo mediante payload cruzado son rechazados;
- una edición legítima de plantilla y unidad DO, junto con su auditoría, completa el flujo.

## Fase 2D — Lecturas de entidades y relaciones

Aplicada mediante:

- `20260728134017_create_public_entity_read_contracts.sql`;
- `20260728134425_scope_entity_reads_and_relationships.sql`;
- `20260728134625_normalize_service_role_boolean_helpers.sql`;
- `20260728134752_restrict_public_entity_base_columns.sql`.

### Contratos públicos sanitizados

La ficha pública dejó de consultar directamente las tablas base y utiliza:

- `public_entity_directory_details`;
- `public_entity_relationships`.

Ambas vistas son `security_invoker`. La vista de entidades contiene únicamente campos destinados a publicación. La vista de relaciones excluye:

- `notes`;
- `document_id`;
- `approved_change_request_id`;
- `created_by`;
- metadatos editoriales de actualización.

La API `/api/entidades` ya no solicita `notes` y utiliza las vistas también para resolver entidades relacionadas.

### RLS territorial

`current_user_can_read_entity(uuid)` permite:

- entidades activas y públicas para cualquier visitante;
- entidades internas, privadas o inactivas solo cuando el actor posee `entities.view` dentro del alcance territorial canónico.

`current_user_can_read_entity_relationship(uuid)` permite:

- relaciones activas cuando ambos extremos son entidades activas y públicas;
- relaciones administrativas cuando el actor puede gestionar al menos un extremo y puede leer ambos.

Las políticas heredadas basadas en `current_user_is_admin()` y `current_user_has_any_active_role()` fueron sustituidas por estos lectores territoriales.

`current_user_can_read_entity_descendants(uuid)` también exige ahora `entities.view` sobre la entidad raíz; `national_admin` y `scope_type='national'` ya no constituyen bypasses globales.

### Escrituras y columnas base

`authenticated` ya no posee `INSERT`, `UPDATE` ni `DELETE` directos sobre `entity_relationships`; las mutaciones continúan por RPC y eventos auditados.

`anon` ya no posee `SELECT` de tabla completa. Conserva permisos por columna exclusivamente para soportar las vistas `security_invoker`. No puede leer:

- `ecclesiastical_entities.created_by`;
- `entity_relationships.notes`;
- `entity_relationships.document_id`;
- `entity_relationships.approved_change_request_id`;
- actores o referencias internas de workflow.

### Booleanos estrictos

Una prueba reveló que el patrón:

```sql
current_setting('request.jwt.claim.role', true) = 'service_role' OR ...
```

podía devolver `NULL` cuando el claim no existía. En PL/pgSQL, una condición negativa basada en ese resultado podía no ejecutarse.

Se normalizaron con `coalesce(..., false)`:

- `current_user_can_access_country`;
- `current_user_can_manage_user`;
- `current_user_can_read_entity_descendants`.

Desde esta migración, los tres helpers devuelven siempre `true` o `false`.

### Evidencia transaccional

Las pruebas con registros temporales y `ROLLBACK` confirmaron:

- `anon` no ve entidades ni relaciones internas de DO o CO;
- `anon` sí ve entidades y relaciones públicas;
- el administrador DO ve entidades y relaciones internas DO;
- no ve entidades ni relaciones internas CO;
- conserva la lectura de datos públicos CO;
- descendientes de DO/CO producen `true/false`, no `true/NULL`;
- las vistas públicas y `get_entity_internal_tree` continúan operativas después de restringir columnas;
- las columnas internas no poseen privilegio de lectura anónimo.

## Fase 2E — Dominios restantes

**Pendiente.** La separación internacional aún no está cerrada transversalmente.

Los consumidores restantes deben migrarse en este orden:

1. revisión, aprobación, publicación y eventos estructurales de entidades;
2. personas, nombramientos y cargos;
3. eventos y calendarios;
4. importaciones, revisión y aplicación;
5. documentos, auditoría, reportes y búsqueda;
6. configuración y catálogos.

Para cada consumidor se requiere:

- identificar la entidad o país objetivo antes de autorizar;
- reemplazar el bypass por `super_admin OR current_user_can_access_country(...)` o un helper territorial más específico;
- añadir pruebas A↔B entre dos países;
- verificar lectura y escritura;
- comprobar que `super_admin` conserva operación global;
- registrar dominios que todavía no tengan una ruta confiable hacia país.

No debe modificarse `current_user_is_super_or_national()` de forma central hasta completar el inventario. Hacerlo antes produciría bloqueos funcionales impredecibles.

## Fase 3 — Normalización definitiva de tipos de alcance

Después de completar la fase 2:

1. introducir `scope_type='country'` como valor canónico;
2. migrar asignaciones históricas `national` a `country`;
3. reservar `global` exclusivamente a `super_admin`;
4. retirar la compatibilidad `national` sin país;
5. endurecer constraints para exigir combinaciones exactas por tipo;
6. actualizar contratos de API, formularios, filtros, reportes y manuales;
7. retirar o redefinir `current_user_is_super_or_national()`.

## Criterios de aceptación

La arquitectura solo podrá considerarse cerrada cuando exista evidencia de que:

- un administrador de República Dominicana no puede leer ni modificar Colombia;
- un administrador de Colombia no puede leer ni modificar República Dominicana;
- ambos ven únicamente catálogos y entidades de su país;
- las asignaciones e invitaciones exigen país;
- usuarios pendientes y sin rol permanecen visibles solo dentro de su país;
- auditoría, importaciones, eventos, búsqueda y reportes conservan país;
- `super_admin` puede operar globalmente sin convertirse en una cuenta nacional;
- la matriz E2E incluye aislamiento bidireccional entre países y diócesis;
- no quedan consumidores que equiparen `national_admin` con acceso global.

## Riesgos y deuda controlada

- El bypass heredado continúa activo en dominios todavía no migrados; esta es la principal deuda de seguridad de la fase 2E.
- `pastoral_areas` necesita una relación territorial canónica antes de habilitarse para administradores nacionales.
- Las cuentas existentes recibieron una fuente `backfill` en República Dominicana; antes de operar otros países debe revisarse si corresponde conservarla.
- Los escritores internos todavía poseen defaults históricos de República Dominicana; las fachadas migradas los neutralizan, pero los demás escritores deben revisarse individualmente.
- Los helpers RLS con `SECURITY DEFINER` deben permanecer mínimos, con `search_path` fijo y permisos de ejecución explícitos.
- Los índices nuevos no deben eliminarse sin estadísticas representativas.
- Los registros de auditoría antiguos solo reciben país cuando su alcance histórico permite derivarlo con certeza.
- El alcance `national` sin país se conserva únicamente para compatibilidad de lectura y debe desaparecer en la fase 3.

## Regla de operación

Hasta completar la fase 2E, no se deben crear administradores nacionales de otros países para uso real. Pueden utilizarse cuentas QA controladas con entidades `test-*`, siempre con pruebas A↔B, contraseñas rotadas y suspensión posterior.
