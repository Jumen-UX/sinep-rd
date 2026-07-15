# Pruebas E2E y accesibilidad

La suite de navegador es manual para evitar descargar Chromium y consumir minutos en cada `push`. No forma parte de `pnpm check`.

## PreparaciÃ³n inicial

```bash
pnpm test:e2e:install
```

El comando instala el navegador Chromium compatible con la versiÃ³n fijada de Playwright.

## Servidor local

Configura `.env.local` con las variables normales de Supabase y ejecuta:

```bash
pnpm test:e2e:public
```

Si no existe `E2E_BASE_URL`, Playwright inicia `pnpm dev` en `http://127.0.0.1:3000` y lo detiene al finalizar.

## Entorno ya desplegado

```bash
E2E_BASE_URL=https://entorno-de-prueba.example pnpm test:e2e:public
```

No uses una URL protegida por SSO externo salvo que el navegador de prueba pueda autenticarse en ese SSO.

## Flujo administrativo de importaciÃ³n sin mutaciones

Usa una cuenta de pruebas con el alcance mÃ­nimo necesario:

```bash
E2E_ADMIN_EMAIL=usuario-pruebas@example.org \
E2E_ADMIN_PASSWORD='contraseÃ±a-de-pruebas' \
pnpm test:e2e:admin
```

## Matriz operativa de acceso

La prueba de acceso utiliza cuentas dedicadas de un entorno no productivo y se ejecuta con:

```bash
pnpm test:e2e:access
```

Las credenciales y expectativas se suministran exclusivamente mediante el secreto
`E2E_ACCESS_PROFILES_JSON`. El valor es un arreglo JSON; cada entrada admite:

```json
{
  "label": "diocesan-a",
  "email": "cuenta-configurada-en-secreto",
  "password": "contraseÃ±a-configurada-en-secreto",
  "expectedState": "ready",
  "ownEntityId": "uuid-de-la-diocesis-a",
  "forbiddenEntityId": "uuid-de-la-diocesis-b"
}
```

`expectedState` puede ser `ready`, `onboarding`, `no_role` o `blocked`. Para demostrar
aislamiento bidireccional deben existir dos entradas diocesanas que intercambien
`ownEntityId` y `forbiddenEntityId`. Una cuenta nacional puede declarar
`minimumVisibleDioceses` para comprobar que su catÃ¡logo no queda restringido a una sola
jurisdicciÃ³n.

La prueba no muta datos. Comprueba la redirecciÃ³n efectiva despuÃ©s del login y, para
cuentas listas, consulta el catÃ¡logo diocesano filtrado por el servidor. Los reportes solo
usan `label`; no imprimen correos ni contraseÃ±as.

La prueba inicia sesiÃ³n de forma real, pero intercepta Ãºnicamente `POST /api/admin/importaciones/preparar`. Valida selecciÃ³n del dominio, lectura del CSV, cÃ¡lculo del hash, vista previa y resultado persistido simulado sin crear lotes adicionales en Supabase.

## Piloto mutante `create + noop` de personas

Este recorrido solo debe ejecutarse contra una rama de desarrollo de Supabase o una base no productiva que pueda restablecerse. Nunca habilites `E2E_ALLOW_MUTATIONS=true` contra producciÃ³n.

Necesita una persona existente con cÃ³digo interno estable en ese entorno. El recorrido usa esa identidad como `noop` y crea una segunda persona con visibilidad `internal` y nombre Ãºnico.

```bash
E2E_BASE_URL=https://entorno-no-productivo.example \
E2E_ADMIN_EMAIL=usuario-pruebas@example.org \
E2E_ADMIN_PASSWORD='contraseÃ±a-de-pruebas' \
E2E_ALLOW_MUTATIONS=true \
E2E_PERSON_REFERENCE_CODE=CLERO-000112 \
E2E_PERSON_FIRST_NAME=Agustinus \
E2E_PERSON_LAST_NAME=Panggul \
pnpm test:e2e:admin:mutation
```

La prueba verifica el ciclo completo:

1. login real;
2. preparaciÃ³n de un CSV de dos filas;
3. clasificaciÃ³n de una fila como `create` y otra como `noop`;
4. aprobaciÃ³n editorial;
5. aplicaciÃ³n transaccional;
6. descarga del reporte final CSV;
7. repeticiÃ³n idempotente del endpoint de aplicaciÃ³n.

La persona creada queda marcada como interna y contiene un identificador Ãºnico del recorrido. En una rama efÃ­mera, restablece la base al finalizar. En una base compartida de pruebas, archiva o elimina el registro mediante el procedimiento administrativo acordado; no lo borres directamente desde SQL.

## Suite completa

```bash
pnpm test:e2e
```

La suite usa:

- Chromium;
- trazas, capturas y video solo al fallar;
- Axe sobre WCAG A y AA;
- bloqueo de violaciones automÃ¡ticas con impacto `critical` o `serious`;
- reporte HTML en `playwright-report/`;
- resultados completos de Axe adjuntos a cada prueba.

## EjecuciÃ³n desde GitHub Actions

El workflow `CI` mantiene el flujo directo sobre `main`:

- cada `push` ejecuta TypeScript, pruebas unitarias, contratos estructurales, build y CodeQL;
- cada lunes ejecuta CodeQL y una auditorÃ­a de vulnerabilidades crÃ­ticas en dependencias de producciÃ³n;
- la prueba de navegador contra producciÃ³n se inicia manualmente para no consumir minutos ni generar trÃ¡fico en cada cambio.

Para probar un despliegue:

1. Abre **GitHub â†’ Actions â†’ CI â†’ Run workflow**.
2. Escribe la URL pÃºblica completa en `base_url`.
3. Ejecuta el workflow.

La ejecuciÃ³n prueba las rutas pÃºblicas con Playwright y Axe. Si existen los secretos `E2E_ADMIN_EMAIL` y `E2E_ADMIN_PASSWORD`, tambiÃ©n prueba el flujo administrativo sin mutaciones. El recorrido mutante no debe activarse automÃ¡ticamente: requiere `E2E_ALLOW_MUTATIONS=true` y las tres variables de referencia de persona en un entorno no productivo.

El reporte HTML, las capturas, los videos y las trazas se conservan como artefactos durante 14 dÃ­as.

Los escaneos automÃ¡ticos no sustituyen la revisiÃ³n manual con teclado, lector de pantalla ni pruebas con usuarios.

