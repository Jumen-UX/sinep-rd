# E2E y accesibilidad

> Estado: vigente
> Última revisión: 2026-07-15
> Propietario: ingeniería y frontend

## Objetivo

Documentar los modos de ejecución de Playwright y Axe sin mezclar pruebas públicas automáticas, recorridos administrativos de solo lectura y escenarios mutantes.

## Preparación local

```bash
pnpm install --frozen-lockfile
pnpm test:e2e:install
```

## Portal público

```bash
pnpm test:e2e:public
```

Cubre rutas públicas seleccionadas, navegación básica, teclado y comprobaciones Axe. El workflow `E2E / Public accessibility` se ejecuta automáticamente cuando cambian rutas públicas cubiertas y también admite ejecución manual.

## Suite E2E general

```bash
pnpm test:e2e
```

Ejecuta la configuración Playwright aplicable al entorno y variables disponibles.

## Administración de solo lectura

```bash
pnpm test:e2e:admin
```

Se usa para recorridos administrativos preparados para pruebas. Debe ejecutarse únicamente con una cuenta y un entorno autorizados.

## Matriz de acceso

```bash
pnpm test:e2e:access
```

Requiere `E2E_ACCESS_PROFILES_JSON`. La matriz verifica perfiles representativos y aislamiento de alcance sin escribir secretos en el repositorio.

## Escenarios mutantes

```bash
pnpm test:e2e:admin:mutation
```

Las pruebas mutantes solo pueden ejecutarse contra entornos no productivos, recuperables y explícitamente autorizados. Deben tener datos de prueba identificables y un procedimiento de limpieza o restauración.

## GitHub Actions

Los workflows canónicos son:

- `CI`: auditorías contractuales, typecheck, pruebas, build, CodeQL y ejecuciones manuales aplicables.
- `E2E / Public accessibility`: Playwright, Chromium y Axe sobre rutas públicas cubiertas.

Los filtros de rutas pueden hacer que un cambio exclusivamente documental no genere una nueva corrida E2E pública. Esto no convierte una referencia histórica de GitHub Actions en un workflow activo.

## Accesibilidad mínima automatizada

Las rutas críticas deben comprobar, según aplique:

- ausencia de violaciones Axe bloqueantes;
- navegación por teclado;
- un solo `h1`;
- etiquetas de formularios;
- estados de error;
- ausencia de scroll horizontal global;
- claro y oscuro;
- 320 px;
- texto ampliado;
- posición del botón flotante de accesibilidad;
- persistencia de preferencias.

Las pruebas automatizadas no sustituyen lector de pantalla, zoom de 400 %, alto contraste del sistema, touch, impresión real ni validación en dispositivos y navegadores representativos.

## Evidencia

Registrar commit, entorno, comando, fecha, resultado y artefactos. Nunca conservar contraseñas, tokens, service role ni el contenido de `E2E_ACCESS_PROFILES_JSON` en reportes públicos.
