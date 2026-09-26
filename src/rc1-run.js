import { unidadesCorredor } from './rc1-overlay.js';
import { resolverCombustible } from './rc1-fuel.js?v=integrada-2';
import { calcularRc1 } from './rc1-engine.js';
import { obtenerPerfil, obtenerEscenariosViento } from './rc1-providers.js?v=integrada-2';
import { agregarVientoHorario, horasEscenario } from './rc1-engine.js';
const COMBUSTIBLE_CULTIVO = new Set(['OV', 'VI', 'FY', 'FS', 'CI']);
const DOMINIO_COMBUSTIBLE = new Set(['FO', 'MT', 'PR', 'PA', 'PS', ...COMBUSTIBLE_CULTIVO]);

function evidenciaCombustibleMfe(features) {
  return features.some(f => {
    const p = f.properties ?? {};
    return ['Arbolado', 'Desarbolado', 'Matorral', 'Pastizal'].includes(p.UsoMFE) ||
      [p.FCCARB, p.FCCMAT, p.FCCHER].some(x => Number.isFinite(x) && x > 0);
  });
}

function dentroBbox(point, bbox) {
  return point.lon >= bbox[0] && point.lon <= bbox[2] &&
    point.lat >= bbox[1] && point.lat <= bbox[3];
}

export async function ejecutarRc1(inicio, fin, asset, {
  workerUrl = '', permitirFallbackOpenMeteo = false, manual = null,
  pendienteManual = null, vientoManual = null,
  signal, fetcher = fetch, now = new Date()
} = {}) {
  if (!asset || !Array.isArray(asset.bbox) || !Array.isArray(asset.sigpac) || !Array.isArray(asset.mfe)) {
    throw new TypeError('Asset de combustible inválido');
  }
  if (!dentroBbox(inicio, asset.bbox) || !dentroBbox(fin, asset.bbox)) {
    throw new RangeError('Corredor fuera de la cobertura del asset cargado');
  }
  const overlay = unidadesCorredor(inicio, fin, asset.sigpac, asset.mfe);
  if (overlay.distance_m > 5000 || overlay.segments.length > 255) throw new RangeError('Corredor RC1 piloto: máximo 5 km');
  const fuels = overlay.segments.map(s => {
    const interval = overlay.intervals[s.thematic_interval];
    const sigpac = interval.sigpac.map(f => f.properties);
    const mfe = interval.mfe.map(f => f.properties);
    const combustiblePositivo = sigpac.length > 0 && sigpac.every(p => DOMINIO_COMBUSTIBLE.has(p.uso)) &&
      (sigpac.some(p => p.uso === 'FO' || COMBUSTIBLE_CULTIVO.has(p.uso)) || evidenciaCombustibleMfe(interval.mfe));
    return resolverCombustible({ sigpac, mfe, combustiblePositivo, manual });
  });
  const points = overlay.segments.map(s => s.start_lonlat).concat([overlay.segments.at(-1).end_lonlat]);
  const [profile, winds] = await Promise.all([
    pendienteManual === null
      ? obtenerPerfil(points, { workerUrl, permitirFallbackOpenMeteo, signal, fetcher })
      : Promise.resolve({ elevations: points.map((_, i) => overlay.segments.slice(0, i)
        .reduce((sum, s) => sum + s.distance_m * pendienteManual / 100, 0)),
        source: 'pendiente manual homogénea', fallback: 'manual_slope' }),
    vientoManual === null
      ? obtenerEscenariosViento(inicio, fin, overlay.distance_m, { signal, fetcher, now })
      : Promise.resolve(horasEscenario(now).map(hora => agregarVientoHorario([
        { lat: inicio.lat, lon: inicio.lon, horaUtc: hora,
          velocidadKmh: vientoManual.velocidadKmh,
          direccionDesdeGrados: (vientoManual.haciaGrados + 180) % 360 }
      ], hora)))
  ]);
  if (signal?.aborted) throw new DOMException('Solicitud cancelada', 'AbortError');
  const output = calcularRc1({ segments: overlay.segments, fuels,
    elevations: profile.elevations, winds, inicio, fin, asset_id: asset.asset_id,
    source_versions: { ...asset.manifest, elevation_source: profile.source,
      elevation_fallback: profile.fallback,
      wind_source: vientoManual ? 'viento manual homogéneo' : 'Open-Meteo forecast 10m' },
    created_at: now.toISOString() });
  return { ...output, profile_source: profile.source, profile_fallback: profile.fallback,
    intervals: overlay.intervals.map(i => ({ from_m: i.from_m, to_m: i.to_m,
      sigpac_ids: i.sigpac.map(f => f.id), mfe_ids: i.mfe.map(f => f.id) })) };
}

export async function ejecutarRc1Automatico(inicio, fin, {
  apiBase = '', signal, fetcher = fetch, now = new Date(),
  pendienteManual = null, vientoManual = null
} = {}) {
  const params = new URLSearchParams({ lat0: inicio.lat, lon0: inicio.lon,
    lat1: fin.lat, lon1: fin.lon });
  const response = await fetcher(`${apiBase}/api/rc1/asset?${params}`, { signal });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || `No se pudo identificar el terreno (HTTP ${response.status})`);
  }
  const asset = await response.json();
  return ejecutarRc1(inicio, fin, asset, { workerUrl: `${apiBase}/api/rc1`,
    permitirFallbackOpenMeteo: true, pendienteManual, vientoManual,
    signal, fetcher, now });
}
