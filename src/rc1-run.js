import { unidadesCorredor } from './rc1-overlay.js';
import { resolverCombustible } from './rc1-fuel.js';
import { calcularRc1 } from './rc1-engine.js';
import { obtenerPerfil, obtenerEscenariosViento } from './rc1-providers.js';

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
    const forestDomain = sigpac.length > 0 && sigpac.every(p => ['FO', 'MT', 'PR', 'PA'].includes(p.uso));
    return resolverCombustible({ sigpac, mfe, combustiblePositivo: forestDomain && evidenciaCombustibleMfe(interval.mfe), manual });
  });
  const points = overlay.segments.map(s => s.start_lonlat).concat([overlay.segments.at(-1).end_lonlat]);
  const [profile, winds] = await Promise.all([
    obtenerPerfil(points, { workerUrl, permitirFallbackOpenMeteo, signal, fetcher }),
    obtenerEscenariosViento(inicio, fin, overlay.distance_m, { signal, fetcher, now })
  ]);
  if (signal?.aborted) throw new DOMException('Solicitud cancelada', 'AbortError');
  const output = calcularRc1({ segments: overlay.segments, fuels,
    elevations: profile.elevations, winds, inicio, fin, asset_id: asset.asset_id,
    source_versions: { ...asset.manifest, elevation_source: profile.source,
      elevation_fallback: profile.fallback, wind_source: 'Open-Meteo forecast 10m' },
    created_at: now.toISOString() });
  return { ...output, profile_source: profile.source, profile_fallback: profile.fallback,
    intervals: overlay.intervals.map(i => ({ from_m: i.from_m, to_m: i.to_m,
      sigpac_ids: i.sigpac.map(f => f.id), mfe_ids: i.mfe.map(f => f.id) })) };
}
