/**
 * Valida el body de POST /habilitados.
 * @param {unknown} body - El body parseado de la petición.
 * @returns {null | { status: 400, message: string }}
 */
function validarAprobados(body) {
  if (body.aprobados === undefined) {
    return { status: 400, message: 'El campo aprobados es obligatorio' };
  }

  if (!Array.isArray(body.aprobados)) {
    return { status: 400, message: 'El campo aprobados debe ser un array' };
  }

  if (body.aprobados.length > 150) {
    return { status: 400, message: 'El campo aprobados no puede tener más de 150 elementos' };
  }

  if (body.aprobados.some((e) => typeof e !== 'string')) {
    return { status: 400, message: 'Uno o más elementos no son strings' };
  }

  if (body.aprobados.some((e) => !/^[A-Z0-9]{6}$/.test(e))) {
    return { status: 400, message: 'Uno o más códigos tienen un formato inválido' };
  }

  return null;
}

module.exports = { validarAprobados };
