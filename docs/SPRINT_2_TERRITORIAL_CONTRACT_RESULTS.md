# Sprint 2 — Resultado del contrato territorial

Fecha de corte: 14 de julio de 2026.

## Hallazgo inicial

`src/lib/admin/scopeUtils.ts` consumía la RPC `get_entity_descendants`, pero la función no existía en el entorno real de Supabase. Además, `get_structure_tree` reconstruía la jerarquía con `structure_nodes.parent_node_id`, aunque el modelo canónico de vigencia e historia está en `structure_node_edges`.

## Correcciones aplicadas

1. Se creó `public.get_entity_descendants(uuid, integer)` como proyección institucional de la jerarquía territorial.
2. La descendencia se obtiene exclusivamente desde nodos territoriales vigentes y `structure_node_edges` vigentes.
3. La función devuelve entidades institucionales enlazadas, sin introducir una columna de padre en `ecclesiastical_entities`.
4. Se restringió la ejecución a usuarios autenticados.
5. `public.get_structure_tree` fue reemplazada para determinar raíces, padres, hijos, profundidad y `has_children` desde edges vigentes.
6. `structure_nodes.parent_node_id` permanece como dato de compatibilidad, pero ya no es fuente de lectura del árbol canónico.

## Validación real

- Las 12 plantillas activas devolvieron el mismo número de nodos mediante `get_structure_tree` que el conteo de nodos activos y vigentes.
- La plantilla principal devolvió 162 de 162 nodos.
- Las otras 11 plantillas devolvieron 1 de 1 nodo cada una.
- La proyección de descendientes se verificó sobre una zona pastoral con 14 entidades hijas directas y devolvió 14 registros en profundidad 1.
- El diagnóstico previo mantiene 0 plantillas sin raíz, 0 nodos con múltiples padres vigentes y 0 edges vigentes entre plantillas distintas.

## Contrato resultante

- `ecclesiastical_entities`: identidad y ficha institucional.
- `structure_nodes`: representación de la entidad o unidad dentro de un catálogo territorial.
- `structure_node_edges`: única fuente canónica de relación padre/hijo vigente e histórica.
- `get_structure_tree`: proyección de lectura del árbol territorial.
- `get_entity_descendants`: proyección de alcance institucional derivada del árbol territorial.

## Compatibilidad controlada

`structure_nodes.parent_node_id` no se elimina todavía porque puede existir en formularios, migraciones o adaptadores históricos. Su retiro se evaluará en S2-06 después de confirmar todos sus consumidores. No debe utilizarse para reconstruir jerarquías nuevas.
