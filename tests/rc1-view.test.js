import test from 'node:test';
import assert from 'node:assert/strict';
import { pintarResultadoRc1 } from '../src/rc1-view.js';

test('la ETA única muestra los tramos, reserva hipótesis al detalle y etiqueta entradas manuales', () => {
  const elements = new Map();
  const previous = globalThis.document;
  globalThis.document = { getElementById(id) {
    if (!elements.has(id)) elements.set(id, { innerHTML: '', className: '',
      style: {}, textContent: '' });
    return elements.get(id);
  } };
  const context = {
    Core: { escaparHtml: x => String(x), formatearTiempo: () => '3 h',
      clasificarEscenario: () => 'vigilancia_preventiva' },
    TEXTO_CUADRANTE: { riesgo: { clase: 'riesgo', etiqueta: 'Viento inicial',
      titulo: 'Exposición principal', desc: 'Prueba' } },
    PROTOCOLOS: {
      provisional: { encabezado: 'Preparación y seguimiento',
        titulo: 'Sigue las indicaciones oficiales.', acciones: ['Prepara una salida.'] },
      vigilancia_preventiva: { encabezado: 'Seguimiento',
        titulo: 'Sigue la evolución.', acciones: ['Consulta fuentes oficiales.'] }
    },
    formatearMetros: () => '30 m'
  };
  try {
    const row = { chainage_start_m: 0, chainage_end_m: 30, label: 'TA · supuesto V0=8',
      sigpac_codes: ['TA'], rule: 'unclassified_domain', v0: 8,
      slope_signed_pct: 0, vpif: 8, t_i_min: 3.75, wind_periods: [
        { horaUtc: '2026-09-27T10:00', fv: 1.5,
          wind_points: [{ velocidadKmh: 12 }, { velocidadKmh: 22 }] }
      ], nodata_flags: { fuel: true, elevation: false, wind: false } };
    const result = { scenarios: [{ eta_min: 180, status: 'provisional',
      exposure: { cuadrante: 'riesgo' }, rows: [row] }],
      source_versions: { fuel_source: 'SIGPAC parcial', mfe_count: 0,
        wind_source: 'Open-Meteo pronóstico horario 10 m' },
      profile_source: 'IGN MDT05 WCS', model_version: 'vpif-rc1-cruce-2',
      distance_m: 30 };
    pintarResultadoRc1(result, context);
    const html = elements.get('resultado').innerHTML;
    const visible = html.split('<details class="bloque"><summary>Cómo se calculó')[0];
    assert.match(visible, /Tiempo estimado/);
    assert.match(visible, /<div class="v">3 h/);
    assert.doesNotMatch(visible, /<div class="l">Tramos/);
    assert.match(visible, /Preparación y seguimiento/);
    assert.doesNotMatch(visible, /Hipótesis provisionales|V0 = 8|prudente|Indeterminada/);
    assert.match(html, /Cómo se calculó · 1 tramo/);
    assert.ok(html.includes('22 km/h · FV 1.5'));
    assert.doesNotMatch(elements.get('resumen-texto').textContent, /tramo/);
    assert.match(html, /Hipótesis provisionales/);
    assert.match(html, /1 tramo sin clase de combustible/);
    assert.doesNotMatch(html, /Comparación de viento por horas|Viento \+1 h/);

    result.scenarios[0].rows[0].gap_flag = true;
    result.scenarios[0].rows[0].label = 'cruce incierto CA';
    pintarResultadoRc1(result, context);
    const cruce = elements.get('resultado').innerHTML;
    assert.match(cruce, /1 tramo de cruce incierto SIGPAC: V0 = 8 m\/min/);
    assert.match(cruce, /tiempo de esos cruces es positivo/);
    assert.doesNotMatch(cruce, /tiempo cero/);

    result.scenarios[0].rows[0].gap_flag = false;
    result.scenarios[0].status = 'ok';
    result.scenarios[0].rows[0].nodata_flags.fuel = false;
    result.source_versions = { fuel_source: 'combustible manual homogéneo',
      fuel_mode: 'manual', slope_mode: 'manual', wind_mode: 'manual',
      wind_source: 'viento manual homogéneo' };
    result.profile_source = 'pendiente manual homogénea';
    pintarResultadoRc1(result, context);
    const manual = elements.get('resultado').innerHTML;
    assert.match(manual, /Combustible:<\/b> <span class="origen-manual">Manual/);
    assert.match(manual, /Pendiente:<\/b> <span class="origen-manual">Manual/);
    assert.match(manual, /Viento:<\/b> <span class="origen-manual">Manual/);
  } finally {
    globalThis.document = previous;
  }
});
