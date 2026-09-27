# Alerta Fuego — guía para el equipo fundador

## Qué ofrece la RC1

La web estima de forma orientativa el tiempo que tardaría un frente dominante en recorrer la línea entre un incendio y una zona vulnerable. Está pensada para estudiar conatos o fases iniciales; no predice pavesas, fuego de copas, frentes múltiples ni una propagación espacial completa. No sustituye al 112 ni a los servicios competentes, y la ETA nunca debe usarse para apurar una salida.

La RC1 conserva el mapa, los marcadores, la entrada de coordenadas o enlaces de Google Maps, la geolocalización, los cuadrantes y los protocolos. Divide el corredor en tramos de hasta 30 m de integración, separados también por cambios de combustible. Esos 30 m no representan la precisión del mapa de vegetación.

## Cómo usarla

1. Marca el incendio y la zona vulnerable en el mapa o introduce sus coordenadas.
2. Abre «Datos» si quieres revisar las fuentes o activar un modo manual de pendiente, viento o combustible.
3. Pulsa «Calcular alerta».
4. Lee la ETA única, la distancia y el protocolo. Abre «Cómo se calculó» para ver el número de tramos, las fuentes, las reglas y las hipótesis de cada tramo.

El viento automático procede de un pronóstico horario de Open-Meteo. El cálculo aplica la hora prevista al llegar a cada posición, incluso si cambia en medio de un tramo. El cuadrante del mapa solo describe la dirección inicial, no todas las direcciones futuras. En modo manual, la dirección y la velocidad elegidas se aplican de manera uniforme.

La pendiente automática sale del perfil IGN MDT05 a lo largo del recorrido, con respaldo Open-Meteo Elevation si falla la consulta completa. El control manual va de −100 % a +100 %: valor negativo para descenso hacia la zona, cero para llano y positivo para ascenso. Se aplica uniformemente.

El combustible automático se obtiene por tramo de SIGPAC; el servidor local puede añadir MFE25 cuando dispone de la fuente. La página pública todavía no distribuye MFE25 y no permite seleccionar un fichero: usa SIGPAC y sus reglas provisionales. El control manual permite elegir una clase uniforme para todo el corredor sin sugerencia puntual basada en el foco. [Política de combustible](RC1_POLITICA_COMBUSTIBLE_PROVISIONAL.md).

## Cómo interpretar los resultados

La ETA suma los tiempos calculados para los tramos. En la tabla técnica se identifican los datos manuales y los tramos en los que falta un valor automático. Cuando falta clase de combustible, viento o elevación, el programa mantiene una ETA provisional con V0=8, FV=3 o FP=2, respectivamente. Son los valores más rápidos de la tabla VPIF actual y no constituyen una cota garantizada para un incendio real. Los tramos AG/CA/ED/ZU tienen un tiempo positivo calculado con V0=8 y el viento y la pendiente correspondientes. Es una hipótesis provisional de cruce incierto para el aviso temprano: no demuestra que el fuego cruce ni que la barrera lo detenga; tampoco modeliza pavesas.

El resultado muestra un protocolo vinculado al tiempo estimado. El color o cuadrante de viento inicial no reduce su urgencia. Ante un peligro real, hay que seguir las indicaciones oficiales aunque contradigan la web.

## Datos externos y límites

La aplicación comunica coordenadas a Open-Meteo para viento y, si hace falta, elevación; al servidor local o Worker e IGN para perfil; y al servidor local o Worker y SIGPAC para recintos y usos. Al resolver enlaces cortos de Google Maps intervienen el Worker y Google. No tiene cuentas ni base de datos propia, pero esos proveedores pueden registrar solicitudes.

Las peticiones automáticas pueden fallar por red, tiempo de espera, respuesta inválida, celdas sin elevación o fin del horizonte del pronóstico. El programa registra la incidencia y el supuesto empleado en «Cómo se calculó». [Diagnóstico de fuentes](RC1_FALLOS_PROVEEDORES.md).

La RC1 pública es una demo experimental sin validación predictiva u operativa. Siguen abiertas la discrepancia histórica de matorral (intervalo 2–5 frente a V0=6 m/min), la regla para mezclas de combustible, los cruces inciertos y el papel de la dirección del viento en la velocidad. [Validaciones pendientes](VALIDACION_MVP.md) y [documentación técnica](DOCUMENTACION_TECNICA.md).
