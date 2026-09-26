# ADR 0001 — Demo VPIF por tramos

**Fecha:** 2026-08-08  
**Estado actualizado 2026-09-26:** Aceptado; RC1 provisional implementada para compartir como demo experimental. La revisión científica y operativa sigue pendiente.

## Contexto

Alerta Fuego partió de una demo funcional basada en `VPIF = V0 · FV · FP`, aplicada a todo el trayecto con un único combustible, una pendiente entre extremos y un viento.

La reevaluación científica ha estudiado MFE25, Foto Fija, EIKOS, ZAFM, SIGPAC, Copernicus/CLCplus, PNOA/LiDAR, AEMET/IPIF y una futura línea Rothermel/Behave7. Esa investigación se conserva como I+D+i, pero no debe impedir cerrar una demo viable.

José Antonio ya propuso y validó conceptualmente el cálculo acumulativo por tramos sobre la línea foco → zona vulnerable.

## Decisión

La RC1 conserva la fórmula VPIF y la aplica por tramos y escenario:

```text
VPIF_i,s = V0_i · FV_s · FP_i

t_i,s = d_i / VPIF_i,s

ETA_s = Σ t_i,s
```

El cálculo por tramos está implementado en la demo experimental.

- **Pendiente:** perfil intermedio por tramos, con MDT IGN/PNOA como referencia preferente.
- **Combustible RC1:** SIGPAC determina el dominio. MFE25 aporta candidatos semánticos solo en FO/PR/MT/PA. FO no equivale a pinar. Las reglas max(V0), no tipificado V0=8 con evidencia y gap t=0 son provisionales para revisión experta. Foto Fija queda fuera de runtime.
- **Controles:** pendiente, viento y combustible ofrecen modos manuales independientes; el combustible manual es homogéneo en el corredor.
- **Viento:** se mantiene la estructura del modelo de José Antonio. No se añadirá un factor angular nuevo sin validación.
- **Rothermel:** queda fuera de este lanzamiento y pasa a I+D+i futura, preservando `VPIF-v0` como baseline.

No debe confundirse una segmentación aproximada de 30 m con precisión temática de 30 m de la cartografía de combustible.

El alcance previsto se limita a conatos o incendios en fase inicial con un frente dominante. Quedan fuera múltiples frentes, pavesas, fuego de copas y dinámica espacial compleja.

## Cuestiones abiertas para José Antonio

1. El documento original describe el matorral aproximadamente como `2–5 m/min`, pero usa `V0 = 6 m/min`. Confirmar el valor operativo.
2. Confirmar si la dirección del viento afecta únicamente a la clasificación espacial del escenario o también a la velocidad de propagación.
3. Revisar la RC1 tangible antes de consolidar la especificación v1.0; confirmar max(V0), V0 no tipificado, gaps, FV espacial y presentación de ETA.

## Seguridad

La demo seguirá siendo una estimación orientativa no validada profesionalmente. No debe utilizarse para apurar tiempos ni contradecir al 112 o a los servicios competentes.

Antes de publicar la siguiente versión debe revisarse el lenguaje que pueda implicar seguridad absoluta; en particular, evitar expresiones como «sin riesgo directo» si pueden interpretarse como garantía.

## Consecuencias

- La investigación Rothermel/ZAFM/MFE/EIKOS no se pierde: queda registrada como programa I+D+i, pero no bloquea la demo.
- El preflight de agosto de 2026 se cerró y Dirección autorizó implementar y compartir la RC1 experimental antes de consolidar v1.0.
- La publicación no incluye el fichero MFE25 local; su redistribución sigue sujeta a revisión de condiciones del conjunto de datos.
- Cambios posteriores que alteren el modelo científico, seguridad o arquitectura de datos requieren nueva decisión de Dirección.

## Fuentes canónicas externas al repositorio

- Especificación de diseño en Google Drive: `Especificación_demo_VPIF_por_tramos_v0.1_2026-08-08`.
- Registro científico/I+D+i en Google Drive: `Estado_I+D+i_Alerta_Fuego_2026-08-08`.
- Notion `🔥 Alerta Fuego`: planificación temporal y estado operativo.
