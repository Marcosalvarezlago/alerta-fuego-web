// Datos SIGPAC para la versión pública. No redistribuye el MFE25 local.
const OGC = 'https://sigpac-hubcloud.es/ogcapi/collections/recintos/items';
const PARCEL = 'https://sigpac-hubcloud.es/servicioconsultassigpac/query/recinfoparc';
const REF = ['provincia', 'municipio', 'agregado', 'zona', 'poligono', 'parcela', 'recinto'];

function distanciaM(a, b) {
  return Math.hypot((b.lat - a.lat) * 111195,
    (b.lon - a.lon) * 111195 * Math.cos((a.lat + b.lat) * Math.PI / 360));
}

function validPoint(p) {
  return p && Number.isFinite(p.lat) && Number.isFinite(p.lon) &&
    p.lat >= -90 && p.lat <= 90 && p.lon >= -180 && p.lon <= 180;
}

function refOf(properties) {
  const ref = REF.map(key => Number(properties?.[key]));
  return ref.every(x => Number.isInteger(x) && x >= 0 && x <= 1_000_000_000) ? ref : null;
}

async function jsonLimitado(url, fetcher, maxBytes, timeoutMs = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { signal: ctrl.signal });
    if (!response.ok) throw new Error(`SIGPAC HTTP ${response.status}`);
    const length = Number(response.headers.get('content-length'));
    if (length > maxBytes) throw new Error('SIGPAC: respuesta demasiado grande');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('SIGPAC: respuesta vacía');
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error('SIGPAC: respuesta demasiado grande');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally {
    clearTimeout(timer);
  }
}

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

function tiles(a, b, distance) {
  const count = Math.max(1, Math.ceil(distance / 400));
  return Array.from({ length: count }, (_, i) => {
    const t0 = i / count, t1 = (i + 1) / count;
    const p0 = { lat: a.lat + (b.lat - a.lat) * t0, lon: a.lon + (b.lon - a.lon) * t0 };
    const p1 = { lat: a.lat + (b.lat - a.lat) * t1, lon: a.lon + (b.lon - a.lon) * t1 };
    const mid = (p0.lat + p1.lat) / 2;
    const padLat = 35 / 111195;
    const padLon = 35 / (111195 * Math.max(.2, Math.cos(mid * Math.PI / 180)));
    return [Math.min(p0.lon, p1.lon) - padLon, Math.min(p0.lat, p1.lat) - padLat,
      Math.max(p0.lon, p1.lon) + padLon, Math.max(p0.lat, p1.lat) + padLat];
  });
}

export async function obtenerAssetPublico(a, b, fetcher = fetch) {
  if (!validPoint(a) || !validPoint(b)) throw new RangeError('coordenadas inválidas');
  const distance = distanciaM(a, b);
  if (!(distance > 0 && distance <= 5000)) throw new RangeError('corredor RC1: máximo 5 km');
  const boxes = tiles(a, b, distance);
  const pages = await mapLimit(boxes, 5, async bbox => {
    let url = `${OGC}?f=json&bbox=${bbox.join(',')}&limit=1000`;
    const features = [];
    for (let page = 0; page < 3; page++) {
      const data = await jsonLimitado(url, fetcher, 5_000_000);
      if (!Array.isArray(data.features)) throw new Error('SIGPAC: GeoJSON inválido');
      features.push(...data.features);
      const href = data.links?.find(link => link.rel === 'next')?.href;
      if (!href) return features;
      const next = new URL(href, url);
      if (next.origin !== 'https://sigpac-hubcloud.es' ||
          next.pathname !== '/ogcapi/collections/recintos/items') {
        throw new Error('SIGPAC: paginación inválida');
      }
      url = next.href;
    }
    throw new Error('SIGPAC: demasiados recintos; acorta el corredor');
  });
  const unique = new Map();
  for (const feature of pages.flat()) {
    const ref = refOf(feature.properties);
    if (!ref || !feature.geometry || feature.id == null) continue;
    unique.set(String(feature.id), { type: 'Feature', id: feature.id,
      geometry: feature.geometry,
      properties: { feature_id: feature.id, ref, uso: null, source: 'SIGPAC FEGA OGC',
        lookup_status: 'pending' } });
  }
  if (unique.size > 500) throw new Error('SIGPAC: demasiados recintos; acorta el corredor');
  return { asset_id: 'rc1-public-' + Date.now(),
    bbox: [Math.min(...boxes.map(x => x[0])), Math.min(...boxes.map(x => x[1])),
      Math.max(...boxes.map(x => x[2])), Math.max(...boxes.map(x => x[3]))],
    sigpac: [...unique.values()], mfe: [], lookup_required: true,
    manifest: { fuel_source: 'SIGPAC FEGA OGC', sigpac_count: unique.size, mfe_count: 0,
      mfe_source: 'no disponible en la versión pública', ruleset: 'vpif-rc1-provisional-1' } };
}

export async function obtenerUsosPublicos(parcels, fetcher = fetch) {
  if (!Array.isArray(parcels) || parcels.length < 1 || parcels.length > 20 ||
      parcels.some(p => !Array.isArray(p.key) || p.key.length !== 6 ||
        p.key.some(x => !Number.isInteger(x) || x < 0 || x > 1_000_000_000) ||
        !Array.isArray(p.recintos) || p.recintos.length < 1 || p.recintos.length > 50 ||
        p.recintos.some(x => !Number.isInteger(x) || x < 0 || x > 1_000_000_000))) {
    throw new RangeError('parcelas inválidas');
  }
  return mapLimit(parcels, 5, async parcel => {
    const url = `${PARCEL}/${parcel.key.join('/')}.json`;
    const records = await jsonLimitado(url, fetcher, 1_500_000);
    if (!Array.isArray(records)) throw new Error('SIGPAC: parcela inválida');
    const wanted = new Set(parcel.recintos);
    return { key: parcel.key, uses: records.filter(record => {
      const ref = refOf(record);
      return ref && ref.slice(0, 6).every((x, i) => x === parcel.key[i]) && wanted.has(ref[6]);
    }).map(record => ({ recinto: Number(record.recinto), uso: record.uso_sigpac })) };
  });
}
