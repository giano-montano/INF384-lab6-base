# Trazabilidad

## Requisito → gate → evidencia

| Requisito | Gate (herramienta y umbral) | Bloquea / avisa | Etapa | Run fallido | Run corregido |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

## Cambios a la propuesta de Kiro

| Documento | Qué propuso Kiro | Qué cambiaste | Por qué |
| --- | --- | --- | --- |
| requirements.md (1.4 y glosario) | Un curso se incluye si todos sus requisitos están en `aprobados`, sin excluir los que ya aprobé. Igual en la propiedad 4: con todo aprobado devolvía todos los cursos | Agregué "su `id` no está en `aprobados`" | El pedido dice "cursos no aprobados". Sin eso, un curso que ya aprobé aparece como habilitado y el ejemplo no da 27 |
| requirements.md (Requisito 4) | Máximo 500 elementos en `aprobados` | Lo bajé a 150 | La malla tiene 87 cursos, ninguna lista real pasa de eso; 500 no tenía justificación y 150 deja margen |
| requirements.md (3.1) | Patrón `^[A-Za-z0-9]+$`, y el glosario decía "con guiones" | `^[A-Z0-9]{6}$` | El de Kiro no limitaba el largo (aceptaba un código de 10 000 caracteres) y no coincidía con su propio glosario. Todos los códigos reales tienen 6 caracteres |
| requirements.md | Sección de "propiedades de corrección" para property-based testing | La quité | Necesitaba `fast-check`, una dependencia nueva que el steering no permite sin justificar, y gastaba créditos y tiempo del lab. Lo importante ya está cubierto en los criterios |
| design.md (Testing Strategy) | Volvió a meter 7 propiedades con `fast-check` como devDependency, aunque ya la había sacado de requirements | Las cambié por una tabla de tests de ejemplo, uno por criterio | Ya lo había descartado en requirements; es una dependencia nueva que no hace falta y el diseño no puede contradecir los requisitos aprobados |
| design.md (orden de validación) | Validar el tipo de cada elemento antes que el tamaño de la lista | Primero el tamaño, después el tipo y al final el patrón | Con 5 000 elementos (hallazgo 1) el orden de Kiro recorre toda la lista antes de rechazarla; revisar el largo es instantáneo |
| design.md | No decía qué hacer con códigos inexistentes, duplicados, minúsculas, electivos ni orden de la respuesta, y no tenía sección de gates | Agregué la tabla "Decisiones del endpoint" y la de gates (umbral, bloquea/avisa, etapa, razón) | Son casos que el pedido no define y los gates los pide el entregable E3 |
| requirements.md (1.6, 2.4) | El stack trace solo se cubría cuando fallaba la validación (1.6 era "el repositorio no carga", que no se puede provocar en un test). Tampoco validaba el tipo de cada elemento | 1.6 pasa a cubrir cualquier error no controlado → 500 genérico sin stack ni rutas. Agregué 2.4: un elemento que no es string → 400 | El hallazgo 2 era la fuga del stack trace. Y `regex.test(123)` acepta el número 123 porque lo convierte a texto |
