# Sprint 2 — Modelo estructural canónico

## Propósito

Este documento define la fuente de verdad estructural de SINEP RD y los límites entre identidad institucional, jerarquía territorial y organización interna.

La regla central es: **cada dimensión conserva una responsabilidad distinta y ninguna debe inferirse silenciosamente desde otra**.

## 1. Identidad institucional

### Fuente canónica

- `ecclesiastical_entities`

### Responsabilidad

Representa la identidad estable de una realidad eclesial: diócesis, parroquia, jurisdicción, templo u otra entidad institucional registrada.

### Invariantes

- Una entidad conserva su identidad aunque cambie de dependencia o posición jerárquica.
- El nombre, slug y metadatos institucionales no sustituyen la historia territorial.
- Las relaciones jerárquicas no deben reconstruirse desde nombres ni slugs.
- Las pantallas públicas consumen proyecciones de lectura derivadas de esta fuente y de sus relaciones canónicas.

## 2. Jerarquía territorial configurable

### Fuentes canónicas

- `structure_templates`
- `structure_levels`
- `structure_nodes`
- `structure_node_edges`

### Responsabilidad

Representa cómo se ordenan territorialmente las entidades dentro de una plantilla y una vigencia determinadas.

### Invariantes

- `structure_node_edges` es la única fuente de parentesco territorial vigente.
- `structure_nodes.parent_node_id` no es fuente jerárquica.
- `get_structure_tree` proyecta `parent_node_id` desde los edges para facilitar lectura, navegación y selección.
- Las raíces se determinan por ausencia de edges entrantes elegibles.
- Los ciclos deben impedirse antes de confirmar una relación.
- La vigencia y el estado se evalúan tanto en nodos como en edges.
- La identidad institucional enlazada no se duplica al mover un nodo.

### Contratos de lectura

- `get_structure_tree`
- `get_entity_descendants`
- servicios tipados del dominio `features/structures`

### Contratos de escritura

Las escrituras deben atravesar RPC o rutas administrativas con validación de alcance, permiso y auditoría. No se permiten escrituras directas desde clientes autenticados a las tablas canónicas.

## 3. Organización interna

### Fuentes canónicas

- `organization_charts`
- `organization_units`

### Responsabilidad

Representa estructuras pastorales, administrativas y colegiales que pueden existir en distintos niveles territoriales sin confundirse con la jerarquía territorial.

### Invariantes

- Una unidad organizativa pertenece a un organigrama explícito.
- Su jurisdicción se expresa mediante `ecclesiastical_entity_id` y, cuando aplica, mediante su alcance organizativo.
- La jerarquía interna usa `parent_unit_id`; no usa `structure_node_edges`.
- Crear o editar contenido ordinario no puede aprobar ni publicar implícitamente una unidad.
- Aprobación, publicación, desactivación y archivo son transiciones explícitas y auditadas.
- Las unidades en borrador permanecen internas hasta una acción separada de aprobación y publicación.

## 4. Cargos y nombramientos

### Fuentes relacionadas

- `organization_charts`
- `organization_units`
- catálogos de cargos
- configuraciones de cargos por nivel
- asignaciones y nombramientos canónicos

### Regla de alcance

Los cargos disponibles se determinan por la configuración del nivel, organigrama, jurisdicción y estado canónico de la persona. No existe fallback silencioso a todos los cargos.

Un nombramiento debe conservar:

- persona;
- cargo;
- jurisdicción institucional;
- organigrama y unidad cuando correspondan;
- vigencia;
- predecesor o sucesor cuando aplique;
- auditoría y fuente.

## 5. Relación entre dimensiones

| Dimensión | Responde a | No debe responder a |
| --- | --- | --- |
| Identidad institucional | ¿Qué entidad es? | ¿Dónde está ubicada hoy en la jerarquía? |
| Jerarquía territorial | ¿Cuál es su posición territorial vigente e histórica? | ¿Cómo se organiza internamente su pastoral o administración? |
| Organización interna | ¿Qué órganos, áreas y unidades funcionan dentro de un alcance? | ¿Qué entidad institucional existe o cuál es su identidad? |
| Nombramientos | ¿Quién ocupa qué cargo, dónde y durante qué vigencia? | ¿Cómo se redefine silenciosamente la estructura? |

## 6. Compatibilidad y retirada

La política de compatibilidad heredada está documentada en [SPRINT_2_LEGACY_COMPATIBILITY_INVENTORY.md](./SPRINT_2_LEGACY_COMPATIBILITY_INVENTORY.md).

Reglas:

- los modelos heredados bloqueados no pueden reaparecer bajo `src/`;
- las migraciones históricas pueden conservar referencias para rollback o transformación;
- una compatibilidad de payload solo puede ser de lectura y debe derivarse de fuentes canónicas;
- ninguna compatibilidad puede reabrir escrituras a tablas retiradas;
- la eliminación física de tablas requiere verificación de dependencias de base, paridad histórica y plan de rollback.

## 7. Auditoría y seguridad

Toda mutación estructural administrativa debe:

1. autenticar al actor;
2. validar permiso;
3. validar alcance territorial u organizativo;
4. validar invariantes y ausencia de ciclos;
5. ejecutar mediante contrato transaccional canónico;
6. registrar auditoría con jurisdicción y alcance;
7. invalidar cachés públicas afectadas cuando corresponda.

Las tablas canónicas críticas no deben aceptar escrituras directas desde clientes autenticados.

## 8. Criterio de uso para nuevas funcionalidades

Antes de implementar una funcionalidad nueva, se debe identificar:

- la dimensión responsable;
- la fuente canónica que se leerá;
- el contrato autorizado de escritura;
- la jurisdicción y el alcance requeridos;
- la vigencia e historial afectados;
- la proyección pública que debe invalidarse;
- las pruebas de contrato necesarias.

Cuando una función necesite datos de varias dimensiones, debe componerlas sin convertir una dimensión en sustituto de otra.

## 9. Estado de consolidación

Al cierre técnico de S2-06:

- no existen consumidores de aplicación de los seis modelos estructurales heredados bloqueados;
- la auditoría estricta forma parte de `pnpm check`;
- `parent_node_id` está formalizado como proyección de lectura desde edges;
- las rutas administrativas auditadas no realizan I/O directo;
- las escrituras estructurales críticas se mantienen detrás de servicios y contratos canónicos.

Este documento constituye la base documental de S2-07 y debe mantenerse sincronizado con cualquier cambio futuro del motor estructural.
