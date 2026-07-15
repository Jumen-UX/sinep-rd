# SINEP RD

[![CI](https://github.com/Jumen-UX/sinep-rd/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Jumen-UX/sinep-rd/actions/workflows/ci.yml)
[![E2E / Public accessibility](https://github.com/Jumen-UX/sinep-rd/actions/workflows/e2e-public.yml/badge.svg?branch=main)](https://github.com/Jumen-UX/sinep-rd/actions/workflows/e2e-public.yml)

Sistema Nacional de Información Eclesiástica y Pastoral de República Dominicana. Combina un portal público, herramientas administrativas y una base canónica e histórica respaldada por Supabase.

> Estado del producto: candidata a beta interna. El sprint funcional activo es Sprint 4 — Personas, cargos y nombramientos.

## Requisitos

- Node.js 24.
- pnpm 10.18.3.
- Un proyecto Supabase para flujos integrados.

## Configuración local

1. Copia `.env.example` como `.env.local` y completa las variables requeridas.
2. Instala dependencias con `pnpm install --frozen-lockfile`.
3. Inicia el entorno con `pnpm dev`.
4. Abre `http://localhost:3000`.

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

`CI` se ejecuta en `main` y valida las compuertas canónicas y CodeQL. `E2E / Public accessibility` cubre las rutas públicas afectadas con Chromium, Playwright y Axe.

La aplicación se despliega en Vercel. Mientras el entorno no sea público debe conservar protección de despliegue o controles equivalentes. Los secretos y variables se configuran fuera del repositorio.

Consulta [E2E y accesibilidad](./docs/testing/E2E_Y_ACCESIBILIDAD.md).

## Organización

- `src/app`: rutas, layouts, metadata y composición.
- `src/features`: módulos funcionales por dominio.
- `src/components`: componentes compartidos.
- `src/lib`: autorización, validación, privacidad y clientes Supabase.
- `supabase/migrations`: esquema, RLS, RPC y contratos de lectura.
- `tests`: pruebas unitarias, contractuales y de integración.
- `docs`: documentación canónica, trabajo activo y archivo histórico.

Consulta el [índice de documentación](./docs/README.md), el [Plan Maestro](./docs/product/PLAN_MAESTRO.md) y la [hoja de ruta vigente](./docs/product/ROADMAP.md). Antes de cerrar una pantalla o flujo, aplica los [estándares web](./docs/standards/ESTANDARES_WEB_SINEP_RD.md) y ejecuta `pnpm check`.
