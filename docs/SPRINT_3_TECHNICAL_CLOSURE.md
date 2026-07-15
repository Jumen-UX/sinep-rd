# Sprint 3 — cierre técnico

**Fecha:** 2026-07-15  
**Rama:** `main`  
**Estado:** cierre técnico completado; S3-06 operativo pendiente

## Evidencia confirmada

El operador confirmó CI en verde después de las correcciones de codificación UTF-8 y de la prueba contractual que protege las etiquetas del flujo autenticado.

La validación técnica incluye:

- inventario de rutas administrativas sin I/O directo;
- auditoría estricta de consumidores estructurales;
- typecheck;
- pruebas unitarias y contractuales;
- build de producción.

La matriz autenticada está automatizada en `e2e/admin-access-matrix.spec.mjs` y se ejecuta mediante `pnpm test:e2e:access` cuando existe `E2E_ACCESS_PROFILES_JSON`.

## Límite de la evidencia

El CI verde no demuestra todavía el recorrido real con cuentas diferenciadas ni el aislamiento bidireccional entre diócesis.

S3-06 permanece abierto hasta disponer de:

1. una URL pública autorizada;
2. cuentas no productivas separadas para los estados `ready`, `onboarding`, `no_role` y `blocked`;
3. dos cuentas diocesanas con alcances mutuamente excluyentes;
4. ejecución de Playwright contra el entorno autorizado;
5. evidencia de auditoría sin credenciales ni secretos.

## Decisión de continuidad

El bloqueo restante es operativo y externo al código. Por esa dependencia, el desarrollo puede continuar con el siguiente sprint sin declarar cerrado S3-06.
