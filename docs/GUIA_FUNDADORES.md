# Alerta Fuego — Guía para el equipo fundador

*Documento para validación. No requiere conocimientos de informática.*

---

## Qué es Alerta Fuego

Es una aplicación web que ayuda a estimar, de forma aproximada y prudente, cuánto tiempo podría tardar un incendio forestal en alcanzar una finca, vivienda, corral o cualquier zona que queramos proteger.

Traslada a un mapa y a una pantalla de móvil el mismo cálculo de la hoja "Alerta Fuego" que ya conocéis: el que estima la velocidad de avance del fuego a partir del combustible, el viento y la pendiente, y de ahí el tiempo disponible según la distancia.

**No es un modelo profesional de predicción de incendios, y no pretende serlo.** Es una ayuda para anticiparse y tomar decisiones con más margen.

---

## Qué NO es (importante)

- **No sustituye al 112, INFOEX, bomberos, Protección Civil ni a las autoridades.** Ante peligro real, la única referencia válida son ellos.
- **No predice lo que hará el fuego.** Da una estimación orientativa basada en unos pocos datos.
- **No sirve para apurar tiempos.** El cálculo está pensado para retirarse antes, nunca para justificar quedarse.

La app repite este aviso en pantalla, de forma deliberada, para que nadie confunda una estimación con una certeza.

---

## Cómo se usa (paso a paso)

1. **Se abre en el móvil o el ordenador** desde un enlace web. No hay que instalar nada.
2. **Se toca el mapa para marcar el incendio** (dónde está el fuego o el conato).
3. **Se toca de nuevo para marcar la zona vulnerable** (la finca, la casa, el corral). La app pasa sola de un punto al otro para guiarte.
   - También se puede usar "Mi ubicación" para marcar dónde estás, o escribir/pegar unas coordenadas o un enlace de Google Maps.
4. **Se rellenan tres datos**, igual que en la hoja de cálculo:
   - **Pendiente**: cuánto sube o baja el terreno, y en qué sentido avanza el fuego.
   - **Viento**: hacia dónde empuja y a qué velocidad.
   - **Combustible**: qué tipo de vegetación domina (pastos, quercus, matorral, pinar).
5. **Se pulsa "Calcular alerta"** y aparece el resultado.

El viento y la pendiente se pueden rellenar a mano o dejar que la app los busque sola por internet (ver más abajo).

---

## Qué muestra el resultado

- **En qué cuadrante cae la zona** respecto a la dirección del viento:
  - **Rojo (riesgo)**: el viento empuja el fuego justo hacia la zona. Es la situación principal de alerta.
  - **Amarillo (alerta)**: la zona está a un lado; un cambio de viento podría dirigir el fuego hacia ella.
  - **Verde (sin riesgo directo)**: con el viento actual, el fuego no va hacia la zona. Pero el viento cambia: hay que seguir vigilando.
- **La distancia** entre el fuego y la zona.
- **El tiempo estimado** hasta que el frente podría llegar (solo cuando la zona está en el cuadrante de riesgo o de alerta).
- **El protocolo de actuación** correspondiente al tiempo disponible (30 minutos, 1 hora, 1 hora y media), tomado directamente del documento Alerta Fuego.

Sobre el mapa se dibujan los cuatro cuadrantes y la flecha del viento, para ver la situación de un vistazo.

---

## El cálculo es exactamente el vuestro

La app usa la misma fórmula del documento, sin cambios:

**Velocidad de avance del fuego = combustible × viento × pendiente**

Y de ahí: **tiempo = distancia ÷ velocidad de avance.**

Los valores de las tablas (pastos 3, quercus 4, matorral 6, pinar 8; los factores de viento y de pendiente) son **los mismos del documento original**, sin alterar. Se ha comprobado con el ejemplo del propio documento (matorral, viento 20 km/h, pendiente 30 % subiendo), que da una velocidad de 18 metros por minuto: la app da ese mismo número.

**Esto es lo que más nos interesa que validéis:** que el comportamiento de la app coincide con vuestra experiencia y con el modelo que se acordó.

---

## Datos automáticos: una comodidad con límites claros

La app puede buscar sola el **viento** (de un servicio meteorológico público) y una estimación de la **pendiente** (de un servicio público de altitudes).

Dos decisiones importantes, por prudencia:

- **Si el dato automático no se puede obtener** (sin cobertura, servicio caído), la app **no se inventa un valor ni deja calcular**: avisa y pide rellenarlo a mano o reintentar. Nunca calcula con datos falsos.
- **El viento automático se consulta en el punto del incendio** y muestra la hora de la consulta, para que quede claro que es una foto de un momento, no un dato en vivo.

La estimación automática de la pendiente es todavía **provisional** (usa solo la altura del punto del incendio y de la zona). Mejorarla con datos oficiales del Instituto Geográfico Nacional es uno de los siguientes pasos previstos.

---

## En qué punto está el proyecto

- La app **funciona y es usable en móvil**. Este es el estado que traemos a validación.
- El cálculo está **verificado** contra el documento original.
- Lo que buscamos ahora: **vuestro criterio operativo**. ¿El flujo es claro? ¿Los textos del protocolo son correctos? ¿Falta algún aviso de seguridad? ¿El comportamiento encaja con la experiencia real en el monte?

---

## Qué viene después (si el proyecto sigue adelante)

Pensado para una fase posterior, previsiblemente con financiación:

- Mejorar la pendiente con datos oficiales del IGN (mayor precisión).
- Incorporar el tipo de vegetación desde cartografía oficial (SIGPAC).
- Afinar el cálculo dividiendo el recorrido del fuego en tramos, en lugar de tratarlo como uno solo.

Todo ello **manteniendo la misma regla de siempre**: antes que parecer preciso, la app debe ser honesta sobre lo que no sabe.

---

*Alerta Fuego es una herramienta de ayuda a la anticipación. Ante cualquier emergencia real, llama al 112 y sigue las indicaciones de los servicios competentes.*