# Design Document — `POST /habilitados`

## Overview

Se añade el endpoint `POST /habilitados` a la aplicación Express existente. El endpoint recibe la lista de cursos aprobados por un alumno y devuelve la lista de cursos habilitados: aquellos que el alumno todavía no aprobó y cuyos prerequisitos están todos dentro del conjunto aprobado.

La implementación se apoya íntegramente en `src/data/repositorio.js` (ya existente) y no requiere nuevas dependencias de producción. Los cambios de CI se hacen en `jest.config.js` para mantener la configuración centralizada.

---

## Architecture

```mermaid
flowchart TD
    Cliente -->|POST /habilitados| AppJS[src/app.js]
    AppJS -->|express.json()| ParseBody
    ParseBody -->|SyntaxError| ErrorJSON[Middleware SyntaxError → 400]
    ParseBody -->|body OK| RouterHabilitados[src/routes/habilitados.js]
    RouterHabilitados --> Validador[src/util/validadorAprobados.js]
    Validador -->|inválido| Resp400[HTTP 400 JSON]
    Validador -->|válido| LogicaHabilitados[calcularHabilitados]
    LogicaHabilitados --> Repositorio[src/data/repositorio.js]
    Repositorio -->|listar()| LogicaHabilitados
    LogicaHabilitados --> Resp200[HTTP 200 array cursos]
    AppJS -->|cualquier otro error| MiddlewareError[Middleware genérico → 500]
```

Los componentes nuevos son `src/routes/habilitados.js` y `src/util/validadorAprobados.js`. El resto de archivos (`app.js`, `ci.yml`, `jest.config.js`) reciben modificaciones puntuales.

---

## Components and Interfaces

### `src/routes/habilitados.js` (nuevo)

Router Express para `POST /`. Responsabilidades:

1. Invocar `validarAprobados(req.body)` y, si devuelve un error, responder 400.
2. Invocar `calcularHabilitados(aprobados)` con la lista validada.
3. Responder 200 con el array resultante.
4. Dejar que cualquier error no controlado se propague al middleware genérico de `app.js`.

Exporta un `express.Router()`.

```js
// Firma pública
router.post('/', handler);
module.exports = router;
```

### `src/util/validadorAprobados.js` (nuevo)

Función pura sin dependencias externas. Recibe el `body` parseado y devuelve `null` si es válido, o un objeto `{ status, message }` si no lo es.

```js
// Firma pública
function validarAprobados(body)
// Retorna: null | { status: 400, message: string }
module.exports = { validarAprobados };
```

El validador es una función separada (no inline en la ruta) por tres razones:

1. Permite testear la lógica de validación de forma aislada, sin supertest.
2. Mantiene el handler de ruta corto y legible.
3. Facilita reutilizar o extender la validación sin duplicar código.

### `src/app.js` (modificado)

Dos cambios:

1. **Registro de ruta**: `app.use('/habilitados', require('./routes/habilitados'))` antes del middleware de error genérico.
2. **Interceptor de SyntaxError**: middleware de 4 argumentos que se coloca *antes* del middleware genérico existente, captura los errores con `err instanceof SyntaxError && err.status === 400` y responde `400 { "error": "El body debe ser JSON válido" }`. El middleware genérico solo ve errores no capturados por este interceptor.

### `jest.config.js` (modificado)

Se añade `coverageThreshold` con umbral de líneas al 80 %:

```js
coverageThreshold: {
  global: { lines: 80 },
},
```

**Justificación de colocarlo en `jest.config.js` y no en `ci.yml`**: el umbral es parte de la configuración de Jest, no de la infraestructura del pipeline. Al centralizarlo en `jest.config.js`, cualquier desarrollador que ejecute `npm test -- --coverage` localmente también verá el fallo de umbral, no solo el CI. El script de CI solo necesita pasar `--coverage` como flag adicional.

### `.github/workflows/ci.yml` (modificado)

El paso "Ejecutar pruebas" cambia de:

```yaml
run: npm test
```

a:

```yaml
run: npm test -- --coverage
```

Esto activa la recolección de cobertura en cada push/PR. El threshold del 80 % está en `jest.config.js`, así que Jest falla con código de salida distinto de cero si no se cumple, lo que marca el job de CI como fallido.

---

## Data Models

No se introducen modelos nuevos. El endpoint devuelve objetos `Curso` con la misma forma que ya usa `repositorio.listar()`:

```json
{
  "id": "1INF30",
  "name": "Programación 3",
  "credits": 5.0,
  "cycle": 6,
  "type": "obligatorio",
  "prerequisites": ["1INF25"]
}
```

Todos los campos del modelo se devuelven tal como los entrega el repositorio; no se añade ni se omite ningún campo.

---

## Correctness Properties

*Una propiedad es una característica o comportamiento que debe cumplirse en todas las ejecuciones válidas del sistema: una afirmación formal sobre lo que el sistema debe hacer. Las propiedades sirven de puente entre las especificaciones en lenguaje natural y las garantías de corrección verificables automáticamente.*

### Property 1: La respuesta siempre es un array para entradas válidas

*Para cualquier* array `aprobados` que cumpla todas las reglas de validación (elementos strings con patrón `^[A-Z0-9]{6}$`, longitud ≤ 150), `POST /habilitados` responde HTTP 200 y el body es un array JSON.

**Validates: Requirements 1.1**

---

### Property 2: Con aprobados vacío solo se habilitan los cursos sin prerequisitos

*Para cualquier* estado del repositorio, cuando `aprobados = []`, el array devuelto contiene exactamente los cursos cuyo campo `prerequisites` es vacío y cuyo `id` no está en `aprobados`.

**Validates: Requirements 1.2**

---

### Property 3: Condición de habilitación es correcta y completa

*Para cualquier* array válido de aprobados, cada curso en el array devuelto cumple `id ∉ aprobados` y `prerequisites.every(p => aprobados.includes(p))`; y ningún curso del repositorio que cumpla esas dos condiciones está ausente del resultado.

**Validates: Requirements 1.4**

---

### Property 4: Campo ausente siempre devuelve 400 con el mensaje correcto

*Para cualquier* objeto JSON (incluido `{}` y objetos con otras claves) que no contenga la clave `aprobados`, la API responde HTTP 400 con exactamente `{ "error": "El campo aprobados es obligatorio" }`.

**Validates: Requirements 2.1**

---

### Property 5: Campo aprobados no-array siempre devuelve 400

*Para cualquier* valor no-array asignado a `aprobados` (string, número, objeto, booleano, null), la API responde HTTP 400 con exactamente `{ "error": "El campo aprobados debe ser un array" }`.

**Validates: Requirements 2.2**

---

### Property 6: Código con formato inválido devuelve 400 sin reflejar el input

*Para cualquier* array en el que al menos un elemento no cumpla `^[A-Z0-9]{6}$` (minúsculas, caracteres especiales, espacios, HTML, longitud diferente), la API responde HTTP 400 con `{ "error": "Uno o más códigos tienen un formato inválido" }` y el body no contiene el contenido del código inválido.

**Validates: Requirements 3.1, 3.2, 3.3**

---

### Property 7: Elemento no-string en aprobados devuelve 400

*Para cualquier* array que contenga al menos un elemento que no sea string (número, null, objeto, booleano), junto con cero o más strings válidos, la API responde HTTP 400.

**Validates: Requirements 2.4**

---

## Error Handling

### SyntaxError de `express.json()`

Cuando el body no es JSON válido, `express.json()` lanza un `SyntaxError` con `status: 400` y lo pasa al siguiente middleware de error. El middleware genérico existente en `app.js` respondería 500 (porque no distingue tipo de error). Por eso se añade un interceptor específico antes del genérico:

```js
// En app.js, antes del middleware genérico de 4 args
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'El body debe ser JSON válido' });
  }
  next(err);
});
```

### Errores no controlados en la ruta

Cualquier excepción lanzada dentro del handler de `/habilitados` (por ejemplo, si `repositorio.listar()` fallara) llega al middleware genérico de `app.js`, que ya responde HTTP 500 con `{ "error": "Error interno del servidor" }` sin stack trace ni rutas del sistema.

### Orden de validación en `validarAprobados`

El validador comprueba en este orden, devolviendo al primer fallo:

1. `body.aprobados === undefined` → `"El campo aprobados es obligatorio"` (400)
2. `!Array.isArray(body.aprobados)` → `"El campo aprobados debe ser un array"` (400)
3. `body.aprobados.some(e => typeof e !== 'string')` → HTTP 400 (sin mensaje específico en requirements, se devuelve `"Uno o más elementos no son strings"`)
4. `body.aprobados.length > 150` → `"El campo aprobados no puede tener más de 150 elementos"` (400)
5. `body.aprobados.some(e => !/^[A-Z0-9]{6}$/.test(e))` → `"Uno o más códigos tienen un formato inválido"` (400)

La verificación de tipo (paso 3) se hace antes de la de tamaño (paso 4) porque un elemento no-string podría provocar un TypeError en la regex del paso 5.

---

## Testing Strategy

### Archivo de pruebas

`tests/habilitados.test.js` — pruebas de integración HTTP con supertest sobre `src/app.js` y pruebas unitarias del validador.

### Grupos de casos

**Happy path (ejemplos concretos)**
- `aprobados = []` → 200, solo cursos sin prerequisitos.
- `aprobados = ["1INF25","1INF27","1INF49"]` → 200, exactamente 27 cursos, incluye `1INF29`, `1INF30`, `1INF31`, `1INF32`.
- `aprobados` con exactamente 150 elementos válidos → 200.

**Validaciones (ejemplos)**
- Body sin `Content-Type: application/json` ni body → comportamiento de express.json.
- Body `"{invalid"` → 400, mensaje JSON inválido.
- Elemento nulo o numérico en el array → 400.
- Array de 151 elementos → 400, mensaje de tamaño.

**Pruebas de propiedad (jest-fast-check)**

La librería elegida es **fast-check** (pura JS, compatible con Jest, sin transpilación). Se añade como devDependency:

```
npm install --save-dev fast-check
```

**Justificación de nueva devDependency**: fast-check es la única librería de property-based testing madura para Node.js/Jest sin TypeScript. No es una dependencia de producción. No hay alternativa razonable que evite implementar PBT desde cero.

Cada propiedad se ejecuta con mínimo 100 iteraciones. Las propiedades y sus tags:

| Test | Propiedad | Tag |
|------|-----------|-----|
| Para cualquier array válido → 200 y body es array | Property 1 | `Feature: habilitados, Property 1: respuesta siempre es un array para entradas válidas` |
| Para aprobados=[] → solo cursos sin prerequisites | Property 2 | `Feature: habilitados, Property 2: con aprobados vacío solo se habilitan cursos sin prerequisites` |
| Condición de habilitación correcta y completa | Property 3 | `Feature: habilitados, Property 3: condición de habilitación es correcta y completa` |
| Campo ausente → 400 mensaje obligatorio | Property 4 | `Feature: habilitados, Property 4: campo ausente devuelve 400 con mensaje correcto` |
| aprobados no-array → 400 | Property 5 | `Feature: habilitados, Property 5: campo aprobados no-array devuelve 400` |
| Código inválido → 400 sin reflejar input | Property 6 | `Feature: habilitados, Property 6: código inválido devuelve 400 sin reflejar el input` |
| Elemento no-string → 400 | Property 7 | `Feature: habilitados, Property 7: elemento no-string en aprobados devuelve 400` |

**Cobertura**

El threshold del 80 % en `jest.config.js` se activa con `npm test -- --coverage`. Las pruebas anteriores (cursos, repositorio, health) ya cubren `repositorio.js` y `cursos.js`; los nuevos tests cubren `habilitados.js` y `validadorAprobados.js`.

---

## Design Decisions

| Decisión | Alternativa considerada | Justificación |
|----------|------------------------|---------------|
| Validador en `src/util/validadorAprobados.js` | Inline en la ruta | Testeable de forma aislada; ruta queda corta; consistente con la existencia de `src/util/formato.js` |
| Interceptor de SyntaxError en `app.js` | Interceptor dentro del router `/habilitados` | El SyntaxError lo emite el middleware global `express.json()`, que se ejecuta antes del router. Colocarlo en `app.js` lo centraliza para todos los endpoints actuales y futuros |
| Umbral de cobertura en `jest.config.js` | Flag `--coverageThreshold` en `ci.yml` | Fallo de umbral visible localmente sin depender del CI; configuración centralizada; ci.yml solo necesita pasar `--coverage` |
| Devolver objetos Curso completos | Devolver solo `id` y `name` | Los requirements especifican "objetos Curso completo (todos los campos del modelo)" (RF-01) |
| fast-check como devDependency | No usar PBT | La lógica de filtrado y validación tiene propiedades universales con espacio de inputs grande; PBT detecta casos borde que los tests de ejemplo no cubren. Se justifica la dependencia por ser devDependency |
| Verificar tipo de elemento antes de tamaño | Verificar tamaño primero | Evita TypeError al aplicar regex sobre un valor no-string |

---

## No se añaden dependencias de producción

No se agrega ninguna dependencia al bloque `dependencies` de `package.json`. La única adición es `fast-check` en `devDependencies`, justificada en la sección Testing Strategy.
