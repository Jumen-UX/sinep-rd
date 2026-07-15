# Automatización documental y preventiva

> Estado: activo
> Documento canónico: sí
> Última revisión: 2026-07-15
> Responsable: arquitectura, calidad y documentación

## Objetivo

Mantener documentación, migraciones, pruebas y contratos operativos verificables junto con el código. La automatización debe detectar enlaces rotos, rutas antiguas, sprints contradictorios, términos heredados, migraciones inseguras y suites E2E afectadas antes de cerrar una tarea.

## Comandos documentales

- `pnpm docs:check`: valida integridad documental.
- `pnpm docs:index`: genera `docs/INDEX.generated.md` desde el inventario actual.
- `pnpm docs:index:check`: comprueba que el índice generado esté actualizado.
- `pnpm docs:affected`: informa qué documentos deben revisarse según los archivos modificados.
- `pnpm docs:terminology`: reporta términos y modelos heredados fuera del archivo histórico.
- `pnpm docs:terminology:strict`: convierte esos hallazgos en errores.

## Comandos de base de datos

- `pnpm audit:migrations`: revisa nombres y timestamps, `SECURITY DEFINER`, `search_path`, permisos a `anon/public`, claves foráneas sin índice declarado y operaciones destructivas.
- `pnpm audit:migrations:strict`: bloquea también por advertencias de cobertura o reversibilidad.

## Comandos de impacto

- `pnpm test:affected`: ejecuta pruebas contractuales relacionadas con los archivos modificados.
- `pnpm check:affected`: ejecuta documentación, terminología, reporte documental, auditoría de migraciones, TypeScript y pruebas afectadas.
- `pnpm e2e:affected`: muestra las suites Playwright que corresponden al dominio modificado.
- `pnpm e2e:affected:run`: ejecuta esas suites cuando existen entorno y credenciales.
- `pnpm automation:check`: reúne las auditorías preventivas sin ejecutar build ni toda la suite E2E.
- `pnpm check`: ejecuta los controles bloqueantes generales antes de TypeScript, pruebas y build.

## Controles bloqueantes

1. Todos los documentos declarados en `docs/DOCUMENTATION_MANIFEST.json` deben existir.
2. Los enlaces relativos de Markdown deben resolver a archivos o directorios existentes.
3. Ninguna prueba puede apuntar a un documento Markdown inexistente.
4. Solo puede existir un sprint marcado con `> Estado: activo` dentro de `docs/sprints/`.
5. El sprint activo debe coincidir con el declarado en el manifiesto.
6. Las migraciones deben tener nombres y timestamps únicos y válidos.
7. Una función `SECURITY DEFINER` debe fijar `search_path`.
8. No se permite conceder ejecución de funciones a `anon` o `public` desde migraciones.

## Controles informativos

Durante la transición, estos hallazgos generan advertencias:

- documentos sin metadata de estado;
- posibles duplicados por nombre normalizado;
- documentos no enlazados ni declarados en el manifiesto;
- términos heredados fuera de `docs/archive/`;
- claves foráneas sin índice declarado en la misma migración;
- operaciones `DROP` que requieren revisión de reversibilidad;
- documentos posiblemente afectados por un cambio;
- suites E2E recomendadas para el dominio modificado.

## Flujo obligatorio después de un cambio

1. Revisar el diff y las pruebas que referencian el archivo, función, ruta o componente modificado.
2. Ejecutar `pnpm check:affected`.
3. Revisar `pnpm e2e:affected` y ejecutar las suites recomendadas cuando el entorno lo permita.
4. Si cambió documentación, ejecutar `pnpm docs:index`.
5. Ejecutar `pnpm check` antes de marcar la tarea como completada.

## Flujo para mover o sustituir un documento

1. Crear o identificar el documento canónico nuevo.
2. Actualizar `docs/DOCUMENTATION_MANIFEST.json` cuando corresponda.
3. Actualizar enlaces y pruebas que lean la ruta anterior.
4. Mover el documento sustituido a `docs/archive/` y marcarlo como archivado.
5. Ejecutar `pnpm docs:check` y `pnpm docs:affected`.
6. Regenerar el índice con `pnpm docs:index`.
7. Ejecutar `pnpm check:affected` antes del chequeo completo.

## Límites

Los scripts detectan, clasifican y ejecutan verificaciones seguras. No eliminan ni fusionan documentos, no aplican migraciones, no modifican datos reales, no seleccionan credenciales y no ejecutan automáticamente mutaciones E2E sin una orden explícita y un entorno no productivo autorizado.
