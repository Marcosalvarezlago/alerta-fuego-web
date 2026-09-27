import { obtenerFactorViento, clasificarCuadrante, calcularRumboGrados,
  direccionHaciaDesdeMeteo } from './core.js';
import { V0_RC1 } from './rc1-fuel.js';

export const RC1_VERSION = 'vpif-rc1-horario-1';
const V0_PRUDENTE = Math.max(...Object.values(V0_RC1));
const FV_PRUDENTE = 3;
const FP_PRUDENTE = 2;
const HORA_MS = 3600000;
const MINUTO_MS = 60000;

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

export function horaBaseUtc(ahora = new Date()) {
  return new Date(Math.floor(ahora.getTime() / HORA_MS) * HORA_MS).toISOString().slice(0, 16);
}

export function agregarVientoHorario(puntos, horaUtc, maxPuntos = 7) {
  if (!Array.isArray(puntos) || !puntos.length || puntos.length > maxPuntos ||
      puntos.some(p => !Number.isFinite(p.velocidadKmh) || p.velocidadKmh < 0 ||
        p.horaUtc !== horaUtc)) {
    return { status: 'nodata', horaUtc, fv: null, wind_points: puntos ?? [] };
  }
  const fv = Math.max(...puntos.map(p => obtenerFactorViento(p.velocidadKmh)));
  return { status: 'ok', horaUtc, fv, wind_points: puntos,
    rule: 'max_spatial_fv_same_hour_v1', source: 'Open-Meteo 10 m' };
}

function tiempoTramo(distanciaM, v0, fp, inicioMs, winds, manual) {
  let faltan = distanciaM;
  let cursor = inicioMs;
  const periodos = [];
  while (faltan > 1e-9) {
    const horaMs = Math.floor(cursor / HORA_MS) * HORA_MS;
    const horaUtc = new Date(horaMs).toISOString().slice(0, 16);
    const wind = manual ?? winds.get(horaMs);
    const sinViento = !Number.isFinite(wind?.fv);
    const fv = sinViento ? FV_PRUDENTE : wind.fv;
    const vpif = v0 * fp * fv;
    const minutosHastaCambio = manual ? Infinity : (horaMs + HORA_MS - cursor) / MINUTO_MS;
    const minutos = Math.min(faltan / vpif, minutosHastaCambio);
    const distancia = Math.min(faltan, minutos * vpif);
    if (!(minutos > 0) || !(distancia > 0)) throw new RangeError('Integración horaria inválida');
    periodos.push({ horaUtc, fv, vpif, minutos, distancia_m: distancia,
      sinViento, wind_points: wind?.wind_points ?? [] });
    faltan = Math.max(0, faltan - distancia);
    cursor += minutos * MINUTO_MS;
  }
  return { minutos: periodos.reduce((sum, periodo) => sum + periodo.minutos, 0), finMs: cursor, periodos };
}

export function calcularRc1({ segments, fuels, elevations, winds, inicio, fin,
  asset_id = null, source_versions = {}, created_at = new Date().toISOString() }) {
  if (!Array.isArray(segments) || !segments.length || !Array.isArray(fuels) ||
      !Array.isArray(elevations) || !Array.isArray(winds) || !winds.length ||
      fuels.length !== segments.length || elevations.length !== segments.length + 1) {
    throw new TypeError('Entradas RC1 incompletas');
  }
  const inicioMs = Date.parse(created_at);
  if (!Number.isFinite(inicioMs)) throw new TypeError('Hora de inicio inválida');
  const windMap = new Map(winds.map(w => [Date.parse(w.horaUtc + 'Z'), w]));
  const manual = winds[0]?.manual ? winds[0] : null;
  const rumbo = calcularRumboGrados(inicio.lat, inicio.lon, fin.lat, fin.lon);
  const run_id = `rc1-${created_at}`;
  let cursor = inicioMs;
  const rows = segments.map((segment, i) => {
    const fuel = fuels[i];
    const z0 = elevations[i], z1 = elevations[i + 1];
    const slope = pendienteFirmada(z0, z1, segment.distance_m);
    const fpMedido = factorPendienteFirmada(slope);
    const gap = fuel?.status === 'gap';
    const fuelNoData = !gap && !(Number.isFinite(fuel?.v0) && fuel.v0 > 0);
    const elevationNoData = !gap && fpMedido === null;
    const v0 = fuelNoData ? V0_PRUDENTE : fuel?.v0 ?? null;
    const fp = elevationNoData ? FP_PRUDENTE : fpMedido;
    const tramo = gap ? { minutos: 0, finMs: cursor, periodos: [] } :
      tiempoTramo(segment.distance_m, v0, fp, cursor, windMap, manual);
    const inicioTramoMs = cursor;
    cursor = tramo.finMs;
    const windNoData = tramo.periodos.some(periodo => periodo.sinViento);
    const nodata_flags = { fuel: fuelNoData, elevation: elevationNoData, wind: windNoData };
    const fvValores = [...new Set(tramo.periodos.map(periodo => periodo.fv))];
    const fv = fvValores.length === 1 ? fvValores[0] : null;
    const vpif = gap ? null : segment.distance_m / tramo.minutos;
    return { run_id, model_version: RC1_VERSION, asset_id, ...segment,
      ...fuel, v0, label: fuelNoData ?
        (fuel?.label ?? 'combustible sin dato') + ' · supuesto V0=' + V0_PRUDENTE : fuel?.label,
      z_start_m: Number.isFinite(z0) ? z0 : null,
      z_end_m: Number.isFinite(z1) ? z1 : null, slope_signed_pct: slope, fp,
      start_at_utc: new Date(inicioTramoMs).toISOString(),
      end_at_utc: new Date(cursor).toISOString(),
      wind_periods: tramo.periodos, wind_points: tramo.periodos[0]?.wind_points ?? [],
      fv, vpif, t_i_min: tramo.minutos, gap_flag: gap, nodata_flags,
      assumption_flags: { ...nodata_flags }, source_versions, created_at };
  });
  const primeraHora = Math.floor(inicioMs / HORA_MS) * HORA_MS;
  const windInicial = manual ?? windMap.get(primeraHora);
  const provisional = rows.some(row => Object.values(row.assumption_flags).some(Boolean)) ||
    !Number.isFinite(windInicial?.fv);
  const eta_min = rows.reduce((sum, row) => sum + row.t_i_min, 0);
  const direction = windInicial?.wind_points?.[0]?.direccionDesdeGrados;
  const exposure = Number.isFinite(direction) ?
    clasificarCuadrante(direccionHaciaDesdeMeteo(direction), rumbo) : null;
  const horasUsadas = [...new Set(rows.flatMap(row => row.wind_periods.map(p => p.horaUtc)))];
  const scenario = { scenario: 'recorrido', eta_min, status: provisional ? 'provisional' : 'ok',
    exposure, rows, wind_hours_used: horasUsadas, started_at_utc: created_at,
    arrived_at_utc: new Date(cursor).toISOString(),
    wind_rule: manual ? 'manual_constant_wind' : 'forecast_hour_at_traversal_v1' };
  return { run_id, model_version: RC1_VERSION, asset_id, source_versions, created_at,
    distance_m: segments.reduce((sum, s) => sum + s.distance_m, 0), rumbo, scenarios: [scenario] };
}
