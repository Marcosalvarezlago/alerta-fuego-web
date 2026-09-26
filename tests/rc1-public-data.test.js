import test from 'node:test';
import assert from 'node:assert/strict';
import { obtenerAssetPublico, obtenerUsosPublicos } from '../infra/rc1-public-data.js';

const geom = { type: 'Polygon', coordinates: [[[-6.721, 38.842], [-6.719, 38.842],
  [-6.719, 38.844], [-6.721, 38.844], [-6.721, 38.842]]] };
const ref = { provincia: 6, municipio: 128, agregado: 0, zona: 0, poligono: 18, parcela: 5008 };

test('asset público obtiene geometría sin publicar MFE25 y consulta usos por parcela', async () => {
  const calls = [];
  const fetcher = async url => {
    calls.push(String(url));
    if (String(url).includes('/ogcapi/')) return Response.json({ features: [
      { id: 1, geometry: geom, properties: { ...ref, recinto: 10 } },
      { id: 2, geometry: geom, properties: { ...ref, recinto: 11 } }
    ], links: [] });
    return Response.json([
      { ...ref, recinto: 10, uso_sigpac: 'PR' },
      { ...ref, recinto: 11, uso_sigpac: 'VI' }
    ]);
  };
  const result = await obtenerAssetPublico({ lat: 38.8432, lon: -6.7205 },
    { lat: 38.8432, lon: -6.7202 }, fetcher);
  assert.equal(result.sigpac.length, 2);
  assert.deepEqual(result.mfe, []);
  assert.equal(result.lookup_required, true);
  const uses = await obtenerUsosPublicos([
    { key: [6, 128, 0, 0, 18, 5008], recintos: [10, 11] }
  ], fetcher);
  assert.deepEqual(uses[0].uses.map(x => x.uso), ['PR', 'VI']);
  assert.equal(calls.length, 2);
});

test('asset público rechaza corredores fuera de 5 km y lotes de usos excesivos', async () => {
  await assert.rejects(obtenerAssetPublico({ lat: 38, lon: -6 }, { lat: 39, lon: -6 }), /5 km/);
  await assert.rejects(obtenerUsosPublicos(Array(21).fill({ key: [6, 128, 0, 0, 18, 5008], recintos: [10] })),
    /parcelas inválidas/);
});
