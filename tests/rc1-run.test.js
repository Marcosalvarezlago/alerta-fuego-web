import test from 'node:test';
import assert from 'node:assert/strict';
import { ejecutarRc1 } from '../src/rc1-run.js';
import { calcularDistanciaM } from '../src/core.js';

const inicio = { lat: 0, lon: 0 };
const fin = { lat: 0, lon: 0.0003 };
const asset = { asset_id: 'fixture', bbox: [-0.01, -0.01, 0.01, 0.01], manifest: { ruleset: 'fixture' },
  sigpac: [{ id: 1, properties: { uso: 'PS', feature_id: 1 }, geometry: { type: 'Polygon',
    coordinates: [[[-0.01, -0.01], [0.01, -0.01], [0.01, 0.01], [-0.01, 0.01], [-0.01, -0.01]]] } }], mfe: [] };
const now = new Date('2026-09-26T10:10:00Z');
const hours = [10, 11, 12, 13].map(h => `2026-09-26T${h}:00`);
function mockFetch(url) {
  if (url.includes('/v1/elevation')) {
    const n = new URL(url).searchParams.get('latitude').split(',').length;
    return Promise.resolve({ ok: true, json: async () => ({ elevation: Array(n).fill(100) }) });
  }
  if (url.includes('/v1/forecast')) {
    return Promise.resolve({ ok: true, json: async () => [0, 1].map(() => ({ hourly: {
      time: hours, wind_speed_10m: [10, 20, 30, 0], wind_direction_10m: [270, 270, 270, 270]
    } })) });
  }
  throw new Error(`URL inesperada: ${url}`);
}

test('orquestación RC1 integra geometría, combustible, perfil y cuatro horas', async () => {
  const result = await ejecutarRc1(inicio, fin, asset,
    { permitirFallbackOpenMeteo: true, fetcher: mockFetch, now });
  assert.equal(result.scenarios.length, 4);
  assert.equal(result.profile_fallback, 'open_meteo_elevation_explicit');
  assert.deepEqual(result.scenarios.map(s => s.fv), [1.5, 2, 3, 1]);
  const length = calcularDistanciaM(0, 0, 0, 0.0003);
  assert.ok(Math.abs(result.scenarios[0].eta_min - length / 4.5) < 1e-9);
  assert.equal(result.scenarios[0].rows.reduce((sum, r) => sum + r.distance_m, 0), result.distance_m);
  assert.ok(result.scenarios[0].rows.every(r => r.sigpac_feature_ids[0] === 1));
});

test('cambio de foco/objetivo cancela consultas en curso y evita respuesta obsoleta', async () => {
  const controller = new AbortController();
  const slowFetch = (_url, options) => new Promise((_, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Abortado', 'AbortError')), { once: true });
  });
  const pending = ejecutarRc1(inicio, fin, asset, { permitirFallbackOpenMeteo: true,
    fetcher: slowFetch, signal: controller.signal, now });
  controller.abort();
  await assert.rejects(pending, /Abort/);
});

test('cobertura del asset evita usar datos temáticos fuera del piloto', async () => {
  await assert.rejects(ejecutarRc1(inicio, { lat: 1, lon: 1 }, asset), /fuera de la cobertura/);
});

test('cultivo permanente y FO sin MFE usan V0 prudente; tierra arable queda indeterminada', async () => {
  for (const [uso, expectedV0] of [['VI', 8], ['FO', 8], ['TA', null]]) {
    const copy = structuredClone(asset);
    copy.sigpac[0].properties.uso = uso;
    const result = await ejecutarRc1(inicio, fin, copy, {
      pendienteManual: 0, vientoManual: { haciaGrados: 90, velocidadKmh: 10 }, now,
      fetcher: () => { throw new Error('no debe consultar proveedores con entradas manuales'); }
    });
    assert.equal(result.scenarios[0].rows[0].v0, expectedV0, uso);
    assert.equal(result.scenarios[0].eta_min === null, expectedV0 === null, uso);
    if (expectedV0) assert.equal(result.scenarios[0].rows[0].fallback, 'untyped_v0_8');
  }
});
