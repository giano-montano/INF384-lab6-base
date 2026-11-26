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

## Decisiones del endpoint (casos que el pedido no define)

| Caso | Decisión | Razón |
| --- | --- | --- |
| Código con formato válido que no existe en la malla (ej. `9ZZZ99`) | Se ignora, responde 200 | No afecta el resultado (ningún curso lo tiene como requisito). Rechazarlo obligaría a que el alumno conozca exactamente los códigos del JSON, y un curso de otro plan aprobado no debería romper la consulta |
| Códigos duplicados en `aprobados` | Se ignoran (se usa un `Set`) | Aprobar dos veces el mismo curso no cambia nada. El límite de 150 se cuenta sobre el arreglo recibido, así que los duplicados no permiten saltarse el límite (y hace posible el criterio 4.2, ya que la malla solo tiene 87 cursos) |
| Minúsculas (`1inf25`) | 400 por formato inválido | Los códigos del JSON están todos en mayúsculas; normalizar en silencio esconde errores del cliente y el patrón queda simple |
| Lista vacía `[]` | 200 con los cursos sin requisitos | Lo pide el criterio 1.2: un alumno nuevo puede llevar los cursos sin requisitos |
| Body vacío o sin `Content-Type: application/json` | `express.json()` deja `req.body = {}` → 400 "El campo aprobados es obligatorio" | Es el mismo caso que no enviar el campo |
| Electivos (`cycle: null`) | Se incluyen si cumplen la condición | Son cursos que el alumno puede matricular; el pedido no los excluye |
| Forma de cada curso en la respuesta | Objeto completo del repositorio (`id`, `name`, `credits`, `cycle`, `type`, `prerequisites`) | El alumno necesita créditos y ciclo para planificar; no hay datos sensibles en el modelo |
| Orden de la respuesta | El mismo de `data/cursos.json` (por ciclo), igual que `GET /cursos` | Respuesta estable y consistente con el endpoint existente; permite tests deterministas |
| Tamaño del body | Límite por defecto de `express.json()` (100 kb) | Con 150 códigos de 6 caracteres el body pesa ~1.5 kb; el límite de 100 kb corta antes cualquier body gigante |

---

## Error Handling

### SyntaxError de `express.json()`

Cuando el body no es JSON válido, `express.json()` lanza un `SyntaxError` con `status: 400`. El middleware genérico actual respondería 400 con el mensaje "Error interno del servidor", que es engañoso. Por eso se añade un interceptor antes del genérico:

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

Cualquier excepción dentro del handler de `/habilitados` llega al middleware genérico de `app.js`, que responde HTTP 500 con `{ "error": "Error interno del servidor" }` sin stack trace ni rutas (criterio 1.6). Se prueba forzando el error con `jest.spyOn(repositorio, 'listar').mockImplementation(() => { throw new Error('C:\\apps\\malla\\src\\x.js') })` y verificando que el body no contiene `stack`, `at ` ni `C:\`.

### Orden de validación en `validarAprobados`

El validador comprueba en este orden y devuelve el primer fallo:

1. `body.aprobados === undefined` → `"El campo aprobados es obligatorio"` (400)
2. `!Array.isArray(body.aprobados)` → `"El campo aprobados debe ser un array"` (400)
3. `body.aprobados.length > 150` → `"El campo aprobados no puede tener más de 150 elementos"` (400)
4. `body.aprobados.some(e => typeof e !== 'string')` → `"Uno o más elementos no son strings"` (400)
5. `body.aprobados.some(e => !/^[A-Z0-9]{6}$/.test(e))` → `"Uno o más códigos tienen un formato inválido"` (400)

El tamaño se verifica **antes** de recorrer los elementos: es una comprobación O(1) y evita procesar listas de 5 000 elementos (hallazgo 1). El tipo se verifica antes del patrón porque `regex.test(123)` convierte el número a `"123"` y lo aceptaría.

---

## Testing Strategy

Archivo `tests/habilitados.test.js`: pruebas con supertest sobre `src/app.js` (sin levantar el servidor) y pruebas unitarias de `validarAprobados`. Tests de ejemplo con Jest, sin dependencias nuevas. Al menos un test por criterio:

| Criterio | Test |
| --- | --- |
| 1.1 | Body válido → 200 y el body es un array |
| 1.2 | `[]` → 200, exactamente los cursos sin requisitos |
| 1.3 | `["1INF25","1INF27","1INF49"]` → 27 cursos, incluye 1INF29, 1INF30, 1INF31, 1INF32 |
| 1.4 | Ningún curso de `aprobados` aparece en la respuesta y todo curso devuelto tiene sus requisitos en `aprobados` |
| 1.6 | `repositorio.listar` lanza error → 500, body exacto, sin `stack`, `at ` ni `C:\` |
| 2.1 | `{}` → 400 "El campo aprobados es obligatorio" |
| 2.2 | `{"aprobados":"1INF25"}` → 400 "debe ser un array" (hallazgo 3) |
| 2.3 | Body `{invalid` con `Content-Type: application/json` → 400 "El body debe ser JSON válido" |
| 2.4 | `[123]` y `[null]` → 400 |
| 3.1 / 3.2 | `["1INF30<script>"]` → 400 y el body no contiene `<script>` (hallazgo 2) |
| 3.3 | Mismo caso → status distinto de 500, sin `stack` |
| 4.1 | 151 elementos → 400 (hallazgo 1); 5 000 elementos → 400 en menos de 500 ms |
| 4.2 | 150 elementos válidos (con duplicados) → 200 |
| 5.1 / 5.2 | Se verifican con el gate de cobertura en CI (ver abajo) |

**Cobertura:** hoy la cobertura de líneas es 66.7 % porque `src/util/formato.js` no tiene tests. Al activar el umbral el pipeline va a fallar; se corrige agregando `tests/formato.test.js`.

---

## Gates de calidad y seguridad (ci.yml)

| Gate | Herramienta y umbral | Bloquea / avisa | Etapa | Razón |
| --- | --- | --- | --- | --- |
| Cobertura (Req. 5) | `npm test -- --coverage` con `coverageThreshold.global.lines = 80` en `jest.config.js` | Bloquea | Pull request y push a `main` | La política de TI exige que la cobertura no baje de 80 %. En el PR se detecta antes de integrar; en `main` porque es lo que se publica |
| SCA | `npm audit --audit-level=high` (sin `--omit=dev`) | Bloquea en `high` y `critical`; `moderate` y `low` solo aparecen en el log (avisa) | Pull request y push a `main` | La política prohíbe dependencias con vulnerabilidades altas o críticas. Se incluyen las devDependencies porque también corren en el pipeline. No se bloquea por moderadas para no frenar entregas por avisos sin parche disponible |
| Secretos | CLI `gitleaks detect` v8.24.0 sobre **todo el historial** (`fetch-depth: 0`), cualquier hallazgo | Bloquea | Pull request y push a `main` | La política prohíbe secretos en el repositorio. Se usa el CLI y no `gitleaks-action` porque la action, en un push, solo revisa los commits nuevos y no vería un secreto que ya estaba en commits anteriores. Se escanea el historial porque un secreto borrado en un commit posterior sigue expuesto. Un hallazgo solo se acepta en `.gitleaksignore` después de rotar la clave, con la razón registrada |
| SAST (extra) | CodeQL (`github/codeql-action`, lenguaje `javascript`) | Avisa | Pull request y push a `main` | Detecta patrones inseguros en el código (inyección, XSS). Empieza como aviso porque puede dar falsos positivos y tarda más que los otros gates; se pasa a bloqueante cuando el equipo revise los hallazgos iniciales |

Los tres gates obligatorios corren como jobs separados, para que un fallo en uno no oculte el resultado de los otros.

---

## Design Decisions

| Decisión | Alternativa considerada | Justificación |
|----------|------------------------|---------------|
| Validador en `src/util/validadorAprobados.js` | Inline en la ruta | Testeable de forma aislada; ruta queda corta; consistente con `src/util/formato.js` |
| Interceptor de SyntaxError en `app.js` | Interceptor dentro del router `/habilitados` | El SyntaxError lo emite `express.json()`, que corre antes del router; centralizarlo sirve a todos los endpoints |
| Umbral de cobertura en `jest.config.js` | Flag en `ci.yml` | El fallo de umbral se ve también localmente; `ci.yml` solo pasa `--coverage` |
| Devolver objetos Curso completos | Devolver solo `id` y `name` | El alumno necesita créditos y ciclo para planificar (criterio 1.1) |
| Tests de ejemplo con Jest, sin PBT | `fast-check` (property-based testing) | El steering prohíbe dependencias nuevas sin necesidad; con un test por criterio se cubren los requisitos y los tres hallazgos |
| Verificar tamaño antes que tipo y patrón | Verificar tipo primero | El tamaño es O(1) y corta las listas grandes antes de recorrerlas (hallazgo 1) |

---

## Dependencias

No se agrega ninguna dependencia nueva a `package.json`. Para cumplir el gate de SCA se actualiza `lodash` de `4.17.20` a una versión sin vulnerabilidades altas.
