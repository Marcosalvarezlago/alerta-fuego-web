# RC1 — política provisional de combustible automático

**Estado: hipótesis provisional del modelo, sujeta a revisión técnica.** No es una validación científica de velocidades de propagación. En modo automático, la web identifica cada tramo con los recintos SIGPAC FEGA y, cuando existe, la información MFE25 local. En modo manual, aplica un combustible uniforme al corredor. Conserva código, identificador de recinto, regla, conflicto y fallback en el resultado automático.

| Evidencia en el tramo | Regla RC1 | V0 (m/min) |
|---|---|---:|
| SIGPAC PS | Candidato pastos por uso «pastizal» | 3 |
| SIGPAC PR o MT | Candidato matorral por uso arbustivo/matorral | 6 |
| Dominio FO/PR/MT/PA con MFE25 concluyente | Candidatos según estructura, formación, especie y cubierta | 3, 4, 6 u 8 |
| Varios candidatos fiables | Máximo de los V0 candidatos, con etiqueta de ambigüedad | máximo |
| PA sin clase MFE25 concluyente | Pasto con arbolado no tipificado; no se reduce a PS | 8 provisional |
| FO sin clase MFE25 concluyente | Forestal no tipificado; no se etiqueta pinar | 8 provisional |
| Cultivo permanente o asociación CF/CI/CS/CV/FF/FL/FS/FV/FY/OC/OF/OV/VF/VI/VO | Combustible agrícola no tipificado | 8 provisional |
| Mezcla de clase tipificada con cultivo permanente | Valor conservador y conflicto visible | 8 |
| AG/CA/ED/ZU inequívoco | Discontinuidad; convención `t_gap = 0` | no aplica |
| TA/TH, IM/EP/ZC/ZV, SIGPAC ausente o uso sin correspondencia | NoData conservado; ETA provisional con supuesto V0=8 | 8 supuesto |

`V0 = 8` es el valor más alto de las cuatro clases actuales del modelo. Para combustible positivo no tipificado se aplica como hipótesis provisional. Cuando no hay evidencia de combustible, la clasificación sigue siendo NoData, pero el motor también calcula con 8 para entregar la ETA prudente solicitada; deja visible el supuesto por tramo y marca el escenario como provisional. Esto acorta el tiempo calculado dentro de la tabla VPIF, **no es una cota física demostrada** para cualquier incendio. Si faltan viento o pendiente se usan FV=3 o FP=2 y se señalan del mismo modo. El modo manual sigue disponible.

La regla para FO evita inventar una especie: se muestra “combustible no tipificado”, no “pinar”. En pasto con arbolado sin MFE25 concluyente y en cultivos permanentes, 8 es una hipótesis preventiva provisional de la velocidad base; cobertura, manejo y época pueden cambiar la realidad. No se asigna la etiqueta «pinar» por escoger 8. Las clases PR/MT conservan por ahora `V0 = 6`, pese a la discrepancia con el intervalo 2–5 m/min del documento histórico.

El cálculo por tramos usa `VPIF_i,s = V0_i · FV_s · FP_i` y `ETA_s = Σ(d_i/VPIF_i,s)`. Viento horario y pendiente firmada se documentan en [DOCUMENTACION_TECNICA.md](DOCUMENTACION_TECNICA.md). Las discontinuidades con tiempo cero son una convención contable del modelo; **no demuestran que el fuego las atraviese instantáneamente ni que detengan un incendio**.

## Cuestiones para revisión técnica antes de consolidar la política

1. ¿Se aprueba `V0 = 8` como sobreestimación prudente para FO sin clase MFE25 y para OV/VI/FY/FS/CI, o deben quedar sin ETA?
2. ¿Deben variar estas hipótesis según densidad, manejo, época o cobertura del cultivo? ¿Qué campo verificable permitiría hacerlo automáticamente?
3. ¿Es adecuado usar el máximo entre candidatos MFE25/SIGPAC en límites y conflictos, o conviene otra regla?
4. ¿Se mantiene `V0 = 6` para PR/MT y el matorral MFE25 frente al intervalo histórico 2–5?
5. ¿Cómo debe tratarse una discontinuidad AG/CA/ED/ZU en una ETA de recorrido? ¿Qué prueba permite considerarla cortafuegos real?
6. ¿Debe mostrarse una ETA condicional cuando la zona cae fuera del sector principal según el viento?

**Criterio de cierre:** registrar respuesta, fecha y versión de reglas; modificar código, pruebas y textos si cambia una hipótesis; volver a validar con corredores reales antes de presentar el modelo como fiable.

## Fundamento bibliográfico y límites de la asociación (revisión 2026-09-27)

- El [anexo de usos SIGPAC del BOE](https://www.boe.es/eli/es/rd/2022/12/27/1047/con/20231228) distingue PS (pastizal), PR (pasto arbustivo), MT (matorral), PA (pasto con arbolado), TA (tierras arables), TH (huerta) y las asociaciones de cultivos permanentes. Esta nomenclatura sustenta candidatos de **tipo de cubierta**, no velocidades observadas.
- La [metodología MFE25 del MITECO](https://www.miteco.gob.es/es/biodiversidad/temas/inventarios-nacionales/mapa-forestal-espana/metodologia-mfe-25-.html) registra teselas con tipo estructural, formación, especie y cobertura. Su tesela mínima general es 1 ha y la agrícola 2 ha. Por eso se exigen atributos explícitos y no se interpreta la subdivisión de cálculo de 30 m como resolución cartográfica.
- El [IFN4 del MITECO](https://www.miteco.gob.es/content/dam/miteco/es/biodiversidad/temas/inventarios-nacionales/ifn/ifn4/ifn4_avila_tcm30-536200.pdf) diferencia la propagación por pasto, matorral, hojarasca bajo arbolado y restos. Es evidencia de que «pasto con arbolado» no equivale siempre a pastizal bajo.
- La [guía de modelos de combustible del NWCG](https://www-nwcg.fs2c.usda.gov/publications/pms437/fuels/surface-fuel-model-descriptions) distingue cultivos mantenidos sin combustible propagador de cereales curados, hierba bajo viñedos y frutales. El código agrícola no permite conocer ese estado estacional; TA/TH conservan NoData y los cultivos permanentes quedan no tipificados. No se importa ninguna velocidad NWCG al VPIF.
- La [especificación interna por tramos v0.3](https://docs.google.com/document/d/1aKs7VR50NoGe_Xl9zzrRagDHK9PRCUULewHESl8-Eh8/edit) ya contemplaba PS→3, PR/MT→6, PA condicionado a MFE y la ausencia de equivalencia universal TA/TH. Es una propuesta de diseño, no una validación de campo.

**Criterio aplicado:** seleccionar una de las cuatro clases VPIF solo cuando los atributos disponibles la sostienen; si la cubierta es mixta, conservar los candidatos y usar el V0 mayor; si el uso no permite discriminar, conservar «no tipificado» o NoData y calcular una ETA provisional con V0=8. Las cifras V0 y la tabla de factores son parámetros del modelo VPIF del proyecto, no velocidades deducidas de estas fuentes. Por tanto «prudente» significa menor ETA dentro de esa tabla, sin garantía física.

## Disponibilidad de MFE25

El MFE25 de Extremadura está instalado para la ejecución local y se usa cuando el corredor cruza teselas cubiertas. El Worker y GitHub Pages públicos entregan geometría y usos SIGPAC, pero actualmente devuelven una lista MFE vacía: **la demo pública no consulta MFE25**. El [catálogo MITECO](https://catalogo.datosabiertos.miteco.gob.es/catalogo/dataset/ac11b891-6c6c-4458-b89c-2b73f593d019) ofrece el conjunto nacional y un servicio WMS de visualización/consulta. Para incorporarlo al cálculo público se necesita un servicio vectorial o un derivado con geometrías completas y atributos, actualización, cobertura, atribución y pruebas de latencia. Un WMS de visualización por sí solo no reproduce con fiabilidad los cortes de teselas del corredor. El estado público actual se muestra como «MFE25 no disponible en esta ejecución».
