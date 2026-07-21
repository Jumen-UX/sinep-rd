# Migraciones SQL históricas iniciales

Este directorio conserva SQL aplicado al proyecto de Supabase antes de que el historial comenzara a versionarse de forma completa en GitHub.

## Alcance recuperado

- Fuente: `supabase_migrations.schema_migrations` del proyecto operativo.
- Primer registro conservado por Supabase: `20260702194346_019_grant_public_view_dependencies`.
- Último registro anterior al primer bloque originalmente versionado en GitHub: `20260703042555_053_public_change_suggestions`.
- Total: **54 migraciones registradas**.
- SQL registrado: **146,436 bytes** al incluir los separadores históricos por archivo.

Los archivos SQL de este directorio son una **copia histórica de referencia**. No forman parte de `supabase/migrations` porque ya fueron aplicados y algunos dependen de un esquema base anterior. Copiarlos como migraciones nuevas o ejecutarlos sobre producción podría repetir cargas, permisos y modificaciones de datos.

## Integridad de los bloques

| Archivo | Rango | Migraciones | MD5 del contenido SQL extraído |
|---|---|---:|---|
| `20260702_initial_history_part_1_019_to_033.sql` | 019–033 | 28 | `0145be2574d295b748bc209b0e8c2aa4` |
| `20260702_initial_history_part_2_034_to_036c.sql` | 034–036c | 8 | `5cb44b06252ea005305587f92fc9de22` |
| `20260702_initial_history_part_3_037a_to_053.sql` | 037a–053 | 18 | `fa03d34b0f07c1ed5cce96533c29fd37` |

Los hashes anteriores corresponden al contenido de `statements` concatenado por versión, antes de añadir los comentarios `BEGIN MIGRATION` y `END MIGRATION` usados para separar cada registro dentro de los archivos históricos.

## Brecha anterior a 019

Supabase no conserva en `schema_migrations` registros 001–018. La migración 019 ya presupone la existencia de tablas, vistas, funciones, políticas y catálogos base. Por tanto, el SQL histórico exacto de 001–018 no puede reconstruirse honestamente desde la tabla de migraciones.

Para cerrar esa brecha se requiere una de estas fuentes:

1. un respaldo o exportación del proyecto anterior al 2 de julio de 2026;
2. archivos SQL originales conservados fuera de GitHub;
3. una reconstrucción explícita del esquema base a partir del catálogo actual, documentada como **baseline reconstruido**, no como historial original.

## Regla operativa

- No editar migraciones ya aplicadas.
- No mover estos archivos consolidados a `supabase/migrations`.
- Para una instalación desde cero, crear y validar un baseline reproducible en un proyecto aislado antes de utilizar las migraciones posteriores.
