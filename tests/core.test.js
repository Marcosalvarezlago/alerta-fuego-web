import test from "node:test";
import assert from "node:assert/strict";

import {
  calcularPendienteDesdeElevaciones,
  clasificarCuadrante,
  clasificarEscenario,
  esDatoVientoVigente,
  escaparHtml,
  evaluarAlertaFuego,
  formatearTiempo,
  normalizarCodigoSigpac,
  obtenerFactorPendiente,
  parsearUbicacion
} from "../src/core.js";

test("la dirección automática exacta decide el cuadrante sin cuantizar a cardinal", () => {
  // A 22,4° el rumbo 67,3° aún cae en riesgo (44,9° de diferencia).
  // Cuantizar a N (0°) lo clasificaría incorrectamente como lateral.
  assert.equal(clasificarCuadrante(22.4, 67.3).cuadrante, "riesgo");
  assert.equal(clasificarCuadrante(0, 67.3).cuadrante, "alerta_derecha");
});

test("el modelo acepta grados exactos automáticos y cardinales manuales", () => {
  const base = {
    latFuego: 40,
    lonFuego: -5,
    latZona: 40.01,
    lonZona: -5,
    velocidadVientoKmh: 15,
    tipoCombustible: "pastos_bajos",
    pendientePct: 0,
    sentidoLadera: "llano"
  };
  assert.equal(evaluarAlertaFuego({ ...base, direccionVientoHacia: 12.75 }).direccionVientoGrados, 12.75);
  assert.equal(evaluarAlertaFuego({ ...base, direccionVientoHacia: "N" }).direccionVientoGrados, 0);
});

test("tiempo visible y protocolo usan el mismo redondeo prudente", () => {
  const casos = [
    [30, "30 min", "30_min"],
    [30.1, "30 min", "30_min"],
    [60, "1 h", "1_hora"],
    [60.1, "1 h", "1_hora"],
    [90, "1 h 30 min", "1_hora_y_media"],
    [90.1, "1 h 30 min", "1_hora_y_media"],
    [91, "1 h 31 min", "vigilancia_preventiva"],
    [119.9, "1 h 59 min", "vigilancia_preventiva"],
    [120, "2 h", "vigilancia_preventiva"]
  ];

  for (const [minutos, texto, escenario] of casos) {
    assert.equal(formatearTiempo(minutos), texto, `texto para ${minutos}`);
    assert.equal(clasificarEscenario(minutos), escenario, `escenario para ${minutos}`);
    assert.doesNotMatch(formatearTiempo(minutos), /60 min/);
  }
  assert.equal(formatearTiempo(0.4), "<1 min");
});

test("el pin de Google Maps prevalece sobre el centro visible del mapa", () => {
  const url = "https://www.google.com/maps/place/X/@40.111,-5.222,12z/data=!4m5!3m4!1s0x0:0x0!8m2!3d40.333!4d-5.444";
  assert.deepEqual(parsearUbicacion(url), { ok: true, lat: 40.333, lon: -5.444 });
});

test("un tramo corto con desnivel pequeño pero pendiente fuerte no se marca llano", () => {
  const subida = calcularPendienteDesdeElevaciones(100, 104, 10);
  assert.equal(subida.sentidoLadera, "subiendo");
  assert.equal(subida.pendientePct, 40);
  assert.equal(obtenerFactorPendiente(subida.pendientePct, subida.sentidoLadera), 1.5);

  const bajada = calcularPendienteDesdeElevaciones(104, 100, 10);
  assert.equal(bajada.sentidoLadera, "bajando");
  assert.equal(obtenerFactorPendiente(bajada.pendientePct, bajada.sentidoLadera), 0.7);
});

test("el viento vence exactamente a los diez minutos", () => {
  const datos = { consultadoEnMs: 1_000 };
  assert.equal(esDatoVientoVigente(datos, 600_999, 10), true);
  assert.equal(esDatoVientoVigente(datos, 601_000, 10), false);
  assert.equal(esDatoVientoVigente({}, 1_000, 10), false);
});

test("los códigos SIGPAC se normalizan y se rechaza texto no confiable", () => {
  assert.equal(normalizarCodigoSigpac(" pa "), "PA");
  assert.equal(normalizarCodigoSigpac(null), null);
  assert.throws(() => normalizarCodigoSigpac("<img src=x onerror=alert(1)>"), /no válido/);
  assert.equal(escaparHtml("<b>&'\""), "&lt;b&gt;&amp;&#039;&quot;");
});
