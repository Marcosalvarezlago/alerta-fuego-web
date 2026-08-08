# Alerta Fuego Web

Demo web estática para estimar de forma orientativa el tiempo de llegada de un frente de incendio desde un punto marcado hasta una zona vulnerable.

> **No es un modelo profesional de predicción ni sustituye al 112 o a los servicios de emergencia. No debe usarse para apurar tiempos ni contradecir instrucciones oficiales.**

## Estado del proyecto

- Aplicación de una sola página en `index.html`, sin compilación.
- Mapa Leaflet con OpenStreetMap y Esri World Imagery.
- Viento modelizado mediante Open-Meteo.
- Elevaciones mediante IGN, con reserva Open-Meteo.
- Ocupación del suelo mediante SIGPAC, siempre como sugerencia confirmable.
- Cloudflare Worker versionado en `infra/worker.js`.
- Lógica pura y pruebas reproducibles con Node.
- Modelo por tramos **todavía no implementado**, pero **decidido como arquitectura de la próxima demo**.
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

La siguiente demo mantendrá el modelo de José Antonio, pero lo aplicará **por tramos**:

```text
VPIF_i = V0_i · FV_i · FP_i

t_i = d_i / VPIF_i

ETA = Σ t_i
```

Decisiones de diseño ya adoptadas:

- pendiente por tramos sobre el perfil foco → zona vulnerable;
- cálculo acumulativo de tiempos parciales;
- Rothermel queda fuera de este lanzamiento y pasa a I+D+i futura;
- la implementación no comienza hasta cerrar la especificación y revisarla con José Antonio.

El detalle y las cuestiones abiertas están en [ADR 0001](docs/adr/0001-demo-vpif-por-tramos.md).

## Combustible y SIGPAC

La revisión con José estableció históricamente estas correspondencias por ocupación:

| Código | V0 |
|---|---:|
| PS | 3 |
| PR / MT | 6 |
| PA | 3 |
| FO | 8 |

SIGPAC no identifica la vegetación real con detalle suficiente para decidir por sí solo. Para la próxima demo se probará **MFE25 como fuente semántica principal de combustible por tramo**, con Foto Fija como posible señal de vigencia/cambio y SIGPAC como apoyo/fallback. Esta arquitectura todavía debe superar el preflight técnico y la revisión de José Antonio.

No debe inferirse precisión temática de 30 m por el hecho de muestrear una línea cada ~30 m.

## Cuestiones pendientes de confirmación con José Antonio

- El documento original describe el matorral aproximadamente como `2–5 m/min`, pero usa `V0 = 6 m/min`.
- Confirmar si la dirección del viento afecta únicamente al escenario espacial o también a la velocidad de propagación.
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
