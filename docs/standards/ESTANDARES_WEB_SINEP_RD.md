# Estándares web obligatorios de SINEP RD

> Estado: norma vigente  
> Última revisión: 2026-08-01

Este documento define los criterios mínimos que debe cumplir toda página, componente, consulta, migración o flujo nuevo del proyecto SINEP RD. Su cumplimiento es obligatorio antes de considerar una entrega como terminada.

## Principio rector

Para cada problema se debe elegir la solución más simple, limpia, segura y eficiente que resuelva completamente el requerimiento, reutilizando capacidades existentes y evitando código, dependencias, componentes y abstracciones innecesarias.

La calidad no se mide por la cantidad de código escrito, sino por la claridad, estabilidad, experiencia de usuario, mantenibilidad, rendimiento, seguridad y capacidad de evolución del resultado.

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
- Toda animación debe respetar `prefers-reduced-motion`.

## 3. Rendimiento y Core Web Vitals

- Priorizar carga rápida del contenido principal. Objetivo: LCP menor a 2.5 segundos en condiciones razonables.
- Evitar componentes pesados en la primera carga si pueden diferirse.
- Evitar saltos visuales durante la carga. Reservar espacios para datos, tarjetas e imágenes.
- Evitar animaciones innecesarias.
- Usar formatos modernos de imagen cuando se agreguen recursos gráficos: WebP o AVIF, salvo incompatibilidad justificada.
- Mantener JavaScript y CSS razonablemente pequeños y reutilizables.
- Filtrar en PostgreSQL antes de transferir datos y seleccionar únicamente las columnas necesarias.
- Ejecutar en el servidor la lógica sensible o que no requiera interacción inmediata.
- Evitar estado derivado, transformaciones repetidas, consultas duplicadas y carga completa de colecciones grandes.
- Usar paginación, caché e invalidación cuando el volumen o la frecuencia real lo justifiquen.
- Crear índices a partir de consultas observadas, no por anticipación genérica.

## 4. Diseño, UX y responsive

- El diseño debe aprobarse en dos estados mínimos antes de implementar una página nueva: desktop/tablet grande y mobile.
- El enfoque debe ser mobile-first: primero legibilidad y uso en celular, luego expansión a escritorio.
- Las tablas deben transformarse en tarjetas o listas legibles en móvil cuando no puedan conservar su significado en una tabla responsive.
- Los enlaces y botones deben usar textos descriptivos. Evitar textos genéricos como “haz clic aquí”.
- La navegación debe permitir encontrar información esencial en un máximo de tres pasos razonables.
- Las vistas públicas deben mantener coherencia institucional: sobriedad, claridad, jerarquía visual y lenguaje eclesial correcto.
- Cada pantalla debe responder con claridad dónde está el usuario, qué información ve, qué puede hacer, cuál es la acción principal y cómo se relaciona la entidad con las demás.
- Evitar exceso de tarjetas, contenedores anidados, bordes, colores, acciones equivalentes y formularios sin agrupación.
- Usar espacio, tipografía y jerarquía antes de añadir decoración.

## 5. Seguridad, privacidad y legalidad

- La web debe operar bajo HTTPS en producción.
- Las rutas administrativas deben estar protegidas por autenticación, permiso y alcance.
- Las vistas públicas no deben exponer datos privados, datos sensibles ni información administrativa interna.
- Debe existir una política de privacidad visible antes de publicar el sistema formalmente.
- Si se usan cookies no esenciales o analítica, debe existir consentimiento de cookies y explicación clara del uso.
- Las consultas públicas deben respetar Row Level Security y vistas públicas controladas en Supabase.
- Las credenciales, secretos y tokens nunca deben hardcodearse ni exponerse al cliente.
- La validación de entradas debe existir en el límite de confianza correspondiente y no depender únicamente del navegador.
- La integridad crítica debe asegurarse con restricciones, transacciones, RLS y RPC cuando corresponda.

## 6. Simplicidad y código limpio

- Buscar primero la solución más simple que cumpla completamente el requerimiento.
- No confundir código corto con código óptimo.
- Preferir funciones pequeñas y expresivas, composición, configuración declarativa, tipos reutilizables y soluciones previsibles.
- Usar nombres específicos del dominio, como `parish`, `ecclesiasticalJurisdiction`, `pastoralAssignment`, `verificationStatus` o `currentAppointment`.
- Evitar nombres ambiguos como `data`, `item`, `value`, `temp`, `handleStuff`, `doProcess` o `utils2` cuando el contexto no sea suficiente.
- Eliminar código muerto, duplicación, estados innecesarios, efectos innecesarios, archivos sin responsabilidad clara y comentarios que repitan el código.
- No crear abstracciones prematuras. Una abstracción debe eliminar complejidad real, no ocultarla ni desplazarla.

## 7. Reutilización antes de crear

Antes de escribir código nuevo, revisar si el problema ya puede resolverse mediante:

- un componente, servicio, tipo, utilidad o patrón existente;
- una capacidad nativa de Next.js o React;
- una función, restricción, vista o índice de PostgreSQL;
- una política, RPC o capacidad de Supabase;
- una configuración de Vercel;
- una dependencia ya instalada y compatible.

No deben coexistir implementaciones paralelas para selección jerárquica, subida de fotografías, fuentes, validación, auditoría, permisos, historial o creación de nombramientos.

## 8. Evitar sobreingeniería

No crear sin una necesidad concreta:

- hooks para una sola línea;
- componentes para fragmentos sin lógica ni reutilización;
- servicios que solo envuelvan otra función sin agregar valor;
- repositorios genéricos para todas las tablas;
- fábricas con una sola variante;
- motores de reglas para condiciones estáticas;
- estados globales para datos locales;
- formularios dinámicos genéricos cuando exista un caso concreto sencillo;
- sistemas configurables para valores que no necesitan configuración;
- microservicios, buses de eventos o capas empresariales para flujos simples.

La complejidad solo se introduce cuando exista una necesidad funcional, técnica o de escalabilidad demostrable.

## 9. Complejidad progresiva

- Mostrar inicialmente una experiencia clara, rápida y con pocas decisiones visibles.
- Revelar funciones avanzadas mediante secciones expandibles, paneles secundarios, opciones avanzadas, filtros básicos y avanzados, formularios por pasos o campos condicionales.
- No mostrar las mismas capacidades a visitantes, editores y administradores.
- Mantener una alternativa simple para grafos, mapas, árboles, líneas de tiempo, comparadores, tablas inteligentes y otros componentes avanzados.
- Cargar componentes complejos solo cuando sean necesarios.

## 10. Dependencias externas

Solo se agregará una dependencia cuando:

- resuelva un problema no trivial;
- evite una implementación compleja o insegura;
- sea estable, mantenida y compatible;
- tenga licencia adecuada;
- no duplique capacidades existentes;
- su costo de integración sea menor que mantener una implementación propia.

Antes de instalarla se debe comparar implementación propia y dependencia externa considerando código, complejidad, seguridad, casos límite, tamaño, dependencias transitivas, actividad, compatibilidad, riesgo de abandono e impacto en el bundle.

Nunca se debe copiar código público sin comprenderlo ni incorporar una solución completa cuando solo se necesita un patrón o una parte pequeña.

## 11. Innovación pragmática

Las soluciones innovadoras deben producir una mejora concreta en experiencia de usuario, calidad de datos, seguridad, mantenimiento, accesibilidad, rendimiento, automatización o reducción de errores.

Son candidatas válidas, cuando exista una necesidad demostrada:

- búsqueda semántica;
- detección asistida de duplicados;
- sugerencias de relaciones;
- formularios adaptativos;
- navegación contextual;
- árboles y grafos de relaciones;
- historial temporal;
- validación automática de datos;
- importaciones inteligentes;
- automatización de tareas repetitivas.

Antes de implementarlas se debe evaluar el problema que resuelven, mejora frente al estado actual, dependencias, costo de mantenimiento, riesgos, reversibilidad y compatibilidad arquitectónica.

## 12. Evaluación previa obligatoria

Antes de implementar, responder internamente:

1. ¿Ya existe algo similar en el proyecto?
2. ¿Puede resolverse con una capacidad nativa?
3. ¿Puede simplificarse el flujo?
4. ¿Se necesita realmente estado en el cliente?
5. ¿Se resuelve mejor en PostgreSQL, Supabase o el servidor?
6. ¿Se está duplicando lógica?
7. ¿La nueva abstracción elimina complejidad real?
8. ¿Una dependencia externa es realmente más sostenible?
9. ¿La interfaz puede mostrar menos inicialmente?
10. ¿Las funciones avanzadas pueden revelarse progresivamente?
11. ¿La solución es fácil de probar?
12. ¿Será comprensible y mantenible dentro de un año?
13. ¿Existe una forma más directa y eficiente?

Si existe una solución significativamente más simple que cumpla el requerimiento, debe preferirse.

## 13. Reporte de optimización

Cuando corresponda, toda entrega debe indicar:

- **Simplificación realizada:** complejidad evitada o eliminada.
- **Código reutilizado:** componentes, funciones, patrones o capacidades existentes aprovechadas.
- **Código eliminado:** duplicaciones, estados, dependencias o capas retiradas.
- **Decisión sobre dependencias:** alternativa elegida y razón.
- **Impacto en rendimiento:** consultas, renderizados, transferencia, bundle, carga o mantenimiento reducidos.
- **Alternativas descartadas:** soluciones más complejas no utilizadas y motivo.
- **Riesgos o deuda técnica:** hallazgos que requieran seguimiento.

## Checklist antes de implementar una página o flujo

1. Definir el problema real y el criterio de aceptación.
2. Revisar componentes, servicios, tipos, RPC, políticas y patrones existentes.
3. Determinar qué debe resolverse en PostgreSQL, servidor y cliente.
4. Diseñar el estado inicial simple y la divulgación progresiva de funciones avanzadas.
5. Mostrar maqueta desktop y mobile cuando exista un cambio visual relevante.
6. Revisar semántica HTML, accesibilidad y navegación por teclado.
7. Validar permisos, alcance, privacidad y tratamiento de errores.
8. Verificar consultas, columnas, paginación, caché y renderizados.
9. Justificar cualquier dependencia nueva.
10. Implementar con el menor número razonable de responsabilidades y capas.
11. Ejecutar pruebas específicas, `pnpm typecheck`, `pnpm test` y `pnpm build` o `pnpm check` según el alcance.
12. Revisar responsive real y `prefers-reduced-motion`.
13. Documentar simplificación, reutilización, impacto y deuda técnica.

## Estado aplicado

Estos estándares son transversales a todos los sprints y prevalecen como criterio de calidad para nuevas funcionalidades, correcciones, refactorizaciones, migraciones y decisiones de arquitectura. No reemplazan el Plan Maestro ni la hoja de ruta; determinan cómo debe ejecutarse cada tarea.