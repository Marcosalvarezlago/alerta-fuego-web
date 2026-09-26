import { unidadesCorredor } from './rc1-overlay.js';
import { resolverCombustible } from './rc1-fuel.js?v=integrada-2';
import { calcularRc1 } from './rc1-engine.js';
import { obtenerPerfil, obtenerEscenariosViento } from './rc1-providers.js?v=integrada-2';
import { agregarVientoHorario, horasEscenario } from './rc1-engine.js';
const COMBUSTIBLE_CULTIVO = new Set(['OV', 'VI', 'FY', 'FS', 'CI']);
const DOMINIO_COMBUSTIBLE = new Set(['FO', 'MT', 'PR', 'PA', 'PS', ...COMBUSTIBLE_CULTIVO]);

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
    results = await Promise.all(batches.map(async batch => {
      const response = await fetcher(`${apiBase}/api/rc1/usos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parcels: batch }), signal: ctrl.signal
      });
      if (!response.ok) throw new Error(`SIGPAC no pudo completar los usos (HTTP ${response.status})`);
      const data = await response.json();
      if (!Array.isArray(data.parcels)) throw new Error('SIGPAC devolvió usos incompletos');
      return data.parcels;
    }));
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
    const params = new URLSearchParams({ lat0: inicio.lat, lon0: inicio.lon,
      lat1: fin.lat, lon1: fin.lon });
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetcher(`${apiBase}/api/rc1/asset?${params}`, { signal: controller.signal });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.error || `No se pudo identificar el terreno (HTTP ${response.status})`);
      }
      asset = await response.json();
    } catch (error) {
      if (controller.signal.aborted && !signal?.aborted) {
        throw new Error('SIGPAC tarda demasiado. Reintenta o usa combustible manual.');
      }
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
  await completarUsosPublicos(asset, apiBase, fetcher, signal);
  return ejecutarRc1(inicio, fin, asset, { workerUrl: `${apiBase}/api/rc1`,
    permitirFallbackOpenMeteo: true, pendienteManual, vientoManual,
    manual: combustibleManual,
    signal, fetcher, now });
}
