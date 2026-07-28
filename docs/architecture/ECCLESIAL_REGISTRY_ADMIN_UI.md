# Interfaz administrativa del registro eclesial

> Estado: primera versión implementada; build y recorrido autenticado pendientes de evidencia final  
> Fecha: 2026-07-28  
> Ruta: `/admin/registro-eclesial`

## Alcance implementado

La primera interfaz operativa consume el modelo descrito en `ECCLESIAL_PLACES_INSTITUTIONS_MEDIA.md` sin utilizar las entidades heredadas como fuente de escritura.

El workspace se divide en tres secciones:

1. **Lugares**: templos, iglesias, santuarios, capillas y otros lugares físicos.
2. **Instituciones**: escuelas, universidades, seminarios, monasterios, dispensarios, hospitales, obras sociales y medios.
3. **Comunicación**: teléfono, correo, web, redes, radio, televisión, publicaciones, podcast y streaming.

## Navegación y permisos

El módulo aparece como **Registro eclesial** en la sección de directorios cuando el usuario posee alguno de estos permisos:

- `places.view`;
- `institutions.view`;
- `communications.view`.

La UI deriva las acciones disponibles exclusivamente desde permisos efectivos:

- lugares: `places.create_proposal` y `places.publish`;
- instituciones: `institutions.create_proposal` e `institutions.publish`;
- canales: `communications.update_proposal`.

Los usuarios sin permiso de publicación solo pueden guardar lugares o instituciones con estado `under_review` y visibilidad `internal`.

## Ámbito activo

La interfaz envía `activeScope.type` y `activeScope.entityId` a los lectores RPC.

La migración `20260728215830_add_ecclesial_registry_read_rpcs.sql` filtra en PostgreSQL:

- ámbito global;
- país;
- diócesis;
- parroquia;
- entidad;
- vicaría;
- zona;
- área pastoral;
- unidad organizativa.

Los nodos estructurales y las unidades utilizan recorridos recursivos con límite de profundidad y protección de ciclos. Los lugares e instituciones también pueden entrar en el ámbito mediante afiliaciones vigentes.

La matriz ejecutada con el administrador DO devolvió:

- 4 lugares;
- 1 institución;
- 168 canales;
- 52 propietarios autorizados.

Los registros de otros países quedaron fuera del resultado.

## Lectores RPC

Fachadas públicas `SECURITY INVOKER`, disponibles solo para `authenticated`:

- `admin_list_ecclesiastical_places`;
- `admin_list_ecclesial_institutions`;
- `admin_list_communication_channels`;
- `admin_list_ecclesial_registry_owner_options`.

Los lectores privados verifican permisos y vuelven a validar el alcance de cada fila. No dependen solamente del filtro del navegador.

## Formularios

### Lugar

Campos iniciales:

- tipo de lugar;
- entidad principal;
- nombre y nombre oficial;
- advocación y patrono;
- dedicación;
- consagración;
- municipio y dirección;
- estado y visibilidad;
- indicador de sede principal;
- descripción.

El formulario deshabilita dedicación o consagración cuando el catálogo del tipo no admite el acto. La base repite la validación.

### Institución

Campos iniciales:

- categoría;
- entidad principal;
- nombre y nombre oficial;
- fundación;
- erección canónica;
- municipio y dirección;
- estado y visibilidad;
- descripción.

### Canal

El propietario puede ser:

- entidad eclesial;
- unidad organizativa;
- lugar físico;
- institución.

Campos iniciales:

- propietario;
- tipo de canal;
- etiqueta;
- valor;
- visibilidad;
- indicador principal.

La lista de propietarios ya llega filtrada por permiso, país y ámbito activo.

## Listas y filtros

Cada pestaña incluye:

- búsqueda normalizada;
- filtro por tipo o categoría;
- estado;
- visibilidad;
- tabla accesible con caption;
- estados vacíos y de carga;
- mensajes de error y confirmación.

Las tablas muestran:

- lugar: tipo, entidad principal, dedicación, consagración, estado, afiliaciones y canales;
- institución: categoría, dominio, entidad principal, fundación, erección, estado, afiliaciones y canales;
- canal: propietario, tipo, valor, país, estado y visibilidad.

## Archivos

- `src/app/(admin)/admin/registro-eclesial/page.tsx`;
- `src/features/ecclesial-registry/admin/EcclesialRegistryPage.tsx`;
- `src/features/ecclesial-registry/services/ecclesial-registry-admin-service.ts`;
- `src/features/ecclesial-registry/index.ts`;
- `src/features/admin/navigation/admin-navigation-contract.ts`;
- `supabase/migrations/20260728215830_add_ecclesial_registry_read_rpcs.sql`;
- `tests/ecclesial-registry-ui-contract.test.mjs`.

## Pendientes de la siguiente iteración

- edición de registros existentes;
- interfaz de afiliaciones y línea histórica;
- fichas públicas y rutas internacionales;
- relación explícita de catedral con la jurisdicción;
- galerías, documentos e imágenes;
- importación por lotes de escuelas, obras y medios;
- impresión y selección de campos;
- recorrido E2E autenticado con cuentas de distintos niveles;
- confirmación de build del HEAD cuando Vercel permita una nueva construcción.
