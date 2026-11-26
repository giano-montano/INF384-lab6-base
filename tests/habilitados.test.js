const request = require('supertest');
const app = require('../src/app');
const repositorio = require('../src/data/repositorio');

// ---------------------------------------------------------------------------
// Requisito 1 — Calcular cursos habilitados
// ---------------------------------------------------------------------------

describe('POST /habilitados — Requisito 1: calcular cursos habilitados', () => {
  // Criterio 1.1: body válido → 200 y el body es un array
  test('1.1 body válido responde 200 con un array', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: ['1INF25'] });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // Criterio 1.2: aprobados vacío → solo cursos sin prerequisites
  test('1.2 aprobados vacío devuelve exactamente los cursos sin prerequisites', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: [] });

    expect(res.status).toBe(200);

    const sinRequisitos = repositorio
      .listar()
      .filter((c) => Array.isArray(c.prerequisites) && c.prerequisites.length === 0);

    expect(res.body.length).toBe(sinRequisitos.length);

    const idsRespuesta = res.body.map((c) => c.id);
    for (const curso of sinRequisitos) {
      expect(idsRespuesta).toContain(curso.id);
    }
  });

  // Criterio 1.3: aprobados con tres cursos → exactamente 27 cursos habilitados
  test('1.3 con ["1INF25","1INF27","1INF49"] responde 200 con exactamente 27 cursos', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: ['1INF25', '1INF27', '1INF49'] });

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(27);
  });

  test('1.3 la respuesta incluye los cursos 1INF29, 1INF30, 1INF31 y 1INF32', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: ['1INF25', '1INF27', '1INF49'] });

    const ids = res.body.map((c) => c.id);
    expect(ids).toContain('1INF29');
    expect(ids).toContain('1INF30');
    expect(ids).toContain('1INF31');
    expect(ids).toContain('1INF32');
  });

  // Criterio 1.4: ningún aprobado aparece en la respuesta; cada curso devuelto
  //              tiene todos sus prerequisites dentro de aprobados
  test('1.4 ningún id de aprobados aparece en la respuesta', async () => {
    const aprobados = ['1INF25', '1INF27', '1INF49'];
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados });

    expect(res.status).toBe(200);
    const idsRespuesta = res.body.map((c) => c.id);
    for (const id of aprobados) {
      expect(idsRespuesta).not.toContain(id);
    }
  });

  test('1.4 cada curso devuelto tiene todos sus prerequisites dentro de aprobados', async () => {
    const aprobados = ['1INF25', '1INF27', '1INF49'];
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados });

    expect(res.status).toBe(200);
    const setAprobados = new Set(aprobados);
    for (const curso of res.body) {
      for (const prereq of curso.prerequisites) {
        expect(setAprobados.has(prereq)).toBe(true);
      }
    }
  });

  // Criterio 1.6: error no controlado → 500 sin stack ni rutas del sistema
  test('1.6 error en repositorio.listar responde 500 con mensaje genérico', async () => {
    const spy = jest
      .spyOn(repositorio, 'listar')
      .mockImplementation(() => {
        throw new Error('C:\\apps\\malla\\src\\x.js');
      });

    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: ['1INF25'] });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Error interno del servidor' });

    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain('stack');
    expect(bodyStr).not.toContain('at ');
    expect(bodyStr).not.toContain('C:\\');

    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Requisito 2 — Validar que `aprobados` sea un array
// ---------------------------------------------------------------------------

describe('POST /habilitados — Requisito 2: validar aprobados', () => {
  // Criterio 2.1: campo aprobados ausente → 400
  test('2.1 body sin campo aprobados responde 400 con mensaje obligatorio', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'El campo aprobados es obligatorio' });
  });

  // Criterio 2.2: aprobados no es array → 400
  test('2.2 aprobados string responde 400 "debe ser un array"', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: '1INF25' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'El campo aprobados debe ser un array' });
  });

  test('2.2 aprobados número responde 400 "debe ser un array"', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: 42 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'El campo aprobados debe ser un array' });
  });

  test('2.2 aprobados objeto responde 400 "debe ser un array"', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: { a: 1 } });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'El campo aprobados debe ser un array' });
  });

  // Criterio 2.3: JSON inválido → 400
  test('2.3 body JSON inválido responde 400 "El body debe ser JSON válido"', async () => {
    const res = await request(app)
      .post('/habilitados')
      .set('Content-Type', 'application/json')
      .send('{invalid');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'El body debe ser JSON válido' });
  });

  // Criterio 2.4: elemento no-string → 400
  test('2.4 aprobados con número [123] responde 400', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: [123] });

    expect(res.status).toBe(400);
  });

  test('2.4 aprobados con null [null] responde 400', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: [null] });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Requisito 3 — Validar formato de los códigos de curso
// ---------------------------------------------------------------------------

describe('POST /habilitados — Requisito 3: validar formato de códigos', () => {
  // Criterios 3.1 y 3.2: código con formato inválido → 400 sin reflejar el contenido
  test('3.1/3.2 código con <script> responde 400', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: ['1INF30<script>'] });

    expect(res.status).toBe(400);
  });

  test('3.1/3.2 el body de la respuesta no contiene <script>', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: ['1INF30<script>'] });

    expect(JSON.stringify(res.body)).not.toContain('<script>');
  });

  // Criterio 3.3: mismo caso → nunca 500, sin stack traces
  test('3.3 código inválido no provoca 500', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: ['1INF30<script>'] });

    expect(res.status).not.toBe(500);
  });

  test('3.3 el body de la respuesta no contiene stack', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: ['1INF30<script>'] });

    expect(JSON.stringify(res.body)).not.toContain('stack');
  });

  test('3.1 mensaje de error es "Uno o más códigos tienen un formato inválido"', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: ['1INF30<script>'] });

    expect(res.body).toEqual({ error: 'Uno o más códigos tienen un formato inválido' });
  });
});

// ---------------------------------------------------------------------------
// Requisito 4 — Limitar el tamaño del array `aprobados`
// ---------------------------------------------------------------------------

describe('POST /habilitados — Requisito 4: limitar tamaño de aprobados', () => {
  // Criterio 4.1a: 151 elementos → 400
  test('4.1a 151 elementos responde 400 con mensaje de tamaño máximo', async () => {
    const aprobados = Array(151).fill('AAAAAA');

    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'El campo aprobados no puede tener más de 150 elementos',
    });
  });

  // Criterio 4.1b: 5 000 elementos → 400 en menos de 500 ms
  test('4.1b 5000 elementos responde 400 en menos de 500 ms', async () => {
    const aprobados = Array(5000).fill('AAAAAA');

    const inicio = Date.now();
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados });
    const duracion = Date.now() - inicio;

    expect(res.status).toBe(400);
    expect(duracion).toBeLessThan(500);
  });

  // Criterio 4.2: exactamente 150 elementos (con duplicados) → 200
  test('4.2 exactamente 150 elementos (con duplicados) responde 200', async () => {
    // La malla tiene 87 cursos; llenamos hasta 150 repitiendo '1INF25'
    const aprobados = Array(150).fill('1INF25');

    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados });

    expect(res.status).toBe(200);
  });
});
