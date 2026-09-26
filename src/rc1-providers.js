import { agregarVientoHorario, horasEscenario } from './rc1-engine.js';

async function jsonConTimeout(url, options = {}, fetcher = fetch, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const external = options.signal;
  const abort = () => controller.abort();
  external?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetcher(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
    external?.removeEventListener('abort', abort);
  }
}

export async function obtenerPerfil(puntos, { workerUrl, signal, fetcher = fetch,
  permitirFallbackOpenMeteo = false } = {}) {
  if (!Array.isArray(puntos) || puntos.length < 2 || puntos.length > 256) throw new RangeError('perfil fuera de límites');
  if (workerUrl) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await jsonConTimeout(`${workerUrl.replace(/\/$/, '')}/perfil`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ puntos }), signal
        }, fetcher, 20000);
        if (!Array.isArray(response.elevaciones) || response.elevaciones.length !== puntos.length) {
          throw new Error('perfil inválido');
        }
        return { elevations: response.elevaciones.map(x => Number.isFinite(x) ? x : null),
          source: workerUrl.startsWith('http://127.0.0.1') || workerUrl.startsWith('http://localhost')
            ? 'IGN MDT05 WCS, servidor local' : 'IGN MDT05 WCS, servicio web', fallback: null };
      } catch (error) {
        if (signal?.aborted) throw error;
        if (attempt === 1 && !permitirFallbackOpenMeteo) throw error;
      }
    }
  }
  if (!permitirFallbackOpenMeteo) throw new Error('Perfil MDT05 no disponible');
  const elevations = [];
  for (let i = 0; i < puntos.length; i += 100) {
    const batch = puntos.slice(i, i + 100);
    const url = 'https://api.open-meteo.com/v1/elevation?latitude=' +
      batch.map(p => p.lat).join(',') + '&longitude=' + batch.map(p => p.lon).join(',');
    const response = await jsonConTimeout(url, { signal }, fetcher);
    if (!Array.isArray(response.elevation) || response.elevation.length !== batch.length) throw new Error('Open-Meteo elevation inválido');
    elevations.push(...response.elevation.map(x => Number.isFinite(x) ? x : null));
  }
  return { elevations, source: 'Open-Meteo Elevation / GLO-90', fallback: 'open_meteo_elevation_explicit' };
}

export function puntosViento(inicio, fin, distanceM) {
  const n = Math.min(6, Math.floor(distanceM / 5000));
  return Array.from({ length: n + 2 }, (_, i) => ({
    lat: inicio.lat + (fin.lat - inicio.lat) * i / (n + 1),
    lon: inicio.lon + (fin.lon - inicio.lon) * i / (n + 1)
  }));
}

export async function obtenerEscenariosViento(inicio, fin, distanceM,
  { signal, fetcher = fetch, now = new Date() } = {}) {
  const points = puntosViento(inicio, fin, distanceM);
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + points.map(p => p.lat).join(',') +
    '&longitude=' + points.map(p => p.lon).join(',') +
    '&hourly=wind_speed_10m,wind_direction_10m&forecast_days=2&timezone=UTC&wind_speed_unit=kmh';
  const response = await jsonConTimeout(url, { signal }, fetcher);
  const forecasts = Array.isArray(response) ? response : [response];
  if (forecasts.length !== points.length) throw new Error('Open-Meteo: número de puntos incoherente');
  return horasEscenario(now).map(hour => {
    const observations = forecasts.map((f, i) => {
      const index = f.hourly?.time?.indexOf(hour);
      return { lat: points[i].lat, lon: points[i].lon, horaUtc: hour,
        velocidadKmh: index >= 0 ? f.hourly?.wind_speed_10m?.[index] : null,
        direccionDesdeGrados: index >= 0 ? f.hourly?.wind_direction_10m?.[index] : null };
    });
    return agregarVientoHorario(observations, hour);
  });
}
