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
- Modelo por tramos **no implementado**.
- Validación operativa externa **no acreditada por el repositorio**.

La demo publicada se encuentra en [GitHub Pages](https://marcosalvarezlago.github.io/alerta-fuego-web/). Su disponibilidad y la del Worker deben comprobarse por separado.

## Estructura

```text
.
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
    └── GUIA_FUNDADORES.md
```

- [Documentación técnica](docs/DOCUMENTACION_TECNICA.md): arquitectura, modelo implementado, fuentes, límites, privacidad, pruebas y despliegue.
- [Guía para el equipo fundador](docs/GUIA_FUNDADORES.md): explicación no técnica y cuestiones pendientes de validación.

## Modelo actual

```text
VPIF = V0 · FV · FP
tiempo = distancia / VPIF
```

El trayecto completo usa hoy un solo combustible, una pendiente calculada entre los extremos y un viento. La documentación técnica contiene las fronteras exactas que ejecuta el código.

## Criterio SIGPAC acordado

La revisión con José estableció estas correspondencias por ocupación:

| Código | V0 |
|---|---:|
| PS | 3 |
| PR / MT | 6 |
| PA | 3 |
| FO | 8 |

SIGPAC no identifica la vegetación real con detalle suficiente para decidir por sí solo. Los códigos sin correspondencia acordada requieren elección manual.

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

## Próxima ampliación estudiada

Se ha propuesto un modelo por tramos con muestreo aproximado cada 30 m. Es una hipótesis pendiente de validar, no una capacidad de la demo. MDE, Copernicus y PNOA son posibles fuentes o productos a evaluar; no se ha fijado todavía su papel ni una metodología validada.

La clasificación avanzada de vegetación queda fuera de esta fase.
