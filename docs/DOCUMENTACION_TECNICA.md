# Alerta Fuego — Documentación técnica

*Estado: demo web funcional en fase de validación. Este documento separa expresamente lo que está implementado de lo que solo está propuesto.*

---

## 1. Propósito, alcance y nivel de validación

Alerta Fuego estima de forma orientativa el tiempo de llegada de un frente de incendio forestal a una zona vulnerable. La implementación actual usa el modelo:

**VPIF = V0 · FV · FP**

**tiempo = distancia / VPIF**

La aplicación no es un modelo profesional de propagación, no predice la evolución real de un incendio y no sustituye al 112, INFOEX, bomberos, Protección Civil ni a ninguna autoridad competente. Sus resultados no deben utilizarse para apurar una evacuación, entrar en una zona comprometida ni contradecir instrucciones oficiales.

El documento original del grupo es la fuente que debe permitir comprobar la procedencia de las tablas y de los protocolos. En el estado del repositorio sobre el que se hizo esta revisión, ese PDF no estaba versionado; por tanto, la afirmación histórica de que el portado es «1:1» no es auditable únicamente con este repositorio. Incorporar la fuente, su versión y su fecha forma parte de la trazabilidad pendiente.

El uso previsto de IGN, SIGPAC e INFOEX sitúa la validación actual en España y, en particular, en el contexto territorial para el que fue concebido el proyecto. El mapa y Open-Meteo admiten coordenadas de otros países, pero eso no convierte la demo en una herramienta validada globalmente.

---

## 2. Arquitectura implementada

### Aplicación web

- `index.html` contiene la interfaz y carga como módulo la lógica pura de `src/core.js`; no hay framework ni proceso de compilación.
- Leaflet 1.9.4 se carga desde CDN.
- OpenStreetMap proporciona el mapa base y Esri World Imagery la capa satélite.
- El mapa, el cálculo y el estado de la interfaz se ejecutan en el navegador.

La aplicación puede abrirse como web estática, pero las funciones automáticas no son completamente locales: dependen de servicios externos y de un Cloudflare Worker.

### Datos consultados directamente desde el navegador

- **Open-Meteo Forecast API:** estimación modelizada de viento a 10 m en el punto del incendio.
- **Open-Meteo Elevation API:** reserva de elevación cuando no se obtiene la del IGN.

El «viento actual» de la interfaz es una salida de modelo meteorológico, no una observación de una estación situada en el punto.

### Cloudflare Worker

La copia versionada está en `infra/worker.js`. Expone:

- `/resolver`: intenta resolver enlaces cortos de Google Maps.
- `/elevaciones`: consulta dos elevaciones en el WCS del IGN.
- `/sigpac`: consulta el uso SIGPAC en el punto del incendio.

El Worker desplegado se mantiene por separado. Mientras el despliegue sea manual, que un endpoint responda no demuestra por sí solo que su código desplegado sea idéntico a `infra/worker.js`.

La copia versionada acepta únicamente `GET` y `OPTIONS`, valida formato y rango de coordenadas, normaliza la respuesta SIGPAC y limita el resolvedor a rutas concretas de Google Maps. Las redirecciones se siguen manualmente, con un máximo de cinco saltos y validación de cada destino. Se mantiene CORS `*` para que la web estática pueda llamar al Worker; eso permite también llamadas desde otros orígenes y debe tenerse en cuenta para cuota, abuso y observabilidad.

---

## 3. Modelo implementado

### Combustible

| Combustible del modelo | V0 (m/min) |
|---|---:|
| Pastos bajos | 3 |
| Bosque de quercus / encinar / robledal | 4 |
| Matorral mediterráneo | 6 |
| Pinar | 8 |

### Viento

Estas son las fronteras que ejecuta actualmente el código:

| Velocidad (km/h) | FV |
|---|---:|
| `v < 10` | 1 |
| `10 ≤ v < 20` | 1,5 |
| `20 ≤ v < 30` | 2 |
| `v ≥ 30` | 3 |

La dirección automática en grados se convierte a dirección «hacia» sumando 180° y el cálculo conserva esos grados. El modo manual ofrece ocho direcciones cardinales (N, NE, E, SE, S, SO, O, NO).

### Pendiente

| Situación | FP |
|---|---:|
| Fuego subiendo y pendiente `< 20 %` | 1 |
| Fuego subiendo y pendiente `20–40 %`, ambos incluidos | 1,5 |
| Fuego subiendo y pendiente `> 40 %` | 2 |
| Fuego bajando ladera | 0,7 |
| En llano | 1 |

### Geometría y escenarios

- La distancia entre incendio y zona se calcula mediante Haversine, en línea recta.
- El rumbo incendio→zona se compara con la dirección operativa del viento.
- Diferencia angular `≤ 45°`: riesgo.
- Diferencia angular `> 45° y ≤ 135°`: alerta lateral.
- Diferencia angular `> 135°`: sin riesgo directo según el viento usado.
- El tiempo se normaliza hacia abajo a minutos enteros para no mostrar más margen que el calculado; el texto y el escenario usan ese mismo entero.
- Escenarios: `≤ 30 min`, `≤ 60 min`, `≤ 90 min` y vigilancia preventiva por encima.

El ejemplo implementado con matorral, 20 km/h y 30 % subiendo produce `6 · 2 · 1,5 = 18 m/min`. Esto comprueba la aritmética del código; no sustituye la comparación con la fuente documental ni una validación operativa.

---

## 4. Datos automáticos y sus límites

### Viento — Open-Meteo

- Se consulta en el punto del incendio.
- La respuesta se conserva en memoria durante un máximo de diez minutos por coordenadas aproximadas.
- La interfaz muestra la hora en que la aplicación hizo la consulta.
- La velocidad se redondea a km/h enteros, igual que se muestra en la interfaz. La dirección conserva los grados automáticos y no se reduce a un cardinal.
- La resolución y el modelo concreto pueden variar según ubicación y disponibilidad de Open-Meteo.

No debe afirmarse que el viento es homogéneo entre dos puntos solo por la resolución nominal del modelo. La orografía, la escala local y el paso del tiempo siguen siendo limitaciones relevantes.

### Pendiente — IGN con reserva Open-Meteo

El Worker intenta obtener una elevación para cada extremo mediante el WCS del IGN. Si falla, el navegador consulta Open-Meteo Elevation. Después calcula:

`pendiente = |elevación zona − elevación incendio| / distancia horizontal`

Limitaciones:

- Solo usa los dos extremos; no recorre el perfil intermedio.
- No detecta vaguadas, crestas, barrancos ni cambios sucesivos de sentido.
- La pendiente calculada se redondea a un porcentaje entero, igual que se muestra en la interfaz, antes de aplicar el factor.
- IGN y Open-Meteo tienen cobertura, resolución, actualización y condiciones de servicio distintas.
- Debe mostrarse siempre qué fuente produjo el dato. Cualquier etiqueta contradictoria en la interfaz debe considerarse un defecto de trazabilidad.

Por estas razones, la pendiente automática es **provisional**, aunque la fuente de elevación sea oficial.

### Combustible — SIGPAC

SIGPAC aporta una **ocupación o uso del suelo en un punto**. No identifica con fiabilidad suficiente la especie, la estructura, la carga, la continuidad ni la humedad real del combustible forestal. Por ello:

- SIGPAC sugiere; la persona confirma.
- El fallo de SIGPAC no bloquea el cálculo si se elige combustible manualmente.
- Un uso sin equivalencia confirmada debe quedar en selección manual.
- Al mover el punto del incendio debe repetirse la consulta y no reutilizarse una sugerencia anterior como si perteneciera al punto nuevo.

La conversación de revisión con José dejó acordado el siguiente criterio, reflejado en la constante `SUGERENCIA_COMBUSTIBLE`:

| Ocupación SIGPAC | V0 acordada |
|---|---:|
| PS | 3 |
| PR o MT | 6 |
| PA | 3 |
| FO | 8 |

Este criterio es una clasificación conservadora basada en la ocupación disponible, no una identificación botánica. No se atribuye validación de campo adicional a estas correspondencias. El resto de usos queda fuera de la equivalencia automática hasta que exista un criterio explícito.

La consulta usa la ruta oficial `recinfobypoint/[srid]/[lon]/[lat].json`. Si el servicio devuelve varios recintos en un límite, seleccionar uno sin advertencia introduce otra incertidumbre que debe tratarse antes de considerar el dato definitivo.

---

## 5. Comportamiento prudencial de la interfaz

- Los puntos, la dirección y velocidad del viento, la pendiente, su sentido y el combustible deben quedar definidos antes de calcular.
- Un fallo de viento o pendiente en modo automático bloquea el cálculo hasta reintentar o volver a manual.
- SIGPAC no bloquea porque su papel es consultivo.
- En el cuadrante «sin riesgo directo» se presenta vigilancia preventiva en vez del protocolo temporal principal.
- La cabecera y el resultado recuerdan que la referencia real son el 112 y los servicios competentes.

La intención de diseño es invalidar cualquier resultado cuando cambie una entrada. Esa propiedad debe cubrir también actualizaciones explícitas de datos automáticos y respuestas que lleguen tarde; forma parte de las comprobaciones necesarias antes de una validación externa.

---

## 6. Resolución de ubicaciones

El editor implementa:

- coordenadas decimales separadas por coma, punto y coma o espacios;
- varios formatos de URL completa de Google Maps;
- coordenadas Web Mercator presentes en determinados parámetros de URL;
- enlaces cortos de Google mediante el Worker;
- detección específica de algunos enlaces IGN antiguos con UTM, que no se convierten automáticamente.

El resolvedor recibe el enlace completo y puede enviarlo a Google para seguir la redirección. Esto debe explicarse en la información de privacidad.

---

## 7. Pruebas y evidencia disponible

El proyecto incorpora lógica pura reutilizable en `src/core.js`, pruebas Node en `tests/` y el comando reproducible `npm test`. El workflow `.github/workflows/test.yml` ejecuta esa misma orden en cada `push` y `pull_request`.

Se retira el antiguo recuento histórico de casos porque no era reproducible desde la versión anterior del repositorio y sus subtotales documentados no eran coherentes. La referencia válida pasa a ser la suite que acompaña al código, no una cifra escrita a mano en este documento.

No debe confundirse:

- que una función exista en el código;
- que un endpoint responda en una comprobación puntual;
- que haya pruebas automatizadas repetibles;
- que el modelo haya sido validado operativamente por especialistas.

La suite actual cubre fronteras numéricas, cuadrantes, formato y clasificación del tiempo, vigencia del viento, equivalencias SIGPAC, parser, validación del Worker, redirecciones y errores de parámetros. La invalidación del estado SIGPAC al mover el incendio está implementada en la interfaz, pero, como el resto de interacciones completas del DOM, requiere comprobación de integración en navegador. Los proveedores reales y el comportamiento visual también necesitan comprobaciones aparte.

---

## 8. Fuentes, atribución y privacidad

### Datos enviados

Cuando se activan funciones automáticas:

- las coordenadas del incendio se envían a Open-Meteo para el viento;
- las coordenadas de incendio y zona se envían al Worker/IGN o a Open-Meteo para elevaciones;
- la coordenada del incendio se envía al Worker/SIGPAC;
- un enlace corto pegado se envía al Worker y a Google para resolverlo.

La aplicación no implementa cuentas ni una base de datos propia, pero los proveedores externos y la infraestructura de alojamiento pueden conservar registros según sus políticas. No deben introducirse ubicaciones sensibles sin comprender este flujo.

### Atribuciones a revisar y mantener

- Open-Meteo y, para su Elevation API, Copernicus.
- IGN/CNIG para el modelo digital del terreno.
- SIGPAC — FEGA, bajo CC BY 4.0.
- OpenStreetMap contributors y su licencia.
- Esri y los proveedores de World Imagery que correspondan a cada zona.

La presencia del nombre de una fuente no garantiza por sí sola el cumplimiento de sus condiciones. Los enlaces, fórmulas de atribución y políticas deben revisarse antes de una publicación promocionada o comercial.

---

## 9. Desarrollo y despliegue

- GitHub Pages puede publicar `index.html` desde la raíz de una rama configurada en GitHub.
- Esa configuración vive en GitHub y no está descrita por un workflow dentro del repositorio.
- El Worker se despliega por separado y hoy existe riesgo de divergencia entre la copia versionada y la desplegada.
- No hay proceso de compilación ni dependencias de ejecución instalables. `package.json` define únicamente el entorno y el comando de pruebas.

Resuelto en esta rama de fiabilidad:

- suite reproducible y ejecución automática en `push` y `pull_request`;
- tabla SIGPAC alineada con el criterio acordado;
- coherencia de tiempo, dirección automática, caducidad del viento y estado SIGPAC;
- trazabilidad de la fuente de elevación y atribución visible de OpenStreetMap/Open-Meteo;
- validación estricta de parámetros y redirecciones en la copia versionada del Worker.

Pendiente antes de presentar la herramienta como lista para distribución:

1. Versionar el PDF fuente con versión, fecha y procedencia claras.
2. Desplegar esta revisión del Worker y registrar el identificador o fecha de despliegue.
3. Completar la revisión jurídica de atribuciones, privacidad, licencias y alcance geográfico.
4. Validar externamente las tablas, protocolos, textos y casos operativos.
5. Decidir y validar el diseño del eventual cálculo por tramos.

---

## 10. Ampliación por tramos — no implementada

El modelo actual calcula todo el trayecto con un único combustible, una pendiente entre extremos y un viento. **No existe todavía lógica por tramos en la demo.**

La ampliación planteada estudia:

- muestrear la línea incendio→zona aproximadamente cada 30 m;
- construir un perfil de elevación y pendiente por segmento;
- asignar ocupación o combustible por segmento;
- incorporar variación temporal del viento;
- combinar tiempos parciales sin ocultar la incertidumbre acumulada.

Los 30 m son una propuesta de diseño, no una resolución validada. También son propuestas pendientes de selección y validación las fuentes o productos MDE, Copernicus y PNOA. Antes de implementar hay que acordar cobertura, resolución efectiva, licencias, tratamiento de datos ausentes, coste de consultas y validación del nuevo cálculo.

La clasificación avanzada de vegetación queda **fuera de este bloque**. No se presupone que PNOA, Copernicus u otra fuente permitan convertir automáticamente vegetación real en los cuatro combustibles del modelo sin una metodología específica y validada.

---

*Esta documentación describe la demo y sus límites. Toda modificación del modelo o de las correspondencias operativas debe quedar versionada, probada y sometida a la validación que corresponda antes de presentarse como fiable en una emergencia.*
