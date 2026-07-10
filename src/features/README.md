# Arquitectura por dominios de SINEP RD

`src/features` contiene la implementación funcional de cada dominio. Las rutas de Next.js dentro de `src/app` deben limitarse a composición, configuración de ruta y reexportación de pantallas.

## Estructura estándar

```text
src/features/<dominio>/
├── admin/          # Pantallas y componentes administrativos del dominio
├── public/         # Pantallas y componentes públicos, cuando aplique
├── components/     # Componentes propios del dominio
├── services/       # Acceso a RPC, tablas, API y Storage
├── hooks/          # Estado reutilizable del dominio
├── types/          # Tipos compartidos
└── index.ts        # Punto de entrada público del dominio
```

## Responsabilidades

### `src/app`

- Define rutas, layouts, metadata y límites de carga/error.
- Importa una pantalla desde `src/features`.
- No contiene consultas complejas, reglas de negocio ni formularios extensos.

Ejemplo:

```tsx
export { default } from '@/features/personas/admin/PersonDetailPage'
```

### `admin` y `public`

- Componen la experiencia visual del dominio.
- Usan servicios tipados.
- No duplican consultas de Supabase.
- No contienen SQL ni reglas de autorización de servidor.

### `services`

- Centralizan RPC, consultas, llamadas HTTP y Storage.
- Exponen tipos de entrada y salida.
- Transforman errores técnicos en errores controlables por la interfaz.
- No renderizan componentes.

### `components`

- Contienen piezas reutilizables del dominio.
- Los componentes reutilizables entre dominios permanecen en `src/components`.

## Reglas obligatorias

1. Una RPC no debe invocarse desde varias pantallas; debe existir un servicio compartido.
2. Los cambios históricos —nombramientos, traslados, fallecimientos, ordenaciones y cambios estructurales— se registran como operaciones, no como edición silenciosa.
3. Los formularios deben priorizar catálogos, búsqueda y selectores sobre texto libre.
4. Las rutas administrativas deben usar la autorización centralizada del servidor.
5. Los archivos `page.tsx` deben mantenerse mínimos.
6. No se deben importar archivos desde `src/app` hacia `src/features`.
7. Los dominios no deben depender circularmente entre sí; las piezas comunes se extraen a `src/components`, `src/lib`, `src/services` o `src/types`.

## Dominios iniciales

- `personas`: directorio, ficha, propuestas y calidad de datos.
- `clero/priest`: creación y mantenimiento específico de sacerdotes.
- `structures`: configurador y selector jerárquico.
- `appointments`: cargos y nombramientos.
- `events`: eventos históricos y evolución institucional.
- `imports`: carga por lotes, validación y aplicación.

Esta convención es el contrato para continuar la reestructuración del repositorio.
