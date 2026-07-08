# Perfil visual institucional - Arquidiocesis de Santo Domingo

Este documento cierra la adaptacion visual inicial de SINEP RD a la linea grafica institucional de la Arquidiocesis de Santo Domingo.

## Paleta base

| Uso | Color |
| --- | --- |
| Oro institucional | `#FFC003` |
| Negro | `#000000` |
| Gris institucional | `#54565A` |
| Blanco | `#FFFFFF` |
| Rojo secundario | `#DA291C` |
| Naranja secundario | `#E87722` |
| Gris claro | `#D0D0CE` |

## Criterio de aplicacion

- El blanco domina la interfaz.
- El oro se usa para acciones principales, estados activos, foco y acentos.
- El negro se reserva para titulos, marca y texto principal.
- El gris institucional se usa en texto secundario, ayudas y metadatos.
- El rojo se reserva para errores, advertencias graves o acciones destructivas.
- Las pantallas administrativas deben parecer formularios institucionales, no un ERP generico.

## Archivos aplicados

- `src/app/brand.css`: tokens y estilo visual global.
- `src/app/admin-brand.css`: ajustes especificos de login y panel administrativo.
- `src/app/layout.tsx`: importa la capa visual institucional.

## Componentes cubiertos

- Header global.
- Navegacion principal.
- Botones primarios y secundarios.
- Tarjetas, metricas y listados.
- Login administrativo.
- Panel administrativo.
- Formularios y estados de foco.
- Estados de error.

## Reglas de mantenimiento

1. No usar colores fuera de la paleta salvo que exista una necesidad funcional documentada.
2. No usar el oro como color de fondo masivo; debe funcionar como acento.
3. No usar rojo para elementos decorativos.
4. Mantener formularios con campos amplios, bordes finos y foco dorado.
5. Evitar interfaces saturadas o excesivamente coloridas.
6. Priorizar seleccion y catalogos sobre entrada manual.
7. Mantener el perfil preparado para futuras variantes por diocesis.

## Pendiente visual futuro

- Incorporar imagenes institucionales oficiales cuando esten disponibles.
- Sustituir la marca textual temporal por el identificador oficial en formato web.
- Crear tema por diocesis cuando el sistema opere multi-jurisdiccion.
