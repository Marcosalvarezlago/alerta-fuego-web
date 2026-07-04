// =============================================================
// Alerta Fuego — servicio intermedio (Cloudflare Worker)
//
// Endpoints:
//   GET /resolver?url=https://maps.app.goo.gl/XXXX
//     → { "url_final": "https://www.google.com/maps/...@lat,lon..." }
//   GET /elevaciones?lats=LAT1,LAT2&lons=LON1,LON2
//     → { "elevaciones": [e1, e2], "fuente": "IGN (MDT, WCS)" }
//
// Seguridad: /resolver solo acepta dominios de Google Maps (lista
// blanca) para que nadie use el servicio como proxy abierto.
// /elevaciones no acepta URLs del usuario: solo coordenadas, y el
// destino (servicios.idee.es) es fijo.
// =============================================================

const DOMINIOS_PERMITIDOS = /^https:\/\/(maps\.app\.goo\.gl|goo\.gl|maps\.google\.[a-z.]{2,6}|www\.google\.[a-z.]{2,6})\//;

const WCS_IGN = "https://servicios.idee.es/wcs-inspire/mdt";
const COBERTURA_IGN = "Elevacion4258_5"; // MDT 5 m en lat/lon (EPSG:4258)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(objeto, status = 200) {
  return new Response(JSON.stringify(objeto), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" }
  });
}

async function fetchConTiempo(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// --- ArcGrid (ESRI ASCII): cabecera de texto + matriz de valores ---
function parsearArcGrid(texto) {
  const filas = [];
  for (const linea of texto.trim().split(/\r?\n/)) {
    const t = linea.trim();
    if (!t) continue;
    if (/^[a-zA-Z]/.test(t)) continue; // ncols, nrows, xllcorner, yllcorner, cellsize, NODATA_value
    const valores = t.split(/\s+/).map(Number);
    if (valores.some((v) => !isFinite(v))) continue;
    filas.push(valores);
  }
  if (!filas.length) throw new Error("ArcGrid sin datos");
  const fila = filas[Math.floor(filas.length / 2)];
  const valor = fila[Math.floor(fila.length / 2)];
  if (!isFinite(valor) || valor <= -999) throw new Error("sin dato de elevación en el punto");
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
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    // ------------------- /resolver -------------------
    if (url.pathname === "/resolver") {
      const destino = url.searchParams.get("url") || "";

      if (!DOMINIOS_PERMITIDOS.test(destino)) {
        return json({ error: "dominio no permitido" }, 400);
      }

      try {
        const respuesta = await fetchConTiempo(destino);
        let urlFinal = respuesta.url;

        // Si Google interpone su CAPTCHA (/sorry), la URL real de Maps
        // viaja dentro del parámetro continue: la extraemos.
        if (urlFinal.includes("/sorry/")) {
          const cont = urlFinal.match(/[?&]continue=([^&]+)/);
          if (cont) {
            try { urlFinal = decodeURIComponent(cont[1]); } catch (e) { /* dejar tal cual */ }
          }
        }

        return json({ url_final: urlFinal });
      } catch (e) {
        return json({ error: "no se pudo resolver el enlace" }, 502);
      }
    }

    // ------------------- /elevaciones -------------------
    if (url.pathname === "/elevaciones") {
      const lats = (url.searchParams.get("lats") || "").split(",").map(Number);
      const lons = (url.searchParams.get("lons") || "").split(",").map(Number);

      const validas = lats.length === 2 && lons.length === 2 &&
        lats.every((v) => isFinite(v) && v >= -90 && v <= 90) &&
        lons.every((v) => isFinite(v) && v >= -180 && v <= 180);
      if (!validas) {
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

    return json({ error: "ruta desconocida" }, 404);
  }
};