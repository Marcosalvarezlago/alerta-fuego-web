# Alerta Fuego Web

Demo web estática para estimar de forma orientativa el tiempo de llegada de un frente de incendio desde un punto marcado hasta una zona vulnerable.

> **No es un modelo profesional de predicción ni sustituye al 112 o a los servicios de emergencia. No debe usarse para apurar tiempos ni contradecir instrucciones oficiales.**

## Estado del proyecto

- Demo global en `index.html` y piloto RC1 local en `rc1.html`, sin compilación.
- Mapa Leaflet con OpenStreetMap y Esri World Imagery.
- Viento modelizado mediante Open-Meteo.
- Elevaciones mediante IGN, con reserva Open-Meteo.
- Ocupación del suelo mediante SIGPAC, siempre como sugerencia confirmable.
- Cloudflare Worker versionado en `infra/worker.js`.
- Lógica pura y pruebas reproducibles con Node.
- RC1 por tramos **implementada provisionalmente para pruebas locales con asset piloto interno**; no desplegada ni validada científicamente.
- Validación operativa externa **no acreditada por el repositorio**.

La demo publicada se encuentra en [GitHub Pages](https://marcosalvarezlago.github.io/alerta-fuego-web/). Su disponibilidad y la del Worker deben comprobarse por separado.

## Estructura

```text
.
├── AGENTS.md
├── index.html
├── rc1.html
├── package.json
├── src/
│   ├── core.js
│   ├── rc1-geometry.js / rc1-overlay.js
│   ├── rc1-fuel.js / rc1-engine.js
│   └── rc1-providers.js / rc1-run.js
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

La demo publicada (`index.html`) usa un solo combustible, una pendiente entre extremos y un viento. El piloto local (`rc1.html`) integra por tramos y conserva ese cálculo global como referencia histórica.

## RC1 provisional por tramos

La RC1 mantiene el modelo de José Antonio y lo aplica **por tramos**:

```text
VPIF_i,s = V0_i · FV_s · FP_i

t_i,s = d_i / VPIF_i,s

ETA_s = Σ t_i,s
```

Decisiones de diseño ya adoptadas:

- pendiente por tramos sobre el perfil foco → zona vulnerable;
- cálculo acumulativo de tiempos parciales;
- Rothermel queda fuera de este lanzamiento y pasa a I+D+i futura;
- la implementación local se revisará técnicamente antes de pasar a José Antonio; sus decisiones científicas siguen provisionales.

El detalle y las cuestiones abiertas están en [ADR 0001](docs/adr/0001-demo-vpif-por-tramos.md).

## Combustible y SIGPAC

La demo global histórica conserva estas correspondencias por ocupación; **no son la regla de la RC1**:

| Código | V0 |
|---|---:|
| PS | 3 |
| PR / MT | 6 |
| PA | 3 |
| FO | 8 |

En RC1, SIGPAC decide primero el dominio: PS→pastos; PR/MT→candidato matorral; PA→candidato pastos; FO no tiene V0 directo. MFE25 solo añade semántica en FO/PR/MT/PA. Los candidatos múltiples conservan su etiqueta ambigua y usan provisionalmente max(V0). El piloto genera un asset local desde un subconjunto real SIGPAC+MFE25; no está publicado ni empaquetado como PMTiles.

No debe inferirse precisión temática de 30 m por el hecho de muestrear una línea cada ~30 m.

## Cuestiones pendientes de confirmación con José Antonio

- El documento original describe el matorral aproximadamente como `2–5 m/min`, pero usa `V0 = 6 m/min`.
- Confirmar si la dirección del viento afecta únicamente al escenario espacial o también a la velocidad de propagación.
- Revisar max(V0), cota de combustible positivo no tipificado, t_gap=0, agregación espacial FV y presentación de ETA por sector antes de consolidar v1.0.

## Datos externos y privacidad

Las funciones automáticas envían coordenadas o enlaces a servicios externos:

- Open-Meteo para viento y, en reserva, elevación;
- Cloudflare Worker e IGN para elevaciones;
- Cloudflare Worker y SIGPAC para ocupación del suelo;
- Cloudflare Worker y Google para enlaces cortos.

No hay cuentas ni base de datos propia en esta demo, pero los proveedores pueden registrar solicitudes conforme a sus políticas. Antes de una difusión mayor deben mantenerse las atribuciones y condiciones de Open-Meteo/Copernicus, IGN/CNIG, SIGPAC/FEGA, OpenStreetMap y Esri.

## Desarrollo local

Para probar `rc1.html`, sirve el repositorio por HTTP local, abre la página y carga el asset piloto interno generado en `C:\Users\marco\Documents\Alerta Fuego\audit_output\rc1_fuel_pilot_internal.json`. El asset no se versiona ni publica por ahora. La página acepta un Worker RC1 local para `/perfil` (MDT05); si no está disponible, puede usarse el fallback Open-Meteo/GLO-90 marcándolo explícitamente. Fuera del área del asset o con combustible/MDT/viento NoData, la ETA automática queda indeterminada. Los detalles por segmento se descargan como JSON.

El pipeline `scripts/build_rc1_pilot.py` usa GDAL ya disponible en el entorno `alerta-gis` y requiere un GeoJSON de recintos SIGPAC, MFE25 SHP y bbox explícito. No instala dependencias ni crea PMTiles. Para publicar un derivado regional faltan ingestión completa de recintos, generalización/topología, empaquetado PMTiles, medición de tamaño y revisión jurídica de condiciones MFE25. [SIGPAC publica recintos bajo CC BY 4.0](https://sigpac-hubcloud.es/html/sdsigpac/descServicio.html); la licencia específica MFE25 del derivado debe confirmarse antes de distribuirlo.

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
