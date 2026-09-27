# ADR 0002 — Cruces inciertos en la ETA RC1

**Fecha:** 2026-09-27  
**Estado:** aplicada provisionalmente en la demo experimental; pendiente de evaluación científica y operativa.  
**Sustituye:** la regla de tiempo cero para AG/CA/ED/ZU de ADR 0001.

## Problema observado

La RC1 asignaba cero minutos a los tramos SIGPAC AG, CA, ED y ZU. Así un tramo de longitud positiva desaparecía de la ETA y del avance horario: el viento previsto para la siguiente hora podía aplicarse demasiado tarde. Tampoco había evidencia para afirmar que esos usos garantizasen un paso instantáneo o una detención del incendio.

El [anexo SIGPAC del Real Decreto 1047/2022](https://www.boe.es/buscar/pdf/2022/BOE-A-2022-23047-consolidado.pdf) define AG como agua, CA como viales, ED como edificaciones y ZU como zona urbana. Son clases de uso; no aportan por sí solas anchura efectiva, combustible fino, continuidad, protección ni probabilidad de ignición al otro lado. La [investigación del US Forest Service sobre eficacia de cortafuegos](https://research.fs.usda.gov/treesearch/66232) identifica la influencia del comportamiento del incendio, meteorología y extinción. El [glosario NWCG](https://training.nwcg.gov/pre-courses/FI210/html/nifc___full_main_p206.htm) describe los focos secundarios por pavesas más allá de la zona de ignición directa.

## Decisión provisional

Para AG/CA/ED/ZU inequívocos se integra todo el tramo con `VPIF = 8 · FV_h · FP_i` m/min. El tiempo `d_i / VPIF` es positivo y el cambio de hora del pronóstico se aplica al llegar a él, como en cualquier otro tramo. La salida conserva el código SIGPAC y la marca de **cruce incierto**, y la ETA se marca provisional. Si falta viento o elevación, se aplican además FV=3 o FP=2 con banderas propias. Los límites mixtos entre estos usos y combustible siguen como NoData.

Se toma 8 porque es el mayor V0 de las cuatro clases VPIF existentes. Dentro de esa tabla produce una ETA más temprana que V0=3, 4 o 6 para el mismo viento y pendiente. No procede de una medida de propagación sobre agua, carretera o edificación. La regla representa una **hipótesis de aviso temprano** y no una predicción validada de cruce ni una cota física inferior del tiempo real.

## Alternativas consideradas

- **Tiempo cero:** adelanta más la ETA, pero equivale a un salto sin duración y omite cambios horarios del viento. Se descarta por incoherencia matemática y comunicativa.
- **V0=3 o velocidad aún menor:** representa una ralentización o freno y da más tiempo de llegada. Sin datos sobre anchura y eficacia de la barrera podría retrasar indebidamente el aviso.
- **Detener la ETA en la barrera:** trataría un código de uso como prueba de que el fuego no la supera. Los focos secundarios y la heterogeneidad de esos usos impiden sostenerlo.
- **Modelo específico de salto o cruce:** sería preferible con datos y validación propios; queda como investigación futura.

## Límites y riesgos

Una carretera, masa de agua, edificio o zona urbana pueden comportarse de formas muy distintas según anchura, vegetación, meteorología e intervención. El fuego puede avanzar por combustible cercano, rodear el obstáculo o iniciar focos por pavesas; la RC1 no modeliza esos procesos. En algunos casos la ETA resultará demasiado temprana y en otros demasiado tardía. La etiqueta «prudente» se refiere solo a escoger el V0 máximo **dentro del VPIF vigente**; no debe interpretarse como garantía para decisiones de evacuación.

## Registro de investigación y correcciones pendientes

1. Reunir corredores con AG/CA/ED/ZU y contrastarlos con ortofoto, cartografía de mayor resolución y geometría de cada obstáculo; registrar fecha, escala, calidad y anchura efectiva.
2. Separar agua/viales de edificaciones/urbano si los datos permiten reglas distintas. Examinar vegetación en márgenes y estructuras capaces de transportar el fuego.
3. Recopilar episodios observados de detención, rodeo, cruce directo y focos secundarios, con viento y actuaciones de extinción. Evitar usar la misma muestra para diseñar y validar una nueva regla.
4. Hacer análisis de sensibilidad de ETA y orden de prioridad con tiempo cero, V0=8, velocidades menores y un modelo de cruce explícito. Examinar los casos en que cambia el protocolo mostrado.
5. Evaluar un modelo que represente probabilidades o intervalos de cruce, con incertidumbre de posición y de tiempo, antes de introducirlo en la demo. Cualquier nueva ecuación requiere decisión de producto y revisión científica.
6. Revisar con especialistas forestales y operativos la redacción, los ejemplos reales y el riesgo de que «cruce incierto» se confunda con un paso asegurado.
7. Si se modifica la regla, versionar código y documentación, añadir casos reproducibles con datos conocidos y comparar resultados públicos tras despliegue.

La revisión de MFE25 público es una línea separada: añadir cobertura vectorial y atributos podría mejorar la identificación del combustible adyacente, pero MFE25 no convierte por sí solo AG/CA/ED/ZU en un modelo de cruce.

## Verificación de esta decisión

Pruebas de tiempo positivo, marca provisional, fallback por viento y avance del reloj al atravesar una frontera horaria. La validación con incendios reales y la revisión operativa permanecen pendientes.
