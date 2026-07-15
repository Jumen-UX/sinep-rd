# Sprint 2 — Cierre técnico

> Estado: archivado
> Fecha: 2026-07-14
> Commit de cierre S2-07: `b528e827105c400bb9b9851555e775912255930f`

Sprint 2 consolidó los límites entre identidad institucional, jerarquía territorial, organización interna y cargos o nombramientos.

CI #1129 confirmó 56 rutas administrativas auditadas, 52 delegadas en features, 4 de composición, 0 con I/O directo, 65 consumidores estructurales inventariados, 0 fuentes ambiguas, 294 pruebas aprobadas y build de producción correcto.

Invariantes consolidados:

- `structure_node_edges` es la fuente de parentesco territorial.
- `parent_node_id` solo se permite como proyección derivada.
- Las unidades organizativas pertenecen a un organigrama explícito.
- Guardar no aprueba ni publica.
- Aprobar y publicar son operaciones separadas y auditadas.
- Los cargos por nivel se guardan transaccionalmente.
- No existe fallback silencioso a todos los cargos.
- Los modelos estructurales heredados bloqueados no pueden reaparecer bajo `src/`.
- Las rutas administrativas permanecen sin I/O directo.

Los controles operativos de beta se trasladaron a la hoja de ruta. Consulta también la evidencia consolidada del Sprint 2.
