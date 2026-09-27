import { obtenerFactorViento, clasificarCuadrante, calcularRumboGrados,
  direccionHaciaDesdeMeteo } from './core.js';
import { V0_RC1 } from './rc1-fuel.js';

export const RC1_VERSION = 'vpif-rc1-provisional-2';
const V0_PRUDENTE = Math.max(...Object.values(V0_RC1));
const FV_PRUDENTE = 3;
const FP_PRUDENTE = 2;

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
      const fpMedido = factorPendienteFirmada(slope);
      const gap = fuel?.status === 'gap';
      const nodata_flags = { fuel: !gap && !(Number.isFinite(fuel?.v0) && fuel.v0 > 0),
        elevation: !gap && fpMedido === null, wind: !Number.isFinite(wind?.fv) };
      const v0 = nodata_flags.fuel ? V0_PRUDENTE : fuel?.v0 ?? null;
      const fp = nodata_flags.elevation ? FP_PRUDENTE : fpMedido;
      const fv = nodata_flags.wind ? FV_PRUDENTE : wind.fv;
      const vpif = gap ? null : v0 * fv * fp;
      const t = gap ? 0 : segment.distance_m / vpif;
      return { run_id, model_version: RC1_VERSION, asset_id, ...segment,
        ...fuel, v0, label: nodata_flags.fuel ?
          (fuel?.label ?? 'combustible sin dato') + ' · supuesto prudente V0=' + V0_PRUDENTE : fuel?.label,
        z_start_m: Number.isFinite(z0) ? z0 : null,
        z_end_m: Number.isFinite(z1) ? z1 : null, slope_signed_pct: slope, fp,
        meteo_scenario_utc: wind?.horaUtc ?? null, wind_points: wind?.wind_points ?? [],
        fv, vpif, t_i_min: t, gap_flag: gap, nodata_flags,
        assumption_flags: { ...nodata_flags },
        source_versions, created_at };
    });
    const provisional = rows.some(row => Object.values(row.assumption_flags).some(Boolean));
    const eta_min = rows.reduce((sum, row) => sum + row.t_i_min, 0);
    const direction = wind?.wind_points?.[0]?.direccionDesdeGrados;
    const exposure = Number.isFinite(direction) ?
      clasificarCuadrante(direccionHaciaDesdeMeteo(direction), rumbo) : null;
    return { scenario: h === 0 ? 't0' : `+${h}h`, horaUtc: wind?.horaUtc ?? null,
      eta_min, status: provisional ? 'provisional' : 'ok', exposure,
      fv: Number.isFinite(wind?.fv) ? wind.fv : FV_PRUDENTE,
      wind_rule: wind?.rule ?? (!Number.isFinite(wind?.fv) ? 'prudential_max_fv_v1' : null), rows };
  });
  return { run_id, model_version: RC1_VERSION, asset_id, source_versions, created_at,
    distance_m: segments.reduce((sum, s) => sum + s.distance_m, 0), rumbo, scenarios };
}
