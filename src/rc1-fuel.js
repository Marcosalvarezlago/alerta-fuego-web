// Resolución temática provisional RC1. Las reglas MFE usan presencia explícita,
// nunca traducen clases ajenas ni convierten ausencia de dato en combustible.
export const V0_RC1 = Object.freeze({ pastos: 3, quercus: 4, matorral: 6, pinar: 8 });
const GAP = new Set(['AG', 'CA', 'ED', 'ZU']);
const MFE_DOMAINS = new Set(['FO', 'MT', 'PR', 'PA']);
const UNTYPED_POSITIVE = new Set(['FO', 'CF', 'CI', 'CS', 'CV', 'FF', 'FL', 'FS', 'FV', 'FY', 'OC', 'OF', 'OV', 'VF', 'VI', 'VO']);
const NATURAL = new Set(['Bosque Adehesado', 'Bosque', 'Bosque de Plantación',
  'Herbazal-Pastizal', 'Arbustedos', 'Pastizal-Matorral', 'Matorral con arbolado disperso',
  'Herbazal-Pastizal con dehesa hueca', 'Galerías arbustivas', 'Prados']);
const PASTURE = new Set(['Herbazal-Pastizal', 'Prados', 'Herbazal-Pastizal con dehesa hueca', 'Pastizal-Matorral']);
const QUERCUS = /^(Quercus (ilex|suber|pyrenaica|faginea)|Q\. (ilex|suber|pyrenaica|faginea))$/i;
const QUERCUS_FORM = /^(Encinares|Alcornocales|Melojares|Quejigares|Dehesas)/i;

function numeroPositivo(v) { return Number.isFinite(Number(v)) && Number(v) > 0; }

export function candidatosMfe(mfe) {
  if (!mfe || typeof mfe !== 'object') return [];
  const out = [];
  const add = (categoria, regla, evidencia) => out.push({ categoria, v0: V0_RC1[categoria], regla, evidencia,
    source: 'MFE25', feature_id: mfe.feature_id ?? mfe.fid ?? null });
  if (PASTURE.has(mfe.DesTipEstr) &&
      ['HERBAZAL/PASTIZAL', 'PASTIZAL DE ALTA MONTAÑA'].includes(mfe.FormHerbac) && numeroPositivo(mfe.FCCHER)) {
    add('pastos', 'P1', ['DesTipEstr', 'FormHerbac', 'FCCHER']);
  }
  if (QUERCUS.test(mfe.Especie1 ?? '') && QUERCUS_FORM.test(mfe.FormArbol ?? '') && numeroPositivo(mfe.FCCARB)) {
    add('quercus', 'Q1', ['Especie1', 'FormArbol', 'FCCARB']);
  }
  if (NATURAL.has(mfe.DesTipEstr) && mfe.FormArbust && numeroPositivo(mfe.FCCMAT)) {
    add('matorral', 'M1', ['DesTipEstr', 'FormArbust', 'FCCMAT']);
  }
  if (/^Pinus /i.test(mfe.Especie1 ?? '') && /^Pinar /i.test(mfe.FormArbol ?? '') && numeroPositivo(mfe.FCCARB)) {
    add('pinar', 'PI1', ['Especie1', 'FormArbol', 'FCCARB']);
  }
  return out;
}

export function resolverCombustible({ sigpac, mfe = [], combustiblePositivo = false, manual = null } = {}) {
  const recintos = (Array.isArray(sigpac) ? sigpac : sigpac ? [sigpac] : [])
    .map(r => typeof r === 'string' ? { uso: r } : r)
    .filter(r => /^[A-Z]{2}$/.test(r.uso ?? ''))
    .sort((a, b) => String(a.feature_id ?? '').localeCompare(String(b.feature_id ?? '')));
  const mfes = (Array.isArray(mfe) ? mfe : [mfe]).filter(Boolean)
    .sort((a, b) => String(a.feature_id ?? a.fid ?? '').localeCompare(String(b.feature_id ?? b.fid ?? '')));
  const codes = [...new Set(recintos.map(r => r.uso))].sort();
  const base = { sigpac_codes: codes, sigpac_feature_ids: recintos.map(r => r.feature_id ?? null),
    mfe_feature_ids: mfes.map(m => m.feature_id ?? m.fid ?? null), candidates: [],
    conflict: recintos.length > 1, fallback: null, confidence: 'provisional', source: ['SIGPAC'] };
  if (!codes.length) {
    if (manual && Object.hasOwn(V0_RC1, manual)) return { ...base, status: 'manual',
      label: `manual: ${manual}`, v0: V0_RC1[manual], fallback: 'manual_explicit',
      rule: 'manual_missing_sigpac_v1', source: ['manual'] };
    return { ...base, status: 'nodata', label: 'SIGPAC sin dato', v0: null, rule: 'missing_sigpac' };
  }
  if (codes.every(c => GAP.has(c))) {
    return { ...base, status: 'gap', label: `cruce incierto ${codes.join(' / ')}`, v0: 8,
      rule: 'sigpac_uncertain_crossing_v0_8_v2', gap_type: codes.join('/'), conflict: base.conflict || mfes.length > 0 };
  }
  if (codes.some(c => GAP.has(c))) return { ...base, status: 'nodata', label: 'límite combustible/cruce incierto',
    v0: null, conflict: true, rule: 'mixed_domain_boundary' };
  const candidates = [];
  const add = (categoria, uso) => candidates.push({ categoria, v0: V0_RC1[categoria], source: 'SIGPAC',
    feature_id: recintos.find(r => r.uso === uso)?.feature_id ?? null, regla: `sigpac_${uso}`, evidencia: ['uso'] });
  for (const c of codes) {
    if (c === 'PS') add('pastos', c);
    if (c === 'PR' || c === 'MT') add('matorral', c);
  }
  const consultarMfe = codes.every(c => MFE_DOMAINS.has(c));
  if (consultarMfe) {
    for (const m of mfes) candidates.push(...candidatosMfe(m));
    if (mfes.length) base.source.push('MFE25');
  }
  // PA combina pasto y árboles: sin clase MFE concluyente, pastos=3 sería una falsa certeza.
  if (codes.includes('PA') && !candidates.some(c => c.source === 'MFE25')) {
    return { ...base, status: 'untyped', candidates,
      label: 'pasto con arbolado · combustible no tipificado', v0: 8,
      conflict: base.conflict || codes.length > 1, fallback: 'untyped_v0_8',
      rule: 'pa_without_mfe_class_v1', confidence: 'baja' };
  }
  const unique = [...new Map(candidates.map(c => [`${c.categoria}:${c.source}:${c.feature_id}`, c])).values()];
  const categorias = [...new Set(unique.map(c => c.categoria))].sort();
  if (combustiblePositivo && codes.some(c => c !== 'FO' && UNTYPED_POSITIVE.has(c)) && categorias.length) {
    return { ...base, status: 'untyped', candidates: unique,
      label: 'mezcla con combustible no tipificado · valor conservador', v0: 8,
      conflict: true, fallback: 'untyped_v0_8', rule: 'mixed_positive_fuel_max_v0_v1', confidence: 'baja' };
  }
  if (categorias.length) return { ...base, status: 'classified', candidates: unique,
    label: categorias.length > 1 ? `clasificación ambigua: ${categorias.join(' / ')}` : categorias[0],
    v0: Math.max(...unique.map(c => c.v0)), conflict: base.conflict || categorias.length > 1,
    rule: categorias.length > 1 ? 'max_candidate_v0_v1' : 'single_candidate_v1' };
  if (manual && Object.hasOwn(V0_RC1, manual)) return { ...base, status: 'manual', label: `manual: ${manual}`,
    v0: V0_RC1[manual], fallback: 'manual_explicit', rule: 'manual_v1' };
  if (combustiblePositivo) return { ...base, status: 'untyped',
    label: 'combustible no tipificado · valor conservador', v0: 8,
    fallback: 'untyped_v0_8', rule: 'positive_fuel_evidence_v1', confidence: 'baja' };
  return { ...base, status: 'nodata', label: 'combustible indeterminado', v0: null,
    rule: consultarMfe && !mfes.length ? 'missing_mfe' : 'unclassified_domain' };
}
