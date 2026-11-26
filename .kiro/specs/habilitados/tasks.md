# Implementation Plan: `POST /habilitados`

## Overview

Implementar el endpoint `POST /habilitados` sobre la aplicación Express existente. El orden es: primero los gates (para registrar el run en rojo), luego los tests (que fallan porque el endpoint no existe), luego la implementación y al final las correcciones que dejan el pipeline en verde.

Después de cada tarea: `npm test` en la terminal y commit + push.

---

## Tasks

- [x] 1. Agregar los gates al pipeline
  - [x] 1.1 Umbral de cobertura en `jest.config.js`
    - Añadir `coverageThreshold: { global: { lines: 80 } }` al objeto exportado, sin tocar las otras claves.
    - En `.github/workflows/ci.yml`, cambiar el paso "Ejecutar pruebas" de `npm test` a `npm test -- --coverage`.
    - _Requisitos: 5.1, 5.2_

  - [x] 1.2 Job `audit` (SCA) en `.github/workflows/ci.yml`
    - Job separado `audit` en `ubuntu-latest`: `actions/checkout@v4`, `actions/setup-node@v4` con `node-version: 22`, y `npm audit --audit-level=high`.
    - No corregir la versión de `lodash` en esta tarea: el run debe fallar.
    - _Requisitos: 6.1_

  - [x] 1.3 Job `secrets` (gitleaks) en `.github/workflows/ci.yml`
    - Job separado `secrets` en `ubuntu-latest`: `actions/checkout@v4` con `fetch-depth: 0`.
    - Descargar el CLI y escanear todo el historial:
      `curl -sSfL https://github.com/gitleaks/gitleaks/releases/download/v8.24.0/gitleaks_8.24.0_linux_x64.tar.gz | tar -xz gitleaks`
      `./gitleaks detect --source . --redact -v`
    - No usar `gitleaks-action`: en un push solo revisa los commits nuevos y no detectaría la clave de commits anteriores.
    - No tocar `config/ejemplo.env` en esta tarea: el run debe fallar.
    - _Requisitos: 7.1_

- [x] 2. Escribir los tests de `POST /habilitados` (deben fallar: el endpoint aún no existe)
  - [x] 2.1 Crear `tests/habilitados.test.js` con los tests del Requisito 1.
    - Importar `supertest`, `app` desde `../src/app` y `repositorio` desde `../src/data/repositorio`.
    - Test 1.1: `{ "aprobados": ["1INF25"] }` → 200, el body es un array.
    - Test 1.2: `{ "aprobados": [] }` → 200, exactamente los cursos con `prerequisites` vacío.
    - Test 1.3: `{ "aprobados": ["1INF25","1INF27","1INF49"] }` → 200, exactamente 27 cursos, incluye `1INF29`, `1INF30`, `1INF31` y `1INF32`.
    - Test 1.4: con el mismo body, ningún id de `aprobados` aparece en la respuesta y cada curso devuelto tiene sus `prerequisites` dentro de `aprobados`.
    - Test 1.6: `jest.spyOn(repositorio, 'listar').mockImplementation(() => { throw new Error('C:\\apps\\malla\\src\\x.js') })` → 500, body exactamente `{ "error": "Error interno del servidor" }`, el body serializado no contiene `stack`, `at ` ni `C:\`. Restaurar el mock con `mockRestore()`.
    - No implementar la ruta en esta tarea.
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.6_

  - [x] 2.2 Agregar al mismo archivo los tests de validación (Requisitos 2, 3 y 4).
    - Test 2.1: `{}` → 400, `{ "error": "El campo aprobados es obligatorio" }`.
    - Test 2.2: `{ "aprobados": "1INF25" }` → 400, `{ "error": "El campo aprobados debe ser un array" }` (hallazgo 3).
    - Test 2.3: string `{invalid` con `Content-Type: application/json` → 400, `{ "error": "El body debe ser JSON válido" }`.
    - Test 2.4: `[123]` y `[null]` → 400.
    - Test 3.1/3.2: `["1INF30<script>"]` → 400, el body serializado no contiene `<script>` (hallazgo 2).
    - Test 3.3: mismo caso → status distinto de 500 y el body no contiene `stack`.
    - Test 4.1a: 151 elementos `"AAAAAA"` → 400, `{ "error": "El campo aprobados no puede tener más de 150 elementos" }`.
    - Test 4.1b: 5 000 elementos → 400 en menos de 500 ms (hallazgo 1).
    - Test 4.2: 150 elementos válidos con duplicados (`"1INF25"` repetido) → 200.
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2_

- [ ] 3. Implementar el endpoint
  - [ ] 3.1 Crear `src/util/validadorAprobados.js` con `validarAprobados(body)`.
    - Devuelve `null` si es válido o `{ status: 400, message }` con el primer error.
    - Orden: (1) `aprobados` ausente, (2) no es array, (3) longitud > 150, (4) algún elemento no es string → `"Uno o más elementos no son strings"`, (5) algún código no cumple `^[A-Z0-9]{6}$`.
    - _Requisitos: 2.1, 2.2, 2.4, 3.1, 3.2, 4.1_

  - [ ] 3.2 Crear `src/routes/habilitados.js`.
    - Router con `POST /`: validar con `validarAprobados(req.body)`; si hay error, responder 400 `{ error: message }`.
    - Convertir `aprobados` en un `Set`, llamar a `repositorio.listar()` y filtrar los cursos cuyo `id` no esté en el Set y cuyos `prerequisites` estén todos en el Set. Mantener el orden del repositorio.
    - Responder 200 con el array. No usar try/catch: los errores no controlados llegan al middleware de `app.js`.
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ] 3.3 Modificar `src/app.js`.
    - Añadir `app.use('/habilitados', require('./routes/habilitados'))` después de `/cursos`.
    - Añadir antes del middleware genérico un middleware de 4 argumentos que capture `err instanceof SyntaxError && err.status === 400 && 'body' in err` y responda `400 { "error": "El body debe ser JSON válido" }`.
    - No modificar otras líneas.
    - _Requisitos: 1.6, 2.3_

- [ ] 4. Correcciones para dejar el pipeline en verde
  - [ ] 4.1 Crear `tests/formato.test.js` con al menos un test por cada función exportada de `src/util/formato.js` (incluyendo `formatearCiclo` con `null` y `undefined`, `formatearTipo` con `"obligatorio"` y `"electivo"`, y `listaRequisitos` con array vacío y no vacío).
    - _Requisitos: 5.2_

  - [ ] 4.2 Actualizar `lodash` a una versión sin vulnerabilidades altas: `npm install lodash@4.18.1` (actualiza `package.json` y `package-lock.json`). Verificar con `npm audit --audit-level=high` y con `npm test`.
    - _Requisitos: 6.1_

  - [ ] 4.3 Sacar la clave de `config/ejemplo.env` y registrar el hallazgo histórico.
    - Reemplazar el valor por `CATALOGO_API_KEY=<definir-en-.env-local>`.
    - Crear `.gitleaksignore` con el fingerprint que reportó el run fallido del job `secrets` (formato `<commit>:config/ejemplo.env:<regla>:<línea>`), con un comentario `#` que diga que la clave fue rotada y por qué sigue en el historial.
    - _Requisitos: 7.1_

- [ ]* 5. (Extra SAST) Job `codeql` en `.github/workflows/ci.yml` con `github/codeql-action/init@v3` y `github/codeql-action/analyze@v3`, lenguaje `javascript-typescript`, permiso `security-events: write`. Solo avisa: no se agrega como requisito bloqueante.

---

## Notes

- La tarea marcada con `*` es opcional.
- Cada tarea referencia los criterios de `requirements.md`.
- Sin dependencias nuevas; solo se actualiza la versión de `lodash`.
- Las verificaciones (`npm test`, `npm test -- --coverage`) se corren a mano en la terminal, no como tareas de Kiro, para no gastar créditos.
