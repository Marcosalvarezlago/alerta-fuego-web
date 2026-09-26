# Alerta Fuego — Guía para el equipo fundador

*La RC1 por tramos está integrada en la interfaz local de `index.html`. GitHub Pages conserva por ahora la demo global histórica. Ninguna está validada como herramienta fiable de emergencia. Los apartados anteriores a “RC1 por tramos” describen la versión histórica publicada.*

---

## Qué es Alerta Fuego

Alerta Fuego es una aplicación web que hace una estimación orientativa del tiempo que tardaría un frente de incendio en recorrer la distancia entre un punto de incendio y una zona vulnerable.

El cálculo combina cuatro datos:

- la distancia;
- el tipo de combustible o vegetación dominante;
- la velocidad y dirección del viento;
- la pendiente y el sentido en que avanza el fuego.

La fórmula implementada es la que se venía usando en el proyecto: velocidad base del combustible multiplicada por los factores de viento y pendiente; después, distancia dividida por esa velocidad.

El documento original del grupo debe conservarse junto al proyecto para poder comprobar de forma independiente las tablas y los textos de actuación. La demo por sí sola no demuestra que el modelo haya sido validado por especialistas.

---

## Qué NO es

- **No predice la evolución real de un incendio.** Simplifica un fenómeno que cambia continuamente.
- **No sustituye al 112, INFOEX, bomberos, Protección Civil ni a ninguna autoridad.**
- **No sirve para apurar una salida ni para justificar quedarse.**
- **No es una validación profesional del terreno, del combustible ni del viento.**
- **No está validada para cualquier país.** IGN y SIGPAC aportan datos para el ámbito español.

Ante peligro real, llama al 112 y sigue las instrucciones oficiales aunque contradigan la estimación de la aplicación.

---

## Cómo se usa la demo

1. Se abre la web en móvil u ordenador.
2. Se marca el punto del incendio en el mapa.
3. Se marca la zona que se quiere proteger.
4. Se revisan o introducen pendiente, viento y combustible.
5. Se pulsa **Calcular alerta**.

Los puntos también pueden fijarse con coordenadas, algunos enlaces de Google Maps o, para la zona vulnerable, con «Mi ubicación».

La aplicación no debería calcular mientras falte un dato necesario. Usar un dato automático no elimina la obligación de comprobar si tiene sentido con lo que se ve y se conoce del terreno.

---

## Qué muestra el resultado

- **Rojo — riesgo:** la zona queda en la dirección principal usada para el viento.
- **Amarillo — alerta lateral:** un cambio de dirección puede llevar el frente hacia la zona.
- **Fuera del sector principal según el viento considerado:** no significa que la zona sea segura; el viento y el incendio pueden cambiar.
- Distancia entre los dos puntos.
- Velocidad de propagación calculada por el modelo.
- Tiempo estimado y escenario temporal.
- Recomendaciones asociadas al escenario.

Los textos de actuación también deben revisarse con el equipo fundador y con criterio competente en emergencias. Que estén incorporados en la app no los convierte por sí solo en instrucciones oficiales.

---

## Los datos automáticos y sus límites

### Viento

Open-Meteo ofrece una estimación de modelo meteorológico en el punto del incendio. No es un anemómetro colocado allí ni una observación directa. La aplicación convierte la dirección meteorológica «desde» en la dirección «hacia» la que empujaría el frente y conserva temporalmente la consulta.

Si el viento automático no está disponible o ha caducado, hay que reintentar o volver al modo manual. El cálculo no debe continuar usando un viento automático antiguo como si fuera actual.

### Pendiente

La aplicación obtiene la elevación del incendio y de la zona mediante IGN; si no puede, intenta Open-Meteo. Con esos dos extremos calcula una pendiente media sencilla.

Esto no dibuja el perfil completo entre ambos puntos. Un barranco, una cresta o varios cambios de ladera pueden quedar ocultos. Por eso la pendiente automática es provisional y la interfaz debe indicar la fuente utilizada.

Si esta consulta falla, hay que reintentar o elegir la pendiente manualmente.

### Combustible y SIGPAC

SIGPAC informa de la ocupación oficial del suelo en el punto del incendio. No sabe necesariamente qué especie hay, cuánta biomasa existe, si está seca ni cómo continúa la vegetación hasta la zona protegida.

Por prudencia, SIGPAC **solo sugiere**. La persona debe confirmar el combustible, y una consulta fallida no impide elegirlo manualmente.

La demo global histórica conserva este criterio; la RC1 usa una arquitectura distinta:

| Ocupación SIGPAC | Velocidad base propuesta |
|---|---:|
| PS — pastizal | 3 m/min |
| PR o MT — pasto arbustivo/matorral | 6 m/min |
| PA — pasto con arbolado | 3 m/min |
| FO — forestal | 8 m/min en la demo histórica; sin V0 directo en RC1 |

Es una clasificación conservadora por ocupación, no una identificación botánica. Los usos sin correspondencia acordada deben elegirse manualmente. Al mover el punto del incendio hay que repetir la consulta; una sugerencia pertenece al punto en el que se obtuvo.

---

## Qué pasa si falla internet o una fuente

- Si falla **viento** o **pendiente** mientras están en automático, el cálculo queda bloqueado hasta reintentar o pasar a manual.
- Si falla **SIGPAC**, se mantiene la elección manual de combustible porque su consulta es orientativa.
- Las teselas del mapa, IGN, SIGPAC, Open-Meteo, Google Maps y el Worker son servicios externos. Su disponibilidad no depende solo del proyecto.

No debe confundirse «el servicio respondió una vez» con «el servicio está garantizado».

---

## Privacidad: qué datos salen del dispositivo

Al usar funciones automáticas se envían coordenadas a servicios externos:

- el incendio a Open-Meteo para consultar viento;
- incendio y zona a IGN, al Worker o a Open-Meteo para calcular elevaciones;
- el incendio a SIGPAC para consultar ocupación;
- un enlace corto al Worker y a Google para resolverlo.

La aplicación no tiene cuentas ni una base de datos propia, pero los proveedores y alojamientos pueden generar registros conforme a sus políticas. Conviene no introducir ubicaciones sensibles sin conocer este flujo.

---

## En qué punto está realmente el proyecto

- Existe una demo web estática que permite recorrer el flujo completo.
- El cálculo básico, el mapa y las consultas externas están implementados.
- La correspondencia SIGPAC se ha revisado con José y la demo refleja la tabla de esta guía.
- La aplicación incorpora pruebas unitarias reproducibles, pero sigue necesitando comprobación visual y con servicios reales, revisión de fuentes y licencias, trazabilidad del documento original y validación operativa independiente.
- La publicación web y el Worker son despliegues separados; el Worker requiere control de versión para evitar diferencias entre el repositorio y lo que está activo.

La pregunta de esta fase no es solo «¿funciona la pantalla?», sino también:

- ¿El modelo y sus fronteras coinciden con lo acordado?
- ¿Los textos de actuación son correctos y prudentes?
- ¿Las sugerencias SIGPAC tienen sentido en los casos conocidos?
- ¿Qué errores deben impedir presentar un resultado?
- ¿Qué nivel de validación hace falta antes de ampliar su uso?

---

## RC1 por tramos: piloto local provisional

La web local conserva mapa, marcadores, editor de coordenadas, geolocalización, cuadrantes y protocolos de la versión anterior. Al pulsar “Calcular alerta”, `index.html` recorre un corredor 1D, corta sus fronteras SIGPAC/MFE25, integra segmentos de hasta 30 m, usa pendiente firmada de perfil y cuatro escenarios horarios de viento. Cada tramo aporta su tiempo a la ETA. Los 30 m son separación de integración, no precisión del mapa de combustible.

La prueba local obtiene SIGPAC y el perfil IGN automáticamente; el MFE25 actualmente disponible en el equipo cubre Extremadura. Nadie tiene que elegir un fichero, escribir la URL de un Worker ni seleccionar combustible. Un FO sin clase MFE no se convierte en pinar: recibe provisionalmente V0=8 con etiqueta de “combustible no tipificado”. Viñedo, olivar y otros cultivos permanentes reciben la misma hipótesis prudente. Sin evidencia suficiente, la ETA queda indeterminada. Las discontinuidades inequívocas se registran con tiempo cero como convención de cálculo: **no significa que el fuego atraviese una barrera instantáneamente**. Puede usarse Open-Meteo Elevation como respaldo visible si el MDT05 no responde. [Reglas y preguntas para José Antonio](RC1_POLITICA_COMBUSTIBLE_PROVISIONAL.md).

Dirección decidió implementar RC1 antes de la revisión con José Antonio. Quedan para su criterio: max(V0) en mezclas, V0=8 para combustible positivo no tipificado, t_gap=0, viento espacial prudencial, presentación de ETA por sector y discrepancia histórica del matorral 2–5 frente a 6 m/min. La RC1 no está desplegada ni validada científicamente; ninguna ETA debe interpretarse como tiempo seguro.

---

*Alerta Fuego es una ayuda de anticipación en desarrollo. Ante cualquier emergencia real, llama al 112 y sigue las indicaciones de los servicios competentes.*
