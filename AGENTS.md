# AGENTS.md

## Propósito
Este repositorio contiene la aplicación web activa de Alerta Fuego. Codex ejecuta trabajo técnico acotado; las decisiones de producto, ciencia, seguridad, datos, coste o alcance se toman fuera del repositorio y deben volver a ChatGPT antes de consolidarse cuando no estén ya documentadas aquí.

## Antes de cambiar código
1. Lee `README.md`.
2. Lee `docs/DOCUMENTACION_TECNICA.md`.
3. Si el cambio afecta a uso, validación o comunicación, lee también `docs/GUIA_FUNDADORES.md`.
4. Comprueba el estado actual del código y las pruebas; no presupongas que una propuesta descrita en conversaciones externas está aprobada.

## Estructura útil
- `index.html`: interfaz web activa.
- `src/core.js`: lógica pura reutilizable.
- `tests/`: pruebas reproducibles.
- `infra/worker.js`: Cloudflare Worker versionado.
- `docs/`: documentación técnica y de validación.

## Comandos
- Pruebas: `npm test`
- Worker: `npm run deploy:worker` solo con autorización explícita para desplegar.

## Restricciones
- `VPIF = V0 · FV · FP` es el baseline implementado, no una verdad científica validada.
- El modelo por tramos, nuevas fuentes de combustible/vegetación y cambios de arquitectura científica siguen sujetos a decisión y validación.
- No conviertas hipótesis o notas exploratorias en comportamiento de producción por iniciativa propia.
- No presentes la aplicación ni sus resultados como modelo profesional o validado.
- Mantén visibles procedencia, límites e incertidumbre de los datos automáticos.
- No elimines trazabilidad ni documentación histórica relevante.
- No hagas push, merge, despliegues, cambios de infraestructura o gastos sin autorización explícita.

## Calidad
- Ejecuta `npm test` tras cambios de lógica.
- Añade o ajusta tests cuando cambie comportamiento verificable.
- Mantén separadas las afirmaciones «implementado», «probado», «desplegado» y «validado externamente».
- Si un cambio estructural tiene consecuencias de producto, ciencia, seguridad, datos, coste o alcance, detente y devuelve la decisión a ChatGPT.
