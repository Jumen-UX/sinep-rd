# Edición e historial del registro eclesial

> Estado: implementado y compilado en producción; recorrido autenticado multinivel pendiente  
> Fecha: 2026-07-28  
> Ruta: `/admin/relaciones-eclesiales`

## Objetivo

La edición de lugares, instituciones, obras y canales debe conservar la historia de pertenencia y administración. Una corrección de nombre o dirección puede actualizar la ficha; un cambio de entidad principal no puede reescribir retroactivamente la relación anterior.

La solución separa tres operaciones:

1. actualizar la ficha principal;
2. agregar o cerrar relaciones secundarias;
3. consultar relaciones vigentes e históricas.

## Regla de afiliación primaria

Cada lugar tiene exactamente una afiliación primaria vigente:

- `belongs_to` cuando no es sede principal;
- `seat_of` cuando es sede principal.

Cada institución tiene exactamente una afiliación primaria vigente `belongs_to`.

Los índices parciales:

- `ecclesiastical_place_affiliations_one_current_primary_idx`;
- `ecclesial_institution_affiliations_one_current_primary_idx`;

impiden que existan dos relaciones primarias activas simultáneamente.

Los triggers de consistencia rechazan:

- una relación primaria hacia una entidad distinta de `primary_entity_id`;
- una relación `seat_of` cuando el lugar no está marcado como sede;
- el cierre directo de la relación primaria;
- el reemplazo de la relación primaria desde el formulario de afiliaciones.

## Transiciones históricas

Cuando cambia `primary_entity_id`, o cambia `is_primary_seat` en un lugar, los triggers posteriores a la actualización:

1. bloquean la afiliación vigente;
2. asignan `valid_to=current_date`;
3. cambian `is_current=false` y `status='inactive'`;
4. insertan la nueva afiliación con `valid_from=current_date`;
5. registran auditorías separadas para cierre y creación.

Las transiciones se identifican en auditoría como:

- `primary_closed`;
- `primary_created`.

La lógica se aplica también al crear un registro, de modo que la afiliación primaria siempre exista aunque la escritura se origine fuera del formulario administrativo.

## Lectores

Fachadas públicas `SECURITY INVOKER`, ejecutables únicamente por `authenticated`:

- `admin_get_ecclesiastical_place`;
- `admin_get_ecclesial_institution`;
- `admin_list_ecclesiastical_place_affiliations`;
- `admin_list_ecclesial_institution_affiliations`.

Los lectores privados verifican `places.view` o `institutions.view` mediante los helpers tipados del registro y devuelven:

- ficha completa editable;
- destino y tipo de cada relación;
- fechas inicial y final;
- condición vigente o histórica;
- documento fuente y notas;
- indicador de relación primaria.

## Cierre de relaciones secundarias

RPC auditadas:

- `admin_close_ecclesiastical_place_affiliation`;
- `admin_close_ecclesial_institution_affiliation`.

El cierre:

- exige permiso de actualización sobre el propietario;
- valida que la fecha final no preceda la fecha inicial;
- establece `valid_to`;
- cambia la relación a histórica e inactiva;
- conserva notas y fuente;
- registra la transición `closed`.

La RPC rechaza explícitamente el cierre de la relación primaria. Para cambiarla se modifica la entidad principal desde la ficha.

## Interfaz administrativa

La ruta `/admin/relaciones-eclesiales` se divide en:

- lugares;
- instituciones;
- canales.

El usuario selecciona una ficha visible dentro del ámbito activo. La interfaz carga la ficha completa y deriva las operaciones permitidas desde:

- `places.update_proposal`;
- `institutions.update_proposal`;
- `communications.update_proposal`;
- `places.publish`;
- `institutions.publish`.

### Lugares

La edición incluye:

- tipo y entidad principal;
- unidad administradora;
- nombre, advocación y patrono;
- apertura, bendición, dedicación, consagración y cierre;
- capacidad y condición de sede;
- dirección y coordenadas;
- fuente, estado y visibilidad.

### Instituciones

La edición incluye:

- categoría y entidad principal;
- unidad administradora;
- identidad civil;
- fundación, erección canónica, registro civil y cierre;
- dirección y coordenadas;
- fuente, estado y visibilidad.

### Canales

La edición incluye:

- propietario y tipo de propietario;
- tipo, etiqueta y valor;
- verificación;
- condición principal;
- estado y visibilidad.

Los campos opcionales vaciados se envían explícitamente al escritor. Esto permite eliminar una fecha, dirección, fuente o dato civil anterior en vez de conservarlo por omisión del JSON.

## Relaciones secundarias

Para lugares se admiten desde la interfaz:

- propiedad;
- administración;
- atención pastoral;
- uso;
- localización.

Para instituciones:

- propiedad;
- administración;
- adscripción pastoral;
- patrocinio;
- operación;
- pertenencia institucional;
- localización.

Los destinos pueden ser entidades, unidades organizativas o instituciones, siempre dentro del país y alcance autorizados.

## Evidencia transaccional

La matriz se ejecutó con un administrador nacional DO dentro de una transacción terminada en `ROLLBACK`.

Se comprobó:

- creación de lugar e institución;
- creación de relación secundaria;
- edición sin pérdida de identidad;
- cambio de entidad principal;
- conservación de dos afiliaciones primarias, una histórica y una vigente;
- rechazo del cierre de la afiliación primaria;
- cierre correcto de relaciones secundarias;
- auditoría con país DO;
- cero datos temporales persistidos.

Resultado: `registry_edit_history_matrix_passed`.

La comprobación final confirmó además:

- tres migraciones de edición e historial aplicadas;
- cero lugares QA;
- cero instituciones QA;
- cero canales QA;
- cero auditorías QA.

## Validación de producción

El despliegue de producción `dpl_C846KVFPNqZer3N2HXzdZ1GW3bHZ`, asociado al commit `c36406e61316655bc52651f43c788b3dbf82731d`, terminó en estado `READY`.

Ese artefacto incluye:

- la ruta `/admin/relaciones-eclesiales`;
- el workspace de edición e historial;
- el servicio TypeScript;
- la navegación autorizada;
- los lectores y escritores RPC;
- las reglas de integridad histórica;
- los contratos estáticos.

La ruta respondió correctamente. Sin sesión activa, el middleware redirige a `/admin/login` y conserva `next=/admin/relaciones-eclesiales`. La respuesta mantiene `x-robots-tag: noindex` para el área administrativa.

El ajuste posterior para permitir vaciar campos opcionales está contenido en el commit `d3d91b1925dbc2cda8a7ebb02405d4a7826da514`. No altera la estructura de la página ni los contratos de base de datos.

## Advisors

El Security Advisor no detectó exposiciones nuevas asociadas a este bloque. Conserva únicamente la advertencia externa conocida de protección contra contraseñas filtradas deshabilitada.

El Performance Advisor no añadió claves foráneas sin índice por estas migraciones. Los dos índices parciales nuevos pueden aparecer inicialmente como no utilizados hasta que exista tráfico real de edición.

## Migraciones

1. `20260728223626_preserve_registry_primary_affiliation_history.sql`;
2. `20260728223724_add_registry_edit_history_readers.sql`;
3. `20260728223811_add_registry_affiliation_close_rpcs.sql`.

## Archivos de interfaz

- `src/app/(admin)/admin/relaciones-eclesiales/page.tsx`;
- `src/features/ecclesial-registry/admin/EcclesialRegistryHistoryPage.tsx`;
- `src/features/ecclesial-registry/services/ecclesial-registry-history-service.ts`;
- `src/features/admin/navigation/admin-navigation-contract.ts`;
- `tests/ecclesial-registry-history-ui-contract.test.mjs`.

## Riesgos y siguientes pasos

- El recorrido E2E autenticado con roles de país, diócesis y parroquia depende de las cuentas protegidas de S7-10.
- Las relaciones todavía no permiten seleccionar documentos fuente desde un repositorio documental.
- Las fechas de transición automática utilizan la fecha efectiva de la edición; posteriormente podrá añadirse una fecha efectiva explícita con flujo de revisión.
- Deben agregarse fichas públicas que presenten solo relaciones vigentes y una sección histórica opcional.
- La importación por lotes de instituciones y medios debe usar estos mismos escritores y reglas de transición.
