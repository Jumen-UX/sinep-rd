# Política de seguridad de SINEP RD

> Estado: vigente
> Última revisión: 2026-07-15
> Etapa del producto: beta interna

## Versiones soportadas

Durante la beta interna solo se mantiene la rama operativa `main` y los despliegues derivados de ella. No se ofrecen parches de seguridad para versiones históricas o forks no mantenidos.

## Reportar una vulnerabilidad

No publiques vulnerabilidades, credenciales, datos personales ni procedimientos de explotación en un issue público.

Reporta el hallazgo de forma privada al responsable del repositorio mediante los canales privados habilitados en GitHub. Si GitHub Security Advisories está disponible para el repositorio, úsalo como canal preferente.

Incluye, cuando sea posible:

- componente o ruta afectada;
- entorno observado;
- impacto potencial;
- pasos mínimos de reproducción sin datos sensibles;
- evidencia sanitizada;
- commit o versión aproximada;
- cualquier mitigación temporal identificada.

No incluyas contraseñas, tokens, claves de Supabase, service role, cookies de sesión, datos privados de personas ni copias completas de bases de datos.

## Alcance

La política cubre la aplicación Next.js, rutas API y contratos administrativos, Supabase Auth/PostgreSQL/RLS/RPC/Storage, despliegues de Vercel y workflows de GitHub Actions asociados a SINEP RD.

## Respuesta

Los reportes se clasifican por impacto y explotabilidad. Un hallazgo crítico puede bloquear la beta, suspender un flujo o requerir revocación de credenciales antes de continuar el desarrollo.

La corrección debe incluir, según aplique, prueba de regresión, revisión de alcance, auditoría de exposición, rotación de secretos y verificación del entorno desplegado.

La divulgación pública se coordinará después de aplicar una mitigación suficiente y evaluar el riesgo para datos y usuarios.

## Principios operativos

- La service role nunca se usa en el navegador.
- Los secretos no se almacenan en el repositorio ni en documentación.
- Una sesión autenticada no sustituye permiso y alcance.
- Las mutaciones sensibles deben ser auditables.
- Las pruebas mutantes se ejecutan únicamente en entornos no productivos y recuperables.
- Los datos personales y privados se minimizan en logs, artefactos y reportes.
