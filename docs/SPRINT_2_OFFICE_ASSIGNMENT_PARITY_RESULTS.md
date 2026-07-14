# Sprint 2 — S2-05: paridad de cargos y alcance

Fecha de validación: 14 de julio de 2026.

## Resultado

La configuración de cargos por nivel y los nombramientos vigentes fueron comparados contra los modelos canónicos de niveles, organigramas, unidades y entidades.

### Configuración por nivel

- 111 relaciones activas entre niveles y cargos.
- 49 relaciones marcadas como predeterminadas.
- La escritura pasa por `admin_save_structure_level_offices` en una única transacción, con bloqueo de fila, validación de alcance y auditoría.
- `get_structure_level_office_options` ya no expone todos los cargos activos como fallback silencioso.
- Las opciones disponibles se limitan a las familias de organigrama ya asociadas al mismo `level_key`.
- Un nivel sin configuración explícita, como `chapel`, recibe cero opciones en lugar de todos los cargos.

Familias observadas:

| Nivel | Cargos disponibles | Familias de organigrama |
|---|---:|---:|
| archdiocese | 3 | 2 |
| diocese | 3 | 2 |
| parish | 4 | 1 |
| pastoral-zone | 1 | 1 |
| vicariate | 1 | 1 |
| chapel | 0 | 0 |

### Nombramientos vigentes

- 187 nombramientos actuales y activos.
- 187 tienen cargo configurado.
- 187 tienen organigrama.
- 187 tienen entidad eclesiástica de alcance.
- 0 carecen de alcance.
- 0 presentan incompatibilidad entre el organigrama del cargo y el del nombramiento.
- 0 referencias de cargo están ausentes o inactivas.

Actualmente los 187 nombramientos vigentes están vinculados a entidad eclesiástica y organigrama; ninguno utiliza todavía `organization_unit_id`. Esto es válido para los datos actuales y no constituye una inconsistencia. Los futuros nombramientos internos deberán comprobar además la paridad entre unidad y organigrama.

## Contratos reproducibles

- `supabase/diagnostics/sprint2_office_assignment_parity.sql`
- `tests/office-assignment-parity-diagnostic.test.mjs`
- `tests/structure-level-office-transaction-contract.test.mjs`
- `tests/structure-level-office-options-scope.test.mjs`

## Criterio de cierre

S2-05 puede considerarse técnicamente completado cuando el CI confirme:

1. La escritura transaccional de cargos por nivel.
2. La ausencia de fallback silencioso.
3. La paridad de cargos, organigramas y alcance.
4. La permanencia del diagnóstico como consulta de solo lectura.
