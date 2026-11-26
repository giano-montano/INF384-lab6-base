# Implementation Plan: `POST /habilitados`

## Overview

Implementar el endpoint `POST /habilitados` sobre la aplicación Express existente. El plan cubre la creación del validador de entrada, la lógica de negocio en la ruta, el registro en `app.js`, los ajustes de cobertura en `jest.config.js` y la actualización del pipeline de CI.

---

## Tasks

- [ ] 1. Crear el validador de aprobados
  - Crear el archivo `src/util/validadorAprobados.js` con la función pura `validarAprobados(body)`.
  - La función devuelve `null` si el body es válido, o `{ status: 400, message: string }` con el primer error encontrado.
  - Implementar el orden de validación exacto: (1) `aprobados` ausente, (2) no es array, (3) longitud > 150, (4) algún elemento no es string, (5) algún código no cumple `^[A-Z0-9]{6}$`.
  - Verificar el tamaño antes de recorrer los elementos para evitar iterar listas grandes.
  - Exportar `{ validarAprobados }` con `module.exports`.
  - _Requisitos: 2.1, 2.2, 2.4, 3.1, 3.2, 4.1_

- [ ] 2. Crear la ruta `POST /habilitados`
  - [ ] 2.1 Crear `src/routes/habilitados.js` con un `express.Router()` que registra `POST /`.
    - Importar `validarAprobados` desde `../util/validadorAprobados` y `repositorio` desde `../data/repositorio`.
    - En el handler: invocar `validarAprobados(req.body)`; si devuelve error, responder `res.status(400).json({ error: mensaje })` y retornar.
    - Implementar `calcularHabilitados(aprobados)` como función local: convertir `aprobados` en un `Set`, llamar a `repositorio.listar()` y filtrar los cursos cuyo `id` no esté en el Set y cuya lista `prerequisites` esté completamente contenida en el Set.
    - Responder 200 con el array resultante.
    - Propagar cualquier excepción no controlada al middleware de error de `app.js` (no capturar con try/catch).
    - Exportar el router con `module.exports = router`.
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ] 2.2 Registrar la ruta y el interceptor de SyntaxError en `src/app.js`.
    - Añadir un middleware de 4 argumentos **antes** del middleware genérico existente que capture `err instanceof SyntaxError && err.status === 400 && 'body' in err` y responda `400 { "error": "El body debe ser JSON válido" }`.
    - Añadir `app.use('/habilitados', require('./routes/habilitados'))` antes de los dos middlewares de error.
    - No modificar ninguna otra línea de `app.js`.
    - _Requisitos: 1.5, 2.3, 1.6_

- [ ] 3. Punto de control — verificar lógica principal
  - Asegurarse de que todos los archivos creados/modificados hasta aquí son sintácticamente válidos (node --check).
  - Confirmar que `npm test` ejecuta sin errores de módulo no encontrado antes de continuar.

- [ ] 4. Escribir los tests de la ruta `/habilitados`
  - [ ] 4.1 Crear `tests/habilitados.test.js` con los tests de criterios de respuesta correcta (Requisito 1).
    - Importar `supertest` y `app` desde `../src/app`.
    - Test 1.1: `POST /habilitados` con body `{ "aprobados": ["1INF25"] }` → 200, body es array.
    - Test 1.2: body `{ "aprobados": [] }` → 200, el array resultante contiene exactamente los cursos cuyo campo `prerequisites` es `[]` y no contiene ningún curso con prerequisitos.
    - Test 1.3: body `{ "aprobados": ["1INF25","1INF27","1INF49"] }` → 200, array de exactamente 27 cursos, el array incluye `1INF29`, `1INF30`, `1INF31` y `1INF32`.
    - Test 1.4: para el mismo body del test 1.3, verificar que ningún `id` del array `aprobados` aparece en la respuesta y que cada curso devuelto tiene todos sus `prerequisites` dentro de `aprobados`.
    - Test 1.6: usar `jest.spyOn(repositorio, 'listar').mockImplementation(() => { throw new Error('C:\\\\apps\\\\malla\\\\src\\\\x.js') })` → respuesta 500, body exactamente `{ "error": "Error interno del servidor" }`, body serializado no contiene `"stack"`, `"at "` ni `"C:\\"`.
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.6_

  - [ ] 4.2 Añadir los tests de validación de entrada (Requisitos 2, 3 y 4) al mismo archivo `tests/habilitados.test.js`.
    - Test 2.1: body `{}` → 400, `{ "error": "El campo aprobados es obligatorio" }`.
    - Test 2.2: body `{ "aprobados": "1INF25" }` → 400, mensaje contiene `"debe ser un array"`.
    - Test 2.3: enviar string `{invalid` con cabecera `Content-Type: application/json` → 400, `{ "error": "El body debe ser JSON válido" }`.
    - Test 2.4a: body `{ "aprobados": [123] }` → 400.
    - Test 2.4b: body `{ "aprobados": [null] }` → 400.
    - Test 3.1/3.2: body `{ "aprobados": ["1INF30<script>"] }` → 400, el body serializado de la respuesta no contiene la cadena `"<script>"`.
    - Test 3.3: mismo caso anterior → status distinto de 500 y body serializado no contiene `"stack"`.
    - Test 4.1a: array de 151 elementos (cadenas `"AAAAAA"` repetidas) → 400, `{ "error": "El campo aprobados no puede tener más de 150 elementos" }`.
    - Test 4.1b: array de 5 000 elementos → 400 y el tiempo de respuesta es menor de 500 ms.
    - Test 4.2: array de 150 elementos válidos que incluye duplicados (`"1INF25"` repetido) → 200.
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2_

- [ ] 5. Punto de control — todos los tests de la ruta pasan
  - Ejecutar `npm test -- --testPathPattern=habilitados --run` y confirmar que todos los tests de los pasos 4.1 y 4.2 pasan.
  - Corregir cualquier discrepancia entre la implementación y los tests antes de continuar.

- [ ] 6. Ajustar umbral de cobertura y tests de `formato.js`
  - [ ] 6.1 Modificar `jest.config.js`: añadir `coverageThreshold: { global: { lines: 80 } }` dentro del objeto exportado.
    - No modificar ninguna otra clave existente.
    - _Requisitos: 5.1, 5.2_

  - [ ] 6.2 Crear `tests/formato.test.js` con tests unitarios de todas las funciones exportadas por `src/util/formato.js`.
    - Importar las funciones desde `../src/util/formato`.
    - `formatearNombre`: al menos un test con cadena normal (ej. `"programación avanzada"`) y uno con cadena ya capitalizada.
    - `formatearCreditos`: test con valor entero y con valor decimal.
    - `formatearCiclo`: test con ciclo numérico, con `null` y con `undefined`.
    - `formatearTipo`: test con `"obligatorio"` y con otro valor (ej. `"electivo"`).
    - `resumenCurso`: test con un objeto curso válido.
    - `totalCreditos`: test con array de cursos con distintos créditos.
    - `agruparPorCiclo`: test con array que incluya al menos dos ciclos distintos.
    - `ordenarPorCreditos`: test con array que incluya cursos con distintos créditos.
    - `listaRequisitos`: test con array vacío y con array no vacío.
    - _Requisitos: 5.1, 5.2_

- [ ] 7. Actualizar el pipeline de CI
  - [ ] 7.1 Modificar `.github/workflows/ci.yml`: cambiar el paso "Ejecutar pruebas" de `run: npm test` a `run: npm test -- --coverage`.
    - _Requisitos: 5.1, 5.2_

  - [ ] 7.2 Añadir el job de auditoría de dependencias en `.github/workflows/ci.yml` como job separado.
    - El job debe llamarse `audit`, ejecutarse en `ubuntu-latest`, hacer checkout del código con `actions/checkout@v4`, instalar dependencias con `npm ci` y ejecutar `npm audit --audit-level=high`.
    - El job bloquea la integración si hay vulnerabilidades `high` o `critical`.
    - _Requisitos: 5.1_

  - [ ] 7.3 Añadir el job de detección de secretos con gitleaks en `.github/workflows/ci.yml` como job separado.
    - El job debe llamarse `secrets`, ejecutarse en `ubuntu-latest`, hacer checkout con `fetch-depth: 0` (historial completo) usando `actions/checkout@v4`, y ejecutar `gitleaks/gitleaks-action@v2`.
    - Cualquier hallazgo bloquea la integración.
    - _Requisitos: 5.1_

- [ ] 8. Punto de control final — cobertura y todos los tests pasan
  - Ejecutar `npm test -- --coverage --run` y confirmar que la cobertura de líneas es ≥ 80 % y que todos los tests pasan.
  - Si la cobertura es inferior al 80 %, añadir los tests faltantes en `tests/formato.test.js` o `tests/habilitados.test.js` según corresponda.

---

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para una entrega mínima.
- Cada tarea referencia los criterios de aceptación del `requirements.md` para trazabilidad.
- Los puntos de control aseguran validación incremental antes de continuar.
- Todos los tests usan Jest + supertest; no se introduce ninguna dependencia nueva.
- El interceptor de SyntaxError en `app.js` debe ir **antes** del middleware genérico existente porque `express.json()` emite el error antes de que llegue al router.

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["3"] },
    { "id": 4, "tasks": ["4.1", "4.2"] },
    { "id": 5, "tasks": ["5"] },
    { "id": 6, "tasks": ["6.1", "6.2"] },
    { "id": 7, "tasks": ["7.1", "7.2", "7.3"] },
    { "id": 8, "tasks": ["8"] }
  ]
}
```
