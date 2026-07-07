# Stack oficial — SINEP RD

Este documento fija el stack técnico base del proyecto. No debe ampliarse sin una razón técnica clara y documentada.

## Stack aprobado

```txt
Next.js + TypeScript
Tailwind CSS
shadcn/ui
PostgreSQL / Supabase
PLpgSQL solo para lógica de base de datos importante
Docker
GitHub Actions para despliegue automático
```

## Responsabilidad de cada pieza

| Tecnología | Responsabilidad principal |
|---|---|
| Next.js | Aplicación web, rutas, renderizado, Server Components, API routes o Server Actions cuando aplique. |
| TypeScript | Tipado del dominio, contratos entre frontend y Supabase, reducción de errores en formularios y dashboards. |
| Tailwind CSS | Sistema de estilos utilitario, responsivo y consistente. |
| shadcn/ui | Componentes reutilizables para formularios, tablas, diálogos, selectores, tabs, cards y estados vacíos. |
| PostgreSQL / Supabase | Base de datos, Auth, Storage, RLS, vistas, funciones RPC y fuente principal de verdad. |
| PLpgSQL | Lógica crítica: seguridad, auditoría, validaciones jerárquicas, eventos históricos y operaciones transaccionales. |
| Docker | Entorno reproducible de desarrollo, pruebas y despliegue. |
| GitHub Actions | Validación automática, typecheck, build, pruebas y despliegue. |

## Estado actual detectado

El repositorio ya usa Next.js, React, TypeScript y Supabase. `package.json` declara:

- `next`
- `react`
- `react-dom`
- `typescript`
- `@supabase/ssr`
- `@supabase/supabase-js`

Tailwind CSS y shadcn/ui forman parte del stack aprobado, pero deben verificarse e instalarse/configurarse explícitamente si aún no están presentes en el repo.

## Regla de arquitectura

La jerarquía eclesial nunca debe estar quemada en el frontend.

Incorrecto:

```txt
Diócesis → Vicaría → Zona → Parroquia
```

Correcto:

```txt
La interfaz consulta a Supabase:
- estructura activa de la diócesis
- niveles configurados
- nodos disponibles por nivel
- cargos permitidos por nivel
- vigencia histórica
```

## Regla sobre PLpgSQL

PLpgSQL se usará solo cuando aporte seguridad, atomicidad o consistencia histórica.

Usar PLpgSQL para:

- Validar estructuras padre/hijo.
- Crear o modificar nodos estructurales con trazabilidad.
- Registrar eventos de evolución estructural.
- Ejecutar operaciones administrativas transaccionales.
- Proteger datos sensibles.
- Aplicar reglas RLS/RPC críticas.

No usar PLpgSQL para:

- Formateo visual.
- Lógica de presentación.
- Transformaciones simples que pertenecen al frontend.
- Reglas temporales de interfaz.

## Regla de formularios

Los formularios deben priorizar selección sobre escritura manual.

Orden recomendado:

```txt
1. Seleccionar país / diócesis / estructura.
2. Cargar niveles dinámicos.
3. Filtrar nodos por padre seleccionado.
4. Permitir “Agregar nuevo” solo cuando no exista la opción.
5. Registrar fuente, fecha y estado de validación.
```

## Estándares oficiales

Cuando exista estándar oficial, se usará como catálogo controlado:

| Dato | Estándar |
|---|---|
| Países | ISO 3166-1 |
| Subdivisiones civiles | ISO 3166-2 |
| Monedas | ISO 4217 |
| Idiomas | ISO 639 |
| Fechas y horas | ISO 8601 |

Para datos eclesiales sin ISO, se usarán catálogos internos controlados con fuente documental.
