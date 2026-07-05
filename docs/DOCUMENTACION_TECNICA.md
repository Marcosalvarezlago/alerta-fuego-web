# Alerta Fuego — Documentación técnica

*Estado: demo funcional para validación externa. IGN y SIGPAC integrados. Última revisión alineada con el `index.html` final.*

---

## 1. Propósito y alcance

Aplicación web para estimar de forma orientativa el tiempo de llegada de un frente de incendio forestal a una zona vulnerable, según el modelo documental del grupo Alerta Fuego (VPIF = V0·FV·FP; tiempo = distancia/VPIF).

Principio rector: **no transmitir falsa precisión ni falsa seguridad**. Ante duda, la app bloquea o avisa en lugar de completar con supuestos. No sustituye a 112, INFOEX, bomberos, Protección Civil ni autoridades competentes.

---

## 2. Arquitectura

**Aplicación:** página web estática de un solo archivo (`index.html`), sin framework ni proceso de compilación. HTML + CSS + JavaScript plano, con Leaflet para el mapa.

**Motivo del diseño:** la versión anterior (Streamlit) reejecutaba toda la página en cada interacción, lo que hacía el mapa incómodo (saltos de encuadre, recargas, mal comportamiento en móvil). Una web estática elimina ese problema de raíz: el mapa responde localmente, sin servidor.

**Dependencias externas (en tiempo de ejecución, vía CDN):**
- **Leaflet 1.9.4**: motor de mapa (mismo que usaba Folium por debajo en la versión Streamlit).
- **Teselas de mapa**: OpenStreetMap (base) y Esri World Imagery (satélite).

**Servicios de datos (llamadas desde el navegador):**
- **Open-Meteo**: viento actual (`/v1/forecast`, `wind_speed_10m` + `wind_direction_10m`) y elevación (`/v1/elevation`). Sin clave de API. Permite CORS.

**Infraestructura propia:**
- **Cloudflare Worker** (`worker.js`): microservicio intermedio, necesario porque una web estática no puede llamar directamente a ciertos servicios oficiales (política CORS). Tres endpoints:
  - `/resolver`: resuelve enlaces cortos de Google Maps (`maps.app.goo.gl`), que no contienen coordenadas. Lista blanca de dominios para no actuar como proxy abierto. Contempla el caso en que Google interpone su página de verificación (`/sorry`) y extrae la coordenada del parámetro `continue`.
  - `/elevaciones`: pendiente de precisión vía IGN (ver §5).
  - `/sigpac`: uso del suelo vía SIGPAC (ver §5).
  - Plan gratuito (100.000 peticiones/día; el uso previsto por persona es de unas pocas peticiones puntuales, muy por debajo del límite).

**Despliegue:** GitHub Pages (rama `main`, raíz). El worker se despliega aparte en Cloudflare.

---

## 3. Modelo de cálculo

Portado 1:1 desde la implementación Python original. **Valores sin alterar** respecto al documento:

| Combustible | V0 (m/min) |
|---|---|
| Pastos bajos | 3 |
| Bosque de quercus / encinar / robledal | 4 |
| Matorral mediterráneo | 6 |
| Pinar | 8 |

| Viento (km/h) | FV |
|---|---|
| < 10 | 1 |
| 10–20 | 1,5 |
| 20–30 | 2 |
| > 30 | 3 |

| Pendiente (fuego subiendo) | FP |
|---|---|
| < 20 % | 1 |
| 20–40 % | 1,5 |
| > 40 % | 2 |
| Fuego bajando ladera | 0,7 |
| En llano | 1 |

- **Distancia**: fórmula de Haversine.
- **Cuadrantes**: se calcula el rumbo incendio→zona y su diferencia angular con la dirección del viento. ≤45° → riesgo; 45–135° → alerta (lateral, con lado); >135° → sin riesgo directo. El empate exacto en 45° cae del lado prudente (riesgo).
- **Escenario por tiempo**: ≤30 min, ≤60 min, ≤90 min, o vigilancia preventiva por encima.

**Verificación:** el ejemplo del documento (matorral, 20 km/h, 30 % subiendo) da VPIF = 6·2·1,5 = 18 m/min. La batería de pruebas confirma ese valor y las fronteras de todas las tablas.

**Nota:** el modelo no se modifica sin aviso explícito. La evolución "por tramos" (perfil de pendiente, combustible y viento por segmentos del recorrido) está pospuesta y documentada como cambio de modelo que requeriría validación externa.

---

## 4. Decisiones de diseño prudencial

Estas decisiones son deliberadas y no deben revertirse sin considerar su motivo:

1. **Nada operativo por defecto.** Los tres datos (viento, pendiente, combustible) arrancan sin seleccionar; los sliders aparecen atenuados hasta que el usuario los toca. Calcular permanece bloqueado, indicando qué falta. Evita calcular con valores que el usuario no ha elegido conscientemente.

2. **Sin valores inventados en modo automático.** Si Open-Meteo no responde o faltan coordenadas, la app no sustituye por un valor por defecto: bloquea el cálculo, explica el motivo y ofrece reintentar o pasar a manual. (Corrige un patrón de la versión Streamlit, donde un fallo silencioso permitía calcular con datos ficticios.)

3. **Coherencia entre lo mostrado y lo calculado.** El viento automático se cachea por coordenadas del punto del incendio (TTL 10 min) y muestra la hora de consulta. Así el dato en pantalla es exactamente el usado en el cálculo, y no cambia solo entre interacciones.

4. **Invalidación del resultado.** Cualquier cambio de punto o de dato borra el resultado y los cuadrantes del mapa: nunca se muestra un resultado que no corresponde al estado actual.

5. **Presentación según cuadrante.** En "sin riesgo directo" no se muestra el protocolo de tiempos sino vigilancia preventiva, para no alarmar fuera de la trayectoria principal. El cálculo subyacente es el mismo.

6. **Recordatorio prudencial** fijo en cabecera y resultado (referencia al 112 y a los servicios competentes).

---

## 5. Datos automáticos: estado y límites

- **Viento (Open-Meteo):** operativo. Conversión verificada de dirección meteorológica "desde" a dirección operativa "hacia" (+180°). Resolución del modelo (1–11 km): entre puntos a distancia operativa el viento apenas varía, por lo que consultarlo en el punto del incendio es una convención correcta, no una simplificación problemática. La mejora futura real en este dato no es espacial sino **temporal** (pronóstico horario integrado en un modelo por tramos); ver §9.

- **Pendiente (IGN, con reserva a Open-Meteo):** operativo. Consulta el Modelo Digital del Terreno del IGN (resolución 5 m, servicio WCS oficial) a través del worker, que pide un recuadro mínimo alrededor de cada punto en formato ArcGrid (texto plano) y extrae el valor central. Si el IGN no responde, cae automáticamente a Open-Meteo (~90 m de resolución) **con la fuente indicada de forma explícita** en la interfaz y en el resultado: nunca un descenso silencioso. En ambos casos el método sigue siendo el de dos puntos extremos (no un perfil completo del recorrido); por eso se etiqueta como "provisional" independientemente de la fuente.

- **Combustible (SIGPAC, sugerencia confirmable):** operativo, pero con una decisión de diseño deliberada: **SIGPAC no decide, sugiere**. Consulta el uso oficial del suelo en el punto del incendio mediante la consulta `recinfobypoint` del Servicio de Consultas SIGPAC (FEGA), y propone un combustible equivalente (tabla en `app_ui.js`, `SUGERENCIA_COMBUSTIBLE`). El combustible solo se vuelve operativo si el usuario confirma con un toque ("Usar sugerencia"); un fallo del servicio no bloquea el cálculo, porque es consultivo, no imprescindible. Casos con manejo explícito: uso sin equivalencia (se pide elección manual), uso "Forestal" (SIGPAC no distingue el tipo de arbolado: se propone pinar por prudencia, con aviso, al ser el más rápido de la tabla), sin recinto en el punto (zona urbana, etc.). Atribución obligatoria por licencia: "SIGPAC — FEGA, CC BY 4.0", visible en la tarjeta.

**Nota de arquitectura sobre SIGPAC:** la ruta correcta del servicio oficial es `servicioconsultassigpac/query/recinfobypoint/[srid]/[lon]/[lat].json` (orden longitud/latitud, no lat/lon). Confirmada contra el ejemplo de la documentación oficial del FEGA antes de integrarse; varias rutas de las colecciones espaciales del catálogo (`recintos`, `cultivo_declarado`) se investigaron primero y se descartaron por no llevar el atributo de uso.

---

## 6. Resolución de ubicaciones (parser)

El editor de coordenadas acepta:
- Coordenadas decimales (`40.1290, -5.4610`) con coma, punto y coma o espacios.
- Enlaces completos de Google Maps (`@lat,lon`, `!3d!4d`, `!2d!3d`, parámetros `q`/`ll`/etc., `/maps/search/lat,lon`).
- Coordenadas Web Mercator de visores modernos (conversión a WGS84).
- Enlaces cortos de Google (`maps.app.goo.gl`) vía Cloudflare Worker, incluyendo el caso en que Google interpone su CAPTCHA (`/sorry`) con la coordenada dentro del parámetro `continue`.

Casos con mensaje específico: enlace corto sin resolver, enlace IGN antiguo en UTM, formato no reconocido. El parser rechaza deliberadamente números que podrían ser zoom, fechas o identificadores.

---

## 7. Estado de pruebas

Batería automatizada (ejecutada en el entorno de desarrollo con Node/JSDOM), 148 casos en total:
- **Modelo (49 casos):** valores de tablas, fronteras, cuadrantes en 8 rumbos, escenarios por tiempo, formato de tiempo, distancias y rumbos de control, ejemplo documental.
- **Geometría (7):** punto-destino, sectores, ida y vuelta.
- **Conversiones meteo/terreno (19):** dirección desde→hacia, cardinales, pendiente desde elevaciones.
- **Parser de ubicaciones (17):** coordenadas, todos los formatos de enlace de Google Maps, Mercator, CAPTCHA con `continue`, enlaces cortos y UTM del IGN detectados con mensaje específico.
- **Parser ArcGrid del worker (6):** formato IGN con distintos finales de línea, valores NODATA, matrices de distinto tamaño.
- **Extractor SIGPAC del worker (5):** verificado contra el ejemplo literal de la documentación oficial del FEGA.
- **Interfaz completa (66, DOM simulado):** bloqueo prudencial, caché, reintentos, editor, geolocalización, invalidación, ocultación de campos en modo automático, orden de secciones, auditoría de textos, flujo completo de SIGPAC (sugerencia, confirmación, trazabilidad en el resultado, casos sin recinto y de error).

---

## 8. Flujo de trabajo y despliegue

- Edición en VS Code → commit/push con GitHub Desktop → publicación automática en GitHub Pages.
- El `index.html` se ensambla a partir de fragmentos verificados por separado; el archivo final es autocontenido (un solo fichero).
- El worker se mantiene en `worker.js` (copia en el repositorio, carpeta `infra/`) y se despliega en Cloudflare. Pendiente de backlog: automatizar su despliegue vía GitHub para evitar el doble mantenimiento.

---

## 9. Roadmap

**Backlog inmediato (post-demo):**
- Automatizar el despliegue del worker vía GitHub (hoy requiere actualizarlo a mano en el panel de Cloudflare y en el repositorio).
- Documentación de usuario más visual si procede.

**Backlog futuro (crowdfunding):**
- **Modelo por tramos**: dividir el recorrido incendio→zona en segmentos, cada uno con su propia pendiente (ya disponible por IGN), combustible (ya disponible por SIGPAC) y viento (incluida su variación temporal, la mejora real pendiente en este dato). Es un cambio de modelo: conserva la fórmula documental dentro de cada tramo, pero altera los resultados globales. Requiere aviso explícito y validación de perfiles con experiencia en incendios antes de publicarse. Con IGN y SIGPAC ya integrados, este es el paso natural siguiente: la infraestructura de datos está lista, falta la lógica de segmentación.
- Revisar periódicamente la tabla de correspondencia SIGPAC→combustible (`SUGERENCIA_COMBUSTIBLE`) con criterio de campo, especialmente el caso "Forestal" (hoy resuelto por prudencia hacia pinar, el más desfavorable).

**Pospuesto (no antes de validar):**
- Simulación dinámica de frentes, propagación no lineal, aplicación Android nativa, arquitectura de servidor pesada.

---

*Este documento describe el estado técnico para validación. El modelo de cálculo es el del documento original del grupo Alerta Fuego y no se modifica sin acuerdo explícito.*