# Stack oficial

> Estado: vigente
> Última revisión: 2026-07-15
> Fuente verificable: `package.json`, lockfile y `.github/workflows`

## Aplicación

- Next.js 15 con App Router.
- React 19.
- TypeScript estricto.
- Node.js 24, según `package.json#engines`.
- pnpm 10.18.3 con lockfile versionado.

Las versiones efectivas de paquetes se verifican en `package.json` y `pnpm-lock.yaml`; este documento describe la línea tecnológica y no sustituye esos archivos.

## Interfaz

- CSS global y por área existente.
- Tailwind CSS 4 disponible.
- Base de shadcn/ui inicializada mediante `components.json`.
- Radix Slot, Class Variance Authority, `clsx` y `tailwind-merge` para primitivas reutilizables.

La migración visual es gradual. Las pantallas nuevas deben reutilizar componentes y tokens oficiales antes de crear variantes.

## Datos y backend

- PostgreSQL administrado por Supabase.
- `@supabase/ssr` y `@supabase/supabase-js`.
- PL/pgSQL para reglas transaccionales, historial y seguridad.
- RLS, vistas públicas controladas y RPC administrativas.

## Entrega

- Vercel para despliegues de la aplicación y previews autorizados.
- GitHub Actions para CI, CodeQL y E2E público.
- Variables y secretos configurados fuera del repositorio.
- Deployment Protection o controles equivalentes mientras el entorno no sea público.

## Comandos oficiales

```bash
pnpm dev
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm check
pnpm test:e2e:public
pnpm test:e2e:access
```

`pnpm check` ejecuta validación de legado, auditoría de rutas, auditoría estructural estricta, typecheck, pruebas unitarias/contractuales y build.

## Reglas

- No introducir otro framework de frontend o acceso a datos sin una decisión arquitectónica documentada.
- No usar la service role en el navegador.
- No añadir dependencias cuando una capacidad pequeña puede resolverse de forma segura con la plataforma existente.
- Mantener versiones y lockfile sincronizados.
- Evaluar bundle, mantenimiento y superficie de seguridad antes de incorporar paquetes.
- Las pruebas de integración y E2E mutantes no se ejecutan contra producción.

## Evolución pendiente

- Consolidar componentes visuales repetidos mediante el sistema de diseño.
- Ampliar regresión visual y E2E autenticado en entorno no productivo.
- Incorporar lectura XLSX solo después de evaluar dependencia, límites y seguridad.
