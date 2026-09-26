import { calcularDistanciaM } from './core.js';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const R = 6371000;

export function puntoGeodesico(inicio, fin, fraccion) {
  if (fraccion <= 0) return { ...inicio };
  if (fraccion >= 1) return { ...fin };
  const vector = ({ lat, lon }) => [
    Math.cos(lat * RAD) * Math.cos(lon * RAD),
    Math.cos(lat * RAD) * Math.sin(lon * RAD),
    Math.sin(lat * RAD)
  ];
  const a = vector(inicio), b = vector(fin);
  const angulo = Math.acos(Math.max(-1, Math.min(1, a.reduce((s, v, i) => s + v * b[i], 0))));
  if (angulo < 1e-12) return { ...inicio };
  const x = Math.sin((1 - fraccion) * angulo) / Math.sin(angulo);
  const y = Math.sin(fraccion * angulo) / Math.sin(angulo);
  const v = a.map((n, i) => x * n + y * b[i]);
  return { lat: Math.atan2(v[2], Math.hypot(v[0], v[1])) * DEG,
    lon: Math.atan2(v[1], v[0]) * DEG };
}

export function segmentarCorredor(inicio, fin, cortesTematicosM = [], maxM = 30) {
  if (![inicio?.lat, inicio?.lon, fin?.lat, fin?.lon, maxM].every(Number.isFinite) || maxM <= 0) {
    throw new TypeError('Corredor inválido');
  }
  const totalM = calcularDistanciaM(inicio.lat, inicio.lon, fin.lat, fin.lon);
  if (!(totalM > 0) || totalM > Math.PI * R - 1) throw new RangeError('Corredor inválido o antipodal');
  const cortes = [0, ...cortesTematicosM.filter(x => Number.isFinite(x) && x > 0 && x < totalM), totalM]
    .sort((a, b) => a - b)
    .filter((x, i, a) => i === 0 || x - a[i - 1] > 1e-6);
  const segmentos = [];
  for (let j = 0; j < cortes.length - 1; j++) {
    const a = cortes[j], b = cortes[j + 1];
    const n = Math.ceil((b - a) / maxM - 1e-10);
    for (let k = 0; k < n; k++) {
      const desdeM = a + k * maxM;
      const hastaM = k === n - 1 ? b : a + (k + 1) * maxM;
      segmentos.push({ segment_id: `s${segmentos.length + 1}`, chainage_start_m: desdeM,
        chainage_end_m: hastaM, distance_m: hastaM - desdeM,
        start_lonlat: puntoGeodesico(inicio, fin, desdeM / totalM),
        end_lonlat: puntoGeodesico(inicio, fin, hastaM / totalM),
        thematic_interval: j });
    }
  }
  return { distance_m: totalM, cuts_m: cortes, segments: segmentos };
}
