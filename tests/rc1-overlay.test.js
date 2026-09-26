import test from 'node:test';
import assert from 'node:assert/strict';
import { unidadesCorredor } from '../src/rc1-overlay.js';
import { resolverCombustible } from '../src/rc1-fuel.js';

const box = (x0, x1, uso, id) => ({ id, properties: { uso, feature_id: id },
  geometry: { type: 'Polygon', coordinates: [[[x0, -1], [x1, -1], [x1, 1], [x0, 1], [x0, -1]]] } });

test('overlay corta frontera real y asigna ambos usos a intervalos distintos', () => {
  const start = { lat: 0, lon: -0.001 }, end = { lat: 0, lon: 0.001 };
  const overlay = unidadesCorredor(start, end, [box(-0.002, 0, 'PS', 1), box(0, 0.002, 'FO', 2)], [], 30);
  assert.equal(overlay.intervals.length, 2);
  assert.ok(Math.abs(overlay.intervals[0].to_m - overlay.distance_m / 2) < 0.01);
  assert.equal(overlay.intervals[0].sigpac[0].properties.uso, 'PS');
  assert.equal(overlay.intervals[1].sigpac[0].properties.uso, 'FO');
  assert.equal(resolverCombustible({ sigpac: overlay.intervals[1].sigpac.map(f => f.properties) }).status, 'nodata');
});

test('línea en frontera conserva todos los recintos, sin elegir el primero', () => {
  const start = { lat: -0.0005, lon: 0 }, end = { lat: 0.0005, lon: 0 };
  const overlay = unidadesCorredor(start, end, [box(-0.001, 0, 'PS', 1), box(0, 0.001, 'MT', 2)], [], 30);
  assert.ok(overlay.intervals.every(i => i.sigpac.length === 2));
});
