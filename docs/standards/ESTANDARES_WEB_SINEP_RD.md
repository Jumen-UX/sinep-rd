# Estándares web obligatorios de SINEP RD

> Estado: norma vigente  
> Última revisión: 2026-07-10

Este documento define los criterios mínimos que debe cumplir toda página, componente o flujo nuevo del proyecto SINEP RD. Su cumplimiento es obligatorio antes de considerar una entrega como terminada.

## 1. Estándares técnicos W3C

- Usar HTML5 semántico según la función real del bloque: `header`, `nav`, `main`, `section`, `article`, `aside` y `footer`.
- Mantener la estructura lógica separada de los estilos. Los estilos deben vivir en hojas CSS externas o módulos equivalentes aprobados por el proyecto.
- Evitar elementos interactivos no semánticos. Si un elemento ejecuta una acción, debe ser `button`; si navega, debe ser `a` o `Link`.
- Evitar mezclar expresiones ambiguas en JSX. Cuando se combinen `??`, `||` y operadores ternarios, usar variables previas o paréntesis explícitos.
- Mantener compatibilidad con navegadores actuales: Chrome, Safari, Firefox y Edge.

## 2. Accesibilidad WCAG 2.2

- Toda imagen descriptiva debe tener `alt`. Las imágenes decorativas deben usar `alt=""` o ser manejadas por CSS.
- Toda interacción debe funcionar con teclado: Tab, Shift+Tab, Enter, Escape y flechas cuando aplique.
- Debe existir foco visible en enlaces, botones, filtros, tabs, cards clicables y menús.
- Los componentes complejos, como comboboxes, tabs, menús móviles y listboxes, deben usar atributos ARIA adecuados.
- El contraste mínimo entre texto y fondo debe ser 4.5:1 para texto normal y 3:1 para texto grande o elementos gráficos esenciales.
- Cada página debe tener un destino de salto al contenido principal para usuarios de teclado.

## 3. Rendimiento y Core Web Vitals

- Priorizar carga rápida del contenido principal. Objetivo: LCP menor a 2.5 segundos en condiciones razonables.
- Evitar componentes pesados en la primera carga si pueden diferirse.
- Evitar saltos visuales durante la carga. Reservar espacios para datos, tarjetas e imágenes.
- Evitar animaciones innecesarias y respetar `prefers-reduced-motion`.
- Usar formatos modernos de imagen cuando se agreguen recursos gráficos: WebP o AVIF, salvo incompatibilidad justificada.
- Mantener JS y CSS razonablemente pequeños y reutilizables.

## 4. Diseño, UX y responsive

- El diseño debe aprobarse en dos estados mínimos antes de implementar una página nueva: desktop/tablet grande y mobile.
- El enfoque debe ser mobile-first: primero legibilidad y uso en celular, luego expansión a escritorio.
- Las tablas deben transformarse en tarjetas o listas legibles en móvil.
- Los enlaces y botones deben usar textos descriptivos. Evitar textos genéricos como “haz clic aquí”.
- La navegación debe permitir encontrar información esencial en un máximo de tres pasos razonables.
- Las vistas públicas deben mantener coherencia institucional: sobriedad, claridad, jerarquía visual y lenguaje eclesial correcto.

## 5. Seguridad, privacidad y legalidad

- La web debe operar bajo HTTPS en producción.
- Las rutas administrativas deben estar protegidas por autenticación y autorización.
- Las vistas públicas no deben exponer datos privados, datos sensibles ni información administrativa interna.
- Debe existir una política de privacidad visible antes de publicar el sistema formalmente.
- Si se usan cookies no esenciales o analítica, debe existir consentimiento de cookies y explicación clara del uso.
- Las consultas públicas deben respetar Row Level Security y vistas públicas controladas en Supabase.

## Checklist antes de implementar una página nueva

1. Definir objetivo de la página.
2. Mostrar maqueta desktop.
3. Mostrar maqueta mobile.
4. Revisar semántica HTML, accesibilidad y navegación por teclado.
5. Validar que los filtros o interacciones actualicen el contenido correspondiente.
6. Implementar solo después de aprobación visual.
7. Verificar `typecheck` y `build`.
8. Revisar responsive real en celular.
9. Revisar que no se expongan datos privados.

## Estado inicial aplicado

La página principal pública queda como primer objetivo de ajuste continuo bajo estos estándares. Los siguientes módulos deberán seguir este documento desde su fase de diseño.
