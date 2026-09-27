import test from 'node:test';
import assert from 'node:assert/strict';
import { segmentarCorredor } from '../src/rc1-geometry.js';
import { puntoDesdeOrigen } from '../src/core.js';
import { candidatosMfe, resolverCombustible } from '../src/rc1-fuel.js';
import { factorPendienteFirmada, pendienteFirmada, agregarVientoHorario,
  horaBaseUtc, calcularRc1 } from '../src/rc1-engine.js';

const a = { lat: 40, lon: -6 };
function corridor(m, cuts = []) {
  const [lat, lon] = puntoDesdeOrigen(a.lat, a.lon, 0, m);
  const b = { lat, lon };
  return segmentarCorredor(a, b, cuts);
}
function wind(v = 0, hour = '2026-09-26T10:00') {
  return agregarVientoHorario([{ horaUtc: hour, velocidadKmh: v, direccionDesdeGrados: 270 }], hour);
}
function run(lengths, fuels, zs, ws = [wind()], createdAt = "2026-09-26T10:00:00Z") {
  let x = 0;
  const segments = lengths.map((distance_m, i) => {
    const s = { segment_id: `s${i + 1}`, chainage_start_m: x, chainage_end_m: x + distance_m, distance_m };
    x += distance_m;
    return s;
  });
  return calcularRc1({ segments, fuels, elevations: zs, winds: ws, inicio: a,
    fin: { lat: a.lat, lon: a.lon + 0.01 }, created_at: createdAt });
}
const sig = (uso) => resolverCombustible({ sigpac: { uso } });

test('segmento corto, múltiplo exacto y residual conservan longitud sin segmentos cero', () => {
  for (const [m, expected] of [[20, 1], [60, 2], [65, 3]]) {
    const c = corridor(m);
    assert.equal(c.segments.length, expected);
    assert.ok(c.segments.every(s => s.distance_m > 0 && s.distance_m <= 30 + 1e-7));
    assert.ok(Math.abs(c.segments.reduce((x, s) => x + s.distance_m, 0) - c.distance_m) < 1e-7);
  }
  assert.ok(Math.abs(corridor(65).segments.at(-1).distance_m - 5) < 1e-4);
});

test('frontera temática corta el corredor y conserva chainage', () => {
  const c = corridor(65, [25]);
  assert.equal(c.segments.length, 3);
  assert.equal(c.segments[0].chainage_end_m, 25);
  assert.equal(c.segments[1].chainage_start_m, 25);
  assert.equal(c.segments[0].thematic_interval, 0);
  assert.equal(c.segments[1].thematic_interval, 1);
});

test('23 casos ejecutables del preflight: clases, suma, fronteras y NoData', () => {
  const q = { uso: 'FO' };
  const mfeQ = { feature_id: 435, DesTipEstr: 'Bosque', FormArbol: 'Encinares (Quercus ilex)',
    Especie1: 'Quercus ilex', FCCARB: 20, FCCMAT: 0 };
  const mfeP = { feature_id: 11, DesTipEstr: 'Bosque', FormArbol: 'Pinar de pino pinaster',
    Especie1: 'Pinus pinaster', FCCARB: 20, FormArbust: 'Jarales', FCCMAT: 60 };
  const fuels = [sig('PS'), resolverCombustible({ sigpac: q, mfe: mfeQ }), sig('MT'),
    resolverCombustible({ sigpac: q, mfe: { ...mfeP, FormArbust: '', FCCMAT: 0 } })];
  assert.deepEqual(fuels.map(f => f.v0), [3, 4, 6, 8]);
  assert.deepEqual(fuels.map(f => run([30], [f], [0, 0]).scenarios[0].eta_min), [10, 7.5, 5, 3.75]);
  assert.equal(run([30, 30], [fuels[0], fuels[3]], [0, 0, 0]).scenarios[0].eta_min, 13.75);
  assert.equal(resolverCombustible({ sigpac: q, mfe: mfeQ }).v0, 4);
  const paSinMfe = resolverCombustible({ sigpac: { uso: 'PA' } });
  assert.equal(paSinMfe.status, 'untyped');
  assert.equal(paSinMfe.v0, 8);
  assert.match(paSinMfe.label, /no tipificado/);
  assert.equal(resolverCombustible({ sigpac: { uso: 'PA' }, mfe: mfeQ }).v0, 4);
  for (const uso of ['CF', 'FL', 'VO']) {
    const cultivo = resolverCombustible({ sigpac: { uso }, combustiblePositivo: true });
    assert.equal(cultivo.status, 'untyped', uso);
    assert.equal(cultivo.v0, 8, uso);
  }
  assert.equal(resolverCombustible({ sigpac: { uso: 'TA' }, mfe: mfeP }).status, 'nodata');
  assert.equal(resolverCombustible({ sigpac: { uso: 'AG' }, mfe: mfeP }).status, 'gap');
  const mixed = resolverCombustible({ sigpac: q, mfe: mfeP });
  assert.equal(mixed.v0, 8);
  assert.match(mixed.label, /ambigua/);
  assert.equal(mixed.conflict, true);
  const untyped = resolverCombustible({ sigpac: q, mfe: { UsoMFE: 'Bosque' }, combustiblePositivo: true });
  assert.equal(untyped.v0, 8);
  assert.match(untyped.label, /no tipificado/);
  assert.notEqual(untyped.label, 'pinar');
  for (const code of ['AG', 'ZU']) {
    const gap = sig(code);
    assert.equal(run([30], [gap], [0, 0]).scenarios[0].eta_min, 0);
  }
  assert.equal(run([30], [fuels[3]], [0, 9]).scenarios[0].eta_min, 2.5);
  assert.ok(Math.abs(run([30], [fuels[3]], [0, -3]).scenarios[0].eta_min - 30 / 5.6) < 1e-10);
  assert.ok(Math.abs(run([30, 30, 30], [fuels[2], fuels[2], fuels[2]], [0, -3, 0, 13.5])
    .scenarios[0].eta_min - (30 / 4.2 + 5 + 2.5)) < 1e-10);
  assert.equal(run([20], [fuels[1]], [0, 0]).scenarios[0].eta_min, 5);
  assert.deepEqual(corridor(65).segments.map(s => Math.round(s.distance_m)), [30, 30, 5]);
  for (const [speed, expected] of [[10, 2.5], [20, 1.875], [30, 1.25]]) {
    assert.equal(run([30], [fuels[3]], [0, 0], [wind(speed)])
      .scenarios[0].eta_min, expected);
  }
  const sinPerfil = run([30], [fuels[3]], [null, 0]).scenarios[0];
  assert.equal(sinPerfil.eta_min, 30 / (8 * 2));
  assert.equal(sinPerfil.status, 'provisional');
  assert.equal(sinPerfil.rows[0].assumption_flags.elevation, true);
  assert.equal(sig('FO').status, 'nodata');
  const boundary = resolverCombustible({ sigpac: [{ uso: 'FO', feature_id: 2 }, { uso: 'FO', feature_id: 1 }],
    mfe: [mfeQ, mfeP] });
  assert.equal(boundary.v0, 8);
  assert.equal(boundary.conflict, true);
  assert.deepEqual(boundary.sigpac_feature_ids, [1, 2]);
});

test('FP firmado y umbrales 20/40 sin valor absoluto ni NoData llano', () => {
  assert.equal(pendienteFirmada(10, 7, 30), -10);
  assert.equal(factorPendienteFirmada(-10), 0.7);
  assert.equal(factorPendienteFirmada(0), 1);
  assert.equal(factorPendienteFirmada(19.999), 1);
  assert.equal(factorPendienteFirmada(20), 1.5);
  assert.equal(factorPendienteFirmada(40), 1.5);
  assert.equal(factorPendienteFirmada(40.001), 2);
  assert.equal(factorPendienteFirmada(null), null);
});

test('FV 10/20/30, agregación espacial y coherencia horaria', () => {
  const h = '2026-09-26T10:00';
  for (const [v, fv] of [[9.9, 1], [10, 1.5], [20, 2], [30, 3]]) assert.equal(wind(v, h).fv, fv);
  assert.equal(agregarVientoHorario([{ horaUtc: h, velocidadKmh: 9 },
    { horaUtc: h, velocidadKmh: 22 }], h).fv, 2);
  assert.equal(agregarVientoHorario([{ horaUtc: h, velocidadKmh: 9 },
    { horaUtc: '2026-09-26T11:00', velocidadKmh: 22 }], h).status, 'nodata');
  assert.equal(horaBaseUtc(new Date('2026-09-26T10:20:00Z')), '2026-09-26T10:00');
});

test('NoData usa los factores más rápidos de la tabla y conserva las banderas', () => {
  const f = sig('PS');
  const noWind = agregarVientoHorario([], '2026-09-26T10:00');
  const sinViento = run([30], [f], [0, 0], [noWind]).scenarios[0];
  assert.equal(sinViento.eta_min, 30 / (3 * 3));
  assert.equal(sinViento.status, 'provisional');
  assert.equal(sinViento.rows[0].nodata_flags.wind, true);
  const sinCombustible = run([30], [sig('FO')], [0, 0]).scenarios[0];
  assert.equal(sinCombustible.eta_min, 30 / 8);
  assert.equal(sinCombustible.rows[0].v0, 8);
  assert.equal(sinCombustible.rows[0].nodata_flags.fuel, true);
  assert.equal(resolverCombustible({ manual: 'quercus' }).v0, 4);
  const gap = run([30], [sig('AG')], [0, 0], [noWind]).scenarios[0];
  assert.equal(gap.eta_min, 0);
  assert.equal(gap.status, 'provisional');
  const sinElevacion = run([30], [f], [0, null]).scenarios[0];
  assert.equal(sinElevacion.eta_min, 30 / (3 * 2));
  assert.equal(sinElevacion.rows[0].nodata_flags.elevation, true);
  const w1 = wind(10);
  const w2 = agregarVientoHorario([{ horaUtc: '2026-09-26T10:00',
    velocidadKmh: 10, direccionDesdeGrados: 90 }], '2026-09-26T10:00');
  const x = run([30], [f], [0, 0], [w1]).scenarios[0];
  const y = run([30], [f], [0, 0], [w2]).scenarios[0];
  assert.equal(x.eta_min, y.eta_min);
  assert.notEqual(x.exposure.cuadrante, y.exposure.cuadrante);
});

test('el viento cambia dentro de un tramo exactamente al cruzar la hora', () => {
  const result = run([30], [sig('PS')], [0, 0],
    [wind(0, '2026-09-26T10:00'), wind(30, '2026-09-26T11:00')],
    '2026-09-26T10:59:00Z').scenarios[0];
  assert.ok(Math.abs(result.eta_min - 4) < 1e-7);
  assert.deepEqual(result.rows[0].wind_periods.map(p => Math.round(p.distancia_m)), [3, 27]);
  assert.deepEqual(result.wind_hours_used, ['2026-09-26T10:00', '2026-09-26T11:00']);
  assert.equal(result.rows[0].end_at_utc, '2026-09-26T11:03:00.000Z');
});
