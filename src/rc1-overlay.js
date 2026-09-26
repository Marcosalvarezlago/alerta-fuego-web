import { segmentarCorredor, puntoGeodesico } from './rc1-geometry.js';

function rings(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

function dentroAnillo(point, ring) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    const cross = (x - xi) * (yj - yi) - (y - yi) * (xj - xi);
    const projection = (x - xi) * (xj - xi) + (y - yi) * (yj - yi);
    const length2 = (xj - xi) ** 2 + (yj - yi) ** 2;
    if (length2 > 0 && Math.abs(cross) < 1e-11 && projection >= -1e-11 && projection <= length2 + 1e-11) return true;
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function puntoEnGeometria(point, geometry) {
  return rings(geometry).some(polygon => dentroAnillo(point, polygon[0]) &&
    !polygon.slice(1).some(hole => dentroAnillo(point, hole)));
}

function parametrosCorte(a, b, geometry) {
  const out = [];
  const rx = b[0] - a[0], ry = b[1] - a[1];
  for (const polygon of rings(geometry)) for (const ring of polygon) {
    for (let i = 1; i < ring.length; i++) {
      const c = ring[i - 1], d = ring[i];
      const sx = d[0] - c[0], sy = d[1] - c[1];
      const denominator = rx * sy - ry * sx;
      const qx = c[0] - a[0], qy = c[1] - a[1];
      if (Math.abs(denominator) < 1e-15) continue;
      const t = (qx * sy - qy * sx) / denominator;
      const u = (qx * ry - qy * rx) / denominator;
      if (t > 0 && t < 1 && u >= 0 && u <= 1) out.push(t);
    }
  }
  return out;
}

export function unidadesCorredor(inicio, fin, sigpacFeatures, mfeFeatures, maxM = 30) {
  const preliminary = segmentarCorredor(inicio, fin, [], maxM);
  // Densificar la geodésica para intersección estable con geometrías WGS84.
  const points = preliminary.segments.map(s => s.start_lonlat).concat([fin]);
  const chainages = preliminary.segments.map(s => s.chainage_start_m).concat([preliminary.distance_m]);
  const features = [...sigpacFeatures, ...mfeFeatures];
  const cuts = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = [points[i].lon, points[i].lat], b = [points[i + 1].lon, points[i + 1].lat];
    for (const feature of features) {
      for (const t of parametrosCorte(a, b, feature.geometry)) {
        cuts.push(chainages[i] + t * (chainages[i + 1] - chainages[i]));
      }
    }
  }
  const corridor = segmentarCorredor(inicio, fin, cuts, maxM);
  const intervals = corridor.cuts_m.slice(0, -1).map((start, i) => {
    const end = corridor.cuts_m[i + 1];
    const mid = puntoGeodesico(inicio, fin, (start + end) / (2 * corridor.distance_m));
    const pt = [mid.lon, mid.lat];
    const covering = list => list.filter(f => puntoEnGeometria(pt, f.geometry))
      .sort((a, b) => String(a.id ?? '').localeCompare(String(b.id ?? '')));
    return { from_m: start, to_m: end, sigpac: covering(sigpacFeatures), mfe: covering(mfeFeatures) };
  });
  return { ...corridor, intervals };
}
