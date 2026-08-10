# Validación de la próxima demo MVP

**Estado:** planificación. No acredita validación externa ni autoriza despliegue.

Este documento define las puertas mínimas antes de presentar la siguiente versión de Alerta Fuego como demo pública coherente. No sustituye pruebas científicas ni operativas.

## 1. Gate de especificación

Antes de modificar código:

- [ ] Cerrar la especificación interna `VPIF` por tramos y convertirla en una versión revisable por José Antonio.
- [ ] Confirmar que la v0.3 de Drive es documento interno de prevalidación y no el paquete externo a enviar.
- [ ] Resolver o dejar explícitamente abiertas las reglas de combustible por tramo, incluyendo candidatos, conflictos y fallback.
- [x] Ejecutar preflight técnico de MFE25/SIGPAC, perfil MDT IGN/PNOA y arquitectura multifuente.
- [ ] Evaluar cualquier información nueva de Blanca/MITECO sobre EIKOS solo si puede cambiar materialmente la arquitectura.
- [ ] Confirmar con José Antonio el valor de matorral (`2–5` frente a `V0=6`).
- [ ] Confirmar con José Antonio `max(V0)` entre candidatos plausibles y la política de combustible no tipificado.
- [ ] Confirmar con José Antonio el tratamiento de discontinuidades no combustibles.
- [ ] Confirmar con José Antonio el papel de la dirección del viento/cuadrantes en el ETA.
- [ ] Confirmar con José Antonio el uso de un FV común de corredor por escenario y escenarios `t0…+3 h`, o la alternativa que indique.
- [ ] Confirmar con José Antonio el alcance prudencial del modelo: conatos/fase inicial frente a incendios complejos avanzados.
- [ ] Revisar el paquete completo de diseño con José Antonio.

## 2. Gate de fidelidad científica/documental

Tras implementación:

- [ ] Las tablas y fronteras del modelo coinciden con la especificación validada.
- [ ] El tiempo total se calcula como suma de tiempos parciales y no mezcla unidades.
- [ ] Pendiente local y sentido de avance se calculan por segmento.
- [ ] Cada combustible automático conserva procedencia, candidatos y regla de traducción.
- [ ] `max(V0)` se aplica solo entre candidatos plausibles cuando así lo autorice la especificación validada.
- [ ] Un fallback conservador de cálculo nunca se presenta como identificación temática falsa del terreno.
- [ ] Los conflictos MFE–SIGPAC no se resuelven por mayoría simple.
- [ ] Los tramos fuera de taxonomía o discontinuidades quedan identificados como tales y siguen la regla aprobada por José Antonio.
- [ ] CLCplus/WorldCover, Foto Fija/EIKOS y ZAFM no se convierten silenciosamente en `V0` si no existe una regla validada.
- [ ] No se confunde resolución de muestreo con precisión temática de la fuente.

## 3. Gate de proveedores y datos

- [ ] IGN/PNOA: perfil de elevación real verificado y fuente mostrada.
- [ ] MFE25: capa derivada ligera reproducible, con versión/fecha/IDs y cobertura documentadas.
- [ ] SIGPAC: solo segunda evidencia acotada según la especificación; conservar código original y fecha de consulta.
- [ ] Open-Meteo: consulta real, vigencia, modelo/política de selección y trazabilidad verificadas cuando la API lo permita.
- [ ] Si entran flags de Foto Fija/EIKOS/CLCplus, deben ser preprocesado/confianza y no una fusión opaca de mapas.
- [ ] ZAFM: si se conserva como control offline, no debe convertirse mediante crosswalk ad hoc `FBFM40→V0`.
- [ ] Worker desplegado comparado con `infra/worker.js` y versión registrada.
- [ ] Fallos de proveedores conducen a fallback o bloqueo explícito, nunca a datos obsoletos silenciosos.

## 4. Gate de interacción y estado

- [ ] Cambiar foco/objetivo invalida todos los datos dependientes de la trayectoria.
- [ ] Automático y manual no pueden contradecirse sin cambio explícito de modo.
- [ ] El usuario normal no tiene que elegir combustible durante el flujo principal.
- [ ] Override manual de combustible, si existe, queda solo en configuración avanzada y visible como sustitución del automático.
- [ ] Las respuestas tardías de red no sobrescriben un escenario nuevo.
- [ ] La app funciona en móvil y escritorio en los navegadores objetivo.
- [ ] El mapa y los resultados mantienen jerarquía visual comprensible.
- [ ] Si se muestran varios escenarios horarios, queda claro cuál genera cada ETA y no se mezclan horas incompatibles en una misma suma.

## 5. Gate de seguridad y lenguaje

- [ ] La interfaz identifica el resultado como estimación orientativa.
- [ ] La interfaz explica que la demo está pensada para conatos/fase inicial y no para incendios complejos avanzados.
- [ ] No aparecen formulaciones que puedan interpretarse como garantía de seguridad.
- [ ] Sustituir «sin riesgo directo» por una formulación prudencial validada.
- [ ] 112/servicios competentes siguen siendo la referencia prioritaria.
- [ ] Los protocolos/textos no inducen a retrasar evacuación ni a permanecer en una zona comprometida.
- [ ] Las principales limitaciones quedan visibles o accesibles: línea 1D, ausencia de spotting/copas/extremos/solver 2D y falta de validación profesional.
- [ ] Cualquier fallback conservador o discontinuidad no modelada queda marcado en el resultado.

## 6. Gate de pruebas

- [ ] `npm test` pasa íntegramente.
- [ ] Añadir tests para segmentación, suma temporal y fronteras nuevas.
- [ ] Añadir tests para reglas de combustible aprobadas, candidatos múltiples, conflictos y fallback.
- [ ] Añadir tests de discontinuidades/no combustible según la regla finalmente validada.
- [ ] Añadir tests para escenarios meteorológicos y agregación de FV si entra en implementación.
- [ ] Casos de regresión del modelo actual siguen siendo reproducibles cuando proceda.
- [ ] Pruebas de integración en navegador cubren estado automático/manual e invalidación.
- [ ] Smoke tests con proveedores reales realizados separadamente de la suite unitaria.

## 7. Gate jurídico/operativo mínimo

- [ ] Atribuciones y licencias de las fuentes usadas revisadas.
- [ ] Flujo de coordenadas a terceros explicado de forma coherente con la implementación.
- [ ] Alcance geográfico y nivel de validación no se exageran.
- [ ] No se presenta la demo como herramienta oficial ni profesional de predicción.
- [ ] La documentación pública no extrapola los porcentajes de los probes de Extremadura/16,25 km como cobertura territorial de España.

## 8. Criterio de salida

La versión solo pasa a **demo pública** cuando:

1. José Antonio haya revisado la especificación/paquete del modelo;
2. los cambios estén implementados y cubiertos por pruebas;
3. los proveedores reales hayan superado smoke tests;
4. seguridad, lenguaje, atribuciones y privacidad hayan sido revisados;
5. el alcance prudencial de uso esté visible;
6. Dirección autorice explícitamente el despliegue.

La publicación de una demo no equivale a validación científica/operativa del modelo.
