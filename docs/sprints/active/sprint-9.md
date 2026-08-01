# Sprint 9 — Preparación operativa de beta

> Estado: activo
> Inicio: 2026-08-01
> Rama operativa: `main`
> Propietario: operaciones, seguridad, producto y calidad

## Objetivo

Cerrar las compuertas operativas, institucionales y de seguridad necesarias para una beta controlada, sin habilitar indexación ni publicación pública antes de una aprobación explícita.

## Dependencias

- Sprint 8 está cerrado técnica y documentalmente.
- La aplicación permanece como candidata a beta interna.
- Las tareas que requieren URL, cuentas, respaldo, restauración o aprobación institucional dependen de entornos y responsables autorizados.
- UX-1 continúa como backlog coordinado y no sustituye las compuertas operativas de este sprint.

## Cola de ejecución

1. [ ] S9-01 — Completar S3-06: invitación → contraseña → onboarding → login → recuperación con URL autorizada y cuentas diferenciadas.
2. [ ] S9-02 — Validar enlaces vencidos, reutilizados y manipulados con fallo seguro.
3. [ ] S9-03 — Verificar copias de seguridad y ejecutar una restauración documentada.
4. [ ] S9-04 — Definir canal, severidad, responsables y procedimiento de incidentes de beta.
5. [ ] S9-05 — Completar validación institucional y jurídica de privacidad, cookies y aviso legal.
6. [ ] S9-06 — Revisar funcionalmente las unidades organizativas y la publicación selectiva.
7. [ ] S9-07 — Revisar o resolver la aceptación temporal del riesgo de contraseñas filtradas antes del 2026-10-29 o de la apertura pública.
8. [ ] S9-08 — Confirmar en el despliegue de beta metadata `noindex`, robots restrictivo y sitemap vacío.
9. [ ] S9-09 — Ejecutar revisión final con CI, E2E autenticado, salud, seguridad y evidencias operativas.
10. [ ] S9-10 — Registrar decisión explícita de continuar beta, diferirla o aprobar una apertura posterior.


## Matriz de ejecución y compuertas

| Tarea | Estado inicial | Evidencia o autoridad requerida | Próxima acción |
|---|---|---|---|
| S9-01 | Bloqueada externamente | URL autorizada y cuentas diferenciadas | Configurar el entorno de beta y ejecutar el ciclo real. |
| S9-02 | Bloqueada por S9-01 | Enlaces reales o entorno controlado equivalente | Probar expiración, reutilización y manipulación después del ciclo base. |
| S9-03 | Bloqueada externamente | Acceso autorizado a respaldo y entorno aislado de restauración | Ejecutar el procedimiento y conservar evidencia sin secretos. |
| S9-04 | Requiere decisión operativa | Canal institucional, responsables y niveles de severidad aprobados | Completar el plan de incidentes con propietarios reales. |
| S9-05 | Bloqueada externamente | Validación institucional y jurídica | Registrar aprobación, observaciones o cambios exigidos. |
| S9-06 | Lista para auditoría técnica | Código, contratos y datos representativos sin mutación productiva | Revisar flujo, permisos, estados y publicación selectiva. |
| S9-07 | Diferida por plazo o apertura | Decisión del propietario antes del 2026-10-29 o de abrir al público | Revisar controles compensatorios y resolver aceptación. |
| S9-08 | Bloqueada externamente | URL desplegada de beta y configuración autorizada | Verificar respuestas y metadata post-despliegue. |
| S9-09 | Bloqueada por S9-01 a S9-08 | Evidencia acumulada y ejecución completa de calidad | Ejecutar cierre técnico-operativo. |
| S9-10 | Bloqueada por S9-09 | Decisión explícita de producto y operación | Documentar continuar, diferir o aprobar la siguiente etapa. |

Estas compuertas no cambian el orden lógico del sprint. S9-06 puede auditarse en paralelo documental porque es de solo lectura y no afirma el cierre de las tareas anteriores.

## Criterios de cierre

- [ ] El ciclo real de acceso y recuperación está verificado con cuentas diferenciadas.
- [ ] Los enlaces inválidos fallan de forma segura.
- [ ] Existe evidencia de respaldo y restauración.
- [ ] Incidentes tienen canal, severidad, responsables y procedimiento.
- [ ] Privacidad, cookies y aviso legal tienen validación institucional y jurídica.
- [ ] Las unidades organizativas y la publicación selectiva fueron revisadas funcionalmente.
- [ ] El riesgo temporal de contraseñas filtradas fue revisado dentro del plazo.
- [ ] La beta desplegada conserva `noindex`, robots restrictivo y sitemap vacío.
- [ ] CI y los recorridos aplicables concluyen satisfactoriamente con evidencia observada.
- [ ] La decisión de salida está documentada y no se infiere de una prueba parcial.

## Reglas

- No habilitar indexación pública durante la beta.
- No crear ni conservar credenciales QA fuera del ciclo documentado.
- No declarar restauración, validación jurídica, E2E o CI como completados sin evidencia.
- No convertir dependencias externas en cierres ficticios; documentar responsable y bloqueo.
- No mezclar publicación pública con la aprobación técnica de este sprint.

## Estado inicial

Sprint iniciado con los pendientes operativos ya consolidados en el roadmap. Ningún elemento se marca completado en este documento sin nueva evidencia.
