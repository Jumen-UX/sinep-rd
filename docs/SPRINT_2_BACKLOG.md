# Sprint 2 — Consolidar el motor de estructuras

Fecha de inicio: 14 de julio de 2026.  
Cierre técnico: 14 de julio de 2026.  
Estado: **completado técnicamente**; validaciones operativas de beta separadas.

## Objetivo

Establecer el motor estructural canónico como única fuente de verdad para territorio, organización interna, jerarquías, cargos permitidos, consultas públicas y alcance administrativo.

## Estado de entrada

Sprint 1 cerró con:

- 55 rutas administrativas auditadas.
- 51 rutas delegadas en `src/features`.
- 4 rutas de composición.
- 0 rutas con I/O directo.
- 274 pruebas aprobadas.
- TypeScript y build de producción aprobados.

La consolidación pastoral ya avanzó antes de este sprint:

- `organization_units` es el modelo canónico para unidades pastorales, administrativas y orgánicas.
- El modelo heredado `pastoral_entities` fue retirado.
- Las referencias de nombramientos, auditoría, eventos, permisos y vistas públicas fueron migradas a `organization_unit_id`.
- Existe `check-no-legacy-pastoral.mjs` para impedir la reintroducción del modelo eliminado.
- Las escrituras de unidades organizativas pasan por contratos canónicos con permiso, alcance y auditoría.

Por tanto, Sprint 2 no debe repetir esa migración. Debe completar la paridad y definir con precisión las fronteras entre los modelos canónicos que permanecen.

## Modelos canónicos que deben coexistir

### Entidades eclesiásticas

`ecclesiastical_entities` representa entidades con identidad institucional propia y ficha pública, por ejemplo jurisdicciones, parroquias, capillas, templos y otros tipos configurados.

### Estructuras territoriales configurables

`structure_templates`, `structure_levels`, `structure_nodes` y `structure_node_edges` representan la jerarquía territorial configurable, su vigencia y sus relaciones históricas.

### Organización interna

`organization_charts` y `organization_units` representan organización pastoral, administrativa y colegial. No sustituyen las entidades eclesiásticas ni deben volver a convertirse en una jerarquía territorial paralela.

### Cargos y nombramientos

`office_configurations`, `structure_level_office_configurations` y `position_assignments` relacionan cargos, niveles, organigramas, unidades, entidades y personas sin duplicar la identidad de ninguno de esos dominios.

## Backlog de ejecución

### S2-01 — Inventario de correspondencias — COMPLETADO

- [x] Inventariar consumidores de `ecclesiastical_entities`, `structure_nodes`, `organization_units` y sus proyecciones activas.
- [x] Clasificar consumidores como territorial, organizativo, institucional, nombramiento, permiso, evento o presentación pública.
- [x] Detectar compatibilidades y adaptadores transitorios identificables en código activo.
- [x] Documentar qué modelo es fuente y cuál es proyección en cada caso.
- [x] Añadir `audit:structures` y `audit:structures:strict` al flujo reproducible; el modo estricto forma parte de `pnpm check`.

Resultado documentado en `docs/SPRINT_2_STRUCTURAL_MODEL_INVENTORY.md`.

Criterio de cierre:

- Existe una matriz archivo/consulta → modelo canónico → propósito.
- No queda ningún modelo detectado por el auditor sin fuente canónica clasificada.

### S2-02 — Consultas de paridad — COMPLETADO

- [x] Crear consultas reproducibles para conteos de entidades, plantillas, niveles, nodos, organigramas y unidades.
- [x] Comprobar catálogos sin raíz, nodos con múltiples padres vigentes y relaciones entre catálogos distintos.
- [x] Comprobar nodos sin entidad, entidades esperadas sin nodo y duplicidad entidad/nodo por catálogo.
- [x] Comprobar unidades sin organigrama, padres de otro organigrama y unidades sin entidad de alcance.
- [x] Comprobar paridad entre nombramientos, cargos, organigramas y unidades.
- [x] Añadir prueba contractual que garantiza que el diagnóstico permanezca completo y solo lectura.
- [x] Ejecutar el diagnóstico contra el entorno real y clasificar cada discrepancia como válida, migrable o bloqueante.
- [x] Añadir un diagnóstico separado del ciclo de vida para incluir unidades vigentes en estado `draft`.

Resultados documentados en `docs/SPRINT_2_STRUCTURAL_PARITY_RESULTS.md`.

Resultado principal:

- 12 plantillas activas, 61 niveles y 173 nodos activos/vigentes.
- 5 organigramas activos y 181 unidades vigentes.
- 0 discrepancias bloqueantes de jerarquía, alcance u organigrama.
- Las 181 unidades vigentes permanecen en estado `draft`; su promoción controlada se resolverá en S2-04.

Criterio de cierre:

- Las discrepancias quedan clasificadas como válidas, migrables o bloqueantes.
- Las consultas pueden ejecutarse nuevamente después de cada migración.

### S2-03 — Contrato territorial — COMPLETADO

- [x] Confirmar que toda jerarquía territorial se lee desde plantillas, niveles, nodos y edges vigentes.
- [x] Confirmar que una entidad con ficha propia se enlaza al nodo, pero no se duplica dentro del nodo.
- [x] Sustituir la lectura de `get_structure_tree` basada en `structure_nodes.parent_node_id` por una lectura basada en `structure_node_edges`.
- [x] Crear `get_entity_descendants` como proyección institucional derivada exclusivamente del motor territorial canónico.
- [x] Verificar que `scopeUtils.ts` consume la proyección canónica de descendencia.
- [x] Proteger el contrato territorial mediante pruebas automatizadas.

Resultados documentados en `docs/SPRINT_2_TERRITORIAL_CONTRACT_RESULTS.md`.

Validación real:

- Las 12 plantillas activas devolvieron paridad completa entre nodos activos/vigentes y nodos reconstruidos por `get_structure_tree`.
- La plantilla principal devolvió 162 de 162 nodos; las otras 11 devolvieron 1 de 1.
- Una zona pastoral con 14 hijos institucionales devolvió 14 descendientes directos desde edges vigentes.
- No existe jerarquía padre/hijo almacenada en `ecclesiastical_entities`.

Compatibilidad controlada:

- `structure_nodes.parent_node_id` permanece temporalmente como columna de compatibilidad, pero ya no es fuente canónica de lectura.
- Su retiro se decidirá en S2-06 después de inventariar consumidores históricos y adaptadores.

Criterio de cierre:

- Todas las jerarquías territoriales vigentes se reconstruyen desde `structure_node_edges`.
- No existen dos fuentes activas de lectura para la relación padre/hijo.

### S2-04 — Contrato organizativo — CIERRE TÉCNICO COMPLETADO

- [x] Verificar que pastoral, administración y colegialidad usan `organization_charts` y `organization_units`.
- [x] Revisar unidades sin organigrama, sin entidad de alcance o con padre incompatible.
- [x] Confirmar que vistas públicas, permisos, auditoría, cargos y eventos usan `organization_unit_id`.
- [x] Crear el contrato explícito y auditado de aprobación, publicación, desactivación, archivo y restauración.
- [x] Separar el guardado ordinario de las transiciones de estado y visibilidad.
- [x] Sustituir en la interfaz los selectores genéricos por acciones válidas según el estado.
- [x] Mantener bloqueada cualquier reintroducción de `pastoral_entities`.
- [x] Crear una cola de revisión por lotes para las unidades vigentes en borrador.
- [x] Definir criterios técnicos de preparación por organigrama y jurisdicción.
- [x] Normalizar las 12 jerarquías pastorales diocesanas: 12 cabeceras, 180 unidades hijas y 192 unidades alcanzables sin ciclos.
- [x] Mantener aprobación y publicación como acciones separadas, explícitas y auditadas.

Pendientes operativos trasladados a la beta:

- [ ] Validar permisos con cuentas reales separadas para edición, aprobación y publicación.
- [ ] Revisar funcionalmente las unidades por jurisdicción antes de aprobarlas.
- [ ] Publicar únicamente registros aprobados mediante el permiso correspondiente.

Resultados parciales documentados en `docs/SPRINT_2_ORGANIZATION_LIFECYCLE_RESULTS.md`.

Criterio de cierre:

- Toda unidad organizativa operativa pertenece a un organigrama válido.
- El estado `active` se obtiene mediante un contrato explícito de aprobación/publicación.
- Ninguna edición ordinaria puede aprobar o publicar una unidad.
- No existen referencias activas al modelo pastoral eliminado.

### S2-05 — Paridad de cargos y alcance — COMPLETADO

- [x] Verificar que los cargos por nivel provienen de `structure_level_office_configurations`.
- [x] Verificar que cargos organizativos respetan el organigrama configurado.
- [x] Revisar que nombramientos, auditoría y permisos resuelvan correctamente entidad, nodo o unidad.
- [x] Sustituir la actualización destructiva de cargos por nivel por una RPC transaccional, idempotente y auditada.
- [x] Eliminar el fallback silencioso a todos los cargos y validar 187 nombramientos vigentes sin incompatibilidades.

Criterio de cierre:

- No existe fallback silencioso a todos los cargos.
- La actualización de cargos por nivel no puede dejar un estado parcial.

### S2-06 — Compatibilidad y bloqueo de legados — COMPLETADO

- [x] Inventariar tablas, columnas, vistas y funciones heredadas restantes.
- [x] Mantener solo adaptadores con consumidor identificado y prueba de paridad.
- [x] Bloquear consumidores de aplicación de los seis modelos heredados identificados.
- [x] Formalizar `parent_node_id` exclusivamente como proyección de lectura desde `structure_node_edges`.
- [x] Documentar rollback y condición de eliminación física futura.

Criterio de cierre:

- Cada compatibilidad restante tiene propietario, consumidor y fecha de retiro.
- Ninguna tabla heredada recibe escrituras nuevas.

### S2-07 — Documentación canónica — COMPLETADO

- [x] Documentar el modelo lógico y las responsabilidades de las cuatro dimensiones.
- [x] Documentar identidad, jerarquía, vigencia, alcance, historia y enlaces públicos.
- [x] Registrar contratos autorizados de lectura, escritura, auditoría e invalidación pública.
- [x] Registrar reglas de selección de padre, nivel y cargo.
- [x] Enlazar el modelo canónico, el mapa de contratos y el inventario de compatibilidad desde `docs/README.md`.

Criterio de cierre:

- Un desarrollador puede identificar el modelo correcto sin leer migraciones históricas.

## Orden de ejecución

1. S2-01 Inventario de correspondencias. — COMPLETADO
2. S2-02 Consultas de paridad. — COMPLETADO
3. S2-03 Contrato territorial. — COMPLETADO
4. S2-04 Contrato organizativo. — CIERRE TÉCNICO COMPLETADO; VALIDACIÓN OPERATIVA PENDIENTE
5. S2-05 Paridad de cargos y alcance. — COMPLETADO
6. S2-06 Compatibilidad y bloqueo de legados. — COMPLETADO
7. S2-07 Documentación canónica. — COMPLETADO

Este orden es obligatorio porque las migraciones y bloqueos dependen del inventario y de las consultas de paridad. No se eliminará ninguna compatibilidad antes de identificar consumidores y verificar conteos.

## Criterio de cierre del sprint

Estado: **cumplido técnicamente** y validado por CI #1129 sobre `b528e827`.

- Todas las pantallas leen de modelos canónicos explícitos.
- Todas las escrituras llegan a un único contrato por dominio.
- Los conteos y jerarquías tienen consultas de paridad reproducibles.
- No se pierde historial ni enlace público.
- No existen escrituras activas a modelos heredados.
- `pnpm check` permanece verde.
- Las migraciones nuevas son idempotentes o tienen precondiciones explícitas.

## Deuda técnica controlada

- Caché de build en CI.
- Advertencias de Webpack por serialización de cadenas grandes.
- Unificación de catálogos compartidos en asistentes de entidades.
- Revisión de utilidades duplicadas de normalización, errores y alcance.

Estas tareas no deben desplazar el inventario y la paridad estructural, salvo que bloqueen una migración concreta.

## Separación de pendientes operativos

El cierre técnico del Sprint 2 no aprueba datos ni sustituye las pruebas de beta. Permanecen fuera del cierre de ingeniería:

- matriz real de permisos nacional, diocesana, restringida y sin privilegios;
- revisión funcional de las 192 unidades organizativas antes de su aprobación;
- publicación selectiva posterior a la aprobación;
- protección contra contraseñas filtradas en Supabase Auth;
- integración y recorrido administrativo autenticado en un entorno no productivo;
- respaldo, restauración y respuesta a incidentes.

Estos controles se gestionan en la hoja de ruta como **pendientes operativos de beta**.
