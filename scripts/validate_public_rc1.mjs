// Smoke local de los datos públicos: no despliega ni publica recursos.
import { obtenerAssetPublico, obtenerUsosPublicos } from '../infra/rc1-public-data.js';

const a = { lat: Number(process.argv[2]), lon: Number(process.argv[3]) };
const b = { lat: Number(process.argv[4]), lon: Number(process.argv[5]) };
const started = performance.now();
const asset = await obtenerAssetPublico(a, b);
const geometriesAt = performance.now();
const groups = new Map();
for (const feature of asset.sigpac) {
  const ref = feature.properties.ref;
  const key = JSON.stringify(ref.slice(0, 6));
  if (!groups.has(key)) groups.set(key, { key: ref.slice(0, 6), recintos: new Set() });
  groups.get(key).recintos.add(ref[6]);
}
const parcels = [...groups.values()].map(p => ({ key: p.key, recintos: [...p.recintos] }));
const batches = [];
for (let i = 0; i < parcels.length; i += 20) batches.push(parcels.slice(i, i + 20));
const results = await Promise.all(batches.map(batch => obtenerUsosPublicos(batch)));
const codes = results.flat().flatMap(p => p.uses.map(u => u.uso));
console.log(JSON.stringify({ geometry_seconds: (geometriesAt - started) / 1000,
  total_seconds: (performance.now() - started) / 1000,
  sigpac: asset.sigpac.length, parcels: parcels.length,
  matched_uses: codes.length, codes: [...new Set(codes)] }));
