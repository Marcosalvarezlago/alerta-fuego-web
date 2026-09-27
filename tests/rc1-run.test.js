import test from 'node:test';
import assert from 'node:assert/strict';
import { ejecutarRc1, ejecutarRc1Automatico } from '../src/rc1-run.js';
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

test('orquestación RC1 integra geometría, combustible, perfil y viento horario', async () => {
  const result = await ejecutarRc1(inicio, fin, asset,
    { permitirFallbackOpenMeteo: true, fetcher: mockFetch, now });
  assert.equal(result.scenarios.length, 1);
  assert.equal(result.profile_fallback, 'open_meteo_elevation_explicit');
  assert.deepEqual(result.scenarios[0].wind_hours_used, [hours[0]]);
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

test('cultivo permanente y FO sin MFE usan V0 prudente; TA usa hipótesis visible', async () => {
  for (const [uso, expectedV0] of [['VI', 8], ['FO', 8], ['TA', null]]) {
    const copy = structuredClone(asset);
    copy.sigpac[0].properties.uso = uso;
    const result = await ejecutarRc1(inicio, fin, copy, {
      pendienteManual: 0, vientoManual: { haciaGrados: 90, velocidadKmh: 10 }, now,
      fetcher: () => { throw new Error('no debe consultar proveedores con entradas manuales'); }
    });
    const row = result.scenarios[0].rows[0];
    assert.equal(row.v0, expectedV0 ?? 8, uso);
    assert.ok(result.scenarios[0].eta_min > 0, uso);
    assert.equal(row.nodata_flags.fuel, expectedV0 === null, uso);
    assert.equal(result.scenarios[0].status, expectedV0 === null ? 'provisional' : 'ok');
    if (expectedV0) assert.equal(row.fallback, 'untyped_v0_8');
  }
});

test('combustible manual uniforme omite SIGPAC y permite perfil y viento automáticos', async () => {
  const calls = [];
  const fetcher = async (url) => {
    calls.push(String(url));
    if (String(url).endsWith('/perfil')) return { ok: true,
      json: async () => ({ elevaciones: [100, 100, 100] }) };
    if (String(url).includes('/v1/forecast')) return mockFetch(url);
    throw new Error(`consulta inesperada: ${url}`);
  };
  const result = await ejecutarRc1Automatico(inicio, fin, { apiBase: 'https://local.test',
    combustibleManual: 'pinar', fetcher, now });
  assert.ok(result.scenarios[0].rows.every(row => row.v0 === 8 && row.status === 'manual'));
  assert.ok(result.scenarios[0].eta_min > 0);
  assert.ok(calls.every(url => !url.includes('/asset')));
  assert.equal(result.source_versions.fuel_source, 'combustible manual homogéneo');
});

test('la versión pública completa usos SIGPAC por lotes antes de clasificar', async () => {
  const remote = structuredClone(asset);
  remote.lookup_required = true;
  remote.sigpac[0].properties = { feature_id: 1, ref: [6, 128, 0, 0, 18, 5008, 10],
    uso: null, lookup_status: 'pending' };
  const calls = [];
  const fetcher = async (url) => {
    calls.push(String(url));
    if (String(url).includes('/asset?')) return { ok: true, json: async () => remote };
    if (String(url).endsWith('/usos')) return { ok: true, json: async () => ({ parcels: [
      { key: [6, 128, 0, 0, 18, 5008], uses: [{ recinto: 10, uso: 'PR' }] }
    ] }) };
    if (String(url).endsWith('/perfil')) return { ok: true,
      json: async () => ({ elevaciones: [100, 100, 100] }) };
    if (String(url).includes('/v1/forecast')) return mockFetch(url);
    throw new Error(`consulta inesperada: ${url}`);
  };
  const result = await ejecutarRc1Automatico(inicio, fin,
    { apiBase: 'https://local.test', fetcher, now });
  assert.equal(result.scenarios[0].rows[0].v0, 6);
  assert.ok(result.scenarios[0].eta_min > 0);
  assert.equal(calls.filter(url => url.endsWith('/usos')).length, 1);
});


test('corredor de más de 5 km divide asset y perfil sin bloquear el cálculo', async () => {
  const far = { lat: 0, lon: 0.075 };
  const calls = { asset: [], perfil: [] };
  const longAsset = structuredClone(asset);
  longAsset.bbox = [-0.1, -0.1, 0.1, 0.1];
  longAsset.sigpac[0].geometry.coordinates = [[[-0.1, -0.1], [0.1, -0.1],
    [0.1, 0.1], [-0.1, 0.1], [-0.1, -0.1]]];
  const fetcher = async (url, options = {}) => {
    if (String(url).includes('/asset?')) {
      calls.asset.push(String(url));
      return { ok: true, json: async () => structuredClone(longAsset) };
    }
    if (String(url).endsWith('/perfil')) {
      const count = JSON.parse(options.body).puntos.length;
      calls.perfil.push(count);
      return { ok: true, json: async () => ({ elevaciones: Array(count).fill(100) }) };
    }
    if (String(url).includes('/v1/forecast')) {
      const count = new URL(url).searchParams.get('latitude').split(',').length;
      const longHours = Array.from({ length: 48 }, (_, i) =>
        new Date(now.getTime() - 600000 + i * 3600000).toISOString().slice(0, 16));
      return { ok: true, json: async () => Array.from({ length: count }, () => ({
        hourly: { time: longHours, wind_speed_10m: Array(48).fill(10),
          wind_direction_10m: Array(48).fill(270) }
      })) };
    }
    throw new Error('Consulta inesperada: ' + url);
  };
  const result = await ejecutarRc1Automatico(inicio, far,
    { apiBase: 'https://local.test', fetcher, now });
  assert.ok(result.distance_m > 5000);
  assert.ok(result.scenarios[0].rows.length > 255);
  assert.equal(calls.asset.length, 3);
  assert.ok(calls.perfil.length >= 2);
  assert.ok(calls.perfil.every(n => n <= 128));
  assert.ok(Number.isFinite(result.scenarios[0].eta_min));
  assert.equal(result.scenarios[0].status, 'ok');
});

test('fallos de proveedores conservan ETA provisional y procedencia', async () => {
  const result = await ejecutarRc1(inicio, fin, asset, {
    workerUrl: 'https://local.test', permitirFallbackOpenMeteo: true, now,
    fetcher: async () => { throw new Error('proveedor caído'); }
  });
  assert.ok(result.scenarios[0].eta_min > 0);
  assert.equal(result.scenarios[0].status, 'provisional');
  assert.equal(result.scenarios[0].rows[0].nodata_flags.elevation, true);
  assert.equal(result.scenarios[0].rows[0].nodata_flags.wind, true);
  assert.equal(result.profile_fallback, 'prudential_fp_2');
  assert.match(result.source_versions.wind_source, /FV = 3/);
});

test('si SIGPAC falla se informa del dato ausente y se calcula ETA prudente', async () => {
  const fetcher = async (url) => {
    if (String(url).includes('/asset?')) throw new Error('SIGPAC caído');
    throw new Error('No debería llamar a otros proveedores con los controles manuales');
  };
  const result = await ejecutarRc1Automatico(inicio, fin, {
    apiBase: 'https://local.test', fetcher, now,
    pendienteManual: 0, vientoManual: { haciaGrados: 90, velocidadKmh: 10 }
  });
  assert.ok(Number.isFinite(result.scenarios[0].eta_min));
  assert.equal(result.scenarios[0].status, 'provisional');
  assert.equal(result.scenarios[0].rows[0].nodata_flags.fuel, true);
  assert.equal(result.source_versions.incomplete_parts, 1);
  assert.match(result.source_versions.fuel_source, /parcial/);
});
