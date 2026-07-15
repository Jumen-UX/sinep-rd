# Deprecaciones estructurales

> Estado: vigente
> Última revisión: 2026-07-15
> Propietario: arquitectura y dominio de estructuras

## Fuentes canónicas

- `ecclesiastical_entities`: identidad institucional.
- `structure_nodes` y `structure_node_edges`: jerarquía territorial configurable.
- `organization_charts` y `organization_units`: organización pastoral, administrativa y colegial.

Estas dimensiones coexisten y no deben fusionarse.

## Modelos retirados de consumidores de aplicación

No se permiten consumidores bajo `src/` de:

- `diocese_structure_templates`;
- `diocese_structure_levels`;
- `pastoral_structure_templates`;
- `pastoral_structure_levels`;
- `pastoral_entities`;
- `public_pastoral_entities`.

Las migraciones históricas pueden conservar menciones necesarias para transformación, compatibilidad de base o rollback. La prohibición aplica al código ejecutable de la aplicación.

## Compatibilidad permitida

`parent_node_id` solo puede exponerse como proyección de lectura calculada desde `structure_node_edges`. No autoriza reconstruir jerarquía desde `structure_nodes.parent_node_id`.

Las vistas públicas pueden proyectar nombres o identificadores derivados por compatibilidad de payload cuando la fuente real sea canónica. La compatibilidad es de solo lectura y no habilita escrituras a modelos retirados.

## Guardia automática

`pnpm audit:structures:strict` falla cuando detecta un modelo estructural sin clasificación de fuente o un consumidor de modelos retirados. La auditoría forma parte de `pnpm check`.

## Eliminación física

La ausencia de consumidores en `src/` no demuestra que una tabla heredada pueda eliminarse de Supabase. La eliminación física requiere:

1. inventario de dependencias de base;
2. paridad histórica;
3. verificación de migraciones y funciones;
4. plan de rollback;
5. diagnóstico reproducible posterior.

No se borran tablas heredadas únicamente porque la aplicación ya no las consuma.
