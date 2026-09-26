import { obtenerFactorViento, clasificarCuadrante, calcularRumboGrados,
  direccionHaciaDesdeMeteo } from './core.js';

export const RC1_VERSION = 'vpif-rc1-provisional-1';

export function factorPendienteFirmada(pct) {
  if (!Number.isFinite(pct)) return null;
  if (pct < 0) return 0.7;
  if (pct < 20) return 1;
  if (pct <= 40) return 1.5;
  return 2;
}

export function pendienteFirmada(z0, z1, distanciaM) {
  if (![z0, z1, distanciaM].every(Number.isFinite) || distanciaM <= 0) return null;
  return (z1 - z0) / distanciaM * 100;
}

export function agregarVientoHorario(puntos, horaUtc, maxPuntos = 7) {
  if (!Array.isArray(puntos) || !puntos.length || puntos.length > maxPuntos ||
      puntos.some(p => !Number.isFinite(p.velocidadKmh) || p.velocidadKmh < 0 || p.horaUtc !== horaUtc)) {
    return { status: 'nodata', horaUtc, fv: null, wind_points: puntos ?? [] };
  }
  const fv = Math.max(...puntos.map(p => obtenerFactorViento(p.velocidadKmh)));
  return { status: 'ok', horaUtc, fv, wind_points: puntos,
    rule: 'max_spatial_fv_same_hour_v1', source: 'Open-Meteo 10 m' };
}

export function horasEscenario(ahora = new Date()) {
  const base = Math.round(ahora.getTime() / 3600000) * 3600000;
  return [0, 1, 2, 3].map(h => new Date(base + h * 3600000).toISOString().slice(0, 16));
}

export function calcularRc1({ segments, fuels, elevations, winds, inicio, fin,
  asset_id = null, source_versions = {}, created_at = new Date().toISOString() }) {
  if (!Array.isArray(segments) || !segments.length || !Array.isArray(fuels) ||
      !Array.isArray(elevations) || !Array.isArray(winds) || winds.length !== 4 ||
      fuels.length !== segments.length || elevations.length !== segments.length + 1) {
    throw new TypeError('Entradas RC1 incompletas');
  }
  const rumbo = calcularRumboGrados(inicio.lat, inicio.lon, fin.lat, fin.lon);
  const run_id = `rc1-${created_at}`;
  const scenarios = winds.map((wind, h) => {
    const rows = segments.map((segment, i) => {
      const fuel = fuels[i];
      const z0 = elevations[i], z1 = elevations[i + 1];
      const slope = pendienteFirmada(z0, z1, segment.distance_m);
      const fp = factorPendienteFirmada(slope);
      const gap = fuel?.status === 'gap';
      const valid = gap || (Number.isFinite(fuel?.v0) && fuel.v0 > 0 && fp !== null && Number.isFinite(wind?.fv));
      const vpif = !gap && valid ? fuel.v0 * wind.fv * fp : null;
      const t = gap ? 0 : (valid && vpif > 0 ? segment.distance_m / vpif : null);
      return { run_id, model_version: RC1_VERSION, asset_id, ...segment,
        ...fuel, z_start_m: Number.isFinite(z0) ? z0 : null,
        z_end_m: Number.isFinite(z1) ? z1 : null, slope_signed_pct: slope, fp,
        meteo_scenario_utc: wind?.horaUtc ?? null, wind_points: wind?.wind_points ?? [],
        fv: wind?.fv ?? null, vpif, t_i_min: t, gap_flag: gap,
        nodata_flags: { fuel: !fuel || fuel.status === 'nodata',
          elevation: !gap && slope === null, wind: !Number.isFinite(wind?.fv) },
        source_versions, created_at };
    });
    const complete = wind?.status === 'ok' && rows.every(row => row.t_i_min !== null);
    const eta_min = complete ? rows.reduce((sum, row) => sum + row.t_i_min, 0) : null;
    const direction = wind?.wind_points?.[0]?.direccionDesdeGrados;
    const exposure = Number.isFinite(direction) ?
      clasificarCuadrante(direccionHaciaDesdeMeteo(direction), rumbo) : null;
    return { scenario: h === 0 ? 't0' : `+${h}h`, horaUtc: wind?.horaUtc ?? null,
      eta_min, status: complete ? 'ok' : 'indeterminado', exposure,
      fv: wind?.fv ?? null, wind_rule: wind?.rule ?? null, rows };
  });
  return { run_id, model_version: RC1_VERSION, asset_id, source_versions, created_at,
    distance_m: segments.reduce((sum, s) => sum + s.distance_m, 0), rumbo, scenarios };
}
