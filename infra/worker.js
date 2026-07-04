// =============================================================
// Alerta Fuego — servicio resolvedor de enlaces
// Cloudflare Worker. Endpoint:
//   GET /resolver?url=https://maps.app.goo.gl/XXXX
//   → { "url_final": "https://www.google.com/maps/....@lat,lon..." }
//
// Seguridad: solo resuelve enlaces de dominios de Google Maps
// (lista blanca) para que nadie pueda usar el servicio como
// proxy abierto hacia otros destinos.
// =============================================================

const DOMINIOS_PERMITIDOS = /^https:\/\/(maps\.app\.goo\.gl|goo\.gl|maps\.google\.[a-z.]{2,6}|www\.google\.[a-z.]{2,6})\//;

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

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    if (url.pathname === "/resolver") {
      const destino = url.searchParams.get("url") || "";

      if (!DOMINIOS_PERMITIDOS.test(destino)) {
        return json({ error: "dominio no permitido" }, 400);
      }

      try {
        const respuesta = await fetch(destino, { redirect: "follow" });
        return json({ url_final: respuesta.url });
      } catch (e) {
        return json({ error: "no se pudo resolver el enlace" }, 502);
      }
    }

    return json({ error: "ruta desconocida" }, 404);
  }
};