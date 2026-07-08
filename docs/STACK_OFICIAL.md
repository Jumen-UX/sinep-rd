# Stack oficial

Stack acordado para SINEP RD.

## Frontend

- Next.js
- React
- TypeScript como lenguaje principal
- JavaScript / Node.js como runtime y ecosistema base
- Tailwind CSS
- shadcn/ui

## Datos y backend

- PostgreSQL
- Supabase
- PLpgSQL para procesos internos importantes
- RPC de Supabase para operaciones administrativas sensibles

## Infraestructura

- Docker
- GitHub Actions
- Render
- pnpm

## Implementado en el repositorio

- Next.js, React y TypeScript estan instalados en `package.json`.
- Supabase esta integrado mediante `@supabase/ssr` y `@supabase/supabase-js`.
- Docker usa Node 22 y pnpm.
- GitHub Actions ejecuta instalacion, typecheck y build.
- Tailwind CSS esta agregado mediante `tailwindcss`, `@tailwindcss/postcss`, `postcss`, `postcss.config.mjs` y `@import "tailwindcss"` en `src/app/globals.css`.
- shadcn/ui esta inicializado con `components.json`, `src/lib/utils.ts` y componentes base en `src/components/ui`.

## Reglas tecnicas

- No crear motores paralelos cuando ya exista un modulo equivalente.
- No fijar jerarquias eclesiales en el frontend.
- Mantener historial mediante eventos y vigencias.
- Usar listas controladas y fuentes oficiales siempre que sea posible.
- Escribir componentes nuevos preferiblemente con TypeScript y componentes reutilizables.

## Pendiente tecnico

- Regenerar y commitear `pnpm-lock.yaml` con las dependencias nuevas. Temporalmente CI y Docker usan `pnpm install --no-frozen-lockfile` para no bloquear la verificacion mientras se refresca el lockfile.
- Migrar gradualmente la UI existente a componentes shadcn/ui. Ya existe la base, pero las pantallas actuales aun usan CSS legacy en muchas partes.
- Ultima accion: forzar un nuevo run desde el workflow actualizado para refrescar el lockfile.
