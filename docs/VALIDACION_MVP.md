# Validación de la próxima demo MVP

**Estado 2026-09-26:** RC1 provisional preparada como demo pública experimental. Su publicación no acredita validación científica u operativa.

Este documento define las puertas mínimas antes de presentar la siguiente versión de Alerta Fuego como demo pública coherente. No sustituye pruebas científicas ni operativas.

## 1. Especificación provisional RC1 y gate v1.0

Dirección autorizó implementar y compartir la RC1 experimental antes de la revisión experta. Antes de consolidar v1.0:

- [x] Documentar especificación candidata `VPIF` por tramos del preflight.
- [x] Dejar explícitamente abiertas las reglas provisionales de combustible por tramo.
- [x] Ejecutar preflight técnico de MFE25/Foto Fija/SIGPAC y perfil MDT IGN/PNOA.
- [ ] Confirmar con José Antonio el valor de matorral (`2–5` frente a `V0=6`).
- [ ] Confirmar con José Antonio el papel de la dirección del viento en la velocidad.
- [ ] Revisar la RC1 tangible y sus supuestos con José Antonio.

## 2. Gate de fidelidad científica/documental

Tras implementación:

- [ ] Las tablas y fronteras del modelo coinciden con la especificación validada.
- [ ] El tiempo total se calcula como suma de tiempos parciales y no mezcla unidades.
- [ ] Pendiente local y sentido de avance se calculan por segmento.
- [ ] Cada combustible automático conserva procedencia y regla de traducción.
- [ ] Casos ambiguos o sin dato no reciben una clasificación silenciosa.
- [ ] No se confunde resolución de muestreo con precisión temática de la fuente.

## 3. Gate de proveedores y datos

- [ ] IGN/PNOA: consultas reales verificadas y fuente mostrada.
- [ ] Fuente elegida para combustible: acceso/latencia/cobertura/fallos documentados.
- [x] SIGPAC: dominio primero; MFE25 solo semántica en dominios habilitados, probado en piloto local.
- [ ] Open-Meteo: consulta real, vigencia y trazabilidad verificadas.
- [ ] Worker desplegado comparado con `infra/worker.js` y versión registrada.
- [ ] Fallos de proveedores conducen a fallback o bloqueo explícito, nunca a datos obsoletos silenciosos.

## 4. Gate de interacción y estado

- [ ] Cambiar foco/objetivo invalida todos los datos dependientes de la trayectoria.
- [ ] Automático y manual no pueden contradecirse sin cambio explícito de modo.
- [ ] Las respuestas tardías de red no sobrescriben un escenario nuevo.
- [ ] La app funciona en móvil y escritorio en los navegadores objetivo.
- [ ] El mapa y los resultados mantienen jerarquía visual comprensible.

## 5. Gate de seguridad y lenguaje

- [ ] La interfaz identifica el resultado como estimación orientativa.
- [ ] No aparecen formulaciones que puedan interpretarse como garantía de seguridad.
- [ ] El alcance previsto de conatos/fase inicial y los fenómenos no modelizados son accesibles en la interfaz.
- [x] Sustituir «sin riesgo directo» en los textos visibles de la rama local; revisar la presentación final con expertos.
- [ ] 112/servicios competentes siguen siendo la referencia prioritaria.
- [ ] Los protocolos/textos no inducen a retrasar evacuación ni a permanecer en una zona comprometida.
- [ ] Las principales limitaciones del modelo quedan visibles o accesibles.

## 6. Gate de pruebas

- [ ] `npm test` pasa íntegramente.
- [ ] Añadir tests para segmentación, suma temporal y fronteras nuevas.
- [ ] Casos de regresión del modelo actual siguen siendo reproducibles cuando proceda.
- [ ] Pruebas de integración en navegador cubren estado automático/manual e invalidación.
- [ ] Smoke tests con proveedores reales realizados separadamente de la suite unitaria.

## 7. Gate jurídico/operativo mínimo

- [ ] Atribuciones y licencias de las fuentes usadas revisadas.
- [ ] Flujo de coordenadas a terceros explicado de forma coherente con la implementación.
- [ ] Alcance geográfico y nivel de validación no se exageran; no se extrapola el piloto de Extremadura a toda España.
- [ ] No se presenta la demo como herramienta oficial ni profesional de predicción.

## 8. Criterio de salida

La versión solo pasa a **versión validada para uso operativo** cuando:

1. José Antonio haya revisado la RC1 tangible y la especificación v1.0 resultante;
2. los cambios estén implementados y cubiertos por pruebas;
3. los proveedores reales hayan superado smoke tests;
4. seguridad, lenguaje, atribuciones y privacidad hayan sido revisados;
5. Dirección autorice explícitamente el despliegue.

La publicación de una demo no equivale a validación científica/operativa del modelo.
