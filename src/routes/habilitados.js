const express = require('express');
const repositorio = require('../data/repositorio');
const { validarAprobados } = require('../util/validadorAprobados');

const router = express.Router();

router.post('/', (req, res, next) => {
  const error = validarAprobados(req.body);
  if (error) {
    return res.status(error.status).json({ error: error.message });
  }

  const aprobadosSet = new Set(req.body.aprobados);

  const habilitados = repositorio.listar().filter(
    (curso) =>
      !aprobadosSet.has(curso.id) &&
      curso.prerequisites.every((prereq) => aprobadosSet.has(prereq))
  );

  res.status(200).json(habilitados);
});

module.exports = router;
