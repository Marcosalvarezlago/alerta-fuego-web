# AGENTS.md

## Propósito
Este repositorio contiene la aplicación web activa de Alerta Fuego. Codex ejecuta trabajo técnico acotado; las decisiones de producto, ciencia, seguridad, datos, coste o alcance se toman fuera del repositorio y deben volver a ChatGPT antes de consolidarse cuando no estén ya documentadas aquí.

## Mandato actual
La siguiente demo debe conservar el modelo de José Antonio `VPIF = V0 · FV · FP` e incorporar **cálculo por tramos** antes del siguiente lanzamiento. La decisión está registrada en `docs/adr/0001-demo-vpif-por-tramos.md`.

No implementar todavía el modelo por tramos salvo autorización explícita posterior a la revisión con José Antonio. La misión inmediata de Codex es un **preflight técnico sin cambios de código** para cerrar combustible, perfil topográfico, proveedores y divergencias repo↔despliegue.

Rothermel, ZAFM40, WAF, LFMC, solver 2D, spotting y otras ampliaciones científicas son I+D+i futura y no deben incorporarse al MVP por iniciativa propia.

## Antes de cambiar código
1. Lee `README.md`.
2. Lee `docs/DOCUMENTACION_TECNICA.md`.
3. Lee `docs/adr/0001-demo-vpif-por-tramos.md`.
4. Lee `docs/VALIDACION_MVP.md`.
5. Si el cambio afecta a uso, validación o comunicación, lee también `docs/GUIA_FUNDADORES.md`.
6. Comprueba el estado actual del código y las pruebas; no presupongas que una propuesta descrita en conversaciones externas está aprobada.

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
- El cálculo por tramos está decidido para la próxima demo, pero su especificación final debe quedar revisada antes de implementarse.
- Para combustible, MFE25 es el candidato principal a probar; Foto Fija puede aportar vigencia/cambio; SIGPAC queda como apoyo/fallback. No conviertas esta preferencia en código sin completar el preflight y la revisión de Dirección.
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
- Confirmar el paquete completo de diseño antes de modificar el programa.

## Calidad
- Ejecuta `npm test` tras cambios de lógica.
- Añade o ajusta tests cuando cambie comportamiento verificable.
- Mantén separadas las afirmaciones «implementado», «probado», «desplegado» y «validado externamente».
- Usa `docs/VALIDACION_MVP.md` como puertas mínimas para la siguiente demo.
- Si un cambio estructural tiene consecuencias de producto, ciencia, seguridad, datos, coste o alcance, detente y devuelve la decisión a ChatGPT.
