# Contrato mínimo de observabilidad

> Estado: vigente
> Última revisión: 2026-07-20
> Responsable: operaciones y plataforma

## Objetivo

Definir la señal mínima para conocer la disponibilidad de SINEP RD sin convertir el health check, los logs o el monitor externo en una vía de exposición de datos internos.

## Señal canónica de disponibilidad

`GET /api/health` es la única sonda pública de disponibilidad de la aplicación.

El contrato diferencia:

- `application`: el Route Handler pudo ejecutarse y construir una respuesta válida;
- `database`: la API REST de Supabase respondió a una lectura pública, acotada y no cacheada.

La respuesta incluye únicamente:

- estado general `ok` o `degraded`;
- nombre público del servicio;
- identificador de correlación aleatorio;
- estado agregado de aplicación y base de datos;
- tiempo total de la comprobación;
- fecha UTC de la comprobación.

El encabezado `X-Request-Id` debe coincidir con `request_id` y permite relacionar la alerta externa con el evento de plataforma.

## Límites de seguridad

La sonda:

- usa la clave publicable y una lectura ya disponible por la Data API;
- limita la dependencia a cinco segundos;
- responde `200` cuando ambas comprobaciones están disponibles;
- responde `503` cuando la dependencia de datos está degradada;
- declara `Cache-Control: no-store, max-age=0`;
- no devuelve ni registra URL de Supabase, SQL, cuerpo de error, claves, tokens, variables de entorno, versiones, conteos privados o trazas.

No se crea una tabla, función privilegiada ni credencial exclusiva para observabilidad.

## Registro seguro

Una comprobación degradada emite `health_check_degraded` con:

- `request_id`;
- estados agregados de las comprobaciones;
- tiempo total de respuesta.

El evento no contiene el objeto de error original. La investigación detallada se realiza en los registros restringidos de Vercel y Supabase siguiendo el runbook operativo.

## Monitor externo

El monitor debe:

1. consultar `/api/health` cada cinco minutos;
2. tratar dos respuestas consecutivas distintas de `200` como incidente;
3. conservar código, hora, latencia y `X-Request-Id`;
4. almacenar cualquier bypass de protección como encabezado secreto, nunca en la URL;
5. alertar al canal y responsables operativos definidos para la beta.

La configuración real del proveedor, el canal y los responsables es evidencia operativa de beta. No queda completada por este contrato ni por CI.

## Verificación

- `pnpm health:check` valida estado, ambas comprobaciones y correlación.
- `tests/operational-health-contract.test.mjs` protege la respuesta y el registro seguro.
- `tests/operational-runbook-contract.test.mjs` protege el verificador y el procedimiento operativo.

