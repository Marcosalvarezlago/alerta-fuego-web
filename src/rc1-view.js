// Una sola ETA: el viento horario cambia cuando el cálculo alcanza cada tramo.
export function pintarResultadoRc1(r, { Core, TEXTO_CUADRANTE, PROTOCOLOS, formatearMetros }) {
  const esc = Core.escaparHtml;
  const resultado = r.scenarios[0];
  const exposicion = resultado.exposure?.cuadrante ?? resultado.exposure;
  const area = TEXTO_CUADRANTE[exposicion] || {
    clase: 'alerta', etiqueta: 'Orientación no disponible',
    titulo: 'Sin dirección de viento', desc: 'La ETA conserva una hipótesis de viento en los detalles técnicos.'
  };
  const temporal = Core.clasificarEscenario(resultado.eta_min);
  const clave = resultado.status === 'provisional' && temporal === 'vigilancia_preventiva' ?
    'provisional' : temporal;
  const protocolo = PROTOCOLOS[clave];
  const sv = r.source_versions ?? {};
  const combustibleManual = sv.fuel_mode === 'manual' ||
    sv.fuel_source === 'combustible manual homogéneo';
  const pendienteManual = sv.slope_mode === 'manual';
  const vientoManual = sv.wind_mode === 'manual';
  const descripcionExposicion = vientoManual ?
    'La orientación usa la dirección manual, aplicada de forma constante al recorrido.' : area.desc;
  const cuenta = flag => resultado.rows.filter(row => row.nodata_flags?.[flag]).length;
  const combustibleSinDato = cuenta('fuel');
  const pendienteSinDato = cuenta('elevation');
  const vientoSinDato = cuenta('wind');
  const noTipificado = resultado.rows.filter(row => row.fallback === 'untyped_v0_8').length;
  const discontinuidades = resultado.rows.filter(row => row.gap_flag).length;
  const fuentes = [];
  if (!combustibleManual) fuentes.push('<a href="https://sigpac-hubcloud.es/" target="_blank" rel="noopener noreferrer">SIGPAC/FEGA</a>');
  if (sv.mfe_count > 0) fuentes.push('<a href="https://www.miteco.gob.es/" target="_blank" rel="noopener noreferrer">MITECO</a>');
  if (r.profile_source?.startsWith('IGN')) fuentes.push('<a href="https://www.ign.es/" target="_blank" rel="noopener noreferrer">IGN</a>');
  if (r.profile_source?.includes('Open-Meteo') || sv.wind_source?.startsWith('Open-Meteo')) {
    fuentes.push('<a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>');
  }
  const origen = (titulo, modo, descripcion) =>
    `<div><b>${titulo}:</b> ${modo === 'manual' ? '<span class="origen-manual">Manual</span> ' : ''}${esc(descripcion)}</div>`;
  const fuentesUsadas =
    origen('Combustible', combustibleManual ? 'manual' : 'auto',
      combustibleManual ? 'una clase para todo el corredor' :
        (sv.fuel_source || 'SIGPAC FEGA') +
        (sv.mfe_count > 0 ? ' + MFE25 local' : '; MFE25 no disponible en esta ejecución')) +
    origen('Pendiente', pendienteManual ? 'manual' : 'auto',
      r.profile_source || 'fuente no disponible') +
    origen('Viento', vientoManual ? 'manual' : 'auto',
      sv.wind_source || 'fuente no disponible');
  const cantidadTramos = n => n + (n === 1 ? ' tramo' : ' tramos');
  const suposiciones = [];
  if (combustibleSinDato) suposiciones.push(`${cantidadTramos(combustibleSinDato)} sin clase de combustible: V0 = 8 m/min para el cálculo.`);
  if (noTipificado) suposiciones.push(`${cantidadTramos(noTipificado)} con combustible positivo no tipificado: V0 = 8 m/min.`);
  if (pendienteSinDato) suposiciones.push(`${cantidadTramos(pendienteSinDato)} con elevación incompleta: FP = 2.`);
  if (vientoSinDato) suposiciones.push(`${cantidadTramos(vientoSinDato)} atravesados en horas sin pronóstico: FV = 3.`);
  const notaDiscontinuidad = discontinuidades ?
    `<p><b>Discontinuidades:</b> ${cantidadTramos(discontinuidades)} con tiempo cero por convención de esta versión. No implica que el fuego cruce una barrera instantáneamente.</p>` : '';
  const errores = [
    sv.elevation_error && 'Perfil: ' + sv.elevation_error,
    sv.wind_error && 'Viento: ' + sv.wind_error,
    sv.usos_error && 'Usos SIGPAC: ' + sv.usos_error
  ].filter(Boolean);
  const aviso = suposiciones.length ?
    `<p><b>Hipótesis provisionales.</b> ${esc(suposiciones.join(' '))} Son los factores más rápidos de la tabla VPIF actual. Acortan la ETA calculada, pero no garantizan un tiempo real de llegada.</p>` :
    '<p>Sin sustituciones por datos ausentes en este cálculo. El modelo VPIF sigue siendo experimental.</p>';
  const horaLocal = hora => {
    const fecha = new Date(hora + 'Z');
    return Number.isFinite(fecha.getTime()) ?
      new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(fecha) : '—';
  };
  const filas = resultado.rows.map((row, i) => {
    const periodos = row.wind_periods ?? [];
    const viento = periodos.length ?
      periodos.map(p => `${horaLocal(p.horaUtc)} · FV ${p.fv}`).join(' → ') : '—';
    const etiqueta = row.label || 'sin dato';
    const codigos = row.sigpac_codes?.join('/') || '—';
    const reglaCombustible = combustibleManual ? 'Selección manual uniforme' :
      'SIGPAC ' + codigos + ' · ' + (row.rule || '—');
    return `<tr><td>${i + 1}<br><small>${Math.round(row.chainage_start_m)}–${Math.round(row.chainage_end_m)} m</small></td>` +
      `<td>${esc(etiqueta)}<br><small>V0 ${row.v0 ?? '—'} · ${esc(reglaCombustible)}` +
      `${combustibleManual ? ' · <span class="origen-manual">Manual</span>' : ''}</small></td>` +
      `<td>${row.slope_signed_pct === null ? '—' : row.slope_signed_pct.toFixed(1) + ' %'}` +
      `${pendienteManual ? '<br><small class="origen-manual">Manual</small>' : ''}</td>` +
      `<td>${esc(viento)}${vientoManual ? '<br><small class="origen-manual">Manual</small>' : ''}</td>` +
      `<td>${row.vpif === null ? '—' : row.vpif.toFixed(1) + ' m/min'}</td>` +
      `<td>${Core.formatearTiempo(row.t_i_min)}</td></tr>`;
  }).join('');
  const acciones = protocolo.acciones.map(a => `<li>${esc(a)}</li>`).join('');
  const eta = Core.formatearTiempo(resultado.eta_min);
  document.getElementById('resultado').innerHTML =
    `<div class="estado ${area.clase}"><div class="etiqueta">${esc(area.etiqueta)}</div>` +
    `<div class="titulo">${esc(area.titulo)}</div><div class="desc">${esc(descripcionExposicion)}</div></div>` +
    `<div class="metricas"><div class="metrica"><div class="l">Tiempo estimado</div><div class="v">${eta}</div>` +
    `<div class="s">${vientoManual ? 'Viento manual constante durante el recorrido.' : 'Viento horario integrado durante el recorrido.'}</div></div>` +
    `<div class="metrica"><div class="l">Distancia</div><div class="v">${formatearMetros(r.distance_m)}</div>` +
    '<div class="s">Incendio → zona vulnerable.</div></div>' +
    `<div class="metrica"><div class="l">Tramos</div><div class="v">${resultado.rows.length}</div>` +
    '<div class="s">Combustible y pendiente por tramo.</div></div></div>' +
    `<details class="bloque" open><summary>${esc(protocolo.encabezado)}</summary>` +
    `<p class="bloque-intro">${esc(protocolo.titulo)}</p><ul>${acciones}</ul></details>` +
    `<details class="bloque"><summary>Cómo se calculó · ${cantidadTramos(resultado.rows.length)}</summary><div class="tec">` +
    `<div class="origenes">${fuentesUsadas}</div>` +
    `<p>La ETA suma los tiempos de los tramos. ${vientoManual ? 'El viento manual se aplica constante a todo el corredor.' : 'El viento automático cambia al entrar en cada hora del pronóstico, incluso dentro de un tramo.'} El cuadrante del mapa usa la dirección inicial.</p>` +
    `${aviso}${notaDiscontinuidad}${errores.length ? `<p><b>Incidencias de las fuentes:</b> ${esc(errores.join(' · '))}</p>` : ''}` +
    `<p>Modelo ${esc(r.model_version)}. Velocidad efectiva = distancia del tramo / tiempo integrado; si cambia el viento dentro del tramo, reúne ambos periodos.</p>` +
    `<div class="tramos-wrap"><table class="tramos"><thead><tr><th>Tramo</th><th>Combustible y regla</th>` +
    '<th>Pendiente</th><th>Viento aplicado</th><th>Velocidad efectiva</th><th>Tiempo</th>' +
    `</tr></thead><tbody>${filas}</tbody></table></div>` +
    (fuentes.length ? `<p class="fuentes-enlaces">Fuentes: ${fuentes.join(', ')}.</p>` : '') +
    '</div></details>' +
    '<div class="recordatorio"><strong>Ante peligro, 112.</strong> Sigue las indicaciones oficiales. ' +
    'Esta demo orientativa para conatos o fases iniciales no modeliza pavesas, fuego de copas ni frentes múltiples. ' +
    'No utilices la ETA para apurar una salida.</div>';
  const resumen = document.getElementById('resumen');
  resumen.className = area.clase;
  resumen.style.display = 'flex';
  document.getElementById('resumen-texto').textContent =
    `${area.titulo} · ${eta} · ${formatearMetros(r.distance_m)} · ${cantidadTramos(resultado.rows.length)}`;
}
