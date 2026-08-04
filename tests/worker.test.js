import test from "node:test";
import assert from "node:assert/strict";

import worker, {
  esUrlGoogleMapsPermitida,
  normalizarUsoSigpac,
  parsearCoordenada,
  parsearListaCoordenadas,
  resolverUrlGoogleMaps,
  tipoUrlGoogleMaps
} from "../infra/worker.js";

test("la lista blanca admite solo hosts y rutas reales de Google Maps", () => {
  const validas = [
    "https://maps.app.goo.gl/AbCdEf12",
    "https://goo.gl/maps/AbCdEf12",
    "https://www.google.com/maps/place/40,-4",
    "https://www.google.es/maps/dir/40,-4/41,-5",
    "https://maps.google.com/?q=40,-4",
    "https://maps.google.es/maps?q=40,-4"
  ];
  for (const url of validas) {
    assert.equal(esUrlGoogleMapsPermitida(url), true, url);
  }

  const invalidas = [
    "http://maps.app.goo.gl/AbCdEf12",
    "https://maps.app.goo.gl/",
    "https://goo.gl/AbCdEf12",
    "https://goo.gl/maps.evil/AbCdEf12",
    "https://goo.gl.ejemplo.org/maps/AbCdEf12",
    "https://www.google.com/search?q=maps",
    "https://www.google.ejemplo.org/maps/place/40,-4",
    "https://www.google.com.ejemplo.org/maps/place/40,-4",
    "https://maps.app.goo.gl@ejemplo.org/maps/AbCdEf12",
    "https://usuario@maps.google.com/?q=40,-4",
    "javascript:alert(1)"
  ];
  for (const url of invalidas) {
    assert.equal(esUrlGoogleMapsPermitida(url), false, url);
  }
});

test("la página de verificación solo se admite con un continue seguro", () => {
  const mapa = "https://www.google.com/maps/place/40,-4";
  const valida = "https://www.google.com/sorry/index?continue=" + encodeURIComponent(mapa);
  const maliciosa = "https://www.google.com/sorry/index?continue=" +
    encodeURIComponent("https://ejemplo.org/");

  assert.equal(tipoUrlGoogleMaps(valida), "verificacion");
  assert.equal(tipoUrlGoogleMaps(maliciosa), null);
});

test("el resolutor sigue redirecciones manuales y devuelve el destino Maps", async () => {
  const llamadas = [];
  const respuestas = [
    new Response(null, {
      status: 302,
      headers: { Location: "https://www.google.com/maps/place/40,-4" }
    }),
    new Response("ok", { status: 200 })
  ];
  const fetcher = async (url, opciones) => {
    llamadas.push({ url, opciones });
    return respuestas.shift();
  };

  const resultado = await resolverUrlGoogleMaps(
    "https://maps.app.goo.gl/AbCdEf12",
    fetcher
  );

  assert.equal(resultado, "https://www.google.com/maps/place/40,-4");
  assert.deepEqual(llamadas.map(({ url }) => url), [
    "https://maps.app.goo.gl/AbCdEf12",
    "https://www.google.com/maps/place/40,-4"
  ]);
  assert.ok(llamadas.every(({ opciones }) => opciones.redirect === "manual"));
});

test("el resolutor rechaza una redirección fuera de la lista blanca antes de consultarla", async () => {
  let llamadas = 0;
  const fetcher = async () => {
    llamadas += 1;
    return new Response(null, {
      status: 302,
      headers: { Location: "https://ejemplo.org/seguimiento" }
    });
  };

  await assert.rejects(
    resolverUrlGoogleMaps("https://maps.app.goo.gl/AbCdEf12", fetcher),
    /redirección/
  );
  assert.equal(llamadas, 1);
});

test("el resolutor limita la cadena de redirecciones", async () => {
  let siguiente = 0;
  const fetcher = async () => {
    siguiente += 1;
    return new Response(null, {
      status: 302,
      headers: { Location: "https://goo.gl/maps/salto" + siguiente }
    });
  };

  await assert.rejects(
    resolverUrlGoogleMaps("https://goo.gl/maps/inicio", fetcher, 2),
    /demasiadas redirecciones/
  );
  assert.equal(siguiente, 3);
});

test("el resolutor extrae un continue validado de la página /sorry", async () => {
  const destino = "https://www.google.es/maps/place/40,-4";
  const verificacion = "https://www.google.com/sorry/index?continue=" +
    encodeURIComponent(destino);
  const fetcher = async () => new Response(null, {
    status: 302,
    headers: { Location: verificacion }
  });

  assert.equal(
    await resolverUrlGoogleMaps("https://maps.app.goo.gl/AbCdEf12", fetcher),
    destino
  );
});

test("las coordenadas exigen presencia, formato finito y rango", () => {
  assert.equal(parsearCoordenada(null, -90, 90), null);
  assert.equal(parsearCoordenada("", -90, 90), null);
  assert.equal(parsearCoordenada("   ", -90, 90), null);
  assert.equal(parsearCoordenada("NaN", -90, 90), null);
  assert.equal(parsearCoordenada("1e2", -90, 90), null);
  assert.equal(parsearCoordenada("90.0001", -90, 90), null);
  assert.equal(parsearCoordenada("-90", -90, 90), -90);
  assert.equal(parsearCoordenada("+40.1234", -90, 90), 40.1234);

  assert.deepEqual(parsearListaCoordenadas("40.1, 40.2", -90, 90), [40.1, 40.2]);
  assert.equal(parsearListaCoordenadas(null, -90, 90), null);
  assert.equal(parsearListaCoordenadas(",", -90, 90), null);
  assert.equal(parsearListaCoordenadas("40.1", -90, 90), null);
  assert.equal(parsearListaCoordenadas("40.1,91", -90, 90), null);
});

test("el uso SIGPAC se normaliza o se descarta", () => {
  assert.equal(normalizarUsoSigpac(" fo "), "FO");
  assert.equal(normalizarUsoSigpac("pa"), "PA");
  assert.equal(normalizarUsoSigpac("<img>"), null);
  assert.equal(normalizarUsoSigpac("FOO"), null);
  assert.equal(normalizarUsoSigpac(null), null);
});

test("el Worker solo acepta GET/OPTIONS y rechaza parámetros ausentes", async () => {
  const post = await worker.fetch(new Request("https://worker.test/sigpac", { method: "POST" }));
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("Allow"), "GET, OPTIONS");

  const opciones = await worker.fetch(new Request("https://worker.test/sigpac", { method: "OPTIONS" }));
  assert.equal(opciones.status, 204);

  const elevaciones = await worker.fetch(new Request("https://worker.test/elevaciones"));
  assert.equal(elevaciones.status, 400);

  const sigpac = await worker.fetch(new Request("https://worker.test/sigpac"));
  assert.equal(sigpac.status, 400);

  const resolver = await worker.fetch(new Request("https://worker.test/resolver"));
  assert.equal(resolver.status, 400);
});
