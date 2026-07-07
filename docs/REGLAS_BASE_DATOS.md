# Reglas de base de datos

SINEP RD debe conservar historia, fuentes y vigencias. No debe funcionar como una lista plana que se sobrescribe.

## Historial

Cuando un dato puede cambiar con el tiempo, debe modelarse con vigencia o evento.

Ejemplos:

- Nombramiento.
- Traslado.
- Cambio de parroquia.
- Cambio de dependencia.
- Ereccion de parroquia.
- Division territorial.
- Fusion o supresion de unidad.

## Fechas

Usar formato ISO para fechas.

- Fecha completa: `YYYY-MM-DD`.
- Periodos historicos: guardar inicio y fin cuando aplique.
- Si no se conoce una fecha exacta, registrar nota o estado de precision en vez de inventarla.

## Catalogos

El usuario debe seleccionar opciones ya cargadas siempre que sea posible.

Usar listas oficiales cuando existan:

- Paises.
- Provincias.
- Monedas.
- Idiomas.
- Tipos de documento.

Para datos eclesiales sin lista ISO, usar catalogos internos con fuente.

## Estructura eclesial

La estructura interna de una diocesis no debe guardarse como columnas fijas.

Debe usarse el motor de estructuras:

- Plantilla.
- Nivel.
- Nodo.
- Padre.
- Vigencia.
- Evento.

## Nombramientos

Un nombramiento debe vincular:

- Persona.
- Cargo.
- Entidad o nodo.
- Fecha de inicio.
- Fecha de fin, si aplica.
- Estado.
- Fuente o nota.

## Regla de no duplicacion

Antes de crear una entidad o persona, buscar coincidencias existentes.

La interfaz debe favorecer:

1. Buscar.
2. Seleccionar.
3. Completar.
4. Crear solo si no existe.

## Fuentes

Todo dato historico o institucional debe poder vincularse a fuente, nota o documento de respaldo.