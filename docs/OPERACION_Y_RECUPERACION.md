# Operación y recuperación de SINEP RD

> Estado: activo
> Documento canónico: sí
> Última revisión: 2026-07-20
> Responsable: operaciones y plataforma

## Objetivo

Este documento define el procedimiento mínimo para verificar disponibilidad, responder a incidentes y recuperar el servicio sin improvisar cambios directos en producción.

## Health check

La aplicación expone:

```text
GET /api/health
```

Respuesta saludable:

```json
{
  "status": "ok",
  "service": "sinep-rd",
  "request_id": "00000000-0000-4000-8000-000000000000",
  "checks": { "application": "ok", "database": "ok" },
  "response_time_ms": 100,
  "checked_at": "2026-07-14T00:00:00.000Z"
}
```

Códigos esperados:

- `200`: aplicación y base de datos disponibles.
- `503`: aplicación disponible, pero Supabase degradado o inaccesible.

El endpoint usa `no-store`, limita la sonda de base de datos a cinco segundos y no expone claves, URL internas ni detalles SQL. `X-Request-Id` coincide con `request_id` para correlacionar una alerta con los logs seguros de plataforma.

El contrato de campos, registro y monitor se define en [Contrato mínimo de observabilidad](./architecture/OBSERVABILITY_CONTRACT.md).

Verificación manual:

```bash
HEALTH_BASE_URL=https://sinep-rd.vercel.app pnpm health:check
```

Para despliegues protegidos de Vercel:

```bash
HEALTH_BASE_URL=https://preview.example.vercel.app \
VERCEL_AUTOMATION_BYPASS_SECRET=... \
pnpm health:check
```

## Monitoreo recomendado

Frecuencia inicial: cada 5 minutos.

Alertar cuando ocurra cualquiera de estas condiciones:

- dos comprobaciones consecutivas con código distinto de `200`;
- `checks.database` distinto de `ok`;
- tiempo de respuesta superior a 5 segundos en tres comprobaciones consecutivas;
- aumento sostenido de respuestas `5xx`;
- nuevo grupo de errores de runtime en Vercel.

No incluir credenciales en la URL del monitor. Para despliegues protegidos, usar un encabezado de bypass almacenado como secreto del proveedor de monitoreo.

La selección del proveedor, el canal de alerta y sus responsables continúa siendo una comprobación operativa de beta; no se considera resuelta por CI.

## Respuesta a incidentes

1. Confirmar `/api/health` y registrar hora, código y tiempo de respuesta.
2. Revisar el despliegue activo de Vercel y sus errores de runtime.
3. Comprobar el estado de Supabase y la conectividad REST.
4. Identificar el último commit y la última migración aplicada.
5. No editar tablas canónicas directamente desde el cliente.
6. Si el fallo comenzó tras un despliegue de aplicación, restaurar el despliegue anterior estable.
7. Si el fallo comenzó tras una migración, detener escrituras y preparar una migración correctiva reproducible; no borrar manualmente el historial de migraciones.
8. Documentar causa, alcance, corrección y controles preventivos.

## Copias de seguridad

La política mínima debe cubrir:

- respaldo administrado de PostgreSQL según el plan de Supabase;
- exportación lógica periódica antes de cambios de alto riesgo;
- conservación separada de archivos de Storage;
- repositorio Git como fuente de migraciones y código;
- registro de fecha, responsable, entorno y hash del respaldo.

Antes de una migración destructiva:

1. confirmar `pnpm check` verde;
2. obtener respaldo o punto de restauración verificable;
3. revisar que la migración sea idempotente o tenga una corrección definida;
4. aplicar primero en un entorno no productivo cuando esté disponible;
5. validar conteos e invariantes después de aplicar.

## Restauración

La restauración debe probarse en un entorno aislado, nunca directamente sobre producción como primera prueba.

Procedimiento:

1. crear un proyecto o rama de recuperación;
2. restaurar el respaldo de base de datos;
3. restaurar los objetos de Storage requeridos;
4. aplicar únicamente las migraciones posteriores al punto restaurado;
5. configurar variables de entorno del entorno aislado;
6. ejecutar `pnpm check`;
7. ejecutar `pnpm health:check` contra el entorno restaurado;
8. ejecutar Playwright/Axe público y los recorridos administrativos no mutantes;
9. verificar conteos críticos: personas, entidades, unidades, nombramientos, eventos y lotes;
10. documentar duración real de recuperación y cualquier pérdida de datos.

## Criterio de recuperación aceptada

Una restauración se considera válida cuando:

- `/api/health` responde `200`;
- no hay migraciones pendientes inesperadas;
- las vistas públicas cargan;
- el login administrativo funciona;
- no existen referencias huérfanas ni intervalos inválidos;
- los controles RLS y RPC siguen vigentes;
- las pruebas E2E críticas pasan.

## Frecuencia de prueba

- prueba de health check: continua;
- revisión de errores de runtime: semanal y después de cada despliegue importante;
- prueba de restauración: trimestral y antes de la primera versión pública;
- revisión de este runbook: después de cada incidente relevante.
