# Stack oficial

> Estado: vigente  
> Fuente verificable: `package.json`, `Dockerfile` y `.github/workflows`

## Aplicación

- Next.js 15 con App Router.
- React 19.
- TypeScript estricto.
- Node.js 22.
- pnpm 10.18.3 con lockfile versionado.

## Interfaz

- CSS global y por área existente.
- Tailwind CSS 4 disponible.
- Base de shadcn/ui inicializada mediante `components.json`.
- Radix Slot, Class Variance Authority, `clsx` y `tailwind-merge` para primitivas reutilizables.

La migración visual es gradual. No se debe reescribir una pantalla estable solo para cambiar de tecnología; las pantallas nuevas deben reutilizar los componentes oficiales antes de crear variantes.

## Datos y backend

- PostgreSQL administrado por Supabase.
- `@supabase/ssr` y `@supabase/supabase-js`.
- PL/pgSQL para reglas transaccionales, historial y seguridad.
- RLS, vistas públicas controladas y RPC administrativas.

## Entrega

- Docker.
- GitHub Actions.
- Render mediante hook de despliegue después de CI.

## Comandos oficiales

```bash
pnpm dev
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm check
```

`pnpm check` es la compuerta local y de CI: typecheck, pruebas unitarias/contractuales y build.

## Reglas

- No introducir otro framework de frontend o acceso a datos sin una decisión arquitectónica documentada.
- No usar la service role en el navegador.
- No añadir dependencias cuando una capacidad pequeña puede resolverse de forma segura con la plataforma existente.
- Mantener versiones y lockfile sincronizados.
- Evaluar tamaño de bundle, mantenimiento y superficie de seguridad antes de incorporar paquetes.

## Evolución pendiente

- Consolidar componentes visuales repetidos.
- Añadir pruebas E2E y accesibilidad automatizada.
- Incorporar lectura XLSX solo con una dependencia evaluada y procesamiento seguro.
