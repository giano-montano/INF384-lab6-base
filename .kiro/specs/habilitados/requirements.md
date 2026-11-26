# Requirements Document

## Introduction

Este documento describe los requisitos del endpoint `POST /habilitados`, que calcula y devuelve la lista de cursos habilitados para un alumno de Ingeniería Informática (PUCP, plan 2026-1). Un curso está habilitado cuando el alumno no lo ha aprobado y todos sus prerequisitos se encuentran dentro del conjunto de cursos aprobados por el alumno. Un curso sin prerequisitos siempre está habilitado si no fue aprobado. La fuente de datos es `data/cursos.json` (solo lectura), accedida exclusivamente a través de `src/data/repositorio.js`.

## Glossary

- **API**: Interfaz de programación de aplicaciones expuesta por el servidor Express.
- **Repositorio**: Módulo `src/data/repositorio.js` que carga `data/cursos.json` y expone consultas en memoria.
- **Curso**: Objeto con campos `id`, `name`, `credits`, `cycle`, `type` y `prerequisites` según el modelo de datos del producto.
- **Prerequisito**: Código de curso que el alumno debe haber aprobado antes de poder cursar un curso dado.
- **Curso_Habilitado**: Curso cuyo `id` no está en `aprobados` y cuyo array `prerequisites` está completamente contenido en `aprobados`.
- **Validador**: Componente que verifica la forma y el contenido del body de la petición antes de ejecutar la lógica de negocio.
- **Código_Valido**: String de 6 caracteres (mayúsculas y dígitos) que cumple el patrón `^[A-Z0-9]{6}$`.

---

## Requirements

### Requisito 1: Calcular cursos habilitados

**Historia de usuario:** Como alumno de Ingeniería Informática, quiero enviar la lista de cursos que he aprobado y recibir la lista de cursos que puedo llevar, para planificar mi matrícula.

#### Criterios de aceptación

1. WHEN el cliente envía `POST /habilitados` con un body JSON `{ "aprobados": [...] }` válido, THE API SHALL responder con HTTP 200 y un array JSON de objetos Curso_Habilitado.
2. WHEN el array `aprobados` está vacío (`[]`), THE API SHALL responder con HTTP 200 y un array que contiene exactamente todos los cursos del Repositorio cuyo campo `prerequisites` es un array vacío.
3. WHEN el array `aprobados` contiene los códigos `["1INF25","1INF27","1INF49"]`, THE API SHALL responder con HTTP 200 y un array de exactamente 27 cursos, incluyendo los cursos con id `1INF29`, `1INF30`, `1INF31` y `1INF32`.
4. THE API SHALL incluir en la respuesta un curso si y solo si su `id` no está en `aprobados` y cada elemento de su campo `prerequisites` está en `aprobados`.
5. THE API SHALL obtener la lista de todos los cursos únicamente a través del Repositorio, sin leer `data/cursos.json` directamente desde la ruta.
6. IF ocurre un error no controlado al procesar `POST /habilitados`, THEN THE API SHALL responder HTTP 500 con exactamente `{ "error": "Error interno del servidor" }`, sin los textos `stack`, `at ` ni rutas del sistema (`C:\`, `/src/`).

---

### Requisito 2: Validar que `aprobados` sea un array

**Historia de usuario:** Como operador del sistema, quiero que la API rechace entradas malformadas, para evitar respuestas incorrectas o comportamientos inesperados.

#### Criterios de aceptación

1. WHEN el body recibido no contiene el campo `aprobados`, THE Validador SHALL responder con HTTP 400 y `{ "error": "El campo aprobados es obligatorio" }`.
2. WHEN el campo `aprobados` del body no es un array (por ejemplo, es un string, número u objeto), THE Validador SHALL responder con HTTP 400 y `{ "error": "El campo aprobados debe ser un array" }`.
3. WHEN el body de la petición no es JSON válido, THE Validador SHALL responder con HTTP 400 y `{ "error": "El body debe ser JSON válido" }`.
4. WHEN algún elemento de `aprobados` no es un string (número, null, objeto), THE Validador SHALL responder HTTP 400.

---

### Requisito 3: Validar formato de los códigos de curso

**Historia de usuario:** Como operador del sistema, quiero que la API rechace códigos de curso con caracteres no válidos, para evitar inyección de datos y fugas de información.

#### Criterios de aceptación

1. WHEN al menos un elemento del array `aprobados` no cumple el patrón `^[A-Z0-9]{6}$`, THE Validador SHALL responder con HTTP 400 y `{ "error": "Uno o más códigos tienen un formato inválido" }`.
2. IF un código del array `aprobados` contiene caracteres especiales, espacios o etiquetas HTML, THEN THE Validador SHALL responder con HTTP 400 y `{ "error": "Uno o más códigos tienen un formato inválido" }` sin incluir el contenido del código en la respuesta.
3. WHEN la validación de formato falla, THE API SHALL responder con HTTP 400 y nunca con HTTP 500 ni exponer rutas del servidor ni stack traces.

---

### Requisito 4: Limitar el tamaño del array `aprobados`

**Historia de usuario:** Como operador del sistema, quiero que la API rechace arrays de aprobados excesivamente grandes, para proteger el servicio ante ataques de denegación de servicio.

#### Criterios de aceptación

1. WHEN el array `aprobados` contiene más de 150 elementos, THE Validador SHALL responder con HTTP 400 y `{ "error": "El campo aprobados no puede tener más de 150 elementos" }`.
2. WHEN el array `aprobados` contiene exactamente 150 elementos, THE API SHALL procesar la petición con normalidad y responder con HTTP 200.

---

### Requisito 5: Cobertura de pruebas

**Historia de usuario:** Como equipo de desarrollo, quiero que el pipeline de CI garantice una cobertura de líneas mínima, para mantener la calidad del código.

#### Criterios de aceptación

1. THE Pipeline_CI SHALL ejecutar `npm test` con recolección de cobertura en cada push y en cada pull request a `main`.
2. IF la cobertura de líneas del proyecto cae por debajo del 80 %, THEN THE Pipeline_CI SHALL marcar la ejecución como fallida e impedir la integración.

---

### Requisito 6: Dependencias sin vulnerabilidades altas

**Historia de usuario:** Como responsable de TI, quiero que ningún cambio llegue a `main` con dependencias vulnerables, para cumplir la política de seguridad.

#### Criterios de aceptación

1. IF `npm audit --audit-level=high` reporta al menos una vulnerabilidad de severidad `high` o `critical`, THEN THE Pipeline_CI SHALL marcar la ejecución como fallida en cada push y pull request a `main`.

---

### Requisito 7: Ningún secreto en el repositorio

**Historia de usuario:** Como responsable de TI, quiero que el pipeline detecte secretos en el repositorio, para que ninguna clave quede expuesta en el historial.

#### Criterios de aceptación

1. IF gitleaks detecta al menos un secreto en cualquier commit del historial que no esté registrado en `.gitleaksignore`, THEN THE Pipeline_CI SHALL marcar la ejecución como fallida en cada push y pull request a `main`.
