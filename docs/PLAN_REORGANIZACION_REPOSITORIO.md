# Plan de reorganización del repositorio SINEP RD

## Objetivo

Ordenar el repositorio para que sea más escalable, más fácil de mantener y más claro para nuevos desarrolladores, sin perder la lógica de negocio actual.

## Principios guía

- Separar claramente módulos de negocio, UI y utilidades.
- Reducir la mezcla de responsabilidades dentro de la carpeta de rutas.
- Mantener la arquitectura de Next.js, pero introducir un patrón de dominio más explícito.
- Priorizar cambios pequeños y reversibles.
- Documentar cada paso para evitar regresiones.

## Propuesta de estructura objetivo

### 1. Estructura principal recomendada

```text
src/
  app/
    (public)/
    (admin)/
    api/
  features/
    admin/
    public/
    pastoral/
    entidades/
    personas/
    oficinas/
    organismos/
    diocesis/
    provincias-eclesiasticas/
  components/
    shared/
    ui/
  lib/
    shared/
    domains/
    supabase/
  styles/
    globals.css
    themes/
```

### 2. Reglas de organización

- Las rutas de Next.js deben quedar enfocadas en enrutamiento y composición.
- Cada dominio debe tener su propia carpeta en features con:
  - componentes
  - hooks
  - servicios o helpers
  - tipos si aplica
- Los estilos globales deben reducirse y concentrarse en un conjunto claro.
- Los componentes genéricos deben ir en components/shared o components/ui.
- Las utilidades transversales deben ir en lib/shared.

## Fases recomendadas

### Fase 1: Inventario y estabilización

- Identificar carpetas y archivos que ya tienen responsabilidad clara.
- Definir qué módulos deben moverse primero.
- Crear una lista de rutas y componentes críticos.
- Evitar reestructuraciones masivas sin cobertura de verificación.

### Fase 2: Separar área pública y área administrativa

- Agrupar rutas públicas y administrativas en estructuras independientes.
- Mover componentes específicos de cada área a su módulo correspondiente.
- Mantener un punto único de entrada para navegación y layout.

### Fase 3: Introducir módulos por dominio

- Crear carpetas por dominio bajo features.
- Mover lógica y componentes relacionados a esas carpetas.
- Usar imports más explícitos y menos dependencias cruzadas.

### Fase 4: Limpiar estilos y utilidades

- Mover estilos excesivamente globales a archivos de alcance más claro.
- Consolidar utilidades repetidas.
- Determinar qué archivos de CSS deben permanecer globales y cuáles deben ser locales.

### Fase 5: Documentar y consolidar

- Actualizar la documentación de arquitectura.
- Definir reglas de contribución para nuevas carpetas y módulos.
- Añadir checklist de revisión para nuevas funcionalidades.

## Prioridad de implementación

1. Administrar y ordenar la carpeta app por áreas.
2. Crear la estructura base de features.
3. Mover dominios con mayor crecimiento: pastoral, entidades, personas y oficinas.
4. Reducir estilos globales y duplicados.
5. Añadir convenciones de desarrollo en la documentación.

## Criterios de aceptación

- La estructura de carpetas es fácil de navegar.
- Cada carpeta tiene una responsabilidad clara.
- No existen componentes o utilidades dispersas sin dueño claro.
- Los cambios pueden hacerse con menos riesgo y mejor trazabilidad.
- La documentación refleja la organización real del proyecto.

## Siguiente paso inmediato

Empezar por la carpeta app y separar los módulos de administración y público, dejando la base para que los demás dominios se integren progresivamente.
