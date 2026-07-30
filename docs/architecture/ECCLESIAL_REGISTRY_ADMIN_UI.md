# Interfaz administrativa del registro eclesial

> Estado: alcance funcional principal implementado; recorrido autenticado multinivel pendiente  
> Actualizada: 2026-07-30  
> Rutas: `/admin/registro-eclesial` y `/admin/relaciones-eclesiales`

## Alcance implementado

El registro eclesial separa la identidad territorial de los objetos físicos, institucionales y comunicacionales. No utiliza entidades territoriales heredadas como fuente de escritura para estos dominios.

El workspace cubre:

1. **Lugares**: templos, iglesias, catedrales, concatedrales, santuarios, basílicas, capillas y otros lugares físicos.
2. **Instituciones**: escuelas, universidades, seminarios, monasterios, dispensarios, hospitales, obras sociales, centros culturales y medios.
3. **Comunicación**: teléfono, correo, web, redes, radio, televisión, publicaciones, podcast y streaming.
4. **Edición e historial**: actualización de fichas, afiliaciones secundarias, cierre lógico y línea histórica.
5. **Fichas públicas**: páginas SSR para lugares e instituciones activos y públicos, con metadata dinámica, datos estructurados y sitemap.

## Navegación y permisos

El módulo aparece como **Registro eclesial** cuando el usuario posee alguno de estos permisos:

- `places.view`;
- `institutions.view`;
- `communications.view`.

Las acciones se derivan exclusivamente de permisos efectivos:

- lugares: `places.create_proposal`, `places.update_proposal` y `places.publish`;
- instituciones: `institutions.create_proposal`, `institutions.update_proposal` e `institutions.publish`;
- canales: `communications.update_proposal`.

Los usuarios sin permiso de publicación solo pueden guardar propuestas internas o en revisión. Las fachadas públicas son `SECURITY INVOKER`; las implementaciones privilegiadas permanecen en `app_private` y validan permiso, país y alcance.

## Ámbito activo

La interfaz envía `activeScope.type` y `activeScope.entityId` a los lectores RPC. PostgreSQL vuelve a filtrar cada fila por:

- alcance global o nacional;
- diócesis, parroquia o entidad;
- vicaría, zona o área pastoral;
- unidad organizativa;
- afiliaciones vigentes de lugares e instituciones.

Los canales pertenecientes a un lugar o institución heredan las afiliaciones vigentes de su propietario. Los canales de entidad o unidad conservan alcance directo.

## Contrato de lugares y templos

La ficha de un lugar incluye:

- tipo de lugar;
- entidad principal;
- unidad administradora opcional;
- nombre y nombre oficial;
- advocación y patrono;
- apertura, bendición, dedicación y consagración como hechos distintos;
- capacidad, ubicación y coordenadas;
- estado, visibilidad y fuentes;
- indicador de sede principal.

### Catedral y sede jurisdiccional

La relación entre un templo sede y una jurisdicción es explícita y canónica:

- `primary_entity_id` identifica la jurisdicción o entidad principal;
- `is_primary_seat = true` exige una afiliación primaria vigente `seat_of`;
- `is_primary_seat = false` utiliza la afiliación primaria `belongs_to`;
- la afiliación primaria debe apuntar exclusivamente a la entidad principal;
- solo puede existir una afiliación primaria vigente por lugar;
- al cambiar la entidad principal o la condición de sede, la relación anterior se cierra con fecha, estado inactivo y auditoría;
- la nueva relación se crea como un registro histórico separado.

La afiliación primaria no puede cerrarse desde la tabla de relaciones. Debe modificarse desde la ficha del lugar para conservar consistencia entre identidad, sede e historial.

Este contrato permite representar una catedral asociada a su diócesis o arquidiócesis sin convertir el edificio físico en la entidad territorial. También admite concatedrales u otras sedes porque la cardinalidad se controla por lugar, no mediante una restricción global injustificada por jurisdicción.

## Contrato de instituciones y centros

La ficha institucional incluye:

- categoría y dominio;
- entidad principal y unidad administradora opcional;
- nombre común, oficial y razón civil;
- fundación, erección canónica y registro civil como fechas distintas;
- ubicación, estado, visibilidad y fuentes.

La pertenencia primaria usa una afiliación `belongs_to`. Los cambios de entidad principal cierran la relación anterior y crean una nueva. Las relaciones secundarias permiten propiedad, administración, patrocinio, operación, adscripción pastoral, pertenencia a otra institución y ubicación.

## Canales y medios

Un canal puede pertenecer a:

- entidad eclesial;
- unidad organizativa;
- lugar físico;
- institución.

El registro admite canales de contacto, web, redes sociales, mensajería, radiodifusión y publicaciones. Cada canal conserva tipo, valor normalizado, etiqueta, visibilidad, estado, prioridad y verificación.

Los medios con identidad institucional propia se registran como instituciones del dominio `media`; sus frecuencias, sitios, redes, publicaciones y servicios se agregan como canales. Esto evita reducir una emisora, periódico o plataforma a un simple campo de texto.

## Edición e historial

`/admin/relaciones-eclesiales` permite:

- editar lugares, instituciones y canales existentes;
- consultar la ficha completa dentro del alcance activo;
- agregar relaciones secundarias;
- cerrar relaciones con fecha y nota sin borrarlas;
- distinguir la afiliación primaria protegida de las relaciones secundarias editables;
- conservar auditoría de altas, cambios, cierres y transiciones primarias.

## Fichas públicas

Los lugares e instituciones activos con visibilidad pública disponen de fichas SSR independientes. Las fichas reutilizan cargadores cacheados, metadata canónica, Open Graph, Twitter Cards, JSON-LD y sitemap. No exponen notas internas, actores de workflow ni relaciones privadas.

## Lectores y escritores principales

Lectores administrativos:

- `admin_list_ecclesiastical_places`;
- `admin_list_ecclesial_institutions`;
- `admin_list_communication_channels`;
- `admin_list_ecclesial_registry_owner_options`;
- `admin_get_ecclesiastical_place`;
- `admin_get_ecclesial_institution`;
- lectores de afiliaciones con historial.

Escritores auditados:

- `admin_save_ecclesiastical_place`;
- `admin_save_ecclesial_institution`;
- `admin_save_communication_channel`;
- escritores y cierres de afiliaciones.

Las mutaciones invalidan el caché público consolidado del registro.

## Evidencia técnica

El repositorio protege mediante pruebas contractuales:

- separación entre entidades, lugares, instituciones y canales;
- dedicación y consagración como hechos diferentes;
- categorías de educación, salud, formación, vida consagrada, caridad, cultura, administración y medios;
- alcance por país y afiliación;
- fachadas invocadoras y revocación anónima;
- índices de claves foráneas;
- edición e historial;
- transición `belongs_to` ↔ `seat_of` derivada de `is_primary_seat`;
- fichas públicas y sitemap.

## Ampliaciones posteriores

Estas capacidades no bloquean el cierre del registro principal y pertenecen a bloques posteriores de la cola:

- galerías, documentos e imágenes de lugares e instituciones;
- importación por lotes de escuelas, obras, centros y medios;
- impresión y selección de campos;
- directorios públicos transversales y breadcrumbs;
- recorrido E2E autenticado con cuentas de distintos niveles.

## Archivos principales

- `src/app/(admin)/admin/registro-eclesial/page.tsx`;
- `src/app/(admin)/admin/relaciones-eclesiales/page.tsx`;
- `src/features/ecclesial-registry/admin/EcclesialRegistryPage.tsx`;
- `src/features/ecclesial-registry/admin/EcclesialRegistryHistoryPage.tsx`;
- `src/features/ecclesial-registry/services/ecclesial-registry-admin-service.ts`;
- `src/features/ecclesial-registry/services/ecclesial-registry-history-service.ts`;
- `supabase/migrations/20260728212144_create_ecclesial_registry_foundation.sql`;
- `supabase/migrations/20260728223626_preserve_registry_primary_affiliation_history.sql`;
- `tests/ecclesial-registry-contract.test.mjs`;
- `tests/ecclesial-registry-ui-contract.test.mjs`;
- `tests/ecclesial-registry-history-ui-contract.test.mjs`.
