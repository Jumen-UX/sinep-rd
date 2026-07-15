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

No se clasifica `parent_node_id` como modelo heredado. En el contrato TypeScript del árbol representa la proyección del padre resuelto para navegación y selección jerárquica. Su retirada solo procede si el contrato de lectura se sustituye explícitamente por una proyección basada exclusivamente en edges sin degradar consumidores.

Las vistas públicas canónicas también pueden proyectar nombres o identificadores derivados por compatibilidad de payload cuando la fuente real sea canónica. Esa compatibilidad debe permanecer de solo lectura y no puede habilitar escrituras a modelos retirados.

## Guardia automática

`pnpm audit:structures:strict` inventaría consumidores estructurales bajo `src/` y falla cuando encuentra:

1. un modelo estructural sin clasificación de fuente; o
2. un consumidor de cualquiera de los modelos heredados clasificados como `retirar`.

La auditoría forma parte de `pnpm check`, por lo que una regresión vuelve rojo CI antes de integrar nuevas referencias heredadas.

## Evidencia de línea base

La ejecución verde de CI previa a S2-06 reportó:

- `ecclesiastical_entities`: 27 consumidores, 51 referencias.
- `structure_nodes`: 7 consumidores, 9 referencias.
- `organization_units`: 16 consumidores, 29 referencias.
- `organization_charts`: 15 consumidores, 55 referencias.
- 0 consumidores con fuente estructural ambigua.
- `check:legacy` sin referencias al modelo pastoral eliminado.

Con la ampliación de la auditoría, los seis contratos heredados de este documento quedan además bloqueados explícitamente para consumidores bajo `src/`.

## Criterio de cierre S2-06

S2-06 puede cerrarse cuando:

- CI confirma cero consumidores de modelos heredados.
- La auditoría estricta permanece integrada en `pnpm check`.
- Toda compatibilidad temporal conservada tiene propósito explícito y no habilita escrituras heredadas.
- La documentación canónica de S2-07 enlaza esta matriz como política de retirada.

## Riesgo y deuda pendiente

Esta guardia protege consumidores de aplicación, no demuestra por sí sola que las tablas heredadas hayan sido eliminadas de Supabase. La eliminación física sigue pospuesta hasta validar dependencias de base, migraciones, rollback y paridad histórica. No deben borrarse tablas solo porque el código de aplicación ya no las consuma.
