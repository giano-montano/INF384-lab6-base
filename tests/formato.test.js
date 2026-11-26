const {
  formatearNombre,
  formatearCreditos,
  formatearCiclo,
  formatearTipo,
  resumenCurso,
  totalCreditos,
  agruparPorCiclo,
  ordenarPorCreditos,
  listaRequisitos,
} = require('../src/util/formato');

describe('formatearNombre', () => {
  test('capitaliza la primera letra de cada palabra', () => {
    expect(formatearNombre('cálculo diferencial')).toBe('Cálculo Diferencial');
  });

  test('convierte a minúsculas antes de capitalizar', () => {
    expect(formatearNombre('PROGRAMACIÓN ORIENTADA')).toBe('Programación Orientada');
  });
});

describe('formatearCreditos', () => {
  test('formatea un número entero con 1 decimal y la unidad', () => {
    expect(formatearCreditos(4)).toBe('4.0 créditos');
  });

  test('formatea un número decimal con 1 decimal', () => {
    expect(formatearCreditos(3.5)).toBe('3.5 créditos');
  });

  test('redondea a 1 decimal cuando hay más decimales', () => {
    expect(formatearCreditos(2.75)).toBe('2.8 créditos');
  });
});

describe('formatearCiclo', () => {
  test('devuelve "Electivo" cuando el ciclo es null', () => {
    expect(formatearCiclo(null)).toBe('Electivo');
  });

  test('devuelve "Electivo" cuando el ciclo es undefined', () => {
    expect(formatearCiclo(undefined)).toBe('Electivo');
  });

  test('devuelve "Ciclo N" para un valor numérico', () => {
    expect(formatearCiclo(6)).toBe('Ciclo 6');
  });
});

describe('formatearTipo', () => {
  test('devuelve "Obligatorio" para "obligatorio"', () => {
    expect(formatearTipo('obligatorio')).toBe('Obligatorio');
  });

  test('devuelve "Electivo" para "electivo"', () => {
    expect(formatearTipo('electivo')).toBe('Electivo');
  });

  test('devuelve "Electivo" para cualquier otro valor', () => {
    expect(formatearTipo('otro')).toBe('Electivo');
  });
});

describe('resumenCurso', () => {
  test('genera el resumen con id, nombre y créditos formateados', () => {
    const curso = { id: '1INF30', name: 'Programación', credits: 4 };
    expect(resumenCurso(curso)).toBe('1INF30 · Programación · 4.0 créditos');
  });
});

describe('totalCreditos', () => {
  test('suma los créditos de una lista de cursos', () => {
    const cursos = [
      { id: 'A', credits: 4 },
      { id: 'B', credits: 3 },
      { id: 'C', credits: 5 },
    ];
    expect(totalCreditos(cursos)).toBe(12);
  });

  test('devuelve 0 para una lista vacía', () => {
    expect(totalCreditos([])).toBe(0);
  });
});

describe('agruparPorCiclo', () => {
  test('agrupa cursos por ciclo y ordena por id dentro de cada grupo', () => {
    const cursos = [
      { id: 'B', cycle: 5, credits: 3 },
      { id: 'A', cycle: 5, credits: 4 },
      { id: 'C', cycle: 6, credits: 2 },
    ];
    const resultado = agruparPorCiclo(cursos);
    expect(Object.keys(resultado)).toContain('Ciclo 5');
    expect(Object.keys(resultado)).toContain('Ciclo 6');
    expect(resultado['Ciclo 5'].map((c) => c.id)).toEqual(['A', 'B']);
    expect(resultado['Ciclo 6'].map((c) => c.id)).toEqual(['C']);
  });

  test('agrupa cursos sin ciclo bajo "Electivo"', () => {
    const cursos = [
      { id: 'X', cycle: null, credits: 2 },
      { id: 'Y', cycle: undefined, credits: 3 },
    ];
    const resultado = agruparPorCiclo(cursos);
    expect(Object.keys(resultado)).toContain('Electivo');
    expect(resultado['Electivo'].map((c) => c.id)).toEqual(['X', 'Y']);
  });
});

describe('ordenarPorCreditos', () => {
  test('ordena de mayor a menor créditos; empates se resuelven por id ascendente', () => {
    const cursos = [
      { id: 'C', credits: 3 },
      { id: 'A', credits: 5 },
      { id: 'B', credits: 5 },
    ];
    const resultado = ordenarPorCreditos(cursos);
    expect(resultado.map((c) => c.id)).toEqual(['A', 'B', 'C']);
  });
});

describe('listaRequisitos', () => {
  test('devuelve "Sin requisitos" para un arreglo vacío', () => {
    expect(listaRequisitos([])).toBe('Sin requisitos');
  });

  test('devuelve los códigos ordenados y separados por coma para un arreglo no vacío', () => {
    expect(listaRequisitos(['1CON27', '1IND90', '1INF30'])).toBe('1CON27, 1IND90, 1INF30');
  });

  test('ordena los códigos antes de unirlos', () => {
    expect(listaRequisitos(['Z001', 'A001', 'M001'])).toBe('A001, M001, Z001');
  });
});
