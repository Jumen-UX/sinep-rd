# Aceptación temporal de riesgo — protección frente a contraseñas filtradas

> Estado: aceptado temporalmente
> Decisión: opción A — mantener Supabase Free durante la beta interna
> Fecha de aceptación: 2026-07-31
> Fecha máxima de revisión: 2026-10-29
> Responsable: propietario del proyecto SINEP RD
> Alcance: Supabase Auth y cuentas administrativas durante la beta interna

## Riesgo aceptado

El plan Free actual de Supabase no permite habilitar el control automático de protección frente a contraseñas filtradas. En consecuencia, Supabase Auth no puede comprobar mediante esa función si una contraseña elegida aparece en repositorios conocidos de credenciales comprometidas.

La aceptación es temporal y no equivale a considerar el riesgo resuelto. Debe revisarse antes de la fecha máxima indicada o antes de cualquier apertura pública, lo que ocurra primero.

## Justificación

- El producto permanece en beta interna y la indexación pública continúa cerrada mediante aprobación doble.
- Las cuentas técnicas E2E se generan con contraseñas aleatorias, se suspenden después de cada ronda y pierden sus asignaciones de rol.
- El secreto temporal `E2E_ACCESS_PROFILES_JSON` debe eliminarse después de cada ciclo de pruebas.
- Los accesos administrativos dependen de perfiles, roles, permisos y alcance territorial validados mediante pruebas autenticadas.
- La actualización de plan se evaluará junto con los demás requisitos operativos y económicos previos al lanzamiento público.

## Controles compensatorios obligatorios

1. Mantener la aplicación como beta privada hasta una aprobación institucional y operativa explícita.
2. Exigir contraseñas robustas mediante las validaciones existentes de longitud y complejidad.
3. No reutilizar contraseñas técnicas entre rondas E2E.
4. Suspender las cuentas QA y retirar sus roles al terminar cada ronda.
5. Eliminar `E2E_ACCESS_PROFILES_JSON` cuando las cuentas QA estén suspendidas.
6. Mantener secretos únicamente en GitHub Actions o en el entorno protegido `qa`.
7. Revisar periódicamente usuarios, perfiles suspendidos, asignaciones de rol y registros de auditoría.
8. Investigar y revocar inmediatamente cualquier cuenta ante indicios de exposición o acceso anómalo.

## Condiciones que obligan a revisar antes del vencimiento

La excepción debe revisarse inmediatamente si ocurre cualquiera de estas condiciones:

- decisión de abrir el producto al público;
- incorporación de usuarios externos a la organización responsable;
- aumento significativo del número de administradores;
- incidente de credenciales, autenticación o control de acceso;
- disponibilidad presupuestaria para un plan compatible;
- cambio de capacidades o precios de Supabase Auth.

## Criterio de cierre futuro

El riesgo se considerará resuelto cuando:

1. se actualice Supabase a un plan que incluya la función;
2. se habilite la protección frente a contraseñas filtradas;
3. se verifique su activación en el proyecto correcto;
4. se registre la evidencia en la documentación operativa y de seguridad.

## Decisión

Se acepta temporalmente el riesgo bajo los controles anteriores. Esta decisión permite cerrar Sprint 7, pero permanece como condición previa de revisión para el lanzamiento público.