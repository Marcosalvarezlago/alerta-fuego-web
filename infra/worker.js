// =============================================================
// Alerta Fuego — servicio intermedio (Cloudflare Worker)
//
// Endpoints públicos:
//   GET /resolver?url=https://maps.app.goo.gl/XXXX
//   GET /elevaciones?lats=LAT1,LAT2&lons=LON1,LON2
//   GET /sigpac?lat=LAT&lon=LON
//   POST /perfil  {puntos:[{lat,lon}, ...]} — MDT05 por ventanas WCS
//   GET /api/rc1/asset — geometrías SIGPAC para el corredor público
//   POST /api/rc1/usos — usos SIGPAC agrupados por parcela
//
// /resolver valida la URL inicial, cada redirección y la URL final
// para impedir que el Worker se convierta en un proxy abierto.
// =============================================================

import { obtenerAssetPublico, obtenerUsosPublicos } from './rc1-public-data.js';

const HOSTS_MAPS_CON_RUTA = new Set([
  "www.google.com",
  "www.google.es"
]);

const HOSTS_MAPS_DEDICADOS = new Set([
  "maps.google.com",
  "maps.google.es"
]);

const MAX_REDIRECCIONES = 5;

const WCS_IGN = "https://servicios.idee.es/wcs-inspire/mdt";
const COBERTURA_IGN = "Elevacion4258_5"; // MDT 5 m en lat/lon (EPSG:4258)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(objeto, status = 200, cabeceras = {}) {
  return new Response(JSON.stringify(objeto), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", ...cabeceras }
  });
}

export async function fetchConTiempo(url, opciones = {}, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opciones, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function urlSinCredencialesNiPuerto(url) {
  return url.protocol === "https:" && !url.username && !url.password && !url.port;
}

function rutaMaps(pathname) {
  return pathname === "/maps" || pathname.startsWith("/maps/");
}

function urlDesde(valor, base) {
  try {
    return base ? new URL(valor, base) : new URL(valor);
  } catch {
    return null;
  }
}

/**
 * Clasifica exclusivamente URLs que el resolutor puede consultar.
 * La página /sorry de Google solo se admite cuando contiene un destino
 * `continue` que, por sí mismo, vuelve a ser una URL válida de Maps.
 */
function tipoUrlDirectaGoogleMaps(url) {
  const host = url.hostname.toLowerCase();

  if (host === "maps.app.goo.gl") {
    return url.pathname !== "/" ? "corta" : null;
  }

  if (host === "goo.gl") {
    return rutaMaps(url.pathname) ? "corta" : null;
  }

  if (HOSTS_MAPS_DEDICADOS.has(host)) {
    return "maps";
  }

  if (!HOSTS_MAPS_CON_RUTA.has(host)) return null;
  if (rutaMaps(url.pathname)) return "maps";

  return null;
}

export function tipoUrlGoogleMaps(valor) {
  const url = valor instanceof URL ? valor : urlDesde(valor);
  if (!url || !urlSinCredencialesNiPuerto(url)) return null;

  const tipoDirecto = tipoUrlDirectaGoogleMaps(url);
  if (tipoDirecto) return tipoDirecto;

  const host = url.hostname.toLowerCase();
  if (!HOSTS_MAPS_CON_RUTA.has(host)) return null;

  if (url.pathname === "/sorry" || url.pathname.startsWith("/sorry/")) {
    const continuar = url.searchParams.get("continue");
    const urlContinuar = continuar ? urlDesde(continuar) : null;
    const tipoContinuar = urlContinuar && urlSinCredencialesNiPuerto(urlContinuar)
      ? tipoUrlDirectaGoogleMaps(urlContinuar)
      : null;
    return tipoContinuar === "maps" ? "verificacion" : null;
  }

  return null;
}

export function esUrlGoogleMapsPermitida(valor) {
  return tipoUrlGoogleMaps(valor) !== null;
}

function destinoDeVerificacion(url) {
  if (tipoUrlGoogleMaps(url) !== "verificacion") return null;
  const destino = urlDesde(url.searchParams.get("continue"));
  return tipoUrlGoogleMaps(destino) === "maps" ? destino : null;
}

/**
 * Sigue redirecciones manualmente para poder validar todos los destinos.
 * `fetcher` se inyecta en pruebas; debe aceptar (url, opciones).
 */
export async function resolverUrlGoogleMaps(
  destino,
  fetcher = fetchConTiempo,
  maxRedirecciones = MAX_REDIRECCIONES
) {
  let actual = urlDesde(destino);
  if (!actual || !esUrlGoogleMapsPermitida(actual)) {
    throw new Error("URL de Google Maps no permitida");
  }

  if (!Number.isInteger(maxRedirecciones) || maxRedirecciones < 0) {
    throw new Error("límite de redirecciones no válido");
  }

  for (let saltos = 0; saltos <= maxRedirecciones; saltos += 1) {
    const continuar = destinoDeVerificacion(actual);
    if (continuar) return continuar.href;

    const respuesta = await fetcher(actual.href, { redirect: "manual" });
    const esRedireccion = respuesta.status >= 300 && respuesta.status < 400;

    if (esRedireccion) {
      if (saltos >= maxRedirecciones) {
        throw new Error("demasiadas redirecciones");
      }

      const location = respuesta.headers.get("Location");
      const siguiente = location ? urlDesde(location, actual) : null;
      if (!siguiente || !esUrlGoogleMapsPermitida(siguiente)) {
        throw new Error("redirección a un dominio o ruta no permitidos");
      }

      actual = siguiente;
      continue;
    }

    if (!respuesta.ok) {
      throw new Error("Google Maps HTTP " + respuesta.status);
    }

    // Con redirect:"manual" `respuesta.url` debe coincidir con `actual`.
    // Aun así se valida por defensa adicional si el runtime informa otra URL.
    const informada = respuesta.url ? urlDesde(respuesta.url, actual) : actual;
    if (!informada || !esUrlGoogleMapsPermitida(informada)) {
      throw new Error("URL final no permitida");
    }

    const finalVerificacion = destinoDeVerificacion(informada);
    if (finalVerificacion) return finalVerificacion.href;
    if (tipoUrlGoogleMaps(informada) !== "maps") {
      throw new Error("el enlace corto no devolvió una ubicación de Maps");
    }

    return informada.href;
  }

  throw new Error("no se pudo resolver el enlace");
}

export function parsearCoordenada(valor, minimo, maximo) {
  if (typeof valor !== "string" || valor.trim() === "") return null;
  const texto = valor.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(texto)) return null;

  const numero = Number(texto);
  if (!Number.isFinite(numero) || numero < minimo || numero > maximo) return null;
  return numero;
}

export function parsearListaCoordenadas(valor, minimo, maximo, cantidad = 2) {
  if (typeof valor !== "string") return null;
  const partes = valor.split(",");
  if (partes.length !== cantidad) return null;

  const numeros = partes.map((parte) => parsearCoordenada(parte, minimo, maximo));
  return numeros.every((numero) => numero !== null) ? numeros : null;
}

/** Devuelve únicamente códigos SIGPAC de dos letras, normalizados. */
export function normalizarUsoSigpac(valor) {
  if (typeof valor !== "string") return null;
  const uso = valor.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(uso) ? uso : null;
}

// --- ArcGrid (ESRI ASCII): cabecera de texto + matriz de valores ---
export function parsearArcGrid(texto) {
  const filas = [];
  for (const linea of texto.trim().split(/\r?\n/)) {
    const t = linea.trim();
    if (!t) continue;
    if (/^[a-zA-Z]/.test(t)) continue;
    const valores = t.split(/\s+/).map(Number);
    if (valores.some((v) => !Number.isFinite(v))) continue;
    filas.push(valores);
  }
  if (!filas.length) throw new Error("ArcGrid sin datos");
  const fila = filas[Math.floor(filas.length / 2)];
  const valor = fila[Math.floor(fila.length / 2)];
  if (!Number.isFinite(valor) || valor <= -999) {
    throw new Error("sin dato de elevación en el punto");
  }
  return valor;
}

async function elevacionIGN(lat, lon) {
  const d = 0.0003; // ~30 m de recuadro alrededor del punto
  const bbox = [lon - d, lat - d, lon + d, lat + d].join(",");
  const url = WCS_IGN +
    "?service=WCS&version=1.0.0&request=GetCoverage" +
    "&coverage=" + COBERTURA_IGN +
    "&crs=EPSG:4258&bbox=" + bbox +
    "&width=3&height=3&interpolationMethod=bilinear&format=ArcGrid";
  const r = await fetchConTiempo(url);
  if (!r.ok) throw new Error("IGN HTTP " + r.status);
  const texto = await r.text();
  if (texto.includes("ServiceException") || texto.includes("<?xml")) {
    throw new Error("IGN devolvió un error de servicio");
  }
  return parsearArcGrid(texto);
}

// ArcGrid completo: la posición de las celdas se deriva de su propia cabecera.
// NoData permanece null y nunca se interpreta como terreno llano.
export function parsearArcGridPerfil(texto, puntos) {
  const lines = texto.trim().split(/\r?\n/);
  const head = {};
  let index = 0;
  while (index < lines.length && /^[A-Za-z_]+\s/.test(lines[index].trim())) {
    const [key, value] = lines[index].trim().split(/\s+/);
    head[key.toLowerCase()] = Number(value);
    index++;
  }
  const { ncols, nrows } = head;
  const dx = head.dx ?? head.cellsize;
  const dy = head.dy ?? head.cellsize;
  const x0 = head.xllcorner ?? (head.xllcenter - dx / 2);
  const y0 = head.yllcorner ?? (head.yllcenter - dy / 2);
  if (![ncols, nrows, dx, dy, x0, y0].every(Number.isFinite) ||
      ncols < 1 || nrows < 1 || ncols * nrows > 100000 || dx <= 0 || dy <= 0) {
    throw new Error('ArcGrid inválido');
  }
  const rows = lines.slice(index).map(line => line.trim().split(/\s+/).map(Number));
  if (rows.length !== nrows || rows.some(row => row.length !== ncols)) throw new Error('ArcGrid incompleto');
  return puntos.map(({ lat, lon }) => {
    const col = Math.floor((lon - x0) / dx);
    const row = nrows - 1 - Math.floor((lat - y0) / dy);
    if (col < 0 || col >= ncols || row < 0 || row >= nrows) return null;
    const z = rows[row][col];
    return Number.isFinite(z) && z !== head.nodata_value && z > -999 ? z : null;
  });
}

function distanciaAproxM(a, b) {
  const dy = (b.lat - a.lat) * 111195;
  const dx = (b.lon - a.lon) * 111195 * Math.cos((a.lat + b.lat) * Math.PI / 360);
  return Math.hypot(dx, dy);
}

export function ventanasPerfil(puntos) {
  const result = [];
  let from = 0;
  for (let i = 1; i < puntos.length; i++) {
    if (distanciaAproxM(puntos[from], puntos[i]) > 900) {
      result.push({ from, to: i });
      from = i;
    }
  }
  result.push({ from, to: puntos.length - 1 });
  return result;
}

async function perfilIGN(puntos) {
  const elevaciones = Array(puntos.length).fill(null);
  for (const { from, to } of ventanasPerfil(puntos)) {
    const subset = puntos.slice(from, to + 1);
    const midLat = subset.reduce((s, p) => s + p.lat, 0) / subset.length;
    const padLat = 10 / 111195;
    const padLon = 10 / (111195 * Math.cos(midLat * Math.PI / 180));
    const minLon = Math.min(...subset.map(p => p.lon)) - padLon;
    const maxLon = Math.max(...subset.map(p => p.lon)) + padLon;
    const minLat = Math.min(...subset.map(p => p.lat)) - padLat;
    const maxLat = Math.max(...subset.map(p => p.lat)) + padLat;
    // La cobertura 4258 usa celdas angulares: elegir el paso más fino para
    // que ni el eje Este-Oeste exceda aproximadamente 5 m en esta latitud.
    const step = Math.min(5 / 111195, 5 / (111195 * Math.cos(midLat * Math.PI / 180)));
    const width = Math.max(3, Math.ceil((maxLon - minLon) / step));
    const height = Math.max(3, Math.ceil((maxLat - minLat) / step));
    if (width * height > 100000 || width > 512 || height > 512) throw new Error('perfil demasiado grande');
    const url = WCS_IGN + '?service=WCS&version=1.0.0&request=GetCoverage' +
      '&coverage=' + COBERTURA_IGN + '&crs=EPSG:4258&bbox=' +
      [minLon, minLat, maxLon, maxLat].join(',') +
      '&width=' + width + '&height=' + height + '&interpolationMethod=bilinear&format=ArcGrid';
    const response = await fetchConTiempo(url, {}, 15000);
    if (!response.ok) throw new Error('IGN HTTP ' + response.status);
    if (Number(response.headers.get('content-length')) > 2000000) throw new Error('respuesta IGN demasiado grande');
    const body = await response.text();
    if (body.length > 2000000 || body.includes('ServiceException') || body.includes('<?xml')) {
      throw new Error('respuesta IGN inválida');
    }
    const z = parsearArcGridPerfil(body, subset);
    z.forEach((value, j) => { elevaciones[from + j] = value; });
  }
  return elevaciones;
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    const url = new URL(request.url);
    if (url.pathname === '/api/rc1/usos' && request.method === 'POST') {
      if (Number(request.headers.get('content-length')) > 12000) return json({ error: 'cuerpo demasiado grande' }, 413);
      try {
        const body = await request.text();
        if (body.length > 12000) return json({ error: 'cuerpo demasiado grande' }, 413);
        const uses = await obtenerUsosPublicos(JSON.parse(body).parcels);
        return json({ parcels: uses });
      } catch (e) { return json({ error: e.message }, e instanceof RangeError || e instanceof SyntaxError ? 400 : 502); }
    }
    if ((url.pathname === '/perfil' || url.pathname === '/api/rc1/perfil') && request.method === 'POST') {
      if (Number(request.headers.get('content-length')) > 20000) return json({ error: 'cuerpo demasiado grande' }, 413);
      let body;
      try { body = await request.text(); } catch { return json({ error: 'cuerpo inválido' }, 400); }
      if (body.length > 20000) return json({ error: 'cuerpo demasiado grande' }, 413);
      let puntos;
      try { puntos = JSON.parse(body).puntos; } catch { return json({ error: 'JSON inválido' }, 400); }
      if (!Array.isArray(puntos) || puntos.length < 2 || puntos.length > 256 || puntos.some(p =>
        !p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon) ||
        p.lat < -90 || p.lat > 90 || p.lon < -180 || p.lon > 180)) {
        return json({ error: 'puntos inválidos' }, 400);
      }
      if (puntos.slice(1).some((p, i) => distanciaAproxM(puntos[i], p) > 100) ||
          puntos.reduce((sum, p, i) => i ? sum + distanciaAproxM(puntos[i - 1], p) : 0, 0) > 5000) {
        return json({ error: 'corredor fuera de límites' }, 400);
      }
      try {
        const elevaciones = await perfilIGN(puntos);
        return json({ elevaciones, fuente: 'IGN MDT05 WCS', nodata: elevaciones.map(x => x === null) });
      } catch (e) { return json({ error: 'perfil IGN no disponible: ' + e.message }, 502); }
    }
    if (request.method !== "GET") {
      return json({ error: "método no permitido" }, 405, { Allow: "GET, OPTIONS" });
    }

    if (url.pathname === '/api/rc1/asset') {
      const lat0 = parsearCoordenada(url.searchParams.get('lat0'), -90, 90);
      const lon0 = parsearCoordenada(url.searchParams.get('lon0'), -180, 180);
      const lat1 = parsearCoordenada(url.searchParams.get('lat1'), -90, 90);
      const lon1 = parsearCoordenada(url.searchParams.get('lon1'), -180, 180);
      if ([lat0, lon0, lat1, lon1].some(x => x === null)) return json({ error: 'coordenadas no válidas' }, 400);
      try {
        return json(await obtenerAssetPublico({ lat: lat0, lon: lon0 }, { lat: lat1, lon: lon1 }));
      } catch (e) { return json({ error: e.message }, e instanceof RangeError ? 400 : 502); }
    }

    // ------------------- /resolver -------------------
    if (url.pathname === "/resolver") {
      const destino = url.searchParams.get("url");
      if (!destino || !esUrlGoogleMapsPermitida(destino)) {
        return json({ error: "dominio o ruta no permitidos" }, 400);
      }

      try {
        const urlFinal = await resolverUrlGoogleMaps(destino);
        return json({ url_final: urlFinal });
      } catch {
        return json({ error: "no se pudo resolver el enlace" }, 502);
      }
    }

    // ------------------- /elevaciones -------------------
    if (url.pathname === "/elevaciones") {
      const lats = parsearListaCoordenadas(url.searchParams.get("lats"), -90, 90);
      const lons = parsearListaCoordenadas(url.searchParams.get("lons"), -180, 180);
      if (!lats || !lons) {
        return json({ error: "coordenadas no válidas" }, 400);
      }

      try {
        const [e1, e2] = await Promise.all([
          elevacionIGN(lats[0], lons[0]),
          elevacionIGN(lats[1], lons[1])
        ]);
        return json({ elevaciones: [e1, e2], fuente: "IGN (MDT, WCS)" });
      } catch (e) {
        return json({ error: "elevación IGN no disponible: " + e.message }, 502);
      }
    }

    // ------------------- /sigpac -------------------
    // Orden oficial: x = longitud, y = latitud; SRID 4258 (ETRS89).
    if (url.pathname === "/sigpac") {
      const lat = parsearCoordenada(url.searchParams.get("lat"), -90, 90);
      const lon = parsearCoordenada(url.searchParams.get("lon"), -180, 180);
      if (lat === null || lon === null) {
        return json({ error: "coordenadas no válidas" }, 400);
      }

      const consulta = "https://sigpac-hubcloud.es/servicioconsultassigpac/query/recinfobypoint/4258/" +
        lon + "/" + lat + ".json";

      try {
        const r = await fetchConTiempo(consulta);
        if (!r.ok) throw new Error("SIGPAC HTTP " + r.status);
        const recintos = await r.json();

        if (!Array.isArray(recintos)) throw new Error("respuesta inesperada del servicio");
        if (recintos.length === 0) return json({ uso: null });

        // En un límite puede haber varios recintos: se conserva el primero.
        const recinto = recintos[0] || {};
        let uso = recinto.uso_sigpac;
        if (uso === undefined) {
          for (const clave of Object.keys(recinto)) {
            if (/^uso(?:_|$)/i.test(clave)) {
              uso = recinto[clave];
              break;
            }
          }
        }
        return json({ uso: normalizarUsoSigpac(uso) });
      } catch (e) {
        return json({ error: "SIGPAC no disponible: " + e.message }, 502);
      }
    }

    return json({ error: "ruta desconocida" }, 404);
  }
};
