"""Servidor local de la web con datos RC1 obtenidos al calcular.

Requiere el Python del entorno alerta-gis (osgeo). Uso interno; escucha solo
127.0.0.1 y nunca publica el MFE25 ni los recintos SIGPAC como asset estático.
"""
import gzip
import json
import math
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from osgeo import ogr
from build_rc1_pilot import bbox_geometry, mfe_features, sigpac_with_use

ROOT = Path(__file__).resolve().parents[1]
MFE_PATH = Path(os.environ.get('ALERTA_MFE_SHP',
    r'C:\Users\marco\Documents\Alerta Fuego\tmp-mfe-extremadura-audit\MFE_43.shp'))
SIGPAC_ITEMS = 'https://sigpac-hubcloud.es/ogcapi/collections/recintos/items'
IGN_WCS = 'https://servicios.idee.es/wcs-inspire/mdt'
ASSET_CACHE = {}


def get_json(url, timeout=20):
    request = urllib.request.Request(url, headers={'User-Agent': 'AlertaFuego-RC1-local/1.0'})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read(12_000_001)
    if len(raw) > 12_000_000:
        raise ValueError('respuesta SIGPAC demasiado grande')
    return json.loads(gzip.decompress(raw) if raw[:2] == b'\x1f\x8b' else raw)


def distancia_m(a, b):
    dy = (b['lat'] - a['lat']) * 111195
    dx = (b['lon'] - a['lon']) * 111195 * math.cos(math.radians((a['lat'] + b['lat']) / 2))
    return math.hypot(dx, dy)


def punto(lat, lon):
    lat, lon = float(lat), float(lon)
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError('coordenadas fuera de rango')
    return {'lat': lat, 'lon': lon}


def corredor(a, b):
    length = distancia_m(a, b)
    if not 0 < length <= 5000:
        raise ValueError('corredor RC1: distancia entre 0 y 5 km')
    line = ogr.CreateGeometryFromWkt(
        f"LINESTRING({a['lon']} {a['lat']},{b['lon']} {b['lat']})")
    mid_lat = (a['lat'] + b['lat']) / 2
    pad = 35 / (111195 * max(.2, math.cos(math.radians(mid_lat))))
    clip = line.Buffer(pad)
    bbox = list(clip.GetEnvelope())
    return clip, [bbox[0], bbox[2], bbox[1], bbox[3]]


def sigpac_features(clip, bbox):
    query = urllib.parse.urlencode({'f': 'json', 'bbox': ','.join(map(str, bbox)), 'limit': 1000})
    url = f'{SIGPAC_ITEMS}?{query}'
    relevant = {}
    for _ in range(6):
        data = get_json(url)
        features = data.get('features', [])
        for feature in features:
            geom = ogr.CreateGeometryFromJson(json.dumps(feature.get('geometry')))
            if geom is None or geom.IsEmpty() or not geom.Intersects(clip):
                continue
            key = str(feature.get('id'))
            relevant[key] = feature
        next_url = next((item.get('href') for item in data.get('links', [])
                         if item.get('rel') == 'next'), None)
        if not next_url:
            break
        url = urllib.parse.urljoin(url, next_url)
    else:
        raise ValueError('demasiados recintos SIGPAC para este corredor; acorta la distancia')
    out = []
    for feature in relevant.values():
        try:
            out.append(sigpac_with_use(feature, clip))
        except Exception:
            geom = ogr.CreateGeometryFromJson(json.dumps(feature['geometry'])).Intersection(clip)
            out.append({'type': 'Feature', 'id': feature.get('id'),
                        'geometry': json.loads(geom.ExportToJson()),
                        'properties': {'feature_id': feature.get('id'), 'uso': None,
                                       'source': 'SIGPAC FEGA OGC', 'lookup_status': 'failed'}})
    return out


def asset(a, b):
    key = tuple(round(p[k], 6) for p in (a, b) for k in ('lat', 'lon'))
    if key in ASSET_CACHE:
        return ASSET_CACHE[key]
    clip, bbox = corredor(a, b)
    sigpac = sigpac_features(clip, bbox)
    mfe = []
    if MFE_PATH.is_file():
        for feature in mfe_features(MFE_PATH, bbox):
            geom = ogr.CreateGeometryFromJson(json.dumps(feature['geometry']))
            if geom is None or not geom.Intersects(clip):
                continue
            clipped = geom.Intersection(clip)
            if clipped is None or clipped.IsEmpty():
                continue
            feature['geometry'] = json.loads(clipped.ExportToJson())
            mfe.append(feature)
    result = {'asset_id': 'rc1-local-' + '-'.join(map(str, key)), 'bbox': bbox,
              'sigpac': sigpac, 'mfe': mfe,
              'manifest': {'created_at': datetime.now(timezone.utc).isoformat(),
                           'sigpac_source': 'FEGA SIGPAC OGC + consulta de uso por recinto',
                           'mfe_source': str(MFE_PATH) if MFE_PATH.is_file() else 'no disponible',
                           'mfe_license': 'uso interno; redistribución pendiente de revisión',
                           'ruleset': 'vpif-rc1-provisional-1',
                           'sigpac_count': len(sigpac), 'mfe_count': len(mfe)}}
    if len(ASSET_CACHE) >= 16:
        ASSET_CACHE.pop(next(iter(ASSET_CACHE)))
    ASSET_CACHE[key] = result
    return result


def parse_arcgrid(body, points):
    lines = body.strip().splitlines()
    header = {}
    index = 0
    while index < len(lines):
        parts = lines[index].split()
        if len(parts) != 2 or not parts[0].replace('_', '').isalpha():
            break
        header[parts[0].lower()] = float(parts[1])
        index += 1
    cols, rows = int(header['ncols']), int(header['nrows'])
    dx = header.get('dx', header.get('cellsize'))
    dy = header.get('dy', header.get('cellsize'))
    x0 = header.get('xllcorner', header.get('xllcenter', 0) - dx / 2)
    y0 = header.get('yllcorner', header.get('yllcenter', 0) - dy / 2)
    matrix = [list(map(float, line.split())) for line in lines[index:]]
    if not (0 < cols <= 512 and 0 < rows <= 512 and len(matrix) == rows
            and all(len(row) == cols for row in matrix)):
        raise ValueError('perfil ArcGrid incompleto')
    values = []
    for p in points:
        col = math.floor((p['lon'] - x0) / dx)
        row = rows - 1 - math.floor((p['lat'] - y0) / dy)
        z = matrix[row][col] if 0 <= row < rows and 0 <= col < cols else None
        values.append(z if z is not None and math.isfinite(z)
                      and z != header.get('nodata_value') and z > -999 else None)
    return values


def perfil(points):
    if not 2 <= len(points) <= 256:
        raise ValueError('perfil fuera de límites')
    points = [punto(p['lat'], p['lon']) for p in points]
    values = [None] * len(points)
    start = 0
    windows = []
    for i in range(1, len(points)):
        if distancia_m(points[start], points[i]) > 750:
            windows.append((start, i))
            start = i
    windows.append((start, len(points) - 1))
    for start, end in windows:
        sub = points[start:end + 1]
        mid = sum(p['lat'] for p in sub) / len(sub)
        pad_lat = 10 / 111195
        pad_lon = 10 / (111195 * math.cos(math.radians(mid)))
        x0 = min(p['lon'] for p in sub) - pad_lon
        x1 = max(p['lon'] for p in sub) + pad_lon
        y0 = min(p['lat'] for p in sub) - pad_lat
        y1 = max(p['lat'] for p in sub) + pad_lat
        step = 5 / 111195
        width = max(3, math.ceil((x1 - x0) / step))
        height = max(3, math.ceil((y1 - y0) / step))
        if width > 512 or height > 512 or width * height > 100000:
            raise ValueError('ventana de perfil demasiado grande')
        params = urllib.parse.urlencode({'service': 'WCS', 'version': '1.0.0',
            'request': 'GetCoverage', 'coverage': 'Elevacion4258_5', 'crs': 'EPSG:4258',
            'bbox': ','.join(map(str, (x0, y0, x1, y1))), 'width': width,
            'height': height, 'interpolationMethod': 'bilinear', 'format': 'ArcGrid'})
        with urllib.request.urlopen(f'{IGN_WCS}?{params}', timeout=20) as response:
            raw = response.read(2_000_001)
        if len(raw) > 2_000_000:
            raise ValueError('respuesta IGN demasiado grande')
        body = raw.decode('utf-8', errors='replace')
        if 'ServiceException' in body or '<?xml' in body:
            raise ValueError('IGN devolvió un error de servicio')
        values[start:end + 1] = parse_arcgrid(body, sub)
    return {'elevaciones': values, 'fuente': 'IGN MDT05 WCS',
            'nodata': [z is None for z in values]}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_json(self, data, status=200):
        raw = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path != '/api/rc1/asset':
            return super().do_GET()
        try:
            q = urllib.parse.parse_qs(parsed.query)
            a = punto(q['lat0'][0], q['lon0'][0])
            b = punto(q['lat1'][0], q['lon1'][0])
            self.send_json(asset(a, b))
        except (KeyError, ValueError, TypeError) as exc:
            self.send_json({'error': str(exc)}, 400)
        except Exception as exc:
            self.send_json({'error': f'No se pudo consultar el terreno: {exc}'}, 502)

    def do_POST(self):
        if urllib.parse.urlparse(self.path).path != '/api/rc1/perfil':
            return self.send_json({'error': 'ruta no encontrada'}, 404)
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0 or length > 50_000:
                raise ValueError('petición de perfil fuera de límites')
            data = json.loads(self.rfile.read(length))
            self.send_json(perfil(data['puntos']))
        except (KeyError, ValueError, TypeError) as exc:
            self.send_json({'error': str(exc)}, 400)
        except Exception as exc:
            self.send_json({'error': f'Perfil IGN no disponible: {exc}'}, 502)


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    print(f'Alerta Fuego RC1: http://127.0.0.1:{port}/index.html', flush=True)
    ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
