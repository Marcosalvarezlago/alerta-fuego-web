# Alerta Fuego Web

Demo web para estimar de forma orientativa el tiempo de llegada de un frente de incendio desde un punto marcado hasta una zona vulnerable.

> **No es un modelo profesional de predicción ni sustituye al 112 o a los servicios de emergencia. No debe usarse para apurar tiempos ni contradecir instrucciones oficiales.**

## Estado del proyecto

- Interfaz original en `index.html`, ahora con VPIF RC1 por tramos; `rc1.html` redirige a ella.
- Mapa Leaflet con OpenStreetMap y Esri World Imagery.
- Viento modelizado mediante Open-Meteo.
- Elevaciones mediante IGN, con reserva Open-Meteo.
- Combustible automático por tramo mediante SIGPAC y MFE25 cuando existe cobertura local, con reglas provisionales trazables. Pendiente, viento y combustible admiten modo manual.
- Cloudflare Worker versionado en `infra/worker.js`.
- Lógica pura y pruebas reproducibles con Node.
- RC1 por tramos integrada y comprobada con el servidor local y con la ruta pública del Worker. Sus hipótesis siguen siendo provisionales; no hay validación predictiva u operativa.
- Validación operativa externa **no acreditada por el repositorio**.

La demo publicada se encuentra en [GitHub Pages](https://marcosalvarezlago.github.io/alerta-fuego-web/). Su disponibilidad y la del Worker deben comprobarse por separado.

El alcance previsto de la demo experimental son conatos o incendios en fase inicial y escenarios simples con un frente dominante. No modeliza múltiples frentes, pavesas, fuego de copas ni dinámica espacial 2D compleja.

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
│   └── rc1-providers.js / rc1-run.js / rc1-view.js
├── scripts/serve_rc1_local.py
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
- [ADR 0002](docs/adr/0002-cruces-inciertos-eta-rc1.md): corrección del tiempo cero y plan de investigación de cruces.
- [Política provisional de combustible](docs/RC1_POLITICA_COMBUSTIBLE_PROVISIONAL.md): supuestos automáticos y cuestiones para revisión técnica.
- [Mejora visual futura](docs/ROADMAP_VISUALIZACION_RC1.md): mapa de combustibles, perfil de pendiente y lectura temporal del recorrido.
- [Diagnóstico de datos automáticos](docs/RC1_FALLOS_PROVEEDORES.md): por qué pueden faltar elevación o viento y cómo se refleja en la ETA.
- [Validación MVP](docs/VALIDACION_MVP.md): puertas mínimas antes de presentar la siguiente versión como demo pública coherente.

## Modelo actual implementado

```text
VPIF = V0 · FV · FP
tiempo = distancia / VPIF
```

La misma interfaz RC1 se sirve en local y en GitHub Pages. El cálculo público obtiene SIGPAC y el perfil de elevación por medio del Worker; la ejecución local puede complementar SIGPAC con MFE25 instalado en el equipo.

## RC1 provisional por tramos

La RC1 mantiene el modelo VPIF del proyecto y lo aplica **por tramos**:

```text
VPIF_i,h = V0_i · FV_h · FP_i
tiempo parcial = distancia recorrida con VPIF_i,h / VPIF_i,h
ETA = suma de tiempos parciales hasta la zona
```

Decisiones de diseño ya adoptadas:

- pendiente por tramos sobre el perfil foco → zona vulnerable;
- cálculo acumulativo de tiempos parciales, cambiando FV al cruzar cada hora prevista;
- Rothermel queda fuera de este lanzamiento y pasa a I+D+i futura;
- las decisiones científicas de la implementación siguen siendo provisionales.

El detalle y las cuestiones abiertas están en [ADR 0001](docs/adr/0001-demo-vpif-por-tramos.md).

## Combustible y SIGPAC

La demo global histórica conserva estas correspondencias por ocupación; **no son la regla de la RC1**:

| Código | V0 |
|---|---:|
| PS | 3 |
| PR / MT | 6 |
| PA | 3 |
| FO | 8 |

En RC1, SIGPAC decide primero el dominio: PS→candidato pastos; PR/MT→candidato matorral; PA requiere MFE25 concluyente para tipificar, o queda como combustible no tipificado. MFE25 añade semántica en FO/PR/MT/PA cuando está disponible. Los candidatos múltiples conservan su etiqueta ambigua y usan provisionalmente max(V0). Si hay evidencia positiva de combustible pero no clase fiable (FO sin MFE o cultivo permanente o asociación agrícola), se usa V0=8, marcado como hipótesis conservadora. Los cruces AG/CA/ED/ZU se calculan con V0=8 como hipótesis provisional y tiempo positivo, sin afirmar que el fuego los atraviese. TA/TH y la ausencia de SIGPAC conservan su marca NoData; el cálculo usa V0=8 como hipótesis prudente y muestra una ETA provisional. Si faltan viento o elevación, usa FV=3 o FP=2 respectivamente, con las mismas advertencias. Ninguno de estos valores es una cota física garantizada. El modo manual permite escoger un combustible uniforme para todo el corredor. [Reglas completas](docs/RC1_POLITICA_COMBUSTIBLE_PROVISIONAL.md).

El resultado muestra una sola ETA. «Cómo se calculó» indica el número de tramos. Los detalles técnicos distinguen entradas manuales, procedencia de cada fuente e hipótesis empleadas. La dirección del cuadrante representa el viento inicial; la ETA integra el viento horario durante el recorrido.

La persona puede elegir corredores de más de 5 km: la aplicación divide automáticamente las consultas SIGPAC y el perfil en lotes pequeños. Una distancia larga aumenta la dependencia de fuentes externas y no amplía el alcance científico de esta demo para fases iniciales.

No debe inferirse precisión temática de 30 m por el hecho de muestrear una línea cada ~30 m.

## Cuestiones pendientes de revisión técnica

- El documento original describe el matorral aproximadamente como `2–5 m/min`, pero usa `V0 = 6 m/min`.
- Confirmar si la dirección del viento afecta únicamente al escenario espacial o también a la velocidad de propagación.
- Revisar max(V0), cota de combustible positivo no tipificado, cruce incierto AG/CA/ED/ZU con V0=8, agregación espacial FV y presentación de ETA por sector antes de consolidar v1.0.

## Datos externos y privacidad

Las funciones automáticas envían coordenadas o enlaces a servicios externos:

- Open-Meteo para viento y, en reserva, elevación;
- servidor local o Cloudflare Worker e IGN para perfil de elevación;
- servidor local o Cloudflare Worker y SIGPAC para recintos y usos del suelo;
- Cloudflare Worker y Google para enlaces cortos.

No hay cuentas ni base de datos propia en esta demo, pero los proveedores pueden registrar solicitudes conforme a sus políticas. Antes de una difusión mayor deben mantenerse las atribuciones y condiciones de Open-Meteo/Copernicus, IGN/CNIG, SIGPAC/FEGA, OpenStreetMap y Esri.

## Desarrollo local

Para probar la RC1, inicia el servidor local con el Python del entorno `alerta-gis` (GDAL requerido):

```powershell
& 'C:\Users\marco\anaconda3\envs\alerta-gis\python.exe' .\scripts\serve_rc1_local.py 8765
```

Abre [http://127.0.0.1:8765/index.html](http://127.0.0.1:8765/index.html). Fija incendio y zona vulnerable y pulsa **Calcular alerta**. El servidor obtiene los recintos SIGPAC y el perfil IGN; el navegador consulta el viento horario. No hay que cargar un asset ni escribir una URL de Worker. En **Datos** se puede desactivar por separado cada modo automático y usar pendiente, viento o combustible manuales. Por defecto, el servidor busca el MFE25 local en `C:\Users\marco\Documents\Alerta Fuego\tmp-mfe-extremadura-audit\MFE_43.shp`; se puede cambiar con `ALERTA_MFE_SHP`. Sin esa fuente, solo se usan los códigos SIGPAC y se conserva NoData donde falte evidencia. La cobertura MFE25 disponible es Extremadura, no España completa.

El pipeline `scripts/build_rc1_pilot.py` usa GDAL ya disponible en el entorno `alerta-gis` y requiere un GeoJSON de recintos SIGPAC, MFE25 SHP y bbox explícito. No instala dependencias ni crea PMTiles. Para publicar un derivado regional faltan ingestión completa de recintos, generalización/topología, empaquetado PMTiles, medición de tamaño y revisión jurídica de condiciones MFE25. [SIGPAC publica recintos bajo CC BY 4.0](https://sigpac-hubcloud.es/html/sdsigpac/descServicio.html); la licencia específica MFE25 del derivado debe confirmarse antes de distribuirlo.

No hay proceso de compilación. El servidor local atiende `/api/rc1/asset` y `/api/rc1/perfil`; en GitHub Pages estas rutas las atiende el Worker. Abrir `file://` no es una forma compatible de ejecutar la aplicación.

Las consultas automáticas requieren acceso a internet. El Worker ya está configurado en `index.html`; la persona usuaria no debe introducir su URL. La página pública no distribuye el fichero MFE25 local.

Las pruebas unitarias no llaman a los proveedores reales:

```powershell
npm test
```

## Despliegue

- La página estática se publica mediante GitHub Pages desde la configuración del repositorio.
- El Worker se despliega por separado en Cloudflare.
- En cada publicación, comprobar por separado la web y las rutas públicas del Worker.
- La consolidación científica u operativa de una versión posterior requiere las verificaciones de [VALIDACION_MVP.md](docs/VALIDACION_MVP.md).

## I+D+i posterior

La reevaluación científica realizada sobre MFE25, Foto Fija, ZAFM, EIKOS, Copernicus/CLCplus, PNOA/LiDAR, AEMET/IPIF y Rothermel se conserva fuera del repositorio como investigación canónica del proyecto. En GitHub solo se documentan las decisiones que afectan al software.

La línea futura contempla, sin compromiso de implementación inmediata, `AF-Rothermel-v1` en modo sombra, golden tests contra Behave7, benchmark `VPIF-v0` vs `Rothermel + MFE13` vs `Rothermel + ZAFM40`, humedad/WAF, hindcasting y validación geográfica.
