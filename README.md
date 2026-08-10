# Alerta Fuego Web

Demo web estática para estimar de forma orientativa el tiempo de llegada de un frente de incendio desde un punto marcado hasta una zona vulnerable.

> **No es un modelo profesional de predicción ni sustituye al 112 o a los servicios de emergencia. No debe usarse para apurar tiempos ni contradecir instrucciones oficiales.**

## Estado del proyecto

- Aplicación de una sola página en `index.html`, sin compilación.
- Mapa Leaflet con OpenStreetMap y Esri World Imagery.
- Viento modelizado mediante Open-Meteo.
- Elevaciones mediante IGN, con reserva Open-Meteo.
- Ocupación del suelo mediante SIGPAC en la versión actualmente publicada.
- Cloudflare Worker versionado en `infra/worker.js`.
- Lógica pura y pruebas reproducibles con Node.
- Modelo por tramos **todavía no implementado**, pero **decidido como arquitectura de la próxima demo**.
- Existe una especificación interna de prevalidación `v0.3`; **no es el documento que se enviará directamente a José Antonio**. Primero se preparará un paquete breve específico para su revisión.
- Validación operativa externa **no acreditada por el repositorio**.

La demo publicada se encuentra en [GitHub Pages](https://marcosalvarezlago.github.io/alerta-fuego-web/). Su disponibilidad y la del Worker deben comprobarse por separado.

## Estructura

```text
.
├── AGENTS.md
├── index.html
├── package.json
├── src/
│   └── core.js
├── tests/
├── .github/
│   └── workflows/test.yml
├── infra/
│   └── worker.js
└── docs/
    ├── DOCUMENTACION_TECNICA.md
    ├── GUIA_FUNDADORES.md
    ├── VALIDACION_MVP.md
    └── adr/
        └── 0001-demo-vpif-por-tramos.md
```

- [Documentación técnica](docs/DOCUMENTACION_TECNICA.md): arquitectura, modelo implementado, fuentes, límites, privacidad, pruebas y despliegue.
- [Guía para el equipo fundador](docs/GUIA_FUNDADORES.md): explicación no técnica y cuestiones pendientes de validación.
- [ADR 0001](docs/adr/0001-demo-vpif-por-tramos.md): decisión de mantener VPIF e incorporar cálculo por tramos en la próxima demo.
- [Validación MVP](docs/VALIDACION_MVP.md): puertas mínimas antes de presentar la siguiente versión como demo pública coherente.

## Modelo actual implementado

```text
VPIF = V0 · FV · FP
tiempo = distancia / VPIF
```

El trayecto completo usa hoy un solo combustible, una pendiente calculada entre los extremos y un viento. La documentación técnica contiene las fronteras exactas que ejecuta el código.

## Próxima demo planificada

La siguiente demo mantendrá el modelo de José Antonio y lo aplicará **por tramos**. La propuesta interna de prevalidación vigente es:

```text
VPIF_i = V0_i · FV_s · FP_i

t_i = d_i / VPIF_i

ETA_s = Σ t_i
```

`FV_s` representa un escenario meteorológico estático común al corredor. Esta formulación, los escenarios `t0…+3 h`, el tratamiento de cuadrantes y los fallbacks de combustible siguen pendientes de revisión con José Antonio.

Decisiones de diseño ya adoptadas:

- pendiente por tramos sobre el perfil foco → zona vulnerable;
- cálculo acumulativo de tiempos parciales;
- combustible automático en el flujo normal, con trazabilidad y override manual solo avanzado;
- Rothermel queda fuera de este lanzamiento y pasa a I+D+i futura;
- la implementación no comienza hasta cerrar la especificación y revisarla con José Antonio.

No debe confundirse una segmentación aproximada de 30 m con precisión temática de 30 m de la cartografía de combustible o del viento.

## Alcance prudencial del MVP

Dirección limita provisionalmente el uso pretendido del modelo a **conatos o incendios en fase inicial de expansión y escenarios relativamente simples con un frente dominante**. Esta delimitación es una restricción de producto y seguridad, no una afirmación de fiabilidad cuantificada.

La demo no debe presentarse como adecuada para incendios complejos en fase avanzada, múltiples frentes, spotting/pavesas relevantes, fuego de copas, comportamiento extremo o dinámica espacial 2D compleja.

## Combustible y fuentes cartográficas

La aplicación antigua utilizó heurísticas SIGPAC simples; se conservan como antecedente, no como verdad de combustible. La propuesta interna tras los probes de 2026 es:

1. **MFE25** como backbone semántico principal para construir candidatos VPIF a partir de formación, estructura, especies y coberturas.
2. **SIGPAC** como segunda evidencia acotada de uso/ocupación y delimitación espacial; no sustituye a MFE en terreno forestal y no se resuelven conflictos por mayoría de mapas.
3. Ante varias categorías VPIF plausibles, seleccionar la de mayor `V0` como regla conservadora inicial, conservando candidatos, fuente, regla y confianza.
4. Ante combustible no tipificado, la especificación interna propone una cota conservadora de cálculo separada de la etiqueta temática; debe validarla José Antonio antes de producción.
5. CLCplus/WorldCover, Foto Fija/EIKOS y ZAFM se reservan principalmente para control, vigencia o validación offline en este MVP, no como traductores runtime directos a `V0`.

El probe multifuente utilizó 65 posiciones sobre 16,25 km de corredores deliberadamente heterogéneos: MFE produjo candidato defendible en el 61,54 % de esa longitud-proxy y la jerarquía MFE→SIGPAC llegó al 69,23 %. **Estas cifras son comparativas del ensayo y no representan cobertura de Extremadura ni de España.**

### Estado de ZAFM

ZAFM **no está descartado del proyecto**. Se descarta únicamente como motor/fallback directo del MVP `VPIF-v0` y cualquier crosswalk ad hoc `FBFM40 → V0`. Se conserva como control científico offline y como fuente candidata prioritaria para la futura línea `Rothermel + ZAFM40`.

## Cuestiones pendientes de confirmación con José Antonio

- Confirmar la arquitectura acumulativa por tramos.
- El documento original describe el matorral aproximadamente como `2–5 m/min`, pero usa `V0 = 6 m/min`.
- Validar `max(V0)` entre candidatos plausibles y la política para combustible no tipificado.
- Revisar los casos históricos SIGPAC (`PS`, `PR/MT`, `PA`, `FO`, `TA` y usos fuera de taxonomía).
- Aclarar el significado físico u operacional de los cuadrantes y si afectan al ETA o solo al mensaje.
- Confirmar el tratamiento del viento por escenarios y la agregación espacial.
- Confirmar el alcance prudencial de uso: conatos/fase inicial frente a incendios complejos avanzados.
- Revisar el paquete completo de diseño antes de modificar el programa.

## Datos externos y privacidad

Las funciones automáticas envían coordenadas o enlaces a servicios externos:

- Open-Meteo para viento y, en reserva, elevación;
- Cloudflare Worker e IGN para elevaciones;
- Cloudflare Worker y SIGPAC para ocupación del suelo;
- Cloudflare Worker y Google para enlaces cortos.

No hay cuentas ni base de datos propia en esta demo, pero los proveedores pueden registrar solicitudes conforme a sus políticas. Antes de una difusión mayor deben mantenerse las atribuciones y condiciones de Open-Meteo/Copernicus, IGN/CNIG, SIGPAC/FEGA, OpenStreetMap y Esri.

## Desarrollo local

No hay proceso de compilación. Para evitar limitaciones del esquema `file://`, sirve la raíz con cualquier servidor HTTP estático y abre `index.html` desde `localhost`.

Las consultas automáticas requieren acceso a internet. El Worker desplegado usa una URL configurada en `index.html`; modificar `infra/worker.js` no actualiza automáticamente esa copia remota.

Las pruebas unitarias no llaman a los proveedores reales:

```powershell
npm test
```

## Despliegue

- La página estática se publica mediante GitHub Pages desde la configuración del repositorio.
- El Worker se despliega por separado en Cloudflare.
- Hasta automatizarlo, hay que registrar qué revisión de `infra/worker.js` está desplegada para evitar divergencias.
- La siguiente versión no debe desplegarse sin superar las puertas de [VALIDACION_MVP.md](docs/VALIDACION_MVP.md) y autorización expresa de Dirección.

## I+D+i posterior

La reevaluación científica realizada sobre MFE25, Foto Fija, ZAFM, EIKOS, Copernicus/CLCplus, PNOA/LiDAR, AEMET/IPIF y Rothermel se conserva fuera del repositorio como investigación canónica del proyecto. En GitHub solo se documentan las decisiones que afectan al software.

La línea futura contempla, sin compromiso de implementación inmediata, `AF-Rothermel-v1` en modo sombra, golden tests contra Behave7, benchmark `VPIF-v0` vs `Rothermel + MFE13` vs `Rothermel + ZAFM40`, humedad/WAF, hindcasting y validación geográfica.
