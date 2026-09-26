"""Piloto interno RC1 desde recintos OGC SIGPAC y MFE25 local.

Uso: python build_rc1_pilot.py recintos.geojson MFE_43.shp salida.json xmin ymin xmax ymax
La salida NO es un asset publicable: requiere revisión de licencia MFE25 y
pruebas de simplificación/topología antes de PMTiles.
"""
import hashlib
import gzip
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from osgeo import ogr, osr

ogr.UseExceptions()

ATTRS = ('DesTipEstr', 'FormArbol', 'FormArbust', 'FormHerbac', 'Especie1',
         'FCCARB', 'FCCMAT', 'FCCHER', 'UsoMFE', 'n_MODCOM')
REF = ('provincia', 'municipio', 'agregado', 'zona', 'poligono', 'parcela', 'recinto')


def digest(path):
    h = hashlib.sha256()
    with open(path, 'rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def reference(obj):
    return tuple(int(obj.get(key, -1)) for key in REF)


def bbox_geometry(bounds):
    x0, y0, x1, y1 = bounds
    return ogr.CreateGeometryFromWkt(
        f'POLYGON(({x0} {y0},{x1} {y0},{x1} {y1},{x0} {y1},{x0} {y0}))')


def sigpac_with_use(feature, clip):
    geometry = ogr.CreateGeometryFromJson(json.dumps(feature['geometry']))
    pt = geometry.PointOnSurface()
    url = ('https://sigpac-hubcloud.es/servicioconsultassigpac/query/'
           f'recinfobypoint/4258/{pt.GetX()}/{pt.GetY()}.json')
    with urllib.request.urlopen(url, timeout=15) as response:
        raw = response.read()
        data = json.loads(gzip.decompress(raw) if raw[:2] == b'\x1f\x8b' else raw)
    matches = [r for r in data if reference(r) == reference(feature['properties'])]
    code = matches[0].get('uso_sigpac') if len(matches) == 1 else None
    clipped = geometry.Intersection(clip)
    return {'type': 'Feature', 'id': feature['id'], 'geometry': json.loads(clipped.ExportToJson()),
            'properties': {'feature_id': feature['id'], 'uso': code,
                           'source': 'SIGPAC FEGA OGC + consulta punto',
                           'lookup_status': 'matched' if code else 'unmatched'}}


def mfe_features(path, source_bbox):
    ds = ogr.Open(str(path))
    layer = ds.GetLayer()
    wgs84 = osr.SpatialReference()
    wgs84.ImportFromEPSG(4326)
    wgs84.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    source_srs = layer.GetSpatialRef()
    source_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    to_source = osr.CoordinateTransformation(wgs84, source_srs)
    to_wgs84 = osr.CoordinateTransformation(source_srs, wgs84)
    clip = bbox_geometry(source_bbox)
    bbox = clip.Clone()
    bbox.Transform(to_source)
    layer.SetSpatialFilter(bbox)
    result = []
    for feature in layer:
        geom = feature.GetGeometryRef().Clone()
        if not geom.IsValid():
            geom = geom.MakeValid()
        if geom is None or geom.IsEmpty():
            continue
        geom.Transform(to_wgs84)
        geom = geom.Intersection(clip)
        if geom is None or geom.IsEmpty():
            continue
        properties = {name: feature.GetField(name) for name in ATTRS}
        properties.update(feature_id=feature.GetFID(), source='MFE25 MITECO')
        result.append({'type': 'Feature', 'id': feature.GetFID(),
                       'geometry': json.loads(geom.ExportToJson()),
                       'properties': properties})
    return result


def main():
    if len(sys.argv) != 8:
        raise SystemExit(__doc__)
    sigpac_path, mfe_path, output_path = map(Path, sys.argv[1:4])
    source = json.loads(sigpac_path.read_text(encoding='utf-8-sig'))
    features = source.get('features')
    if not isinstance(features, list) or not features:
        raise ValueError('SIGPAC sin features')
    source_bbox = list(map(float, sys.argv[4:8]))
    if not (source_bbox[0] < source_bbox[2] and source_bbox[1] < source_bbox[3]):
        raise ValueError('bbox inválido')
    clip = bbox_geometry(source_bbox)
    recintos = [sigpac_with_use(f, clip) for f in features]
    if any(f['properties']['uso'] is None for f in recintos):
        raise ValueError('Recinto sin uso SIGPAC: piloto incompleto')
    mfe = mfe_features(mfe_path, source_bbox)
    output = {'asset_id': 'rc1-internal-pilot-2026-09-26', 'bbox': source_bbox,
              'sigpac': recintos, 'mfe': mfe,
              'manifest': {'created_at': datetime.now(timezone.utc).isoformat(),
                           'sigpac_source_sha256': digest(sigpac_path),
                           'mfe_shp_sha256': digest(mfe_path),
                           'sigpac_license': 'CC BY 4.0; atribución FEGA/SIGPAC',
                           'mfe_license': 'redistribución sin confirmar; uso interno',
                           'ruleset': 'vpif-rc1-provisional-1',
                           'geometry': 'GeoJSON WGS84, piloto; no PMTiles',
                           'sigpac_count': len(recintos), 'mfe_count': len(mfe)}}
    output_path.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')),
                           encoding='utf-8')
    print(json.dumps({'path': str(output_path), 'bytes': output_path.stat().st_size,
                      'sigpac_count': len(recintos), 'mfe_count': len(mfe)},
                     ensure_ascii=False))


if __name__ == '__main__':
    main()
