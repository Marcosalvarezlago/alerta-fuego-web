# Alerta Fuego — Guía para el equipo fundador

*Documento para revisar la demo y decidir qué debe validarse antes de presentarla como herramienta fiable.*

---

## Qué es Alerta Fuego

Alerta Fuego es una aplicación web que hace una estimación orientativa del tiempo que tardaría un frente de incendio en recorrer la distancia entre un punto de incendio y una zona vulnerable.

El cálculo combina distancia, combustible, viento y pendiente a partir del modelo `VPIF = V0 · FV · FP` de José Antonio.

La próxima demo mantiene ese modelo como baseline, pero aplicará el cálculo por tramos sobre el corredor foco → zona vulnerable. La especificación interna vigente es `v0.3 prevalidación`; **no es el documento que se enviará tal cual a José Antonio**. Tras la espera breve por posible información de EIKOS se preparará un paquete externo separado y conciso para su revisión.

---

## Qué NO es

- **No predice la evolución real completa de un incendio.** Simplifica un fenómeno que cambia continuamente.
- **No sustituye al 112, INFOEX, bomberos, Protección Civil ni a ninguna autoridad.**
- **No sirve para apurar una salida ni para justificar quedarse.**
- **No es una validación profesional del terreno, del combustible ni del viento.**
- **No debe presentarse como adecuado para incendios complejos en fase avanzada.**

La restricción prudencial de Dirección para el MVP es orientarlo a **conatos o incendios en fase inicial de expansión, con un frente dominante y condiciones relativamente simples**. No se afirma una fiabilidad cuantificada y quedan fuera de su pretensión operativa los grandes incendios complejos, múltiples frentes, spotting relevante, fuego de copas, comportamiento extremo y dinámica 2D compleja.

Ante peligro real, llama al 112 y sigue las instrucciones oficiales aunque contradigan la estimación de la aplicación.

---

## Qué hace hoy la demo publicada

La versión publicada todavía usa:

1. un combustible para el trayecto completo;
2. una pendiente calculada entre los extremos;
3. un viento para el cálculo;
4. SIGPAC como sugerencia de ocupación del suelo que la persona puede confirmar/corregir.

Ese comportamiento actual debe distinguirse del diseño de la próxima demo.

---

## Próxima demo por tramos

La arquitectura decidida es:

```text
foco → corredor → segmentos → cálculo por tramo → suma de tiempos → ETA
```

La propuesta interna de prevalidación usa:

```text
VPIF_i = V0_i · FV_s · FP_i

t_i = d_i / VPIF_i

ETA_s = Σ t_i
```

`FV_s` es, de momento, un candidato de diseño para un escenario meteorológico estático del corredor. José Antonio debe validar la interpretación final del viento y de los cuadrantes.

Los ~30 m son una referencia de integración/segmentación, **no** una afirmación de que combustible o viento tengan 30 m de precisión temática.

---

## Pendiente

Para la próxima demo se pretende obtener un perfil de elevación intermedio con MDT IGN/PNOA y calcular la pendiente local por segmentos, en vez de limitarse a la diferencia entre los extremos.

Un fallo de elevación nunca debe convertirse silenciosamente en pendiente 0. El resultado debe degradarse de forma explícita o pasar a un override avanzado.

---

## Combustible: arquitectura provisional

El flujo normal de la próxima demo debe ser **automático**: la persona usuaria no tendrá que decidir el combustible durante una situación de emergencia.

La propuesta interna es:

1. **MFE25** como backbone semántico principal: formación, estructura, especies y coberturas.
2. **SIGPAC** como segunda evidencia acotada: uso/ocupación y límites espaciales; no sustituye a MFE como semántica forestal.
3. Si varias categorías VPIF son defendibles, usar de forma provisional la de mayor `V0` para no alargar artificialmente el ETA, conservando todas las candidaturas y la regla aplicada.
4. Si el terreno puede portar combustible pero no encaja en las cuatro categorías, usar únicamente el fallback de cálculo que finalmente valide José Antonio, sin inventar una etiqueta temática.
5. El modo manual quedará solo como **Configuración avanzada / override explícito**.

Los probes multifuente no demuestran cobertura territorial. Sobre una muestra deliberadamente heterogénea de 65 posiciones/16,25 km, MFE resolvió el 61,54 % de la longitud-proxy y MFE→SIGPAC el 69,23 %. Son cifras de comparación de arquitectura, no porcentajes de Extremadura o España.

### Casos históricos a revisar

La app antigua usó reglas como `PS→pastos`, `PR→matorral`, `PA→Quercus` y `FO→pinar por prudencia`; posteriormente se manejaron también `PS→3`, `PR/MT→6`, `PA→3`, `FO→8` como heurística SIGPAC.

La nueva propuesta separa **qué combustible creemos que existe** de **qué V0 usamos como cota de cálculo**. Por eso `FO` ya no significa pinar automáticamente, `PA` no se fija a Quercus y `TA` no debe convertirse en pastos sin evidencia de cubierta herbácea.

---

## Otras fuentes y ZAFM

- **CLCplus/WorldCover:** control de cobertura/coherencia, no traductor directo a `V0`.
- **Foto Fija/EIKOS:** señales de vigencia/cambio/confianza. EIKOS está pendiente de posible información adicional de Blanca/MITECO.
- **ZAFM:** **no está descartado del proyecto**. Queda fuera como motor o fallback directo del `VPIF-v0`, pero se conserva como control científico offline y como fuente candidata para la futura línea `Rothermel + ZAFM40`.
- **Sentinel-2/LiDAR:** evolución posterior, no dependencia del MVP actual.

No se fusionarán mapas por mayoría ni se hará un crosswalk ad hoc `FBFM40→V0`.

---

## Viento y cuadrantes

La demo actual convierte la dirección meteorológica «desde» a la dirección «hacia» y usa la dirección para clasificar sectores/cuadrantes; `FV` depende de la velocidad y no existe factor angular continuo.

Los probes mostraron que no tiene sentido fingir una muestra meteorológica independiente cada 30 m. La propuesta interna plantea un FV común precautorio por escenario de corredor y escenarios estáticos `t0…+3 h`, pero debe validarlo José Antonio.

También queda pendiente aclarar si los cuadrantes son una heurística operacional de exposición o una aproximación física a la propagación, cómo agregar cambios de dirección a lo largo del corredor y si deben afectar al ETA o solo al mensaje.

---

## Qué debe mostrar un resultado responsable

- Que la cifra es una **estimación orientativa**.
- Fuente y fecha de los datos automáticos.
- Candidatos/ambigüedad cuando el combustible no sea inequívoco.
- Indicación visible de fallback, conflicto o discontinuidad no modelada.
- Alcance limitado del modelo y ausencia de representación de spotting, copas, comportamiento extremo y frente 2D.
- 112 y servicios competentes como referencia prioritaria.

Debe eliminarse o reformularse «sin riesgo directo» si puede interpretarse como garantía de seguridad.

---

## En qué punto está realmente el proyecto

- Existe una demo web funcional, pero el nuevo diseño por tramos **no está implementado**.
- Los probes técnicos de MFE, SIGPAC, viento y arquitectura multifuente están completados y preservados en Drive.
- La `v0.3` es una especificación **interna de prevalidación**, no el documento externo para José Antonio.
- Se esperarán unos días por posible respuesta de Blanca/MITECO sobre EIKOS.
- Después se preparará un paquete breve de decisiones para José Antonio.
- Solo tras su revisión se congelará una especificación `v1.0`, se autorizará implementación Codex, se harán pruebas/QA y podrá plantearse despliegue.

La pregunta de esta fase ya no es «¿qué fuente más podemos añadir?», sino «¿es coherente y suficientemente prudente esta especificación para que José Antonio la corrija y podamos validarla?».

---

*Alerta Fuego es una ayuda de anticipación en desarrollo. Ante cualquier emergencia real, llama al 112 y sigue las indicaciones de los servicios competentes.*
