# Fuentes del proyecto

> Estado: norma vigente  
> Última revisión: 2026-07-10  
> Alcance: datos eclesiales, civiles, institucionales y referencias técnicas

## Propósito

Esta norma define qué fuentes puede utilizar SINEP RD, cómo se determina su autoridad y qué información debe conservarse para verificar cada dato. Su objetivo es evitar que una importación, una página informativa o una corrección manual sustituya silenciosamente un acto oficial.

## Principios

- La autoridad de la fuente depende de la materia y de la competencia de quien la emite.
- La fecha efectiva del hecho prevalece sobre la fecha de carga o consulta.
- Una fuente auxiliar nunca modifica por sí sola un estado canónico.
- Las discrepancias se revisan; no se eliminan ocultando la evidencia anterior.
- Un documento oficial puede contener datos privados que no deben publicarse.
- Toda importación debe identificar procedencia, transformaciones y resultado.

## Jerarquía de autoridad

| Nivel | Tipo | Ejemplos | Uso permitido |
|---|---|---|---|
| A | Acto oficial competente | decreto, carta de nombramiento, acta o certificación canónica | Determinar hechos, vigencia y efectos canónicos |
| B | Registro institucional oficial | anuario, directorio, boletín, comunicación institucional | Verificar identidad, organización y estado operativo |
| C | Estándar o registro civil oficial | ISO, ONE, IANA, CLDR | Normalizar catálogos civiles y técnicos |
| D | Registro interno controlado | importación aprobada, acta de validación, auditoría | Trazabilidad operativa; no crea autoridad canónica |
| E | Fuente auxiliar | sitio informativo, mapa abierto, geocodificador | Investigación y contraste preliminar |

La clasificación A–E no reemplaza el análisis de competencia. Por ejemplo, una autoridad diocesana puede ser competente para una parroquia, pero no necesariamente para un acto reservado a la Santa Sede.

## Fuentes eclesiales aceptadas

### Santa Sede

- [Código de Derecho Canónico](https://www.vatican.va/archive/cod-iuris-canonici/cic_index_sp.html).
- *Acta Apostolicae Sedis* y actos pontificios aplicables.
- Anuario Pontificio.
- [Boletín de la Oficina de Prensa](https://press.vatican.va/).
- Documentos de dicasterios dentro de su competencia.

### República Dominicana

- Decretos de erección, división, fusión, supresión o cambio de dependencia.
- Decretos y cartas de nombramiento, aceptación o terminación.
- Actas y certificaciones de cancillería.
- Directorios de la Conferencia del Episcopado Dominicano.
- Directorios diocesanos y arquidiocesanos vigentes.
- Boletines, circulares y comunicaciones institucionales verificadas.
- Libros y archivos institucionales cuando exista autorización para consultarlos.

Los sitios web y redes institucionales pueden confirmar una novedad pública, pero un hecho canónico debe contrastarse con el acto o registro competente cuando esté disponible.

### Fuentes institucionales recibidas

Los libros de marca, directorios, hojas de cálculo, decretos y archivos entregados al proyecto son insumos controlados. El registro de importación o validación debe conservar su nombre, custodio, fecha, versión y responsable. No se asume que esos archivos están versionados en este repositorio.

## Fuentes civiles y técnicas

| Materia | Fuente preferida |
|---|---|
| Países y territorios | ISO 3166-1 |
| Subdivisiones civiles | ISO 3166-2 y registro nacional competente |
| Idiomas | ISO 639 |
| Monedas | ISO 4217 |
| Fechas e intervalos | ISO 8601 |
| Zonas horarias | IANA Time Zone Database |
| Localización y formatos | Unicode CLDR |
| División territorial dominicana y estadísticas | Oficina Nacional de Estadística |

La cartografía abierta y los geocodificadores son fuentes auxiliares. Cada coordenada obtenida automáticamente debe conservar proveedor, fecha, precisión y método de validación.

## Fuentes técnicas del software

- Las versiones efectivas se consultan en `package.json`, `pnpm-lock.yaml`, workflows y configuración de despliegue.
- El comportamiento ejecutable se verifica en código, migraciones y pruebas.
- Para implementar una tecnología se utiliza su documentación oficial.
- La lista vigente de tecnologías y comandos está en [Stack oficial](../architecture/STACK_OFICIAL.md).

No se duplican aquí versiones, tipografías o detalles de diseño que ya tienen un documento responsable.

## Datos mínimos de trazabilidad

Los contratos actuales usan, según el dominio:

- `source_name`: nombre entendible de la fuente.
- `source_url`: enlace, cuando puede conservarse y compartirse de forma segura.
- `source_checked_at`: fecha de consulta o verificación.
- `verification_status`: estado editorial del dato.

Cuando el flujo maneje documentos o hechos de mayor autoridad, también debe conservar cuando aplique:

- Institución emisora y custodio.
- Tipo, título y número del documento.
- Fecha de emisión y fecha efectiva.
- Ubicación física o digital.
- Página o sección relevante.
- Persona, entidad, cargo o evento relacionado.
- Nivel de autoridad.
- Actor que registró o verificó la fuente.
- Notas de discrepancia.

Los adjuntos privados se guardan en almacenamiento restringido; no se publican mediante una URL abierta.

## Estados editoriales

Usar los estados definidos por el contrato del dominio. Para nombramientos, el sistema reconoce actualmente:

- `verified`.
- `pending_review`.
- `needs_correction`.
- `disputed`.

No crear sinónimos nuevos desde la interfaz. Si otro dominio necesita estados diferentes, deben añadirse mediante migración, validación y documentación coordinadas.

## Resolución de discrepancias

1. Conservar las fuentes y el valor vigente mientras se revisa el caso.
2. Identificar si la diferencia es de grafía, fecha, alcance, jurisdicción o vigencia.
3. Comparar competencia, fecha efectiva y autenticidad de las fuentes.
4. Solicitar validación al custodio competente cuando sea necesario.
5. Registrar decisión, fundamento y actor.
6. Aplicar el resultado mediante el evento o flujo canónico correspondiente.

Una corrección nunca debe destruir el historial que explica el valor anterior.

## Publicación y privacidad

- Una fuente oficial no convierte automáticamente todos sus datos en públicos.
- No publicar documentos de identidad, contactos privados, información familiar, notas internas ni evidencias restringidas.
- Mostrar enlaces solo cuando su distribución sea legal y segura.
- Respetar licencias y atribución de mapas, imágenes, textos, tipografías y datos externos.
- Las sugerencias públicas permanecen pendientes hasta su revisión administrativa.

## Checklist de registro

- [ ] La autoridad emisora es competente para el dato.
- [ ] Se registraron nombre, fecha de consulta y ubicación disponible.
- [ ] La fecha efectiva se distingue de la fecha de carga.
- [ ] Se clasificó el estado de verificación.
- [ ] Las discrepancias quedaron documentadas.
- [ ] El documento o enlace puede almacenarse legalmente.
- [ ] Los datos privados permanecen fuera de las vistas públicas.
- [ ] El cambio usa el flujo canónico y queda auditado.

## Mantenimiento

Actualizar esta norma cuando cambie una fuente oficial, un contrato de trazabilidad o la política de publicación. Los inventarios concretos de archivos recibidos deben vivir en registros de importación o custodia, no crecer indefinidamente dentro de esta norma.

## Documentos relacionados

- [Reglas de base de datos](../architecture/REGLAS_BASE_DATOS.md)
- [Seguridad de datos](../architecture/SEGURIDAD_DATOS.md)
- [Arquitectura](../architecture/ARQUITECTURA.md)
- [Estándares web](./ESTANDARES_WEB_SINEP_RD.md)
