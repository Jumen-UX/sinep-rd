# Convención de módulos

> Estado: vigente  
> Última revisión: 2026-07-10

## Regla principal

Cada funcionalidad debe tener un dueño claro. `src/app` define rutas; `src/features` contiene el dominio; `src/components` y `src/lib` alojan únicamente piezas transversales.

## Estructura recomendada

```text
src/features/<dominio>/
  admin/          # pantallas administrativas del dominio
  components/     # UI reutilizable dentro del dominio
  config/         # presets y configuración estática tipada
  hooks/          # estado y orquestación del cliente
  services/       # acceso a API, Supabase y transformaciones
  types/          # contratos compartidos del dominio
  index.ts        # frontera pública opcional
```

No es obligatorio crear carpetas vacías. Una carpeta aparece cuando existe una responsabilidad real.

## Reglas por ubicación

### `src/app`

- `page.tsx`: composición mínima de la ruta.
- `layout.tsx`: estructura compartida del segmento.
- `route.ts`: adaptador HTTP con autenticación, validación y traducción de errores.
- CSS global: solo tokens, layouts globales o estilos compartidos por un área completa.

### `src/features`

- Puede importar desde `src/components` y `src/lib`.
- No debe depender de archivos internos de otro dominio; usar su `index.ts` o un servicio compartido explícito.
- Las llamadas a datos deben concentrarse en `services` cuando una pantalla deja de ser trivial.

### `src/components`

- `ui`: primitivas visuales genéricas.
- `admin`: patrones reutilizados por varios dominios administrativos.
- Los componentes específicos de una sola funcionalidad permanecen en su feature.

### `src/lib`

- Infraestructura sin UI: autorización, validación, Supabase, privacidad y utilidades.
- No colocar aquí reglas que pertenezcan claramente a un dominio.

## Nombres e imports

- Componentes React: `PascalCase.tsx`.
- Hooks: `useNombre.ts`.
- Servicios y utilidades: `kebab-case.ts`.
- Rutas públicas y administrativas: español coherente con las URL existentes.
- Preferir el alias `@/` para cruces entre módulos.
- Evitar variantes duplicadas del mismo dominio en español e inglés; los módulos existentes se consolidan gradualmente, sin crear una tercera variante.

## Criterio de extracción

Extraer una ruta a `src/features` cuando cumpla cualquiera de estas condiciones:

- Combina carga de datos, estado y presentación.
- Supera aproximadamente 100 líneas de lógica propia.
- Reutiliza servicios con otra pantalla.
- Representa un flujo de negocio reconocible.

## Checklist

- [ ] La ruta contiene principalmente composición.
- [ ] La regla de negocio tiene un único dueño.
- [ ] No se duplicó un servicio o componente existente.
- [ ] Los tipos importantes son explícitos.
- [ ] La operación sensible valida permiso y alcance en servidor.
- [ ] Existen pruebas proporcionales al riesgo.
