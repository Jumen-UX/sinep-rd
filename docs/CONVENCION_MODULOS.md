# Convención de módulos del repositorio

## Objetivo

Mantener una estructura consistente para que cada funcionalidad del proyecto tenga un dueño claro y sea fácil de localizar.

## Reglas generales

- La carpeta app debe contener únicamente enrutamiento, layout y composición de páginas.
- Los módulos de negocio deben vivir bajo src/features.
- Cada dominio debe tener una carpeta propia con subcarpetas claras:
  - components
  - hooks
  - lib o services
  - pages si aplica
- Los componentes genéricos reutilizables deben ir en src/components.
- Las utilidades compartidas deben ir en src/lib.

## Estructura recomendada

```text
src/
  app/
    (admin)/
    (public)/
    api/
  components/
    ui/
    shared/
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
  lib/
    shared/
    supabase/
```

## Reglas por tipo de archivo

- page.tsx: solo para la definición de la ruta en app.
- layout.tsx: solo para estructura general de la vista.
- components: UI reutilizable del módulo.
- hooks: lógica de interacción o estado local.
- lib/services: acceso a datos, transformaciones y helpers del módulo.

## Buenas prácticas

- Evitar que una carpeta de ruta tenga lógica de negocio pesada.
- Evitar duplicar componentes entre módulos.
- Mantener nombres claros y consistentes.
- Preferir imports relativos cortos y explícitos.
