// Lógica pura compartida por la interfaz y las pruebas.
// Los valores del modelo solo deben cambiarse tras validación operativa.

export const DIRECCIONES_GRADOS = Object.freeze({
  N: 0, NE: 45, E: 90, SE: 135, S: 180, SO: 225, O: 270, NO: 315
});

export const V0_COMBUSTIBLE = Object.freeze({
  pastos_bajos: 3,
  quercus: 4,
  matorral_mediterraneo: 6,
  pinar: 8
});

export const CARDINALES = Object.freeze(["N", "NE", "E", "SE", "S", "SO", "O", "NO"]);

export function normalizarGrados(grados) {
  if (!Number.isFinite(grados)) return null;
  return ((grados % 360) + 360) % 360;
}

export function resolverDireccionGrados(direccion) {
  if (typeof direccion === "number") return normalizarGrados(direccion);
  return Object.hasOwn(DIRECCIONES_GRADOS, direccion) ? DIRECCIONES_GRADOS[direccion] : null;
}

export function calcularDistanciaM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (g) => g * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calcularRumboGrados(lat1, lon1, lat2, lon2) {
  const toRad = (g) => g * Math.PI / 180;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return normalizarGrados(Math.atan2(y, x) * 180 / Math.PI);
}

export function diferenciaAngularFirmada(a, b) {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

export function clasificarCuadrante(direccionVientoGrados, rumboFuegoZonaGrados) {
  const d = diferenciaAngularFirmada(direccionVientoGrados, rumboFuegoZonaGrados);
  const abs = Math.abs(d);
  if (abs <= 45) return { cuadrante: "riesgo", diferencia: d };
  if (abs <= 135) {
    return { cuadrante: d > 0 ? "alerta_derecha" : "alerta_izquierda", diferencia: d };
  }
  return { cuadrante: "sin_riesgo", diferencia: d };
}

export function obtenerFactorViento(vKmh) {
  if (vKmh < 10) return 1;
  if (vKmh < 20) return 1.5;
  if (vKmh < 30) return 2;
  return 3;
}

export function obtenerFactorPendiente(pendientePct, sentidoLadera) {
  if (sentidoLadera === "bajando") return 0.7;
  if (sentidoLadera === "llano") return 1;
  if (pendientePct < 20) return 1;
  if (pendientePct <= 40) return 1.5;
  return 2;
}

// El minuto mostrado siempre redondea hacia abajo: nunca presenta más tiempo
// disponible que el calculado. El escenario usa exactamente el mismo entero.
export function minutosPrudentes(tiempoMin) {
  if (tiempoMin === null || !Number.isFinite(tiempoMin) || tiempoMin < 0) return null;
  return Math.floor(tiempoMin);
}

export function formatearTiempo(tiempoMin) {
  const totalMinutos = minutosPrudentes(tiempoMin);
  if (totalMinutos === null) return "indeterminado";
  if (tiempoMin > 0 && totalMinutos === 0) return "<1 min";
  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;
  if (horas === 0) return `${minutos} min`;
  if (minutos === 0) return `${horas} h`;
  return `${horas} h ${minutos} min`;
}

export function clasificarEscenario(tiempoMin) {
  const totalMinutos = minutosPrudentes(tiempoMin);
  if (totalMinutos === null) return "indeterminado";
  if (totalMinutos <= 30) return "30_min";
  if (totalMinutos <= 60) return "1_hora";
  if (totalMinutos <= 90) return "1_hora_y_media";
  return "vigilancia_preventiva";
}

export function evaluarAlertaFuego(p) {
  const distanciaM = calcularDistanciaM(p.latFuego, p.lonFuego, p.latZona, p.lonZona);
  const rumbo = calcularRumboGrados(p.latFuego, p.lonFuego, p.latZona, p.lonZona);
  const dirViento = resolverDireccionGrados(p.direccionVientoHacia);
  if (dirViento === null) throw new TypeError("Dirección del viento no válida");
  const cls = clasificarCuadrante(dirViento, rumbo);

  const v0 = V0_COMBUSTIBLE[p.tipoCombustible];
  const fv = obtenerFactorViento(p.velocidadVientoKmh);
  const fp = obtenerFactorPendiente(p.pendientePct, p.sentidoLadera);
  const vpif = v0 * fv * fp;
  const tiempoMin = vpif > 0 ? distanciaM / vpif : null;

  return {
    distanciaM,
    rumboFuegoZona: rumbo,
    direccionVientoGrados: dirViento,
    diferenciaFirmada: cls.diferencia,
    cuadrante: cls.cuadrante,
    v0, fv, fp, vpif,
    tiempoMin,
    tiempoTexto: formatearTiempo(tiempoMin),
    escenario: clasificarEscenario(tiempoMin)
  };
}

export function puntoDesdeOrigen(lat, lon, rumboGrados, distanciaM) {
  const R = 6371000;
  const toRad = (g) => g * Math.PI / 180;
  const toDeg = (r) => r * 180 / Math.PI;
  const br = toRad(rumboGrados);
  const la1 = toRad(lat);
  const lo1 = toRad(lon);
  const dR = distanciaM / R;

  const la2 = Math.asin(
    Math.sin(la1) * Math.cos(dR) +
    Math.cos(la1) * Math.sin(dR) * Math.cos(br)
  );
  const lo2 = lo1 + Math.atan2(
    Math.sin(br) * Math.sin(dR) * Math.cos(la1),
    Math.cos(dR) - Math.sin(la1) * Math.sin(la2)
  );
  return [toDeg(la2), toDeg(lo2)];
}

export function crearSectorLatLng(lat, lon, direccionCentral, aperturaGrados, radioM, pasos = 28) {
  const ini = direccionCentral - aperturaGrados / 2;
  const fin = direccionCentral + aperturaGrados / 2;
  const puntos = [[lat, lon]];
  for (let i = 0; i <= pasos; i++) {
    const ang = ini + (fin - ini) * i / pasos;
    puntos.push(puntoDesdeOrigen(lat, lon, ang, radioM));
  }
  puntos.push([lat, lon]);
  return puntos;
}

export function direccionHaciaDesdeMeteo(desdeGrados) {
  return normalizarGrados(desdeGrados + 180);
}

export function gradosACardinal(grados) {
  const g = normalizarGrados(grados);
  if (g === null) return null;
  return CARDINALES[Math.round(g / 45) % 8];
}

// El umbral vertical de 5 m solo identifica llano cuando la pendiente también
// está por debajo del primer tramo documentado (<20 %). Así un tramo corto y
// empinado conserva su sentido y su factor de pendiente.
export function calcularPendienteDesdeElevaciones(elevFuegoM, elevZonaM, distanciaM, umbralLlanoM = 5) {
  const desnivelM = elevZonaM - elevFuegoM;
  let pendientePct = distanciaM > 0 ? Math.abs(desnivelM) / distanciaM * 100 : 0;
  pendientePct = Math.max(0, Math.min(100, pendientePct));
  const esLlano = Math.abs(desnivelM) < umbralLlanoM && pendientePct < 20;
  const sentidoLadera = esLlano ? "llano" : (desnivelM > 0 ? "subiendo" : (desnivelM < 0 ? "bajando" : "llano"));
  return { desnivelM, pendientePct, sentidoLadera };
}

export function latLonValidos(lat, lon) {
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

export function mercatorAWgs84(x, y) {
  const R = 6378137;
  const lon = x / R * 180 / Math.PI;
  const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI;
  return { lat, lon };
}

export function parsearUbicacion(texto) {
  if (!texto) return { ok: false, motivo: "formato" };
  let t = String(texto).trim();
  try { t = decodeURIComponent(t); } catch { /* texto con % suelto: seguir tal cual */ }

  const esUrl = /https?:\/\//.test(t);
  const NUM = "(-?\\d+(?:\\.\\d+)?)";

  if (esUrl) {
    const cont = t.match(/[?&]continue=([^&]+)/);
    if (cont) {
      let interno = cont[1];
      try { interno = decodeURIComponent(interno); } catch { /* seguir */ }
      const r = parsearUbicacion(interno);
      if (r.ok) return r;
    }

    let ms = t.match(new RegExp("/maps/search/" + NUM + "\\s*,\\s*\\+?\\s*" + NUM));
    if (ms) {
      const lat = parseFloat(ms[1]), lon = parseFloat(ms[2]);
      if (latLonValidos(lat, lon)) return { ok: true, lat, lon };
    }

    // El pin del lugar es más específico que el centro de la vista (@lat,lon).
    let m = t.match(new RegExp("!3d" + NUM + "!4d" + NUM));
    if (m) {
      const lat = parseFloat(m[1]), lon = parseFloat(m[2]);
      if (latLonValidos(lat, lon)) return { ok: true, lat, lon };
    }
    m = t.match(new RegExp("!2d" + NUM + "!3d" + NUM));
    if (m) {
      const lon = parseFloat(m[1]), lat = parseFloat(m[2]);
      if (latLonValidos(lat, lon)) return { ok: true, lat, lon };
    }
    m = t.match(new RegExp("@\\s*" + NUM + "\\s*,\\s*" + NUM));
    if (m) {
      const lat = parseFloat(m[1]), lon = parseFloat(m[2]);
      if (latLonValidos(lat, lon)) return { ok: true, lat, lon };
    }

    const CLAVES = ["q", "ll", "query", "center", "destination", "origin", "daddr", "saddr"];
    for (const clave of CLAVES) {
      const re = new RegExp("[?&#]" + clave + "=" + NUM + "\\s*,\\s*" + NUM);
      const p = t.match(re);
      if (p) {
        const a = parseFloat(p[1]), b = parseFloat(p[2]);
        if (latLonValidos(a, b)) return { ok: true, lat: a, lon: b };
        if (Math.abs(a) > 180 || Math.abs(b) > 90) {
          const c = mercatorAWgs84(a, b);
          if (latLonValidos(c.lat, c.lon)) {
            return { ok: true, lat: +c.lat.toFixed(6), lon: +c.lon.toFixed(6) };
          }
        }
      }
    }
    if (/[?&]x=-?\d/.test(t) && /[?&]y=-?\d/.test(t) && /srid=258\d\d/.test(t)) {
      return { ok: false, motivo: "utm" };
    }
    if (/maps\.app\.goo\.gl|goo\.gl\/maps/.test(t)) {
      return { ok: false, motivo: "enlace_corto" };
    }
    return { ok: false, motivo: "formato" };
  }

  const m = t.match(new RegExp("^" + NUM + "[\\s,;]+" + NUM + "$"));
  if (m) {
    const lat = parseFloat(m[1]), lon = parseFloat(m[2]);
    if (latLonValidos(lat, lon)) return { ok: true, lat, lon };
  }
  return { ok: false, motivo: "formato" };
}

export function esDatoVientoVigente(datos, ahoraMs = Date.now(), minutosValidez = 10) {
  if (!datos || !Number.isFinite(datos.consultadoEnMs)) return false;
  const edadMs = ahoraMs - datos.consultadoEnMs;
  return edadMs >= 0 && edadMs < minutosValidez * 60000;
}

export function normalizarCodigoSigpac(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor !== "string") throw new TypeError("Código SIGPAC no válido");
  const codigo = valor.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(codigo)) throw new TypeError("Código SIGPAC no válido");
  return codigo;
}

export function escaparHtml(valor) {
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
