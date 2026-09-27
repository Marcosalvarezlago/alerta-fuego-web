import test from 'node:test';
import assert from 'node:assert/strict';
import { pintarResultadoRc1 } from '../src/rc1-view.js';

test('la vista muestra ETA provisional y evita vigilancia verde con datos ausentes', () => {
  const elements = new Map();
  const previous = globalThis.document;
  globalThis.document = { getElementById(id) {
    if (!elements.has(id)) elements.set(id, { innerHTML: '', className: '',
      style: {}, textContent: '' });
    return elements.get(id);
  } };
  try {
    const row = { chainage_start_m: 0, chainage_end_m: 30, label: 'TA · supuesto prudente',
      sigpac_codes: ['TA'], rule: 'unclassified_domain', v0: 8,
      slope_signed_pct: 0, vpif: 8, t_i_min: 3.75,
      nodata_flags: { fuel: true, elevation: false, wind: false } };
    const result = { scenarios: [{ eta_min: 180, status: 'provisional',
      scenario: 't0', horaUtc: '2026-09-27T10:00',
      exposure: { cuadrante: 'riesgo' }, rows: [row] }],
      source_versions: { fuel_source: 'SIGPAC parcial', mfe_count: 0,
        wind_source: 'Open-Meteo forecast 10m' },
      profile_source: 'IGN MDT05 WCS', model_version: 'vpif-rc1-provisional-2',
      distance_m: 30 };
    pintarResultadoRc1(result, {
      Core: { escaparHtml: x => String(x), formatearTiempo: () => '3 h',
        clasificarEscenario: () => 'vigilancia_preventiva' },
      TEXTO_CUADRANTE: { riesgo: { clase: 'riesgo', etiqueta: 'Exposición principal',
        titulo: 'Cuadrante de riesgo', desc: 'Prueba' } },
      NOMBRE_CUADRANTE: { riesgo: 'riesgo' },
      PROTOCOLOS: { provisional: { encabezado: '⚠️ Preparación con datos incompletos',
        titulo: 'ETA PROVISIONAL', acciones: ['No aplaces decisiones.'] } },
      formatearMetros: () => '30 m'
    });
    const html = elements.get('resultado').innerHTML;
    assert.match(html, /3 h · prudente/);
    assert.match(html, /ETA PROVISIONAL/);
    assert.match(html, /V0 = 8, FV = 3 o FP = 2/);
    assert.match(html, /SIGPAC parcial/);
    assert.match(html, /Comparación de viento por horas/);
    assert.match(html, /Viento de referencia/);
    assert.doesNotMatch(html, /2026-09-27T10:00/);
    assert.doesNotMatch(html, /VIGILANCIA PREVENTIVA/);
  } finally {
    globalThis.document = previous;
  }
});
