# Lugares, instituciones, obras y medios eclesiales

> Estado: fundamento canónico implementado y validado  
> Última revisión: 2026-07-28  
> Alcance: modelo de datos, autorización, migración heredada, RPC, RLS y vistas públicas

## Objetivo

SINEP distingue cuatro conceptos que antes se almacenaban parcialmente como si fueran la misma entidad:

1. **Entidad eclesial canónica o territorial**: país, diócesis, parroquia, jurisdicción u otra entidad que forma parte del directorio y de la organización eclesial.
2. **Lugar físico eclesiástico**: edificio o espacio donde se celebra, se congrega o funciona una obra, por ejemplo catedral, iglesia parroquial, santuario, capilla u oratorio.
3. **Institución u obra**: organización estable asociada, administrada, patrocinada o atendida por la Iglesia, por ejemplo escuela, universidad, seminario, monasterio, dispensario, hospital, obra social o medio.
4. **Canal de comunicación**: teléfono, correo, sitio web, red social, frecuencia, señal, publicación o plataforma que pertenece a cualquiera de los tres conceptos anteriores o a una unidad organizativa.

Los cuatro registros se relacionan, pero sus identidades y ciclos históricos no son intercambiables.

## Principio territorial y físico

Una parroquia sigue siendo una entidad eclesial y territorial. Su iglesia parroquial es un lugar físico distinto.

Esto permite que:

- la parroquia tenga una fecha de erección propia;
- el templo tenga fechas de apertura, bendición, dedicación y consagración;
- una parroquia tenga varios templos o capillas;
- un templo sea sede de una parroquia, vicaría, zona u otra obra;
- una catedral se vincule directamente a una diócesis;
- un santuario tenga administración, pertenencia y atención pastoral diferentes;
- un edificio cambie de uso o dependencia sin alterar retroactivamente la historia de la entidad canónica.

## Tablas canónicas

### Lugares físicos

`ecclesiastical_places` representa edificios y espacios eclesiásticos.

Campos principales:

- `place_type_id`;
- `primary_entity_id`;
- `managing_organization_unit_id`;
- `legacy_entity_id`;
- `country_iso2`;
- nombre, slug y descripción;
- advocación y patronazgo;
- apertura, bendición, dedicación, consagración y cierre;
- capacidad y condición de sede principal;
- dirección, coordenadas y fuente;
- estado y visibilidad.

`dedicated_at` y `consecrated_at` son hechos distintos. El catálogo de tipos determina si cada categoría admite esos actos.

### Tipos de lugar

`ecclesiastical_place_types` incluye inicialmente:

- catedral y concatedral;
- basílica;
- iglesia parroquial y cuasiparroquial;
- santuario;
- iglesia;
- capilla;
- oratorio;
- ermita;
- iglesia monástica;
- capilla de seminario;
- iglesia de misión;
- otro lugar eclesiástico.

El catálogo es extensible y no depende de un país específico.

### Instituciones y obras

`ecclesial_institutions` representa organizaciones u obras estables.

Campos principales:

- `category_id`;
- `primary_entity_id`;
- `managing_organization_unit_id`;
- `legacy_entity_id`;
- `country_iso2`;
- nombre oficial y slug;
- descripción;
- identidad y registro civil;
- fundación, erección canónica, registro civil y cierre;
- localización y fuentes;
- estado y visibilidad.

### Categorías institucionales

`ecclesial_institution_categories` es jerárquica y cubre inicialmente:

- educación: escuelas, colegios, universidades y centros técnicos;
- salud: hospitales, clínicas y dispensarios;
- formación: seminarios, centros pastorales y casas de retiro;
- vida consagrada: casas religiosas, monasterios y conventos;
- caridad: albergues, bancos de alimentos y otras obras;
- medios: radio, televisión, periódico, revista, medio digital y editorial;
- cultura: bibliotecas, museos y archivos;
- obra social y centros comunitarios;
- administración;
- otras instituciones o centros especiales.

Una emisora, canal, periódico o medio digital se registra como institución porque puede tener nombre, historia, administración, personal y personalidad civil. Sus señales, frecuencias, perfiles y URLs se registran como canales de comunicación.

### Canales de comunicación

`communication_channels` normaliza datos que antes estaban dispersos en columnas fijas.

Un canal pertenece exactamente a uno de estos propietarios:

- entidad eclesial;
- unidad organizativa;
- lugar físico;
- institución.

Tipos iniciales:

- teléfono y correo;
- sitio web;
- Facebook, Instagram, YouTube, X y TikTok;
- WhatsApp y Telegram;
- frecuencia de radio;
- señal o canal de televisión;
- podcast;
- streaming;
- publicación impresa;
- otro canal.

El trigger valida correos y URLs, deriva el país desde el propietario y evita inconsistencias de alcance.

## Afiliaciones e historia

### Lugares

`ecclesiastical_place_affiliations` relaciona un lugar con una entidad, unidad o institución mediante:

- `belongs_to`;
- `seat_of`;
- `owned_by`;
- `administered_by`;
- `pastorally_served_by`;
- `used_by`;
- `located_within`.

### Instituciones

`ecclesial_institution_affiliations` relaciona una institución con una entidad, unidad o institución superior mediante:

- `belongs_to`;
- `owned_by`;
- `administered_by`;
- `pastorally_attached_to`;
- `sponsored_by`;
- `operated_by`;
- `part_of`;
- `located_within`.

Cada afiliación conserva:

- fecha inicial y final;
- condición actual o histórica;
- estado;
- documento fuente;
- notas;
- actor y timestamps.

Las afiliaciones no pueden cruzar países. Una relación `seat_of` debe apuntar a una entidad eclesial.

## País y autorización

El cliente no decide `country_iso2`. Los triggers lo derivan desde:

- la entidad principal;
- la entidad de la unidad administradora;
- el propietario del canal;
- el lugar o institución relacionados.

Si dos extremos pertenecen a países distintos, la escritura falla con una restricción.

Helpers tipados:

- `current_user_can_manage_ecclesiastical_place`;
- `current_user_can_manage_ecclesial_institution`;
- `current_user_can_manage_communication_channel`.

Estos helpers delegan en la autorización canónica de entidad o unidad y exigen un permiso explícito.

## Permisos

### Lugares

- `places.view`;
- `places.create_proposal`;
- `places.update_proposal`;
- `places.approve`;
- `places.publish`.

### Instituciones

- `institutions.view`;
- `institutions.create_proposal`;
- `institutions.update_proposal`;
- `institutions.approve`;
- `institutions.publish`.

### Comunicación

- `communications.view`;
- `communications.update_proposal`.

Los permisos fueron asociados a los roles existentes siguiendo la misma separación entre consulta, edición y aprobación utilizada por entidades.

## RLS y privilegios

Todas las tablas nuevas tienen RLS habilitado.

`anon` solo puede leer registros:

- activos;
- públicos;
- cuyo propietario también sea visible cuando corresponde.

Un usuario autenticado puede leer además registros internos dentro de su alcance y con el permiso adecuado.

Las mutaciones directas para `anon` y `authenticated` están revocadas. La escritura se realiza mediante RPC auditadas.

No se utiliza `current_user_is_super_or_national` ni otro bypass administrativo amplio en las políticas nuevas.

## RPC administrativas

Fachadas públicas `SECURITY INVOKER`:

- `admin_save_ecclesiastical_place`;
- `admin_save_ecclesial_institution`;
- `admin_save_communication_channel`;
- `admin_save_ecclesiastical_place_affiliation`;
- `admin_save_ecclesial_institution_affiliation`.

Las fachadas no pueden ser ejecutadas por `anon`. Delegan en funciones privadas `SECURITY DEFINER` con `search_path` fijo y validaciones de alcance.

Los escritores:

- validan identidad, categoría y propietario;
- verifican entidad y unidad administradora;
- generan slugs únicos;
- derivan país;
- mantienen la afiliación primaria;
- exigen `publish` para estado activo o visibilidad pública;
- registran auditoría con país y entidad de alcance;
- son idempotentes cuando corresponde.

## Vistas públicas

Vistas `security_invoker`:

- `public_ecclesiastical_places`;
- `public_ecclesial_institutions`;
- `public_communication_channels`.

Las vistas solo incluyen registros activos y públicos. La UI pública futura debe consultar estas vistas y no las tablas internas directamente.

## Migración heredada

La migración inicial no elimina ni reclasifica las entidades existentes.

Se crearon registros equivalentes para:

- capillas y santuarios → lugares físicos;
- seminarios, casas religiosas y centros especiales → instituciones;
- teléfono, correo, sitio web y redes de entidades → canales normalizados.

`legacy_entity_id` conserva la relación uno a uno con el registro anterior. Esta estrategia permite comparar, corregir y retirar gradualmente la representación heredada sin pérdida de identidad ni enlaces existentes.

Carga inicial validada:

- 14 tipos de lugar;
- 35 categorías institucionales;
- 16 tipos de canal;
- 4 lugares heredados;
- 3 instituciones heredadas;
- 252 canales heredados;
- 4 afiliaciones primarias de lugares;
- 3 afiliaciones primarias de instituciones.

También se sincronizaron en `country_catalog` los países activos que ya existían como entidades pero faltaban en el catálogo operativo.

## Evidencia transaccional

La matriz se ejecutó dentro de una transacción y terminó con `ROLLBACK`.

Se comprobó:

- creación y publicación de un templo DO por un administrador DO;
- exposición mediante la vista pública;
- dedicación y consagración separadas;
- rechazo de consagración en un tipo que no la admite;
- rechazo de creación en una entidad ES por el administrador DO;
- creación de una escuela;
- creación de un sitio web perteneciente a esa institución;
- afiliación del lugar con la institución;
- auditoría de las cuatro operaciones con país DO;
- invisibilidad de una institución interna CO para el administrador DO;
- rechazo de una afiliación entre un lugar DO y una entidad ES;
- cero lugares, instituciones, canales o auditorías temporales después del rollback.

## Advisors

El Security Advisor no añadió advertencias asociadas a este módulo. Solo permanece la configuración externa conocida de protección contra contraseñas filtradas.

El Performance Advisor detectó inicialmente claves foráneas nuevas sin índice. La migración `20260728213412_index_ecclesial_registry_foreign_keys.sql` añadió cobertura para tipos, categorías, documentos fuente y actores. Después del correctivo no quedaron advertencias de claves foráneas sin índice introducidas por este módulo.

Los índices nuevos pueden aparecer como no usados hasta que exista tráfico real. No deben retirarse antes de observar consultas de producción y estadísticas suficientes.

## Migraciones

1. `20260728212144_create_ecclesial_registry_foundation.sql`;
2. `20260728212411_secure_ecclesial_registry_by_country.sql`;
3. `20260728212649_add_ecclesial_registry_admin_rpcs.sql`;
4. `20260728212747_add_ecclesial_registry_affiliation_rpcs.sql`;
5. `20260728213412_index_ecclesial_registry_foreign_keys.sql`.

## Contratos automatizados

`tests/ecclesial-registry-contract.test.mjs` protege:

- presencia y orden del bloque migratorio;
- separación entre entidad, lugar, institución y canal;
- dedicación y consagración como hechos distintos;
- trazabilidad heredada;
- categorías de obras y medios;
- país derivado y afiliaciones fail-closed;
- RLS y ausencia de bypass nacional;
- fachadas `SECURITY INVOKER`;
- permiso explícito de publicación;
- auditoría;
- vistas públicas;
- índices de claves foráneas.

## Riesgos y siguientes pasos

- Las entidades heredadas de tipos `chapel`, `sanctuary`, `seminary`, `religious_house` y `special_center` siguen coexistiendo. No deben borrarse hasta completar comparación, UI y migración de enlaces.
- `cathedral_name` en jurisdicciones continúa siendo texto histórico. Debe convertirse posteriormente en relación con un `ecclesiastical_place` de tipo `cathedral`.
- No hay todavía instituciones reales cargadas para escuelas, hospitales, dispensarios o medios; solo están disponibles los catálogos y escritores.
- La interfaz administrativa y las fichas públicas todavía no consumen el nuevo registro.
- Las imágenes, documentos adjuntos y galerías de lugares e instituciones requieren un contrato de almacenamiento separado.
- La siguiente fase debe implementar navegación administrativa, listas, formularios y fichas públicas sin reintroducir el asistente heredado de parroquia/capilla como fuente principal.
