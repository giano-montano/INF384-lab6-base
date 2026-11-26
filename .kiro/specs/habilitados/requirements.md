# Requirements Document

## Introduction

Este documento describe los requisitos del endpoint `POST /habilitados`, que calcula y devuelve la lista de cursos habilitados para un alumno de Ingeniería Informática (PUCP, plan 2026-1). Un curso está habilitado cuando todos sus prerequisitos se encuentran dentro del conjunto de cursos aprobados por el alumno. Un curso sin prerequisitos siempre está habilitado. La fuente de datos es `data/cursos.json` (solo lectura), accedida exclusivamente a través de `src/data/repositorio.js`.

## Glossary

- **API**: Interfaz de programación de aplicaciones expuesta por el servidor Express.
- **Repositorio**: Módulo `src/data/repositorio.js` que carga `data/cursos.json` y expone consultas en memoria.
- **Curso**: Objeto con campos `id`, `name`, `credits`, `cycle`, `type` y `prerequisites` según el modelo de datos del producto.
- **Prerequisito**: Código de curso que el alumno debe haber aprobado antes de poder cursar un curso dado.
- **Curso_Habilitado**: Curso cuyo array `prerequisites` está completamente contenido en el array `aprobados` proporcionado por el cliente.
- **Validador**: Componente que verifica la forma y el contenido del body de la petición antes de ejecutar la lógica de negocio.
- **Código_Valido**: Cadena de caracteres alfanuméricos y guiones que cumple el patrón `^[A-Za-z0-9]+$`.

---

## Requirements

### Requisito 1: Calcular cursos habilitados

**Historia de usuario:** Como alumno de Ingeniería Informática, quiero enviar la lista de cursos que he aprobado y recibir la lista de cursos que puedo llevar, para planificar mi matrícula.

#### Criterios de aceptación

1. WHEN el cliente envía `POST /habilitados` con un body JSON `{ "aprobados": [...] }` válido, THE API SHALL responder con HTTP 200 y un array JSON de objetos Curso_Habilitado.
2. WHEN el array `aprobados` está vacío (`[]`), THE API SHALL responder con HTTP 200 y un array que contiene exactamente todos los cursos del Repositorio cuyo campo `prerequisites` es un array vacío.
3. WHEN el array `aprobados` contiene los códigos `["1INF25","1INF27","1INF49"]`, THE API SHALL responder con HTTP 200 y un array de exactamente 27 cursos, incluyendo los cursos con id `1INF29`, `1INF30`, `1INF31` y `1INF32`.
4. THE API SHALL incluir en la respuesta un curso si y solo si cada elemento del campo `prerequisites` del curso está presente en el array `aprobados` recibido.
5. THE API SHALL obtener la lista de todos los cursos únicamente a través del Repositorio, sin leer `data/cursos.json` directamente desde la ruta.
6. WHEN el Repositorio no puede cargar los datos, THE API SHALL responder con HTTP 500 y `{ "error": "Error interno del servidor" }`.

---

### Requisito 2: Validar que `aprobados` sea un array

**Historia de usuario:** Como operador del sistema, quiero que la API rechace entradas malformadas, para evitar respuestas incorrectas o comportamientos inesperados.

#### Criterios de aceptación

1. WHEN el body recibido no contiene el campo `aprobados`, THE Validador SHALL responder con HTTP 400 y `{ "error": "El campo aprobados es obligatorio" }`.
2. WHEN el campo `aprobados` del body no es un array (por ejemplo, es un string, número u objeto), THE Validador SHALL responder con HTTP 400 y `{ "error": "El campo aprobados debe ser un array" }`.
3. WHEN el body de la petición no es JSON válido, THE Validador SHALL responder con HTTP 400 y `{ "error": "El body debe ser JSON válido" }`.

---

### Requisito 3: Validar formato de los códigos de curso

**Historia de usuario:** Como operador del sistema, quiero que la API rechace códigos de curso con caracteres no válidos, para evitar inyección de datos y fugas de información.

#### Criterios de aceptación

1. WHEN al menos un elemento del array `aprobados` no cumple el patrón `^[A-Za-z0-9]+$`, THE Validador SHALL responder con HTTP 400 y `{ "error": "Uno o más códigos tienen un formato inválido" }`.
2. IF un código del array `aprobados` contiene caracteres especiales, espacios o etiquetas HTML, THEN THE Validador SHALL responder con HTTP 400 y `{ "error": "Uno o más códigos tienen un formato inválido" }` sin incluir el contenido del código en la respuesta.
3. WHEN la validación de formato falla, THE API SHALL responder con HTTP 400 y nunca con HTTP 500 ni exponer rutas del servidor ni stack traces.

---

### Requisito 4: Limitar el tamaño del array `aprobados`

**Historia de usuario:** Como operador del sistema, quiero que la API rechace arrays de aprobados excesivamente grandes, para proteger el servicio ante ataques de denegación de servicio.

#### Criterios de aceptación

1. WHEN el array `aprobados` contiene más de 500 elementos, THE Validador SHALL responder con HTTP 400 y `{ "error": "El campo aprobados no puede tener más de 500 elementos" }`.
2. WHEN el array `aprobados` contiene exactamente 500 elementos, THE API SHALL procesar la petición con normalidad y responder con HTTP 200.

---

### Requisito 5: Cobertura de pruebas

**Historia de usuario:** Como equipo de desarrollo, quiero que el pipeline de CI garantice una cobertura de líneas mínima, para mantener la calidad del código.

#### Criterios de aceptación

1. THE Pipeline_CI SHALL ejecutar `npm test` con recolección de cobertura en cada push al repositorio.
2. IF la cobertura de líneas del proyecto cae por debajo del 80 %, THEN THE Pipeline_CI SHALL marcar la ejecución como fallida e impedir la integración.

---

## Propiedades de corrección (Correctness Properties)

Las siguientes propiedades están diseñadas para property-based testing (PBT). Son independientes de ejemplos concretos y deben mantenerse para cualquier entrada válida.

### Propiedad 1 – Corrección del filtrado (invariante de inclusión)

**Categoría:** Invariante  
**Descripción:** Para cualquier array `aprobados` válido, todo curso presente en la respuesta debe tener todos sus prerequisitos dentro de `aprobados`, y todo curso ausente de la respuesta debe tener al menos un prerequisito fuera de `aprobados`.

```
∀ curso ∈ respuesta:   curso.prerequisites ⊆ aprobados
∀ curso ∉ respuesta:   ∃ p ∈ curso.prerequisites tal que p ∉ aprobados
```

### Propiedad 2 – Monotonía (metamórfica)

**Categoría:** Metamórfica  
**Descripción:** Si se amplía el array `aprobados` con elementos adicionales, el conjunto de cursos habilitados no puede disminuir.

```
aprobados1 ⊆ aprobados2  ⟹  habilitados(aprobados1) ⊆ habilitados(aprobados2)
```

### Propiedad 3 – Idempotencia del endpoint

**Categoría:** Idempotencia  
**Descripción:** Llamar al endpoint dos veces con el mismo array `aprobados` debe producir exactamente la misma respuesta (mismo conjunto de cursos, mismo orden).

```
habilitados(aprobados) = habilitados(aprobados)   ∀ aprobados válido
```

### Propiedad 4 – Punto fijo del conjunto completo (invariante)

**Categoría:** Invariante  
**Descripción:** Si `aprobados` contiene los ids de todos los cursos del Repositorio, la respuesta debe contener exactamente todos los cursos del Repositorio.

```
aprobados = { curso.id | curso ∈ todos_los_cursos }  ⟹  |habilitados(aprobados)| = |todos_los_cursos|
```

### Propiedad 5 – Límite superior (metamórfica)

**Categoría:** Metamórfica  
**Descripción:** El número de cursos habilitados nunca supera el total de cursos del Repositorio.

```
|habilitados(aprobados)| ≤ |todos_los_cursos|   ∀ aprobados válido
```

### Propiedad 6 – Rechazo de entradas inválidas (condición de error)

**Categoría:** Condición de error  
**Descripción:** Para cualquier valor de `aprobados` que sea un no-array (string, número, booleano, objeto, null), la respuesta siempre es HTTP 400. Para cualquier código con caracteres fuera del patrón `^[A-Za-z0-9]+$`, la respuesta siempre es HTTP 400 y nunca HTTP 500.
