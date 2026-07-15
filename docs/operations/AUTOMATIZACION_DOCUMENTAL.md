# Automatización documental

> Estado: activo
> Documento canónico: sí
> Última revisión: 2026-07-15
> Responsable: arquitectura y documentación

## Objetivo

Mantener la documentación verificable junto con el código y evitar enlaces rotos, rutas antiguas en pruebas, sprints activos contradictorios, documentos canónicos ausentes y acumulación silenciosa de duplicados o archivos huérfanos.

## Comandos

- `pnpm docs:check`: valida integridad documental.
- `pnpm docs:index`: genera `docs/INDEX.generated.md` desde el inventario actual.
- `pnpm docs:index:check`: comprueba que el índice generado esté actualizado.
- `pnpm check:affected`: ejecuta documentación, TypeScript y pruebas relacionadas con los archivos modificados.
- `pnpm check`: ejecuta la validación documental antes de auditorías, TypeScript, pruebas y build.

## Controles bloqueantes

1. Todos los documentos declarados en `docs/DOCUMENTATION_MANIFEST.json` deben existir.
2. Los enlaces relativos de Markdown deben resolver a archivos o directorios existentes.
3. Ninguna prueba puede apuntar a un documento Markdown inexistente.
4. Solo puede existir un sprint marcado con `> Estado: activo` dentro de `docs/sprints/`.
5. El sprint activo debe coincidir con el declarado en el manifiesto.

## Controles informativos

Durante la transición documental, estos hallazgos generan advertencias sin bloquear CI:

- documentos sin metadata de estado;
- posibles duplicados por nombre normalizado;
- documentos no enlazados ni declarados en el manifiesto;
- documentos activos todavía no clasificados.

Después de limpiar el inventario, estas reglas pueden elevarse a modo estricto desde el manifiesto.

## Flujo para mover o sustituir un documento

1. Crear o identificar el documento canónico nuevo.
2. Actualizar `docs/DOCUMENTATION_MANIFEST.json` cuando corresponda.
3. Actualizar enlaces y pruebas que lean la ruta anterior.
4. Mover el documento sustituido a `docs/archive/` y marcarlo como archivado.
5. Ejecutar `pnpm docs:check`.
6. Regenerar el índice con `pnpm docs:index`.
7. Ejecutar `pnpm check:affected` antes del chequeo completo.

## Límites

Los scripts detectan y reportan; no eliminan, fusionan ni reescriben automáticamente decisiones funcionales o arquitectónicas. El archivado y la consolidación siguen requiriendo revisión humana.
