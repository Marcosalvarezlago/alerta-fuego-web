# AGENTS.md

## Propósito
Este repositorio contiene la aplicación web activa de Alerta Fuego. Codex ejecuta trabajo técnico acotado; las decisiones de producto, ciencia, seguridad, datos, coste o alcance se toman fuera del repositorio y deben volver a ChatGPT antes de consolidarse cuando no estén ya documentadas aquí.

## Identidad del repositorio — comprobar antes de actuar
- **Repositorio canónico del MVP web:** `Marcosalvarezlago/alerta-fuego-web`.
- Ruta local de referencia actual de Marcos: `G:\Mi unidad\Ápeiron\data-projects\alerta-fuego-web`.
- `G:\Mi unidad\Ápeiron\data-projects\alerta-fuego` corresponde al proyecto/repositorio histórico Streamlit y **no debe usarse para auditar, modificar ni validar la demo web actual**.
- `C:\Users\marco\Documents\Alerta Fuego` es un área local de auditoría y datos, no el repositorio de la aplicación.
- Antes de cualquier misión sobre la app, verifica que la raíz contiene al menos `index.html`, `package.json`, `src/core.js` e `infra/worker.js` y que el remoto corresponde a `Marcosalvarezlago/alerta-fuego-web`.
- Si faltan `README.md`, `AGENTS.md`, `docs/adr/0001-demo-vpif-por-tramos.md` o `docs/VALIDACION_MVP.md`, **no asumas que no existen**: comprueba primero si la copia local está desactualizada respecto a `origin/main` y sincronízala solo si la operación está autorizada y no pisa cambios locales.

## Mandato actual
La siguiente demo debe conservar el modelo de José Antonio `VPIF = V0 · FV · FP` e incorporar **cálculo por tramos** antes del siguiente lanzamiento. La decisión está registrada en `docs/adr/0001-demo-vpif-por-tramos.md`.

Dirección autorizó la **implementación provisional RC1 por tramos antes de la revisión con José Antonio**. La secuencia vigente es RC1 local → validación técnica interna → revisión experta → correcciones → especificación v1.0 → validación posterior → eventual despliegue autorizado. Los cambios locales RC1 no equivalen a despliegue ni validación científica.

Rothermel, ZAFM40, WAF, LFMC, solver 2D, spotting y otras ampliaciones científicas son I+D+i futura y no deben incorporarse al MVP por iniciativa propia.

## Antes de cambiar código
1. Confirma primero la identidad del repositorio según la sección anterior.
2. Lee `README.md`.
3. Lee `docs/DOCUMENTACION_TECNICA.md`.
4. Lee `docs/adr/0001-demo-vpif-por-tramos.md`.
5. Lee `docs/VALIDACION_MVP.md`.
6. Si el cambio afecta a uso, validación o comunicación, lee también `docs/GUIA_FUNDADORES.md`.
7. Comprueba el estado actual del código y las pruebas; no presupongas que una propuesta descrita en conversaciones externas está aprobada.

## Estructura útil
- `index.html`: interfaz web activa.
- `src/core.js`: lógica pura reutilizable.
- `tests/`: pruebas reproducibles.
- `infra/worker.js`: Cloudflare Worker versionado.
- `docs/`: documentación técnica, ADR y validación.

## Comandos
- Pruebas: `npm test`
- Worker: `npm run deploy:worker` solo con autorización explícita para desplegar.

## Restricciones científicas y de producto
- La implementación actual de `VPIF = V0 · FV · FP` sigue siendo una estimación orientativa no validada profesionalmente.
- La RC1 por tramos se implementa con supuestos provisionales del preflight de agosto de 2026. José Antonio revisará el producto tangible antes de la especificación v1.0.
- SIGPAC determina el dominio; MFE25 aporta semántica solo en dominios forestales/naturales habilitados. No usar FO→pinar ni precedencia global MFE→SIGPAC.
- No inventes equivalencias silenciosas entre MFE/Anderson/ZAFM y las categorías operativas de José Antonio.
- No confundas longitud de muestreo con precisión temática de la cartografía.
- No conviertas hipótesis o notas exploratorias en comportamiento de producción por iniciativa propia.
- No presentes la aplicación ni sus resultados como modelo profesional o validado.
- Mantén visibles procedencia, límites e incertidumbre de los datos automáticos.
- No elimines trazabilidad ni documentación histórica relevante.
- No hagas push, merge, despliegues, cambios de infraestructura o gastos sin autorización explícita.

## Cuestiones reservadas para revisión con José Antonio
- Incoherencia documental: matorral `2–5 m/min` frente a `V0 = 6 m/min`.
- Confirmar si la dirección del viento afecta solo a la clasificación espacial del escenario o también a la velocidad.
- Revisar max(V0) entre candidatos, V0=8 para combustible positivo no tipificado, t_gap=0, máximo espacial FV y presentación de ETA por sector antes de consolidar v1.0.

## Calidad
- Ejecuta `npm test` tras cambios de lógica.
- Añade o ajusta tests cuando cambie comportamiento verificable.
- Mantén separadas las afirmaciones «implementado», «probado», «desplegado» y «validado externamente».
- Usa `docs/VALIDACION_MVP.md` como puertas mínimas para la siguiente demo.
- Si un cambio estructural tiene consecuencias de producto, ciencia, seguridad, datos, coste o alcance, detente y devuelve la decisión a ChatGPT.
