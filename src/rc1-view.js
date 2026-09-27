// Presentación RC1 dentro del panel y el lenguaje visual de la web principal.
export function pintarResultadoRc1(r, { Core, TEXTO_CUADRANTE, NOMBRE_CUADRANTE,
  PROTOCOLOS, formatearMetros }) {
  const esc = Core.escaparHtml;
  const t0 = r.scenarios[0];
  const exposicion = t0.exposure?.cuadrante ?? t0.exposure;
  const area = TEXTO_CUADRANTE[exposicion] || {
    clase: 'alerta', etiqueta: 'Viento sin dato', titulo: 'Dirección del viento no disponible',
    desc: 'No se puede clasificar la exposición por viento en este escenario.'
  };
  const provisional = t0.status === 'provisional';
  const eta = Core.formatearTiempo(t0.eta_min) + (provisional ? ' · prudente' : '');
  const temporal = Core.clasificarEscenario(t0.eta_min);
  const clave = provisional && temporal === 'vigilancia_preventiva' ? 'provisional' :
    exposicion === 'sin_riesgo' ? 'vigilancia_preventiva' : temporal;
  const protocolo = PROTOCOLOS[clave];
  const horaLocal = hora => {
    const fecha = new Date(hora + 'Z');
    return Number.isFinite(fecha.getTime()) ?
      new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit' }).format(fecha) : 'hora no disponible';
  };
  const escenarios = r.scenarios.map(s =>
    `<div class="escenario"><small>${s.scenario === 't0' ? 'Viento de referencia' : 'Viento ' + esc(s.scenario).replace('h', ' h')} · ${esc(horaLocal(s.horaUtc))}</small>` +
    `<b>${Core.formatearTiempo(s.eta_min)}${s.status === 'provisional' ? ' · prudente' : ''}</b>` +
    `<small>${s.exposure ? esc(NOMBRE_CUADRANTE[s.exposure.cuadrante ?? s.exposure] ||
      s.exposure.cuadrante || s.exposure) : 'viento sin dirección'}</small></div>`
  ).join('');
  const filas = t0.rows.map((row, i) =>
    `<tr><td>${i + 1}</td><td>${Math.round(row.chainage_start_m)}–${Math.round(row.chainage_end_m)} m</td>` +
    `<td>${esc(row.label || 'sin dato')}<br><small>SIGPAC ${esc(row.sigpac_codes?.join('/') || '—')}` +
    ` · regla ${esc(row.rule || '—')}</small></td><td>${row.v0 === null ? '—' : row.v0}</td>` +
    `<td>${row.slope_signed_pct === null ? '—' : row.slope_signed_pct.toFixed(1) + ' %'}</td>` +
    `<td>${row.vpif === null ? '—' : row.vpif.toFixed(1)}</td>` +
    `<td>${row.t_i_min === null ? '—' : Core.formatearTiempo(row.t_i_min)}</td></tr>`
  ).join('');
  const acciones = protocolo.acciones.map(a => `<li>${esc(a)}</li>`).join('');
  const sinDato = t0.rows.filter(row => Object.values(row.nodata_flags || {}).some(Boolean)).length;
  const fallback = t0.rows.filter(row => row.fallback === 'untyped_v0_8').length;
  const combustibleManual = r.source_versions.fuel_source === 'combustible manual homogéneo';
  const fuenteCombustible = combustibleManual ? 'combustible manual homogéneo' :
    esc(r.source_versions.fuel_source || 'SIGPAC FEGA') + ' · ' +
    (r.source_versions.mfe_count > 0 ? 'MFE25 local' : 'MFE25 no disponible en esta ejecución');
  const fuentes = [];
  if (!combustibleManual) fuentes.push('<a href="https://sigpac-hubcloud.es/" target="_blank" rel="noopener noreferrer">SIGPAC/FEGA</a>');
  if (r.source_versions.mfe_count > 0) fuentes.push('<a href="https://www.miteco.gob.es/" target="_blank" rel="noopener noreferrer">MITECO</a>');
  if (r.profile_source?.startsWith('IGN')) fuentes.push('<a href="https://www.ign.es/" target="_blank" rel="noopener noreferrer">IGN</a>');
  if (r.profile_source?.startsWith('Open-Meteo') || r.source_versions.wind_source?.startsWith('Open-Meteo')) {
    fuentes.push('<a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>');
  }
  const detalle = sinDato ? `${sinDato} tramos usan hipótesis prudentes para datos ausentes: V0 = 8, FV = 3 o FP = 2 según falte combustible, viento o pendiente. La ETA es provisional y no garantiza un plazo de llegada.` :
    fallback ? `${fallback} tramos usan V0 = 8 provisional por combustible positivo no tipificado.` :
      'Todos los tramos tienen combustible identificado.';
  document.getElementById('resultado').innerHTML =
    `<div class="estado ${area.clase}"><div class="etiqueta">${area.etiqueta}</div>` +
    `<div class="titulo">${area.titulo}</div><div class="desc">${area.desc}</div></div>` +
    `<div class="metricas"><div class="metrica"><div class="l">Distancia</div>` +
    `<div class="v">${formatearMetros(r.distance_m)}</div><div class="s">Incendio → zona vulnerable.</div></div>` +
    `<div class="metrica"><div class="l">ETA t0</div><div class="v">${eta}</div>` +
    `<div class="s">${exposicion === 'sin_riesgo' ? 'Referencia condicional; vigilancia preventiva.' :
      (provisional ? 'ETA provisional con hipótesis prudentes; no es un tiempo seguro.' : 'Estimación orientativa por tramos.')}</div></div>` +
    `<div class="metrica"><div class="l">Tramos</div><div class="v">${t0.rows.length}</div>` +
    `<div class="s">VPIF y pendiente calculadas en cada tramo.</div></div></div>` +
    `<div class="datos-usados"><b>Datos usados:</b> ${fuenteCombustible} · ` +
    `${esc(r.profile_source)} · ${esc(r.source_versions.wind_source)}. ${detalle}` +
    (fuentes.length ? `<div class="mini-nota">Fuentes: ${fuentes.join(', ')}.</div>` : '') + '</div>' +
    `<div class="mini-nota" style="margin-bottom:8px">Comparación de viento por horas (hora local): cada tarjeta calcula la ETA completa con el viento previsto de esa hora, mantenido constante en todo el recorrido. No indica dónde estará el fuego a esa hora.</div>` +
    `<div class="escenarios">${escenarios}</div>` +
    `<details class="bloque" open><summary>${protocolo.encabezado}: ${protocolo.titulo}</summary>` +
    `<ul>${acciones}</ul></details>` +
    `<details class="bloque"><summary>Detalles técnicos de los tramos</summary><div class="tec">` +
    `Modelo ${esc(r.model_version)}. Velocidades base y reglas experimentales. ` +
    `Si faltan datos, el cálculo usa el factor más rápido de la tabla VPIF para ese dato (V0 = 8, FV = 3, FP = 2). Es una hipótesis prudente del modelo, no una cota física garantizada. Las banderas NoData se conservan.` +
    `<div class="tramos-wrap"><table class="tramos"><thead><tr><th>#</th><th>Recorrido</th>` +
    `<th>Combustible y regla</th><th>V0</th><th>Pendiente</th><th>VPIF</th><th>Tiempo</th>` +
    `</tr></thead><tbody>${filas}</tbody></table></div></div></details>` +
    `<div class="recordatorio"><strong>Recordatorio:</strong> estimación experimental y orientativa, ` +
    `concebida para conatos o fases iniciales con un frente dominante; no modeliza pavesas, ` +
    `fuego de copas ni frentes múltiples. ` +
    `No apures los tiempos ni permanezcas en una zona comprometida. Sigue las indicaciones oficiales. ` +
    `Ante peligro: <strong>112</strong>.</div>`;
  const resumen = document.getElementById('resumen');
  resumen.className = area.clase;
  resumen.style.display = 'flex';
  document.getElementById('resumen-texto').textContent =
    `${area.titulo} · ${eta} · ${formatearMetros(r.distance_m)}`;
}
