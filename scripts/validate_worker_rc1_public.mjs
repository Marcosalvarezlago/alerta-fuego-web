// Smoke real de las rutas nuevas del Worker sin desplegarlo.
import worker from '../infra/worker.js';
import { ejecutarRc1Automatico } from '../src/rc1-run.js';

const a = { lat: Number(process.argv[2]), lon: Number(process.argv[3]) };
const b = { lat: Number(process.argv[4]), lon: Number(process.argv[5]) };
const base = 'https://worker-local.test';
const fetcher = (url, options) => String(url).startsWith(base) ?
  worker.fetch(new Request(url, options)) : fetch(url, options);
const start = performance.now();
const result = await ejecutarRc1Automatico(a, b, { apiBase: base, fetcher });
console.log(JSON.stringify({ seconds: (performance.now() - start) / 1000,
  segments: result.scenarios[0].rows.length,
  eta: result.scenarios.map(s => s.eta_min),
  fuel_labels: [...new Set(result.scenarios[0].rows.map(row => row.label))],
  profile: result.profile_source,
  sigpac_count: result.source_versions.sigpac_count,
  parcel_count: result.source_versions.sigpac_parcel_count }));
