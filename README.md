# SINEP RD

[![CI](https://github.com/Jumen-UX/sinep-rd/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Jumen-UX/sinep-rd/actions/workflows/ci.yml)
[![E2E / Public accessibility](https://github.com/Jumen-UX/sinep-rd/actions/workflows/e2e-public.yml/badge.svg?branch=main)](https://github.com/Jumen-UX/sinep-rd/actions/workflows/e2e-public.yml)

Sistema Nacional de Información Eclesiástica y Pastoral de República Dominicana. Combina un portal público, herramientas administrativas y una base canónica e histórica respaldada por Supabase.

> Estado del producto: candidata a beta interna. Sprints 7 y 8 están cerrados. Sprint 9 está activo para completar la preparación operativa de una beta controlada; la apertura pública requiere una aprobación posterior.

## Requisitos

- Node.js 24.
- pnpm 10.18.3.
- Un proyecto Supabase para flujos integrados.

## Configuración local

1. Copia `.env.example` como `.env.local` y completa las variables requeridas.
2. Instala dependencias con `pnpm install --frozen-lockfile`.
3. Inicia el entorno con `pnpm dev`.
4. Abre `http://localhost:3000`.

Las variables públicas se limitan a la URL y clave publicable de Supabase. `SUPABASE_SERVICE_ROLE_KEY`, credenciales E2E y secretos de bypass son exclusivos del servidor o de la automatización protegida. Durante la beta, `PUBLIC_INDEXING_ENABLED` y `PUBLIC_LAUNCH_APPROVED` deben permanecer en `false`; la indexación solo se abre cuando ambos valores son `true`.

## Calidad

- `pnpm typecheck`: valida TypeScript.
- `pnpm test`: ejecuta pruebas unitarias y contractuales.
- `pnpm test:integration`: ejecuta pruebas contra Supabase real no productivo.
- `pnpm build`: genera la compilación de producción.
- `pnpm check`: ejecuta validación de legado, auditorías de rutas y estructuras, typecheck, pruebas y build.
- `pnpm test:e2e:install`: instala Chromium para Playwright.
- `pnpm test:e2e:public`: prueba rutas públicas y accesibilidad con Axe.
- `pnpm test:e2e:admin`: ejecuta el recorrido administrativo preparado.
- `pnpm test:e2e:access`: ejecuta la matriz autenticada cuando existe su configuración segura.

Las pruebas de integración y los escenarios E2E mutantes no deben ejecutarse contra producción.

## Automatización y despliegue

`CI` valida documentación, TypeScript, pruebas, build, contratos y seguridad. `E2E / Public accessibility` cubre las rutas públicas con Chromium, Playwright y Axe. Los workflows administrativos protegidos aprovisionan, validan y suspenden perfiles QA sin incorporar credenciales al repositorio.

La aplicación se despliega en Vercel. Mientras el entorno no sea público debe conservar protección de despliegue o controles equivalentes. Los secretos y variables se configuran fuera del repositorio.

Consulta [E2E y accesibilidad](./docs/testing/E2E_Y_ACCESIBILIDAD.md), [Operación y recuperación](./docs/OPERACION_Y_RECUPERACION.md), el [contrato de observabilidad](./docs/architecture/OBSERVABILITY_CONTRACT.md) y la [guía de despliegue, migración y restauración](./docs/operations/DESPLIEGUE_MIGRACION_RESTAURACION.md).

## Organización

- `src/app`: rutas, layouts, metadata y composición.
- `src/features`: módulos funcionales por dominio.
- `src/components`: componentes compartidos.
- `src/lib`: autorización, validación, privacidad y clientes Supabase.
- `supabase/migrations`: esquema, RLS, RPC y contratos de lectura.
- `tests`: pruebas unitarias, contractuales y de integración.
- `docs`: documentación canónica, trabajo activo y archivo histórico.

Consulta el [índice de documentación](./docs/README.md), el [Plan Maestro](./docs/product/PLAN_MAESTRO.md), la [hoja de ruta vigente](./docs/product/ROADMAP.md), el [cierre de Sprint 8](./docs/sprints/active/sprint-8.md) y el [Sprint 9 activo](./docs/sprints/active/sprint-9.md).

La aceptación temporal del riesgo de protección frente a contraseñas filtradas está documentada en [este registro de seguridad](./docs/security/RISK_ACCEPTANCE_LEAKED_PASSWORD_PROTECTION.md) y debe revisarse antes del lanzamiento público o el 2026-10-29, lo que ocurra primero.

Antes de cerrar una pantalla o flujo, aplica los [estándares web](./docs/standards/ESTANDARES_WEB_SINEP_RD.md) y ejecuta `pnpm check`.