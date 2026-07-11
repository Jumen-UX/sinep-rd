# SINEP RD

Sistema Nacional de Información Eclesiástica y Pastoral de República Dominicana. El proyecto combina un portal público, herramientas administrativas y una base canónica e histórica respaldada por Supabase.

## Requisitos

- Node.js 22
- pnpm 10.18.3
- Un proyecto Supabase para los flujos integrados

## Configuración local

1. Copia `.env.example` como `.env.local` y completa las variables requeridas.
2. Instala las dependencias con `pnpm install --frozen-lockfile`.
3. Inicia el entorno con `pnpm dev`.
4. Abre `http://localhost:3000`.

## Comandos de calidad

- `pnpm typecheck`: valida TypeScript.
- `pnpm test`: ejecuta pruebas unitarias y contratos estructurales.
- `pnpm test:integration`: ejecuta pruebas contra una instancia real de Supabase.
- `pnpm build`: genera la compilación de producción.
- `pnpm check`: ejecuta typecheck, pruebas unitarias y build.

Las pruebas de integración requieren `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` reales. No deben ejecutarse contra producción.

## Organización

- `src/app`: rutas públicas, administrativas y API.
- `src/features`: módulos funcionales por dominio.
- `src/components`: componentes compartidos.
- `src/lib`: autorización, validación, privacidad y clientes Supabase.
- `supabase/migrations`: esquema, RLS, RPC y contratos de lectura.
- `tests`: pruebas unitarias, estructurales y de integración.
- `docs`: documentación funcional vigente, diseño, estándares y hoja de ruta.

Consulta el [índice de documentación](./docs/README.md). Antes de cerrar una pantalla o flujo, aplica [los estándares web obligatorios](./docs/standards/ESTANDARES_WEB_SINEP_RD.md) y ejecuta `pnpm check`.
