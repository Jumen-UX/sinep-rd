# Pruebas E2E y accesibilidad

La suite de navegador es manual para evitar descargar Chromium y consumir minutos en cada `push`. No forma parte de `pnpm check`.

## Preparación inicial

```bash
pnpm test:e2e:install
```

El comando instala el navegador Chromium compatible con la versión fijada de Playwright.

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

## Flujo administrativo de importación

Usa una cuenta de pruebas con el alcance mínimo necesario:

```bash
E2E_ADMIN_EMAIL=usuario-pruebas@example.org \
E2E_ADMIN_PASSWORD='contraseña-de-pruebas' \
pnpm test:e2e:admin
```

La prueba inicia sesión de forma real, pero intercepta únicamente `POST /api/admin/importaciones/preparar`. Valida selección del dominio, lectura del CSV, cálculo del hash, vista previa y resultado persistido simulado sin crear lotes adicionales en Supabase.

## Suite completa

```bash
pnpm test:e2e
```

La suite usa:

- Chromium.
- trazas, capturas y video solo al fallar;
- Axe sobre WCAG A y AA;
- bloqueo de violaciones automáticas con impacto `critical` o `serious`;
- reporte HTML en `playwright-report/`;
- resultados completos de Axe adjuntos a cada prueba.

Los escaneos automáticos no sustituyen la revisión manual con teclado, lector de pantalla ni pruebas con usuarios.
