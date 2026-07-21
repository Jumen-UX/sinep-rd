# Matriz de validación visual UX

> Estado: vigente
> Última revisión: 2026-07-21
> Propietario: producto, frontend y QA

## Objetivo

Definir qué combinaciones de ruta, tema, viewport y estado deben revisarse antes de aceptar un cambio visual. La matriz separa la evidencia automática sin credenciales de la aceptación autenticada que requiere cuentas protegidas.

## Niveles de evidencia

1. **Estructural:** semántica, reflujo, foco, contraste automatizable y ausencia de desbordamiento.
2. **Captura reproducible:** imagen generada por Chromium con movimiento reducido, animaciones deshabilitadas y viewport fijo.
3. **Regresión aprobada:** captura comparada contra un baseline revisado por producto y frontend.
4. **Aceptación operativa:** recorrido manual o automatizado con cuenta, permisos, alcance y datos representativos.

Una captura generada no es por sí sola un baseline aprobado. Las regiones estables de los shells público y de acceso fueron revisadas y promovidas desde Ubuntu/Chromium a comparaciones bloqueantes. Una ruta autenticada no se considera aceptada cuando la prueba se omite por falta de secretos.

## Matriz automática sin secretos

| Superficie | Ruta | Estado | Temas | Viewports | Evidencia inicial |
|---|---|---|---|---|---|
| Portal público | `/` | Dashboard territorial cargado | claro, oscuro | 390×844, 768×1024, 1440×1200 | captura completa diagnóstica y baseline bloqueante del encabezado móvil o barra lateral de escritorio |
| Acceso administrativo | `/admin/login` | formulario inicial | claro, oscuro | 390×844, 768×1024, 1440×1200 | captura completa diagnóstica y baseline bloqueante de la tarjeta de acceso |
| Recuperación | `/admin/recuperar/solicitar` | formulario inicial | claro, oscuro | 390×844, 768×1024, 1440×1200 | captura completa diagnóstica y baseline bloqueante de la tarjeta de recuperación |

Estas rutas no requieren credenciales. Los datos públicos pueden cambiar; por eso la página completa se conserva como evidencia revisable y la comparación de píxeles se limita a superficies estables. Los 18 baselines vigentes fueron generados en Ubuntu/Chromium por el run `29870240928`, sobre el commit `595afe1`, y revisados antes de incorporarse al repositorio.

## Matriz autenticada protegida

| Superficie | Ruta representativa | Estados mínimos | Perfil requerido |
|---|---|---|---|
| Shell y panel | `/admin` | carga, listo, sin rol, error recuperable | administrador y consulta |
| Personas | `/admin/personas` | resultados, vacío, búsqueda sin resultados, error | nacional y diocesano |
| Nombramientos | `/admin/asignaciones` | catálogo, selección, impacto, error | operador con alcance |
| Estructuras | `/admin/estructura` | árbol simple, árbol complejo, detalle, sin selección | administrador estructural |
| Organización | `/admin/organizacion` | borrador, activa, publicada, error de ciclo | administrador diocesano |
| Revisión | `/admin/revision` | cola vacía, pendientes, decisión restringida | revisor y consulta |
| Importaciones | `/admin/importar/lotes` | vacío, lote con errores, lote aplicable | operador de importación |

Cada ruta autenticada debe revisarse en claro y oscuro, escritorio y móvil, y con el alcance visible. Los perfiles se suministran únicamente mediante `E2E_ACCESS_PROFILES_JSON`.

## Reglas de estabilización de capturas

- Fijar `locale` en `es-DO` y viewport por caso.
- Aplicar el tema antes de cargar la ruta para evitar capturar transiciones.
- Emular movimiento reducido y deshabilitar animaciones y caret.
- Esperar `document.fonts.ready` y el encabezado principal visible.
- No incluir secretos, correos reales ni tokens en la imagen o nombre del artefacto.
- Enmascarar identificadores o datos personales cuando una futura captura autenticada los contenga.
- Conservar capturas fallidas y reportes durante siete días como evidencia temporal.
- Promover a baseline solo una imagen revisada en Ubuntu/Chromium, el mismo entorno del workflow canónico.

## Umbral para activar comparación bloqueante

La comparación de screenshots se activa cuando:

1. la ruta tiene datos estables o una estrategia explícita de enmascarado;
2. el baseline fue generado en Ubuntu/Chromium y aprobado;
3. claro, oscuro, móvil y escritorio fueron revisados;
4. la diferencia tolerada está documentada y no oculta cambios de layout;
5. el workflow publica el diff cuando una comparación falla.

Las superficies estables de la matriz pública ya cumplen este umbral. Las páginas completas con datos vivos y las rutas autenticadas continúan como evidencia visual hasta disponer de datos controlados o enmascarados y perfiles protegidos.

## Criterio de aceptación UX de beta

- Sin desbordamiento horizontal desde 320 px.
- Navegación y acciones primarias operables por teclado.
- Axe sin hallazgos bloqueantes en las rutas automatizadas.
- Temas claro y oscuro sin texto ilegible ni superficies sin token.
- Estados de carga, vacío, error, éxito y restricción comprensibles.
- Ámbito y permisos visibles en la administración.
- Revisión manual con lector de pantalla, zoom 400 %, touch e impresión cuando aplique.
- Evidencia registrada con commit, fecha, entorno y resultado.

Consulta también el [sistema de diseño](./SISTEMA_DE_DISENO.md), el [backlog UX](../sprints/active/ux-backlog.md) y la [guía E2E](../testing/E2E_Y_ACCESIBILIDAD.md).
