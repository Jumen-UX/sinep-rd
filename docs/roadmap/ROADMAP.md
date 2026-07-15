# Hoja de ruta de SINEP RD

> Estado: vigente  
> Actualizada: 2026-07-14  
> Rama operativa: `main`  
> Regla: validar cada punto contra código, migraciones y pruebas antes de iniciarlo

## Estado consolidado

La base cuenta con registro canónico de personas, dimensiones clericales, estructura configurable, permisos por jurisdicción, auditoría, revisión de incompatibilidades, portal público y CI con typecheck, pruebas y build.

La importación controlada persiste lotes y filas, valida catálogos, alcance, duplicados y relaciones, permite corrección por fila y exige una decisión editorial explícita. Los lotes aprobados de personas, estructuras, nombramientos y eventos históricos cuentan con contratos transaccionales, auditoría por fila, registro en `import_batch_changes` y repetición idempotente. Los eventos importados se crean en `pending_review`, generan su plan de acciones y no modifican automáticamente el estado estructural vigente. Las coincidencias exactas de estructuras, nombramientos y eventos pueden enlazarse como operaciones `noop` sin mutar registros canónicos.

El piloto real de eventos ya verificó creación canónica, corrección en línea, revalidación, aprobación, aplicación y una segunda aplicación `noop` sin duplicar el evento. El dispatcher y el contrato mixto soportan lotes `create + noop` en una única operación transaccional. La interfaz distingue `create`, `update` y `noop`, usa acciones de aplicación según el dominio y separa columnas obligatorias de campos opcionales de plantilla.

## Automatización canónica

Los únicos workflows operativos permitidos en el repositorio son:

- `CI`: typecheck, pruebas, build, CodeQL, auditoría crítica programada y E2E de producción bajo ejecución manual.
- `E2E / Public accessibility`: Chromium, Playwright y Axe sobre las rutas públicas afectadas.

El inventario queda protegido por una prueba contractual. GitHub puede conservar en la barra lateral referencias históricas a workflows eliminados; esas referencias no equivalen a archivos activos dentro de `.github/workflows`.

El workflow público utiliza filtros de rutas. Por tanto, una modificación exclusiva de documentación, pruebas contractuales o configuración ajena al portal público no genera una nueva corrida E2E; la última corrida aplicable continúa siendo la evidencia válida hasta que cambie una ruta cubierta o se ejecute manualmente.

## Hito técnico completado — Sprint 2

El Sprint 2 está **cerrado técnicamente** sobre `main`. La evidencia final es [CI #1129](https://github.com/Jumen-UX/sinep-rd/actions/runs/29383246693), asociado a `b528e827`, con auditorías, TypeScript, 294 pruebas, build y CodeQL aprobados.

Resultados consolidados:

- modelo estructural canónico documentado y protegido;
- parentesco territorial derivado exclusivamente de `structure_node_edges`;
- ciclo de vida organizativo separado del guardado ordinario;
- 12 jerarquías pastorales normalizadas con 192 unidades alcanzables y sin ciclos;
- cargos por nivel guardados mediante RPC transaccional y sin fallback silencioso;
- compatibilidades heredadas bloqueadas en CI;
- 56 rutas administrativas con 0 I/O directo;
- mapa de contratos e inventario de compatibilidad enlazados desde la documentación oficial.

Consulta [el cierre técnico del Sprint 2](../SPRINT_2_CIERRE.md).

El cierre técnico no equivale a aprobar datos, abrir la beta ni certificar producción. Las pruebas con usuarios reales, la revisión de las unidades organizativas, la integración no productiva, la protección de credenciales y la restauración permanecen como controles operativos.

## Próximo bloque técnico — Sprint 3

El siguiente bloque de ingeniería es **autenticación, acceso y onboarding**, apoyado en los permisos y alcances consolidados por Sprint 2. Incluye invitación, primer acceso, recuperación, estado reanudable de onboarding, confirmación de rol y ámbito, protección de rutas y pruebas por perfil.

Este bloque puede avanzar sin ocultar ni cerrar automáticamente los controles operativos de beta listados a continuación.

## Hito operativo actual — consolidación de la beta interna

SINEP RD se considera **candidata a beta interna**, no versión pública. El propósito de esta etapa es permitir pruebas controladas por usuarios autorizados sin relajar seguridad, trazabilidad ni consistencia histórica.

### Capacidades incluidas

- Portal público y fichas navegables.
- Portal administrativo autenticado.
- Registro canónico de personas, estructuras, cargos y eventos.
- Permisos y alcance jurisdiccional.
- Auditoría administrativa.
- Importación controlada, revisión editorial y aplicación idempotente.
- Suite de calidad en CI y E2E público con accesibilidad.

### Condiciones pendientes para abrir la beta a probadores internos

- [ ] Aplicar y verificar todas las migraciones en el entorno objetivo de beta.
- [ ] Ejecutar `pnpm test:integration` contra una instancia no productiva de Supabase.
- [ ] Ejecutar un recorrido autenticado de login, persona, estructura, nombramiento, evento, importación y auditoría.
- [ ] Preparar cuentas de prueba con alcances nacional, diocesano, restringido y sin privilegios.
- [ ] Confirmar que un usuario no puede operar fuera de su alcance.
- [ ] Revisar funcionalmente las 192 unidades organizativas antes de aprobarlas y mantener su publicación como acción posterior separada.
- [ ] Activar la protección contra contraseñas filtradas en Supabase Auth.
- [ ] Verificar copias de seguridad y realizar al menos una prueba documentada de restauración.
- [ ] Definir canal de incidencias, severidad y responsable de decisión durante la beta.
- [ ] Validar institucional y jurídicamente privacidad, cookies y aviso legal antes de cualquier apertura pública.

### Criterio de salida de beta interna

No se promoverá una candidata pública mientras exista cualquiera de estas condiciones:

- Incidencia P0 o P1 abierta.
- Operación crítica sin auditoría o sin control de alcance.
- Migración pendiente en el entorno público.
- Flujo administrativo crítico sin prueba autenticada.
- Incumplimiento de accesibilidad bloqueante.
- Ausencia de procedimiento de respaldo, restauración o respuesta a incidentes.

## Programa transversal — experiencia de usuario

El [Plan UX vigente](../PLAN_UX.md) forma parte de esta hoja de ruta y debe aplicarse a toda pantalla o flujo nuevo. Su ejecución no es una reescritura decorativa: consolida componentes, navegación, accesibilidad, prevención de errores, rendimiento percibido y validación con usuarios.

### Prioridad inmediata UX

1. [ ] Consolidar tokens y primitivas visuales compartidas.
2. [ ] Implementar tema claro, oscuro y automático sin destello inicial.
3. [ ] Incorporar el botón flotante y el panel de preferencias de accesibilidad.
4. [ ] Corregir contraste AA en textos, acciones y estados.
5. [ ] Unificar navegación pública y administrativa, eliminando duplicidades.
6. [ ] Normalizar formularios, resumen de errores y confirmación de impacto.
7. [ ] Añadir pruebas visuales en claro, oscuro, escritorio, tableta y móvil.

Estos puntos son P0 del producto y deben completarse antes de ampliar la beta a un grupo mayor o declarar una versión pública.

## Prioridad 0 — operación segura

- [ ] Aplicar y verificar en cada entorno todas las migraciones pendientes. Las migraciones de importación están aplicadas y verificadas en el proyecto Supabase conectado.
- [ ] Ejecutar pruebas de integración contra una instancia no productiva de Supabase.
- [ ] Realizar smoke test autenticado de las rutas administrativas críticas. Preparación, corrección, revalidación, aprobación y aplicación de los cuatro dominios tienen smoke test autenticado por RPC. La aplicación `noop` también fue verificada con repetición idempotente.
- [ ] Confirmar protección contra contraseñas filtradas y revisar asesores de seguridad de Supabase. Los asesores fueron revisados; la protección contra contraseñas filtradas continúa pendiente de activación.
- [ ] Validar institucional y jurídicamente privacidad, cookies y aviso legal.
- [x] Consolidar los workflows en `CI` y `E2E / Public accessibility` y proteger su inventario mediante prueba contractual.

### Orden inmediato de ejecución

1. Ejecutar integración sobre Supabase no productivo.
2. Automatizar el recorrido administrativo autenticado de beta.
3. Validar permisos y alcance con cuentas representativas.
4. Revisar y aprobar de forma controlada las unidades organizativas; publicar solo después y por separado.
5. Cerrar protección de credenciales, respaldo y restauración.
6. Ejecutar en paralelo el Sprint UX 0.1 del Plan UX.
7. Implementar Sprint 3 — autenticación, acceso y onboarding sobre los alcances consolidados.
8. Abrir una ronda limitada de beta interna con registro formal de incidencias.
9. Retomar operaciones `update` e iniciativas funcionales posteriores cuando los controles anteriores estén cerrados.

## Prioridad 1 — importación controlada

Disponible actualmente:

- Plantillas CSV, lectura local, hash SHA-256 y vista previa limitada.
- Persistencia de lotes, filas e incidencias con RLS por alcance.
- Validación de campos, catálogos, fechas, duplicados y relaciones.
- Historial de lotes, detalle por fila, corrección y revalidación.
- Aprobación o rechazo mediante el permiso `imports.review`.
- Reinicio automático de la aprobación cuando el lote vuelve a validarse.
- Aplicación de lotes de personas, estructuras, nombramientos y eventos mediante `imports.apply`.
- Creación atómica mediante los motores canónicos de personas, estructuras, cargos y eventos.
- Eventos importados en `pending_review`, con plan de acciones y sin mutación estructural automática.
- Enlace `noop` para coincidencias exactas y únicas de estructuras, nombramientos y eventos.
- Lotes mixtos `create + noop` dentro de una única operación transaccional.
- Reversión transaccional completa ante el fallo de cualquier fila.
- Protección contra doble aplicación mediante respuesta idempotente.
- Auditoría y trazabilidad entre fila, registro creado o enlazado, cambio aplicado y auditoría.
- Fixtures reproducibles del piloto de eventos y su corrección.
- Suite Playwright/Axe manual, versionada y separada de `pnpm check`.
- Reporte final CSV de lotes aplicados con hash, resumen de aplicación, operación y objetivo canónico por fila.

### Completado

- [x] Crear tablas de lote, filas, incidencias y cambios aplicados.
- [x] Implementar RPC de preparación y validación transaccional.
- [x] Validar catálogos, relaciones, alcance y duplicados por fila.
- [x] Permitir corrección y reintento del lote sin modificar registros canónicos.
- [x] Añadir historial, detalle e incidencias accesibles según el alcance administrativo.
- [x] Añadir revisión editorial explícita, separada de la aplicación canónica.
- [x] Invalidar automáticamente una aprobación anterior cuando cambian los datos validados.
- [x] Implementar aplicación transaccional e idempotente para lotes de personas.
- [x] Implementar aplicación transaccional e idempotente para parroquias y estructuras.
- [x] Implementar aplicación transaccional e idempotente para cargos y nombramientos.
- [x] Implementar registro transaccional e idempotente de eventos históricos.
- [x] Mantener los eventos importados en revisión y bloquear efectos estructurales automáticos.
- [x] Detectar coincidencias exactas y únicas de estructuras, nombramientos y eventos.
- [x] Aplicar lotes completamente `noop` sin modificar registros canónicos.
- [x] Registrar operaciones `noop` en `import_batch_changes` y en auditoría.
- [x] Permitir lotes mixtos `create + noop` dentro de una única transacción.
- [x] Impedir doble aplicación y revertir todo el intento cuando falla una fila.
- [x] Añadir soporte visual y contractual para operaciones `update`.
- [x] Separar columnas obligatorias de columnas opcionales de plantilla.
- [x] Usar acciones de aplicación dinámicas según el dominio.
- [x] Añadir reporte final descargable para lotes aplicados.
- [x] Añadir suite E2E manual del portal público, accesibilidad y preparación administrativa de importaciones.
- [x] Confirmar `pnpm check` y E2E público en GitHub Actions después de la depuración de workflows.

### Pendiente — orden de ejecución

1. [ ] Completar operaciones `update` con comparación visible de cambios y aprobación explícita para todos los dominios que deban admitir actualización.
2. [ ] Añadir un identificador estable para habilitar `noop` seguro en personas.
3. [ ] Añadir lectura XLSX después de evaluar dependencia, límites y seguridad.
4. [ ] Ampliar E2E al recorrido autenticado preparar → corregir → aprobar → aplicar en un entorno no productivo.

## Prioridad 2 — calidad del producto

- [x] Añadir base E2E de portal público y flujo administrativo de importación.
- [x] Automatizar WCAG con Axe y recorridos básicos de teclado.
- [x] Añadir metadata dinámica para fichas públicas y URLs canónicas.
- [ ] Ampliar pruebas E2E a login y flujos administrativos críticos.
- [ ] Incorporar Lighthouse/Core Web Vitals en una compuerta medible.
- [ ] Probar navegación móvil real y tablas adaptativas.
- [ ] Optimizar imágenes remotas con una política explícita.
- [ ] Completar los criterios P0 y P1 definidos en el Plan UX.

## Prioridad 3 — mantenibilidad y rendimiento

- [ ] Consolidar servicios y selectores jerárquicos que todavía tienen variantes heredadas.
- [ ] Reducir páginas con lógica de dominio dentro de `src/app`.
- [ ] Unificar componentes visuales administrativos sobre primitivas oficiales.
- [ ] Completar la estrategia de caché e invalidación para endpoints públicos.
- [ ] Medir consultas lentas, tamaño de respuestas y crecimiento de tablas históricas.
- [ ] Revisar y retirar RPC históricas `SECURITY DEFINER` expuestas cuando exista un wrapper seguro equivalente.

## Prioridad 4 — estadísticas e inteligencia eclesial

El módulo de estadísticas debe reutilizar los contratos canónicos de personas, estructuras, cargos, organismos, eventos y calidad de datos. No se crearán conteos manuales ni modelos paralelos. La implementación comenzará después de cerrar los controles de beta interna y de consolidar los servicios de lectura necesarios.

### Alcance funcional

- Vista pública agregada en `/estadisticas`.
- Vista administrativa por permisos y alcance en `/admin/estadisticas`.
- Dimensiones territorial, personas y ministerios, pastoral, administrativa, colegial, calidad de datos y evolución histórica.
- Filtros jerárquicos por país, provincia eclesiástica, jurisdicción, estructura, nodo y periodo.
- Comparación entre periodos y entre unidades equivalentes.
- Desglose navegable desde cada KPI hasta los registros que explican el resultado.
- Compatibilidad con modo oscuro, teclado, lectores de pantalla y tablas equivalentes para los gráficos.
- Exportaciones controladas y auditadas.

### Fase 1 — gobierno y contratos

1. [ ] Crear el diccionario funcional de KPI con definición, fórmula, numerador, denominador, exclusiones, visibilidad y ámbitos compatibles.
2. [ ] Seleccionar un MVP de 25 a 35 indicadores validados.
3. [ ] Clasificar cada indicador como público, administrativo o restringido.
4. [ ] Crear contratos TypeScript comunes para filtros, periodos, KPI, distribuciones, series, alertas y drilldown.
5. [ ] Definir permisos separados para lectura pública, lectura administrativa, calidad, historia, exportación y administración de definiciones.

### Fase 2 — motor estadístico

1. [ ] Crear `kpi_definitions`, `kpi_supported_scopes` y `kpi_snapshots`.
2. [ ] Implementar la resolución común del ámbito y sus descendientes según dominio, vigencia histórica y permisos.
3. [ ] Crear RPC versionada para el dashboard público agregado.
4. [ ] Crear RPC versionada para el dashboard administrativo con control de alcance.
5. [ ] Crear RPC paginada de drilldown por indicador.
6. [ ] Añadir pruebas de seguridad para usuarios nacionales, diocesanos, restringidos y no autenticados.
7. [ ] Garantizar que el valor de cada KPI coincida con su lista de detalle.

### Fase 3 — interfaz común

1. [ ] Crear `src/features/estadisticas` con rutas delgadas dentro de `src/app`.
2. [ ] Implementar filtros sincronizados con parámetros URL.
3. [ ] Crear tarjetas KPI con estados de valor, carga, sin datos, no aplica, error y restringido.
4. [ ] Crear tablas y gráficos accesibles con alternativa tabular.
5. [ ] Mostrar definición, fórmula, periodo, ámbito y fecha de cálculo desde cada indicador.
6. [ ] Implementar navegación de detalle y retorno conservando los filtros.

### Fase 4 — MVP territorial y de personas

Indicadores mínimos:

- Jurisdicciones, parroquias y lugares de culto activos.
- Entidades por tipo y por jurisdicción.
- Entidades con ubicación geográfica.
- Cambios estructurales por periodo.
- Personas publicadas.
- Obispos, sacerdotes y diáconos activos.
- Religiosos, religiosas y laicos con responsabilidades vigentes.
- Sacerdotes por parroquia.
- Clero sin asignación vigente.
- Parroquias con párroco y parroquias con cargo principal vacante.

Trabajo:

1. [ ] Implementar adaptadores de lectura territorial.
2. [ ] Implementar adaptadores de personas y ministerios sin duplicar personas con varias asignaciones.
3. [ ] Añadir distribuciones, comparaciones entre jurisdicciones hermanas y drilldowns.
4. [ ] Validar resultados actuales e históricos contra los registros canónicos.

### Fase 5 — pastoral, administrativa y colegial

1. [ ] Medir organismos pastorales por nivel, cobertura, responsables y vacantes.
2. [ ] Medir unidades administrativas, directores, cargos vigentes, vacantes y nombramientos próximos a vencer.
3. [ ] Medir organismos colegiales, miembros vigentes, representación, puestos vacantes y mandatos próximos a vencer.
4. [ ] Evitar que una misma unidad se cuente incorrectamente en más de un dominio.
5. [ ] Mostrar `No aplica` cuando un indicador no sea válido para el nivel seleccionado, en vez de mostrar cero.

### Fase 6 — calidad de datos y alertas

1. [ ] Definir reglas ponderadas de completitud por tipo de registro.
2. [ ] Medir registros completos, parciales, sin fuente, pendientes de revisión, desactualizados o potencialmente duplicados.
3. [ ] Detectar relaciones estructurales inconsistentes, cargos vencidos sin cierre y organismos sin responsable.
4. [ ] Convertir cada alerta en una acción navegable hacia el registro corregible.
5. [ ] Respetar `No aplica`, `No identificado` y otras ausencias legítimas sin penalizarlas como error.

### Fase 7 — historia, rendimiento y publicación

1. [ ] Generar snapshots mensuales, anuales y de reportes oficiales para indicadores seleccionados.
2. [ ] Mantener versión de fórmula y evitar reescribir silenciosamente cifras históricas.
3. [ ] Implementar series temporales y comparación de periodos.
4. [ ] Relacionar variaciones relevantes con eventos de creación, división, fusión, supresión o cambio de dependencia.
5. [ ] Implementar caché pública, invalidación, paginación e índices basados en planes de ejecución reales.
6. [ ] Añadir exportación CSV y PDF con filtros, usuario, fecha y ámbito auditados.
7. [ ] Incorporar pruebas E2E, accesibilidad, modo oscuro, móvil y presupuestos de rendimiento.
8. [ ] Documentar el procedimiento para añadir o modificar un KPI.

### Criterio de cierre

- Todas las fórmulas están documentadas y versionadas.
- Cada valor coincide con su desglose.
- Los filtros respetan estructura, vigencia y alcance.
- Ningún dato privado se expone en agregaciones o exportaciones.
- Las comparaciones históricas no mezclan metodologías incompatibles.
- Los gráficos tienen alternativa tabular accesible.
- `pnpm check`, E2E y pruebas de autorización terminan en verde.
- Existe documentación técnica y funcional para mantener el módulo.

## Fuera de alcance inmediato

- Reescritura visual completa sin necesidad funcional.
- Sustitución del motor canónico por modelos paralelos.
- Aplicación automática de importaciones sin revisión.
- Analítica avanzada de actividades, finanzas, sacramentos o desempeño pastoral antes de disponer de datos, metodología, permisos y validación institucional.
- Declarar una versión pública antes de cerrar los controles de beta interna.

## Criterio de cierre de una iniciativa

- Implementación y migración versionadas.
- Autorización, RLS y privacidad revisadas.
- Pruebas proporcionales al riesgo.
- Typecheck y build correctos.
- Documentación vigente actualizada.
- Cumplimiento de los criterios UX aplicables.
- Recorrido funcional verificado en el entorno objetivo.