# Reglas de base de datos — SINEP RD

Estas reglas deben guiar cualquier cambio de esquema, migración o RPC.

## 1. La base de datos es la fuente de verdad

La interfaz no decide la estructura eclesial. La interfaz consulta a la base de datos.

La base de datos debe responder:

- Qué estructuras existen.
- Qué estructura está activa.
- Qué niveles tiene cada estructura.
- Qué nodos existen en cada nivel.
- Qué relaciones padre/hijo son válidas.
- Qué cargos aplican a cada nivel.
- Qué vigencia histórica tiene cada registro.

## 2. No crear jerarquías rígidas

No se deben crear columnas fijas como única solución para jerarquías variables:

```txt
vicaria_id
zona_id
parroquia_id
sector_id
```

Ese patrón solo funciona para una diócesis con una estructura fija.

El patrón correcto es:

```txt
structure_template
  → structure_level
    → structure_node
      → structure_node_edge
```

## 3. Toda estructura debe tener vigencia

Las estructuras y relaciones deben poder responder:

```txt
¿Cómo era la diócesis en una fecha determinada?
¿Qué parroquia pertenecía a qué zona en ese momento?
Qué cambio produjo esta relación?
```

Por eso los nodos y relaciones deben usar campos como:

- `start_date`
- `end_date`
- `is_current`
- `status`
- `source_name`
- `source_url`
- `source_checked_at`

## 4. No editar silenciosamente cambios estructurales importantes

Cambios como división, fusión, supresión, desmembramiento o cambio de dependencia deben registrarse como eventos.

No basta con modificar una fila.

Debe existir un evento con:

- Tipo de evento.
- Fecha efectiva.
- Motivo.
- Fuente documental.
- Nodos afectados.
- Usuario responsable.
- Estado de aprobación.

## 5. Separar entidades eclesiásticas de nodos estructurales

Una entidad eclesiástica puede existir canónicamente aunque participe en distintas estructuras.

Ejemplo:

```txt
Parroquia San José
```

Puede estar vinculada a:

- Una jurisdicción eclesiástica.
- Un nodo territorial.
- Un nodo pastoral.
- Un organigrama administrativo.

Por eso no todo debe vivir en una sola tabla de parroquias.

## 6. Catálogos antes que texto libre

Cuando el usuario pueda seleccionar, no debe escribir.

Usar catálogos para:

- Tipos de persona.
- Tipos de sacerdote.
- Estados canónicos.
- Estados pastorales.
- Cargos.
- Tipos de estructura.
- Tipos de eventos.
- Fuentes documentales.
- Países ISO.
- Subdivisiones civiles ISO.
- Idiomas ISO.
- Monedas ISO.

## 7. Campos privados en tablas privadas

No agregar campos sensibles a vistas públicas ni tablas que se consumen directamente desde la UI pública.

Los datos privados deben estar separados, por ejemplo:

```txt
persons                    → datos públicos/controlados
person_private_validation  → datos sensibles o internos
```

## 8. Cargos y nombramientos son históricos

No sobrescribir un cargo actual sin cerrar o historizar el anterior.

Un nombramiento debe tener:

- Persona.
- Cargo configurado.
- Entidad o nodo donde sirve.
- Fecha efectiva.
- Inicio.
- Fin previsto.
- Fin real.
- Estado.
- Fuente.
- Visibilidad.
- Relación con predecesor/sucesor cuando aplique.

## 9. PLpgSQL solo para reglas críticas

Usar PLpgSQL cuando sea necesario garantizar:

- Atomicidad.
- Seguridad.
- Historial.
- Validación jerárquica.
- Integridad entre múltiples tablas.
- Auditoría.

Evitar PLpgSQL para lógica visual o transformaciones de presentación.

## 10. Migraciones reversibles conceptualmente

Aunque algunas migraciones no sean reversibles automáticamente, deben ser comprensibles y auditables.

Cada migración debe tener:

- Nombre claro.
- Comentarios cuando cambie seguridad o datos históricos.
- Sin IDs hardcodeados cuando puedan consultarse por clave estable.
- Validaciones antes de operaciones destructivas.

## 11. No borrar historia

Regla general:

```txt
Cerrar vigencia > borrar registro
```

Usar `end_date`, `is_current = false`, `status = inactive/suppressed/archived` antes que borrar.

Solo borrar cuando:

- Sea dato de prueba.
- Sea corrección inmediata antes de uso real.
- No exista dependencia histórica.
- Sea requerido por privacidad o cumplimiento.

## 12. Toda lectura pública debe respetar visibilidad

Las vistas públicas y RPC lectoras deben respetar:

- `visibility`
- `status`
- `publication_status`
- vigencia histórica
- RLS

## 13. Dashboards leen agregados controlados

El dashboard no debe hacer consultas improvisadas a muchas tablas desde el cliente.

Preferir:

- Vistas seguras.
- RPC lectoras.
- Agregados controlados.
- Filtros por estructura activa.

## 14. Pruebas mínimas antes de cerrar una fase

Antes de cerrar una fase de base de datos:

- Ejecutar Supabase Security Advisor.
- Ejecutar Supabase Performance Advisor.
- Verificar RLS en tablas nuevas.
- Verificar grants de funciones nuevas.
- Probar lectura pública.
- Probar usuario autenticado sin permisos.
- Probar usuario administrador.
- Probar caso histórico con fecha anterior.
