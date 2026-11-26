const request = require('supertest');
const app = require('../src/app');

describe('GET /cursos/:codigo', () => {
  // Criterio 2.1: curso existente devuelve datos con requisitos resueltos
  test('2.1 responde 200 con el curso y sus prerrequisitos resueltos', async () => {
    const res = await request(app).get('/cursos/1INF30');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: '1INF30',
      name: expect.any(String),
      credits: expect.any(Number),
      cycle: expect.any(Number),
      type: expect.any(String),
    });
    expect(Array.isArray(res.body.prerequisites)).toBe(true);
  });

  test('2.1 cada prerrequisito incluye id y name', async () => {
    // 1CON27 tiene al menos un prerrequisito (1IND90)
    const res = await request(app).get('/cursos/1CON27');

    expect(res.status).toBe(200);
    expect(res.body.prerequisites.length).toBeGreaterThan(0);
    for (const prereq of res.body.prerequisites) {
      expect(prereq).toHaveProperty('id');
      expect(prereq).toHaveProperty('name');
      expect(typeof prereq.id).toBe('string');
      expect(typeof prereq.name).toBe('string');
    }
  });

  // Criterio 2.2: código inexistente → 404
  test('2.2 código inexistente responde 404 con mensaje de error', async () => {
    const res = await request(app).get('/cursos/NOEXISTE');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'curso no encontrado' });
  });
});

describe('GET /cursos', () => {
  // Criterio 1.1: devuelve todos los cursos con los campos requeridos
  test('1.1 responde 200 con todos los cursos', async () => {
    const res = await request(app).get('/cursos');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(87);
  });

  test('1.1 cada curso tiene los campos id, name, credits, cycle y type', async () => {
    const res = await request(app).get('/cursos');

    for (const curso of res.body) {
      expect(curso).toHaveProperty('id');
      expect(curso).toHaveProperty('name');
      expect(curso).toHaveProperty('credits');
      expect(curso).toHaveProperty('cycle');
      expect(curso).toHaveProperty('type');
    }
  });

  // Criterio 1.2: filtra por ciclo válido
  test('1.2 filtra por ciclo=6 y devuelve solo los cursos de ese ciclo', async () => {
    const res = await request(app).get('/cursos?ciclo=6');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    for (const curso of res.body) {
      expect(curso.cycle).toBe(6);
    }
  });

  test('1.2 filtra por ciclo=5 y devuelve solo los cursos de ciclo 5', async () => {
    const res = await request(app).get('/cursos?ciclo=5');

    expect(res.status).toBe(200);
    expect(res.body.every((c) => c.cycle === 5)).toBe(true);
  });

  test('1.2 filtra por ciclo=10 (límite superior)', async () => {
    const res = await request(app).get('/cursos?ciclo=10');

    expect(res.status).toBe(200);
    expect(res.body.every((c) => c.cycle === 10)).toBe(true);
  });

  // Criterio 1.3: ciclo inválido → 400
  test('1.3 ciclo=4 responde 400 con mensaje de error', async () => {
    const res = await request(app).get('/cursos?ciclo=4');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'ciclo debe ser un entero entre 5 y 10' });
  });

  test('1.3 ciclo=11 responde 400 con mensaje de error', async () => {
    const res = await request(app).get('/cursos?ciclo=11');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'ciclo debe ser un entero entre 5 y 10' });
  });

  test('1.3 ciclo=abc responde 400 con mensaje de error', async () => {
    const res = await request(app).get('/cursos?ciclo=abc');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'ciclo debe ser un entero entre 5 y 10' });
  });

  test('1.3 ciclo=6.5 (no entero) responde 400 con mensaje de error', async () => {
    const res = await request(app).get('/cursos?ciclo=6.5');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'ciclo debe ser un entero entre 5 y 10' });
  });
});
