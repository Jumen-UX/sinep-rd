# Sprint 2 — Inventario de compatibilidad estructural heredada

## Objetivo

Registrar qué contratos estructurales siguen permitidos en el código de aplicación y convertir la retirada de modelos heredados en una condición verificable por CI.

## Fuentes canónicas vigentes

| Modelo | Responsabilidad | Estado |
| --- | --- | --- |
| `ecclesiastical_entities` | Identidad institucional eclesial | Canónico |
| `structure_nodes` / `structure_node_edges` | Jerarquía territorial configurable | Canónico |
| `organization_charts` / `organization_units` | Organización pastoral, administrativa y colegial | Canónico |

Estos modelos representan dimensiones distintas. La coexistencia entre ellos no es una compatibilidad heredada y no debe resolverse fusionándolos.

## Modelos heredados retirados de consumidores de aplicación

| Modelo | Clasificación S2-06 | Regla |
| --- | --- | --- |
| `diocese_structure_templates` | Retirar | Ningún consumidor bajo `src/` puede leer o escribir este contrato |
| `diocese_structure_levels` | Retirar | Ningún consumidor bajo `src/` puede leer o escribir este contrato |
| `pastoral_structure_templates` | Retirar | Ningún consumidor bajo `src/` puede leer o escribir este contrato |
| `pastoral_structure_levels` | Retirar | Ningún consumidor bajo `src/` puede leer o escribir este contrato |
| `pastoral_entities` | Retirar | Ningún consumidor bajo `src/` puede leer o escribir este contrato |
| `public_pastoral_entities` | Retirar | Ningún consumidor bajo `src/` puede leer este contrato |

Las migraciones históricas pueden conservar menciones a estos nombres mientras sean necesarias para migración, compatibilidad de base o rollback. La prohibición se aplica al código ejecutable de la aplicación.

## Compatibilidades conservadas temporalmente

`parent_node_id` no se clasifica como modelo heredado. En `get_structure_tree` es una **proyección de lectura** calculada desde `structure_node_edges`; no constituye una fuente alternativa de jerarquía ni autoriza lecturas de `structure_nodes.parent_node_id`.

La compatibilidad queda protegida por `tests/structure-parent-projection-contract.test.mjs`, que verifica:

- raíces resueltas por ausencia de edges entrantes;
- descendientes resueltos por `eligible_edges`;
- `parent_node_id` proyectado desde `edge.parent_node_id`;
- ausencia de `n.parent_node_id as parent_node_id`;
- declaración explícita de que `structure_nodes.parent_node_id` no es fuente jerárquica.

Las vistas públicas canónicas también pueden proyectar nombres o identificadores derivados por compatibilidad de payload cuando la fuente real sea canónica. Esa compatibilidad debe permanecer de solo lectura y no puede habilitar escrituras a modelos retirados.

## Guardia automática

`pnpm audit:structures:strict` inventaría consumidores estructurales bajo `src/` y falla cuando encuentra:

1. un modelo estructural sin clasificación de fuente; o
2. un consumidor de cualquiera de los modelos heredados clasificados como `retirar`.

La auditoría forma parte de `pnpm check`, por lo que una regresión vuelve rojo CI antes de integrar nuevas referencias heredadas.

## Evidencia de línea base

La ejecución verde de CI confirmada para S2-06 reportó:

- `ecclesiastical_entities`: 27 consumidores, 51 referencias.
- `structure_nodes`: 7 consumidores, 9 referencias.
- `organization_units`: 16 consumidores, 29 referencias.
- `organization_charts`: 15 consumidores, 55 referencias.
- 0 consumidores con fuente estructural ambigua.
- `check:legacy` sin referencias al modelo pastoral eliminado.
- 0 consumidores bajo `src/` de los seis contratos heredados bloqueados.

## Estado S2-06

**Cierre técnico completado.**

Se cumplen las condiciones de aplicación:

- CI confirma cero consumidores de modelos heredados.
- La auditoría estricta permanece integrada en `pnpm check`.
- La compatibilidad `parent_node_id` tiene propósito explícito, fuente canónica y contrato automatizado.
- Las compatibilidades de payload permitidas son exclusivamente de lectura.

La documentación canónica de S2-07 debe enlazar esta matriz como política de retirada.

## Riesgo y deuda pendiente

Esta guardia protege consumidores de aplicación, no demuestra por sí sola que las tablas heredadas hayan sido eliminadas de Supabase. La eliminación física sigue pospuesta hasta validar dependencias de base, migraciones, rollback y paridad histórica. No deben borrarse tablas solo porque el código de aplicación ya no las consuma.
