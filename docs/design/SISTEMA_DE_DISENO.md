# Sistema de diseño de SINEP RD

> Estado: vigente
> Última revisión: 2026-07-15
> Propietario: producto y frontend
> Sustituye las guías visuales fragmentadas anteriores.

## Objetivo

Mantener una gramática visual única para el portal público y administrativo, compatible con la identidad institucional, accesible, responsive y preparada para variaciones futuras por jurisdicción sin duplicar componentes.

## Principios

- Claridad antes que decoración.
- Jerarquía visual consistente.
- Una acción primaria reconocible por pantalla.
- Componentes reutilizables antes que variantes locales.
- Selección y búsqueda antes que texto libre cuando exista catálogo.
- Estados del sistema explícitos.
- Prevención de errores y resumen de impacto antes de operaciones sensibles.
- Modo claro, oscuro y preferencia del sistema.
- Navegación completa por teclado y contraste WCAG 2.2 AA.

## Tokens

Los colores, superficies, bordes, tipografía, radios, sombras, espaciado y estados deben consumirse mediante tokens semánticos. Los valores de referencia de interfaz se mantienen en `SINEP_UI_PARAMETERS.json`.

No se deben hardcodear colores institucionales en componentes de dominio cuando exista un token equivalente.

## Identidad visual

La línea visual institucional de la Arquidiócesis de Santo Domingo sirve como referencia inicial de SINEP RD. La aplicación debe separar identidad de producto y personalización jurisdiccional para evitar que una futura diócesis requiera bifurcar componentes.

Logotipos, escudos y marcas deben conservar proporción, área de respeto y contraste suficiente. No deben usarse como decoración de fondo que reduzca legibilidad.

## Tipografía y contenido

- Mantener una escala tipográfica coherente.
- Usar un solo `h1` por pantalla.
- Evitar bloques extensos sin jerarquía.
- Usar etiquetas y ayudas persistentes en formularios; el placeholder no sustituye una etiqueta.
- Los mensajes deben explicar qué ocurrió y qué puede hacer el usuario.

## Componentes base

La aplicación debe converger sobre primitivas compartidas para:

- botones y enlaces de acción;
- campos, selectores y búsqueda;
- alertas y estados;
- tarjetas y paneles;
- tablas y directorios;
- breadcrumbs;
- diálogos y confirmaciones;
- loaders y skeletons;
- vacíos y sin resultados;
- navegación pública y administrativa;
- botón flotante y panel de accesibilidad.

## Formularios y asistentes

Todos los asistentes deben compartir el mismo patrón de pasos, navegación, persistencia de borrador, resumen de errores y revisión final. Los errores se muestran cerca del campo y en un resumen navegable cuando existan varios.

Las operaciones sensibles deben presentar impacto, registros afectados y consecuencias históricas antes de confirmar.

## Estados obligatorios

Cada pantalla debe considerar explícitamente carga, actualización, vacío inicial, sin resultados, acceso restringido, error recuperable, error irreversible, conexión lenta, éxito, operación parcial, datos desactualizados, confirmación y cambios sin guardar.

Los mensajes dinámicos relevantes deben anunciarse mediante `aria-live` o roles equivalentes.

## Responsive

La interfaz debe funcionar desde 320 px, con zoom de 400 % y texto ampliado. No se admite scroll horizontal global. Las tablas complejas deben definir una estrategia móvil deliberada: prioridad de columnas, tarjetas, desplazamiento contenido o vista de detalle.

## Accesibilidad

El botón flotante de accesibilidad debe ser operable por teclado, no cubrir acciones críticas y conservar preferencias. Las opciones de interfaz no sustituyen la compatibilidad con preferencias del sistema ni la semántica HTML correcta.

## Validación

Las rutas críticas deben cubrir, según aplique:

- claro y oscuro;
- escritorio, tableta y móvil;
- 320 px;
- texto ampliado;
- teclado;
- Axe;
- estados de error y vacío;
- regresión visual;
- impresión cuando exista una ficha imprimible.

Consulta también [UX](../product/UX.md) y [Estándares web](../standards/ESTANDARES_WEB_SINEP_RD.md).
