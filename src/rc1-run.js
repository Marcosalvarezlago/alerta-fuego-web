import { unidadesCorredor } from './rc1-overlay.js';
import { segmentarCorredor } from './rc1-geometry.js';
import { resolverCombustible } from './rc1-fuel.js?v=cruce-2';
import { calcularRc1 } from './rc1-engine.js?v=cruce-2';
import { obtenerPerfil, obtenerPronosticoViento } from './rc1-providers.js?v=cruce-2';
import { agregarVientoHorario, horaBaseUtc } from './rc1-engine.js?v=cruce-2';
const COMBUSTIBLE_CULTIVO = new Set(['CF', 'CI', 'CS', 'CV', 'FF', 'FL', 'FS', 'FV', 'FY', 'OC', 'OF', 'OV', 'VF', 'VI', 'VO']);
const DOMINIO_COMBUSTIBLE = new Set(['FO', 'MT', 'PR', 'PA', 'PS', ...COMBUSTIBLE_CULTIVO]);

// Cada petición SIGPAC sigue dentro de los límites operativos del proveedor.
// La distancia elegida por la persona se divide automáticamente, sin límite de 5 km en la interfaz.
async function mapLimit(items, limit, task) {
  const result = Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      result[index] = await task(items[index]);
    }
  }));
  return result;
}

function elevacionesPendienteManual(segments, pct) {
  const elevations = [0];
  for (const segment of segments) {
    elevations.push(elevations.at(-1) + segment.distance_m * pct / 100);
  }
  return elevations;
}

function assetSinDato(part, reason) {
  const a = part.start_lonlat, b = part.end_lonlat, pad = 0.000001;
  return { asset_id: 'sin-dato', sigpac: [], mfe: [], lookup_required: false,
    bbox: [Math.min(a.lon, b.lon) - pad, Math.min(a.lat, b.lat) - pad,
      Math.max(a.lon, b.lon) + pad, Math.max(a.lat, b.lat) + pad],
    manifest: { fuel_source: 'SIGPAC no disponible; cálculo prudente',
      sigpac_count: 0, mfe_count: 0, ruleset: 'vpif-rc1-provisional-1',
      source_error: reason }, incomplete: true };
}

async function obtenerAssetPorPartes(inicio, fin, apiBase, fetcher, signal) {
  const parts = segmentarCorredor(inicio, fin, [], 4000).segments;
  const assets = await mapLimit(parts, 3, async part => {
    if (signal?.aborted) throw new DOMException('Solicitud cancelada', 'AbortError');
    const params = new URLSearchParams({ lat0: part.start_lonlat.lat,
      lon0: part.start_lonlat.lon, lat1: part.end_lonlat.lat, lon1: part.end_lonlat.lon });
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetcher(apiBase + '/api/rc1/asset?' + params, { signal: controller.signal });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        if (response.status >= 400 && response.status < 500) {
          throw new RangeError(detail.error || 'Corredor no válido');
        }
        throw new Error(detail.error || 'SIGPAC HTTP ' + response.status);
      }
      const asset = await response.json();
      if (!Array.isArray(asset.bbox) || !Array.isArray(asset.sigpac) || !Array.isArray(asset.mfe)) {
        throw new Error('Respuesta SIGPAC incompleta');
      }
      return asset;
    } catch (error) {
      if (signal?.aborted) throw error;
      if (error instanceof RangeError) throw error;
      return assetSinDato(part, error.message || String(error));
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  });
  const sigpac = new Map(), mfe = new Map();
  const bbox = [Infinity, Infinity, -Infinity, -Infinity];
  for (const asset of assets) {
    bbox[0] = Math.min(bbox[0], asset.bbox[0]);
    bbox[1] = Math.min(bbox[1], asset.bbox[1]);
    bbox[2] = Math.max(bbox[2], asset.bbox[2]);
    bbox[3] = Math.max(bbox[3], asset.bbox[3]);
    for (const feature of asset.sigpac) sigpac.set(String(feature.id), feature);
    for (const feature of asset.mfe) mfe.set(String(feature.id), feature);
  }
  const incomplete = assets.filter(asset => asset.incomplete).length;
  return { asset_id: assets.length === 1 ? assets[0].asset_id : 'rc1-corridor-' + Date.now(),
    bbox, sigpac: [...sigpac.values()], mfe: [...mfe.values()],
    lookup_required: assets.some(asset => asset.lookup_required),
    manifest: { ...assets[0].manifest, sigpac_count: sigpac.size, mfe_count: mfe.size,
      asset_parts: assets.length, incomplete_parts: incomplete,
      fuel_source: incomplete ? 'SIGPAC parcial; tramos sin dato calculados prudentemente' :
        assets[0].manifest.fuel_source } };
}

async function completarUsosPublicos(asset, apiBase, fetcher, signal) {
  if (!asset.lookup_required) return asset;
  const groups = new Map();
  for (const feature of asset.sigpac) {
    const ref = feature.properties?.ref;
    if (!Array.isArray(ref) || ref.length !== 7) continue;
    const key = JSON.stringify(ref.slice(0, 6));
    if (!groups.has(key)) groups.set(key, { key: ref.slice(0, 6), recintos: new Set() });
    groups.get(key).recintos.add(ref[6]);
  }
  const parcels = [...groups.values()].map(p => ({ key: p.key, recintos: [...p.recintos] }));
  const batches = [];
  for (let i = 0; i < parcels.length; i += 20) batches.push(parcels.slice(i, i + 20));
  const ctrl = new AbortController();
  const abort = () => ctrl.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => ctrl.abort(), 25000);
  let results;
  try {
    results = await mapLimit(batches, 4, async batch => {
      const response = await fetcher(`${apiBase}/api/rc1/usos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parcels: batch }), signal: ctrl.signal
      });
      if (!response.ok) throw new Error(`SIGPAC no pudo completar los usos (HTTP ${response.status})`);
      const data = await response.json();
      if (!Array.isArray(data.parcels)) throw new Error('SIGPAC devolvió usos incompletos');
      return data.parcels;
    });
  } catch (error) {
    if (ctrl.signal.aborted && !signal?.aborted) {
      throw new Error('SIGPAC tarda demasiado. Reintenta o usa combustible manual.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
  const uses = new Map();
  for (const parcel of results.flat()) {
    for (const entry of parcel.uses ?? []) {
      uses.set(JSON.stringify([...parcel.key, entry.recinto]), entry.uso);
    }
  }
  for (const feature of asset.sigpac) {
    const code = uses.get(JSON.stringify(feature.properties.ref));
    feature.properties.uso = typeof code === 'string' && /^[A-Z]{2}$/.test(code) ? code : null;
    feature.properties.lookup_status = feature.properties.uso ? 'matched' : 'unmatched';
  }
  asset.manifest.sigpac_parcel_count = parcels.length;
  return asset;
}

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
  const fuels = overlay.segments.map(s => {
    const interval = overlay.intervals[s.thematic_interval];
    const sigpac = interval.sigpac.map(f => f.properties);
    const mfe = interval.mfe.map(f => f.properties);
    const combustiblePositivo = sigpac.length > 0 && sigpac.every(p => DOMINIO_COMBUSTIBLE.has(p.uso)) &&
      (sigpac.some(p => p.uso === 'FO' || COMBUSTIBLE_CULTIVO.has(p.uso)) || evidenciaCombustibleMfe(interval.mfe));
    return resolverCombustible({ sigpac, mfe, combustiblePositivo, manual });
  });
  const points = overlay.segments.map(s => s.start_lonlat).concat([overlay.segments.at(-1).end_lonlat]);
  const profileTask = pendienteManual === null
    ? obtenerPerfil(points, { workerUrl, permitirFallbackOpenMeteo, signal, fetcher })
      .catch(error => {
        if (signal?.aborted) throw error;
        return { elevations: points.map(() => null),
          source: 'elevación no disponible; FP = 2 prudente',
          fallback: 'prudential_fp_2', source_error: error.message };
      })
    : Promise.resolve({ elevations: elevacionesPendienteManual(overlay.segments, pendienteManual),
      source: 'pendiente manual homogénea', fallback: 'manual_slope' });
  let windError = null;
  const windTask = vientoManual === null
    ? obtenerPronosticoViento(inicio, fin, overlay.distance_m, { signal, fetcher, now })
      .catch(error => {
        if (signal?.aborted) throw error;
        windError = error.message || String(error);
        return [agregarVientoHorario([], horaBaseUtc(now))];
      })
    : Promise.resolve([{ ...agregarVientoHorario([
      { lat: inicio.lat, lon: inicio.lon, horaUtc: horaBaseUtc(now),
        velocidadKmh: vientoManual.velocidadKmh,
        direccionDesdeGrados: (vientoManual.haciaGrados + 180) % 360 }
    ], horaBaseUtc(now)), manual: true }]);
  const [profile, winds] = await Promise.all([profileTask, windTask]);
  if (signal?.aborted) throw new DOMException('Solicitud cancelada', 'AbortError');
  const output = calcularRc1({ segments: overlay.segments, fuels,
    elevations: profile.elevations, winds, inicio, fin, asset_id: asset.asset_id,
    source_versions: { ...asset.manifest, elevation_source: profile.source,
      elevation_fallback: profile.fallback, elevation_error: profile.source_error ?? null,
      wind_error: windError,
      fuel_mode: manual ? 'manual' : 'automatico',
      slope_mode: pendienteManual === null ? 'automatico' : 'manual',
      wind_mode: vientoManual === null ? 'automatico' : 'manual',
      wind_source: vientoManual ? 'viento manual homogéneo' :
        winds.some(w => w.status !== 'ok') ? 'Open-Meteo parcial o no disponible' :
          'Open-Meteo pronóstico horario 10 m' },
    created_at: now.toISOString() });
  if (output.scenarios[0].rows.some(row => row.nodata_flags.wind) && !vientoManual) {
    output.source_versions.wind_source = 'Open-Meteo parcial o fuera del horizonte; FV = 3 en horas sin dato';
  }
  return { ...output, profile_source: profile.source, profile_fallback: profile.fallback,
    intervals: overlay.intervals.map(i => ({ from_m: i.from_m, to_m: i.to_m,
      sigpac_ids: i.sigpac.map(f => f.id), mfe_ids: i.mfe.map(f => f.id) })) };
}

export async function ejecutarRc1Automatico(inicio, fin, {
  apiBase = '', signal, fetcher = fetch, now = new Date(),
  pendienteManual = null, vientoManual = null, combustibleManual = null
} = {}) {
  let asset;
  if (combustibleManual !== null) {
    if (!['pastos', 'quercus', 'matorral', 'pinar'].includes(combustibleManual)) {
      throw new RangeError('Combustible manual no válido');
    }
    const pad = 0.000001;
    asset = { asset_id: 'manual-uniforme',
      bbox: [Math.min(inicio.lon, fin.lon) - pad, Math.min(inicio.lat, fin.lat) - pad,
        Math.max(inicio.lon, fin.lon) + pad, Math.max(inicio.lat, fin.lat) + pad],
      sigpac: [], mfe: [], manifest: { fuel_source: 'combustible manual homogéneo',
        ruleset: 'vpif-rc1-provisional-1', mfe_count: 0, sigpac_count: 0 } };
  } else {
    asset = await obtenerAssetPorPartes(inicio, fin, apiBase, fetcher, signal);
  }
  try {
    await completarUsosPublicos(asset, apiBase, fetcher, signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    asset.sigpac.forEach(feature => { feature.properties.uso = null; });
    asset.manifest.fuel_source = 'SIGPAC sin usos disponibles; cálculo prudente';
    asset.manifest.usos_error = error.message || String(error);
  }
  return ejecutarRc1(inicio, fin, asset, { workerUrl: `${apiBase}/api/rc1`,
    permitirFallbackOpenMeteo: true, pendienteManual, vientoManual,
    manual: combustibleManual,
    signal, fetcher, now });
}
