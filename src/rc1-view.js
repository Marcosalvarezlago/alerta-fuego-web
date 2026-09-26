// Presentación RC1 dentro del panel y el lenguaje visual de la web principal.
export function pintarResultadoRc1(r, { Core, TEXTO_CUADRANTE, NOMBRE_CUADRANTE,
  PROTOCOLOS, formatearMetros }) {
  const esc = Core.escaparHtml;
  const t0 = r.scenarios[0];
  const exposicion = t0.exposure?.cuadrante ?? t0.exposure;
  const area = TEXTO_CUADRANTE[exposicion] || {
    clase: 'alerta', etiqueta: 'Viento sin dato', titulo: 'Exposición indeterminada',
    desc: 'No se puede clasificar la exposición por viento en este escenario.'
  };
  const eta = t0.eta_min === null ? 'Indeterminada' : Core.formatearTiempo(t0.eta_min);
  const clave = t0.eta_min === null ? 'indeterminado' :
    exposicion === 'sin_riesgo' ? 'vigilancia_preventiva' : Core.clasificarEscenario(t0.eta_min);
  const protocolo = PROTOCOLOS[clave];
  const escenarios = r.scenarios.map(s =>
    `<div class="escenario"><small>${esc(s.scenario)} · ${esc(s.horaUtc || 'sin hora')}</small>` +
    `<b>${s.eta_min === null ? 'Indeterminada' : Core.formatearTiempo(s.eta_min)}</b>` +
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
  const fuenteMfe = r.source_versions.mfe_count > 0 ? 'MFE25 local' : 'MFE25 sin cobertura local';
  const detalle = sinDato ? `${sinDato} tramos sin datos suficientes. La ETA queda indeterminada.` :
    fallback ? `${fallback} tramos usan V0 = 8 provisional por combustible positivo no tipificado.` :
      'Todos los tramos tienen combustible identificado.';
  document.getElementById('resultado').innerHTML =
    `<div class="estado ${area.clase}"><div class="etiqueta">${area.etiqueta}</div>` +
    `<div class="titulo">${area.titulo}</div><div class="desc">${area.desc}</div></div>` +
    `<div class="metricas"><div class="metrica"><div class="l">Distancia</div>` +
    `<div class="v">${formatearMetros(r.distance_m)}</div><div class="s">Incendio → zona vulnerable.</div></div>` +
    `<div class="metrica"><div class="l">ETA t0</div><div class="v">${eta}</div>` +
    `<div class="s">${exposicion === 'sin_riesgo' ? 'Referencia condicional; vigilancia preventiva.' :
      'Estimación orientativa por tramos.'}</div></div>` +
    `<div class="metrica"><div class="l">Tramos</div><div class="v">${t0.rows.length}</div>` +
    `<div class="s">VPIF y pendiente calculadas en cada tramo.</div></div></div>` +
    `<div class="datos-usados"><b>Datos usados:</b> SIGPAC FEGA · ${fuenteMfe} · ` +
    `${esc(r.profile_source)} · ${esc(r.source_versions.wind_source)}. ${detalle}` +
    `<div class="mini-nota">Fuentes: <a href="https://sigpac-hubcloud.es/" target="_blank" rel="noopener noreferrer">SIGPAC/FEGA</a>, ` +
    `<a href="https://www.miteco.gob.es/" target="_blank" rel="noopener noreferrer">MITECO</a>, ` +
    `<a href="https://www.ign.es/" target="_blank" rel="noopener noreferrer">IGN</a> y ` +
    `<a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>.</div></div>` +
    `<div class="escenarios">${escenarios}</div>` +
    `<details class="bloque" open><summary>${protocolo.encabezado}: ${protocolo.titulo}</summary>` +
    `<ul>${acciones}</ul></details>` +
    `<details class="bloque"><summary>Detalles técnicos de los tramos</summary><div class="tec">` +
    `Modelo ${esc(r.model_version)}. V0 provisional; por confirmar con José Antonio. ` +
    `Sin combustible comprobable se deja la ETA indeterminada.` +
    `<div class="tramos-wrap"><table class="tramos"><thead><tr><th>#</th><th>Recorrido</th>` +
    `<th>Combustible y regla</th><th>V0</th><th>Pendiente</th><th>VPIF</th><th>Tiempo</th>` +
    `</tr></thead><tbody>${filas}</tbody></table></div></div></details>` +
    `<div class="recordatorio"><strong>Recordatorio:</strong> estimación experimental y orientativa. ` +
    `No apures los tiempos ni permanezcas en una zona comprometida. Sigue las indicaciones oficiales. ` +
    `Ante peligro: <strong>112</strong>.</div>`;
  const resumen = document.getElementById('resumen');
  resumen.className = area.clase;
  resumen.style.display = 'flex';
  document.getElementById('resumen-texto').textContent =
    `${area.titulo} · ${eta} · ${formatearMetros(r.distance_m)}`;
}
