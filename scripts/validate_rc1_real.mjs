// Integración local de solo lectura. No despliega Worker ni publica el asset.
import fs from 'node:fs';
import worker from '../infra/worker.js';
import { ejecutarRc1 } from '../src/rc1-run.js';
import { evaluarAlertaFuego, direccionHaciaDesdeMeteo } from '../src/core.js';

const [assetPath, outputPath] = process.argv.slice(2);
if (!assetPath || !outputPath) throw new Error('Uso: node validate_rc1_real.mjs asset.json salida.json');
const asset = JSON.parse(fs.readFileSync(assetPath, 'utf8'));
const fetcher = (url, options) => String(url).includes('/perfil') ?
  worker.fetch(new Request(url, options)) : fetch(url, options);
const focus = { lat: 38.8432, lon: -6.7205 };
const shortEnd = { lat: 38.8432, lon: -6.7202 };
const longEnd = { lat: 38.8432, lon: -6.7196 };
const options = { workerUrl: 'https://local.test', fetcher };
const short = await ejecutarRc1(focus, shortEnd, asset, options);
const longBlocked = await ejecutarRc1(focus, longEnd, asset, options);
const longManual = await ejecutarRc1(focus, longEnd, asset, { ...options, manual: 'matorral' });
const rows = longManual.scenarios[0].rows;
const startZ = rows[0].z_start_m, endZ = rows.at(-1).z_end_m;
const signedSlope = (endZ - startZ) / longManual.distance_m * 100;
const wind = rows[0].wind_points[0];
const legacy = evaluarAlertaFuego({ latFuego: focus.lat, lonFuego: focus.lon,
  latZona: longEnd.lat, lonZona: longEnd.lon,
  direccionVientoHacia: direccionHaciaDesdeMeteo(wind.direccionDesdeGrados),
  velocidadVientoKmh: wind.velocidadKmh, tipoCombustible: 'matorral_mediterraneo',
  pendientePct: Math.abs(signedSlope),
  sentidoLadera: signedSlope < 0 ? 'bajando' : signedSlope > 0 ? 'subiendo' : 'llano' });
const report = { generated_at: new Date().toISOString(), asset_id: asset.asset_id,
  cases: {
    short: { distance_m: short.distance_m, segments: short.scenarios[0].rows.length,
      eta_min: short.scenarios.map(s => s.eta_min), rows: short.scenarios[0].rows },
    long_no_manual: { distance_m: longBlocked.distance_m, segments: longBlocked.scenarios[0].rows.length,
      eta_min: longBlocked.scenarios.map(s => s.eta_min),
      blocked_rows: longBlocked.scenarios[0].rows.filter(r => r.t_i_min === null).map(r =>
        ({ segment_id: r.segment_id, sigpac_codes: r.sigpac_codes, label: r.label })) },
    long_manual: { distance_m: longManual.distance_m, segments: longManual.scenarios[0].rows.length,
      eta_min: longManual.scenarios.map(s => s.eta_min), rows },
    legacy_comparison: { legacy_global_eta_min: legacy.tiempoMin,
      rc1_segmented_eta_min: longManual.scenarios[0].eta_min,
      delta_min: longManual.scenarios[0].eta_min - legacy.tiempoMin,
      legacy_fv: legacy.fv, legacy_fp: legacy.fp, global_signed_slope_pct: signedSlope }
  } };
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ report: outputPath, cases: Object.fromEntries(Object.entries(report.cases)
  .map(([name, value]) => [name, { distance_m: value.distance_m,
    segments: value.segments, eta_min: value.eta_min, delta_min: value.delta_min }])) }, null, 2));
