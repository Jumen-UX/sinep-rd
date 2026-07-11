# Fuentes del proyecto — SINEP RD

**Documento:** registro maestro de fuentes y referencias  
**Proyecto:** Sistema Nacional de Información Eclesiástica y Pastoral de República Dominicana  
**Última actualización:** 10 de julio de 2026  
**Estado:** vigente

## 1. Propósito

Este documento identifica las fuentes que sustentan el diseño, los datos, las reglas eclesiales, la identidad visual y la implementación técnica de SINEP RD.

Sus objetivos son:

- Distinguir fuentes oficiales de referencias auxiliares.
- Determinar cuál fuente prevalece cuando existen discrepancias.
- Mantener trazabilidad sobre cada dato importante.
- Evitar que una importación, página web o corrección manual sustituya silenciosamente un acto oficial.
- Centralizar las referencias técnicas y tipográficas del proyecto.

---

## 2. Jerarquía de autoridad

Cuando dos fuentes difieran, se aplicará el siguiente orden general, salvo que una regla específica disponga otra cosa.

| Nivel | Clase de fuente | Uso principal | Autoridad |
|---|---|---|---|
| A | Acto jurídico o documento oficial competente | Erecciones, supresiones, nombramientos, límites, cambios de dependencia y hechos canónicos | Canónica |
| B | Registro institucional oficial | Directorios, boletines, anuarios, fichas de cancillería y comunicaciones institucionales | Oficial administrativa |
| C | Estándar o registro civil oficial | Países, subdivisiones, idiomas, monedas, zonas horarias y divisiones territoriales civiles | Oficial técnica o civil |
| D | Documento interno controlado | Importaciones, actas de validación, correcciones aprobadas y documentación del proyecto | Operativa |
| E | Fuente auxiliar | Orientación, georreferenciación preliminar, verificación cruzada o investigación | No canónica |

### Regla de prevalencia

1. Un acto oficial competente prevalece sobre un directorio o una página informativa.
2. La fecha efectiva del acto prevalece sobre la fecha en que el dato fue cargado en el sistema.
3. Una fuente auxiliar nunca debe cambiar por sí sola el estado canónico o histórico de una entidad, persona o cargo.
4. Las discrepancias deben registrarse y enviarse a revisión; no deben resolverse borrando la evidencia anterior.

---

## 3. Fuentes normativas y eclesiales

### 3.1 Santa Sede

| Fuente | Autoridad responsable | Aplicación en SINEP RD | Nivel |
|---|---|---|---|
| Código de Derecho Canónico | Santa Sede | Reglas generales sobre personas jurídicas, oficios, diócesis, parroquias, templos y gobierno eclesial | A |
| Acta Apostolicae Sedis | Santa Sede | Promulgación y verificación de actos de alcance universal o pontificio | A |
| Anuario Pontificio | Secretaría de Estado / Santa Sede | Verificación institucional de circunscripciones, titulares y datos de referencia | A/B |
| Boletín de la Oficina de Prensa de la Santa Sede | Oficina de Prensa de la Santa Sede | Nombramientos, renuncias, erecciones y comunicaciones recientes | B |
| Constitución apostólica *Praedicate Evangelium* | Santa Sede | Organización general de la Curia Romana y dicasterios | A |
| Directorios, instrucciones y decretos de dicasterios | Dicasterio competente | Reglas especializadas según la materia | A/B |

**Portales de referencia:**

- Santa Sede: <https://www.vatican.va/>
- Oficina de Prensa: <https://press.vatican.va/>
- Curia Romana: <https://www.vatican.va/content/romancuria/es.html>

### 3.2 Iglesia en América Latina y el Caribe

| Fuente | Autoridad responsable | Aplicación | Nivel |
|---|---|---|---|
| Documentos del CELAM | Consejo Episcopal Latinoamericano y Caribeño | Terminología, organización y contexto pastoral regional | B |
| Documentos de conferencias generales del episcopado latinoamericano | CELAM y autoridades eclesiales participantes | Referencia pastoral e histórica | B |

Portal de referencia: <https://www.celam.org/>

### 3.3 República Dominicana

| Fuente | Custodio | Aplicación | Nivel |
|---|---|---|---|
| Decretos de erección, división, desmembramiento, fusión o supresión | Autoridad eclesiástica competente | Historia y vigencia de circunscripciones, parroquias y otras entidades | A |
| Decretos y cartas de nombramiento | Autoridad eclesiástica competente | Cargos, fechas de inicio, terminación, sucesión y condición de vacante | A |
| Actas y certificaciones de cancillería | Cancillería correspondiente | Verificación de actos, fechas, nombres y documentos | A/B |
| Directorios oficiales de la Conferencia del Episcopado Dominicano | Conferencia del Episcopado Dominicano | Verificación nacional de jurisdicciones, clero, organismos y contactos | B |
| Directorios diocesanos y arquidiocesanos | Diócesis o arquidiócesis correspondiente | Parroquias, templos, personas, cargos y estructuras internas | B |
| Boletines, circulares y comunicaciones oficiales | Institución emisora | Confirmación de novedades institucionales y pastorales | B |
| Libros parroquiales y archivos institucionales | Parroquia, diócesis o archivo competente | Investigación y validación histórica autorizada | A/B |
| Sitios web y redes institucionales verificadas | Institución titular | Señal de actualización y referencia pública; requieren contraste para hechos canónicos | B/E |

### 3.4 Fuentes propias de la Arquidiócesis de Santo Domingo

| Fuente | Uso en el proyecto | Nivel |
|---|---|---|
| `PDF LIBRO DE MARCA ARQUIDIOCESIS SANTO DOMINGO 2023 baja.pdf` | Identidad visual, colores, marcas, composición y criterios gráficos | B/D |
| `directorio_parroquias_Sto Dgo 2026.xlsx` | Carga y validación inicial de parroquias, templos, contactos y organización territorial/pastoral | B/D |
| Decretos y archivos de la curia arquidiocesana | Fuente canónica de estructuras, límites, cargos y eventos históricos | A |
| Directorio arquidiocesano vigente | Contraste operativo de personas, entidades y asignaciones | B |
| Organización pastoral aprobada | Vicarías, zonas, comisiones, consejos, equipos y dependencias pastorales | A/B |

---

## 4. Fuentes civiles y estándares

### 4.1 Catálogos internacionales

| Dato | Fuente o estándar | Uso en SINEP RD | Nivel |
|---|---|---|---|
| Países y territorios | ISO 3166-1 | Código, nombre oficial y bandera asociada | C |
| Subdivisiones civiles | ISO 3166-2 | Provincias, estados, departamentos u otras divisiones | C |
| Idiomas | ISO 639 | Identificación normalizada de idiomas | C |
| Monedas | ISO 4217 | Código y denominación de monedas | C |
| Fechas y horas | ISO 8601 | Formato de fechas, horas e intervalos | C |
| Zonas horarias | IANA Time Zone Database | Identificadores de zona horaria | C |
| Escrituras, localidades y formatos regionales | Unicode CLDR | Nombres localizados, formatos y metadatos lingüísticos | C |

Portales de referencia:

- ISO: <https://www.iso.org/>
- IANA Time Zone Database: <https://www.iana.org/time-zones>
- Unicode CLDR: <https://cldr.unicode.org/>

### 4.2 República Dominicana

| Fuente | Aplicación | Nivel |
|---|---|---|
| Oficina Nacional de Estadística (ONE) | Divisiones territoriales civiles, códigos, denominaciones y estadísticas oficiales | C |
| Normativa y registros del Estado dominicano | Validación de nombres y condiciones jurídicas civiles cuando corresponda | C |
| Cartografía oficial disponible | Límites y coordenadas de referencia | C |

Portal de referencia de la ONE: <https://www.one.gob.do/>

### 4.3 Fuentes cartográficas auxiliares

Los servicios cartográficos externos pueden utilizarse para geocodificación preliminar o visualización, pero no deben considerarse fuente canónica de límites eclesiásticos.

Ejemplos de uso auxiliar:

- OpenStreetMap.
- Proveedores de geocodificación.
- Imágenes satelitales autorizadas.
- Catálogos geográficos abiertos.

Toda coordenada obtenida automáticamente debe conservar:

- Proveedor.
- Fecha de consulta.
- Nivel de precisión.
- Método de validación.
- Usuario o proceso responsable.

---

## 5. Fuentes internas del proyecto

| Documento o ubicación | Finalidad |
|---|---|
| `README.md` | Entrada general al repositorio |
| `docs/FUENTES_DEL_PROYECTO.md` | Registro maestro de fuentes y referencias |
| Plan Maestro vigente | Alcance, prioridades, sprints y criterios de cierre |
| Reestructuración del plan de trabajo | Decisiones funcionales y arquitectónicas de base |
| Reglas de base de datos | Integridad, vigencia, historial, auditoría y operaciones permitidas |
| Contrato de arquitectura | Separación por dominios, servicios, rutas y dependencias |
| Migraciones de Supabase | Historial ejecutable del esquema y reglas de datos |
| Pruebas automatizadas | Especificación verificable de comportamientos críticos |
| Historial de Git | Autoría, motivación y evolución técnica |
| Registros de importación | Procedencia, transformaciones, errores y resultados de cada lote |
| Registros de auditoría | Actor, operación, fecha, registro afectado y metadatos |

### Regla

Una decisión expresada en una conversación no se considera implementada hasta que esté reflejada, según corresponda, en:

- Código.
- Migración.
- Prueba.
- Documento funcional o técnico.
- Registro de auditoría.

---

## 6. Fuentes técnicas

Las versiones efectivas deben consultarse siempre en `package.json`, `pnpm-lock.yaml`, workflows y configuración de despliegue.

| Tecnología | Uso en el proyecto | Fuente principal |
|---|---|---|
| Next.js 15 | Aplicación web, rutas, renderizado y compilación | <https://nextjs.org/docs> |
| React 19 | Componentes y estado de interfaz | <https://react.dev/> |
| TypeScript 5 | Tipado y validación estática | <https://www.typescriptlang.org/docs/> |
| Supabase JS / SSR | Acceso a datos, autenticación y sesiones | <https://supabase.com/docs> |
| PostgreSQL | Base de datos, funciones, vistas, restricciones e índices | <https://www.postgresql.org/docs/> |
| Tailwind CSS 4 | Utilidades de estilo y procesamiento CSS | <https://tailwindcss.com/docs> |
| Radix Slot | Composición de componentes | <https://www.radix-ui.com/primitives> |
| pnpm 10 | Gestión de paquetes y scripts | <https://pnpm.io/> |
| Node.js 22 | Entorno de ejecución | <https://nodejs.org/docs/latest-v22.x/api/> |
| GitHub y GitHub Actions | Control de versiones, revisión y CI | <https://docs.github.com/> |
| Render | Despliegue de la aplicación | <https://render.com/docs> |

### Versiones declaradas actualmente

Según `package.json`:

```text
Node.js: 22.x
pnpm: 10.18.3
Next.js: ^15.1.6
React: ^19.0.0
TypeScript: ^5.7.3
Tailwind CSS: ^4.0.0
@supabase/supabase-js: ^2.48.1
@supabase/ssr: ^0.5.2
```

---

## 7. Fuentes tipográficas actuales

### 7.1 Configuración global vigente

La tipografía global declarada en `src/app/globals.css` es:

```css
font-family: Arial, Helvetica, sans-serif;
```

Orden de resolución:

1. **Arial**.
2. **Helvetica**, cuando Arial no esté disponible.
3. Fuente genérica **sans-serif** del sistema.

### 7.2 Alcance

Esta familia se hereda actualmente desde `html` y `body` y se aplica, salvo sobrescritura específica, a:

- Portal público.
- Portal administrativo.
- Formularios.
- Tablas.
- Navegación.
- Fichas y dashboards.

Los controles que utilizan `font: inherit` conservan la misma familia tipográfica.

### 7.3 Archivos relacionados

| Archivo | Responsabilidad |
|---|---|
| `src/app/globals.css` | Familia tipográfica global y estilos base |
| `src/app/brand.css` | Colores y ajustes visuales institucionales |
| `src/app/admin-brand.css` | Estilos del portal administrativo |
| `src/app/layout.tsx` | Carga global de hojas de estilo |
| Libro de marca institucional | Fuente de criterio para una futura selección tipográfica oficial |

### 7.4 Estado de la tipografía

La pila actual utiliza fuentes del sistema y no requiere descargar archivos tipográficos externos. Si el libro de marca exige una familia institucional distinta, el cambio debe documentar:

- Nombre exacto de la familia.
- Pesos autorizados.
- Licencia.
- Origen del archivo o proveedor.
- Estrategia de carga.
- Fallbacks.
- Pruebas de rendimiento y legibilidad.

No deben incorporarse archivos de fuentes al repositorio sin verificar previamente su licencia de distribución y uso web.

---

## 8. Datos mínimos que debe guardar cada referencia

Toda fuente registrada en base de datos debe poder conservar, según aplique:

```text
Tipo de fuente
Título
Autoridad o institución emisora
Número de documento o decreto
Fecha de emisión
Fecha efectiva
URL o ubicación física/digital
Archivo adjunto
Idioma
Páginas o sección relevante
Entidad o persona relacionada
Nivel de autoridad
Estado de verificación
Usuario que registró la fuente
Fecha de registro
Notas de discrepancia
```

### Estados recomendados

```text
Pendiente de revisión
Verificada
Verificada con observaciones
Rechazada
Sustituida por una fuente posterior
No localizada
```

---

## 9. Reglas de trazabilidad

1. Cada entidad, persona, cargo o evento histórico importante debe admitir una o más fuentes.
2. La fuente principal debe diferenciarse de las fuentes de apoyo.
3. Un cambio de fuente no debe eliminar la referencia anterior.
4. Las fuentes sustituidas deben conservar su vigencia histórica.
5. Los documentos privados deben respetar permisos y políticas de acceso.
6. Los datos sensibles no deben exponerse en fichas públicas aunque su fuente sea oficial.
7. Toda importación debe registrar el archivo original, lote, transformaciones y resultado.
8. Los valores derivados deben indicar el método de cálculo y las fuentes de entrada.
9. Las correcciones manuales deben registrar motivo, actor y evidencia.
10. Las publicaciones web deben mostrar únicamente fuentes que puedan hacerse públicas.

---

## 10. Política frente a discrepancias

Cuando dos fuentes oficiales no coincidan:

1. No sobrescribir automáticamente el dato vigente.
2. Registrar ambas fuentes.
3. Identificar si la diferencia es de fecha, grafía, jurisdicción, alcance o vigencia.
4. Solicitar validación a la autoridad custodio del dato.
5. Registrar la resolución y su fundamento.
6. Aplicar el cambio mediante la operación o evento histórico correspondiente.

---

## 11. Mantenimiento del documento

Este archivo debe actualizarse cuando ocurra cualquiera de estos casos:

- Se incorpora una nueva fuente institucional.
- Cambia la fuente canónica de un catálogo.
- Se añade una tecnología principal.
- Cambia la tipografía global.
- Se recibe un nuevo directorio, decreto, anuario o libro de marca.
- Se identifica que una fuente auxiliar estaba siendo tratada incorrectamente como oficial.

Cada actualización debe quedar asociada a un commit descriptivo.