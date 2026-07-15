# Sprint 2 — Cierre técnico

> Fecha: 14 de julio de 2026  
> Rama: `main`  
> Commit de cierre S2-07: `b528e827105c400bb9b9851555e775912255930f`  
> Estado: **cerrado técnicamente**

## Resultado

Sprint 2 consolidó el modelo estructural canónico y sus límites entre:

- identidad institucional mediante `ecclesiastical_entities`;
- jerarquía territorial mediante plantillas, niveles, nodos y `structure_node_edges`;
- organización interna mediante `organization_charts` y `organization_units`;
- cargos, nombramientos y eventos mediante contratos relacionados, pero independientes.

El cierre técnico no activa ni publica automáticamente unidades organizativas y no sustituye la validación operativa de la beta.

## Evidencia de CI

La ejecución [CI #1129](https://github.com/Jumen-UX/sinep-rd/actions/runs/29383246693), asociada a `b528e827`, terminó correctamente:

- `Typecheck, tests and build`: aprobado;
- `Check`: aprobado;
- CodeQL JavaScript y TypeScript: aprobado;
- 56 rutas administrativas auditadas;
- 52 rutas delegadas en features;
- 4 rutas de composición;
- 0 rutas con I/O directo;
- 65 consumidores estructurales inventariados;
- 0 consumidores con fuente ambigua;
- 294 de 294 pruebas aprobadas;
- build de producción compilado correctamente.

El run intermedio [CI #1128](https://github.com/Jumen-UX/sinep-rd/actions/runs/29383187908), asociado a `46622867`, fue cancelado al llegar el commit posterior. No representa una falla. El commit anterior `3a3ddaa0` también había pasado CI #1127.

## Estado por bloque

| Bloque | Estado técnico | Evidencia principal |
|---|---|---|
| S2-01 Inventario | Completado | auditor estructural integrado en `pnpm check` |
| S2-02 Paridad | Completado | diagnósticos reproducibles y 0 discrepancias bloqueantes |
| S2-03 Territorio | Completado | árboles y descendencia derivados de edges vigentes |
| S2-04 Organización | Completado técnicamente | ciclo de vida explícito, cola de revisión y jerarquías normalizadas |
| S2-05 Cargos y alcance | Completado | RPC transaccional, sin fallback y 187 nombramientos compatibles |
| S2-06 Compatibilidad | Completado | seis modelos heredados bloqueados y proyección de padre protegida |
| S2-07 Documentación | Completado | modelo, contratos e inventario enlazados desde el índice |

## Invariantes consolidados

- `structure_node_edges` es la única fuente de parentesco territorial.
- `parent_node_id` solo se permite como proyección de lectura derivada.
- Las unidades organizativas pertenecen a un organigrama explícito.
- Guardar contenido no aprueba ni publica.
- Aprobar y publicar son operaciones separadas, autorizadas y auditadas.
- Los cargos por nivel se guardan de forma transaccional.
- No existe fallback silencioso a todos los cargos.
- Los seis modelos estructurales heredados bloqueados no pueden reaparecer bajo `src/`.
- Las rutas administrativas permanecen sin I/O directo.

## Pendientes operativos de beta

Los siguientes controles no reabren Sprint 2; pertenecen al proceso operativo de beta:

1. Preparar cuentas de prueba nacionales, diocesanas, restringidas y sin privilegios.
2. Validar edición, aprobación y publicación dentro y fuera del alcance.
3. Revisar funcionalmente las 192 unidades organizativas antes de aprobarlas.
4. Mantener la publicación separada y selectiva después de la aprobación.
5. Ejecutar `pnpm test:integration` contra Supabase no productivo.
6. Completar un recorrido autenticado de los flujos administrativos críticos.
7. Activar la protección contra contraseñas filtradas en Supabase Auth.
8. Verificar respaldo y realizar una restauración documentada.
9. Definir canal, severidad y responsables de incidentes de beta.
10. Completar validación institucional y jurídica antes de una apertura pública.

## Referencias

- [Backlog del Sprint 2](./SPRINT_2_BACKLOG.md)
- [Modelo estructural canónico](./SPRINT_2_CANONICAL_STRUCTURE_MODEL.md)
- [Contratos del modelo estructural](./architecture/CONTRATOS_MODELO_ESTRUCTURAL.md)
- [Inventario de compatibilidad](./SPRINT_2_LEGACY_COMPATIBILITY_INVENTORY.md)
- [Hoja de ruta](./roadmap/ROADMAP.md)
