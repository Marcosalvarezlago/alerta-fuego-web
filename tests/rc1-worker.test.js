import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { parsearArcGridPerfil, ventanasPerfil } from '../infra/worker.js';

test('perfil ArcGrid preserva celdas NoData y coordenadas', () => {
  const txt = 'ncols 2\nnrows 2\nxllcorner 0\nyllcorner 0\ncellsize 1\nNODATA_value -9999\n1 -9999\n3 4\n';
  assert.deepEqual(parsearArcGridPerfil(txt, [{ lat: 1.5, lon: 0.5 },
    { lat: 1.5, lon: 1.5 }, { lat: 0.5, lon: 1.5 }]), [1, null, 4]);
  assert.deepEqual(parsearArcGridPerfil('ncols 2\nnrows 1\nxllcorner 0\nyllcorner 0\ndx 2\ndy 1\n5 6',
    [{ lat: 0.5, lon: 1 }, { lat: 0.5, lon: 3 }]), [5, 6]);
  assert.throws(() => parsearArcGridPerfil('ncols 1\nnrows 2\ncellsize 1\nxllcorner 0\nyllcorner 0\n1\n',
    [{ lat: 0, lon: 0 }]), /incompleto/);
});

test('perfil separa ventanas y rechaza solicitudes inválidas sin llamar al proveedor', async () => {
  const pts = Array.from({ length: 101 }, (_, i) => ({ lat: 40 + i * 0.00009, lon: -6 }));
  assert.ok(ventanasPerfil(pts).length >= 2);
  const req = (puntos) => new Request('https://example.test/perfil', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ puntos }) });
  assert.equal((await worker.fetch(req([{ lat: 40, lon: -6 }]))).status, 400);
  assert.equal((await worker.fetch(req([{ lat: 40, lon: -6 }, { lat: 41, lon: -6 }]))).status, 400);
});
