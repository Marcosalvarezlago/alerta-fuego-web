# ADR 0001 — Demo VPIF por tramos

**Fecha:** 2026-08-08  
**Actualización:** 2026-08-10  
**Estado:** Aceptado como dirección de diseño; implementación pendiente de revisión final con José Antonio.

## Contexto

Alerta Fuego dispone de una demo funcional basada en `VPIF = V0 · FV · FP`, aplicada hoy a todo el trayecto con un único combustible, una pendiente entre extremos y un viento.

La reevaluación científica ha estudiado MFE25, Foto Fija, EIKOS, ZAFM, SIGPAC, Copernicus/CLCplus, PNOA/LiDAR, AEMET/IPIF y una futura línea Rothermel/Behave7. Esa investigación se conserva como I+D+i, pero no debe impedir cerrar una demo viable.

José Antonio ya propuso y validó conceptualmente el cálculo acumulativo por tramos sobre la línea foco → zona vulnerable.

## Decisión base

La siguiente demo conservará el modelo de José Antonio y aplicará cálculo acumulativo por tramos:

```text
VPIF_i = V0_i · FV · FP_i

t_i = d_i / VPIF_i

ETA = Σ t_i
```

La forma exacta de `FV` y de los escenarios meteorológicos se mantiene pendiente de revisión con José Antonio.

- **Pendiente:** perfil intermedio por tramos, con MDT IGN/PNOA como referencia preferente.
- **Combustible:** automático en el flujo normal; manual solo como override avanzado y explícito.
- **Viento:** se mantiene la estructura del modelo de José Antonio. No se añadirá un factor angular nuevo sin validación.
- **Rothermel:** queda fuera de este lanzamiento y pasa a I+D+i futura, preservando `VPIF-v0` como baseline.

No debe confundirse una segmentación aproximada de 30 m con precisión temática de 30 m de la cartografía de combustible o del viento.

## Actualización de prevalidación — 10/08/2026

Los probes técnicos posteriores a la decisión base permiten formular una propuesta interna más concreta, todavía no autorizada para implementación:

### Combustible

- MFE25 se mantiene como **backbone semántico principal** para construir candidatos VPIF a partir de estructura, formación, especies y coberturas.
- SIGPAC queda como **segunda evidencia acotada** de uso/ocupación y delimitación espacial; no es combustible primario y no prevalece automáticamente sobre MFE en forestal.
- Los conflictos entre fuentes no se resuelven por mayoría simple.
- Ante varias categorías VPIF plausibles, Dirección propone seleccionar la de mayor `V0` como regla conservadora inicial, conservando candidatos, fuente, regla y confianza.
- La especificación interna propone un fallback de cálculo para combustible no tipificado separado de la etiqueta temática. Debe validarlo José Antonio antes de producción.
- CLCplus/WorldCover, Foto Fija/EIKOS y ZAFM quedan como control, vigencia o validación offline en este MVP, no como traductores runtime directos a `V0`.

El probe multifuente de 65 posiciones/16,25 km produjo un 61,54 % de longitud-proxy con candidato MFE y 69,23 % con jerarquía MFE→SIGPAC. Son métricas del ensayo, no estimaciones de cobertura territorial.

### ZAFM

ZAFM **no se descarta del proyecto**. Se descarta únicamente como motor/fallback directo del `VPIF-v0` y como crosswalk ad hoc `FBFM40→V0`. Se conserva como control científico offline y como fuente candidata para la futura línea `Rothermel + ZAFM40`.

### Viento

La especificación interna v0.3 propone evaluar un `FV` común del corredor por escenario meteorológico y escenarios estáticos `t0…+3 h`, evitando fingir viento independiente cada 30 m. Esta parte sigue pendiente de José Antonio.

### Alcance prudencial

Dirección limita provisionalmente el uso pretendido de la próxima demo a **conatos o incendios en fase inicial de expansión y escenarios relativamente simples con un frente dominante**. Es una restricción de producto y seguridad, no una afirmación de fiabilidad cuantificada.

No debe presentarse la demo como adecuada para incendios complejos en fase avanzada, múltiples frentes, spotting/pavesas relevantes, fuego de copas, comportamiento extremo o dinámica 2D compleja.

## Cuestiones abiertas para José Antonio

1. Confirmar la arquitectura acumulativa por tramos.
2. El documento original describe el matorral aproximadamente como `2–5 m/min`, pero usa `V0 = 6 m/min`.
3. Validar `max(V0)` entre candidatos plausibles y la política para combustible no tipificado.
4. Revisar especialmente las reglas/casos históricos SIGPAC (`PS`, `PR/MT`, `PA`, `FO`, `TA` y usos fuera de taxonomía).
5. Aclarar si los cuadrantes son una heurística operacional o una aproximación física y si afectan al ETA o solo al mensaje.
6. Confirmar la agregación del viento por corredor/escenario y los escenarios horarios.
7. Confirmar el alcance prudencial de uso: fase inicial/conatos frente a incendios complejos avanzados.
8. Revisar el paquete completo de diseño antes de modificar el programa.

## Seguridad

La demo seguirá siendo una estimación orientativa no validada profesionalmente. No debe utilizarse para apurar tiempos ni contradecir al 112 o a los servicios competentes.

Antes de publicar la siguiente versión debe revisarse el lenguaje que pueda implicar seguridad absoluta; en particular, evitar expresiones como «sin riesgo directo» si pueden interpretarse como garantía.

## Consecuencias

- La investigación Rothermel/ZAFM/MFE/EIKOS no se pierde: queda registrada como programa I+D+i, pero no bloquea la demo.
- Codex no debe implementar todavía el modelo por tramos. Primero se cierra la especificación interna y se prepara un paquete breve específico para José Antonio.
- La especificación `v0.3` de Drive es **interna**; no es el documento que se enviará directamente a José Antonio.
- Se esperarán unos días por posible respuesta de Blanca/MITECO sobre EIKOS; solo se reabrirá esta arquitectura si aporta información material.
- Tras la revisión de José Antonio se consolidará una especificación `v1.0` y se autorizará explícitamente la implementación.
- Cambios posteriores que alteren el modelo científico, seguridad o arquitectura de datos requieren nueva decisión de Dirección.

## Fuentes canónicas externas al repositorio

- Especificación interna de prevalidación en Google Drive: `Especificación_interna_demo_VPIF_por_tramos_v0.3_prevalidación_2026-08-09`.
- Registro científico y de decisiones en Google Drive: `Registro_decisiones_hipótesis_preguntas_abiertas_10_Ciencia_y_modelo_2026-08-08`.
- Evidencia técnica: `Preflight_MVP_2026-08-08`, incluidos `DESIGN_PROBE_FUEL_WIND` y `DESIGN_PROBE_MULTISOURCE_FUEL`.
- Notion `🔥 Alerta Fuego`: planificación temporal, oportunidades y estado operativo.
