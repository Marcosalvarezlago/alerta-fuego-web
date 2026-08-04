// =============================================================
// Alerta Fuego — servicio intermedio (Cloudflare Worker)
//
// Endpoints públicos:
//   GET /resolver?url=https://maps.app.goo.gl/XXXX
//   GET /elevaciones?lats=LAT1,LAT2&lons=LON1,LON2
//   GET /sigpac?lat=LAT&lon=LON
//
// /resolver valida la URL inicial, cada redirección y la URL final
// para impedir que el Worker se convierta en un proxy abierto.
// =============================================================

const HOSTS_MAPS_CON_RUTA = new Set([
  "www.google.com",
  "www.google.es"
]);

const HOSTS_MAPS_DEDICADOS = new Set([
  "maps.google.com",
  "maps.google.es"
]);

export const MAX_REDIRECCIONES = 5;

const WCS_IGN = "https://servicios.idee.es/wcs-inspire/mdt";
const COBERTURA_IGN = "Elevacion4258_5"; // MDT 5 m en lat/lon (EPSG:4258)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== "GET") {
      return json({ error: "método no permitido" }, 405, { Allow: "GET, OPTIONS" });
    }

    const url = new URL(request.url);

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
