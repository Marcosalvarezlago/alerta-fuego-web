# Próxima mejora de visualización RC1

**Estado:** propuesta para una actualización posterior; no forma parte de la publicación actual.

## Mapa de combustibles por tramo

- Colorear la línea incendio → zona por clase de combustible, con una leyenda estable para pastos, quercus, matorral, pinar, combustible no tipificado, discontinuidad y NoData.
- Mostrar al tocar un tramo: distancia acumulada, código SIGPAC, clase, V0, procedencia, confianza y cualquier conflicto.
- Diferenciar visualmente los valores manuales uniformes de los datos automáticos y evitar que los tramos de 30 m sugieran una precisión cartográfica de 30 m.
- Mantener legibilidad con mapa base y satélite, en móvil y para personas con dificultad de distinguir colores.

## Perfil de pendiente

- Representar elevación frente a distancia acumulada, con puntos y pendiente firmada de cada tramo.
- Vincular el tramo señalado en el perfil con el mismo tramo del mapa y de la tabla técnica.
- Marcar huecos del MDT y el proveedor de respaldo; no dibujar un terreno llano cuando falta elevación.
- En modo manual, mostrar una recta esquemática y etiquetarla como hipótesis homogénea.

## Evolución temporal y calidad de datos

- Dibujar el tiempo acumulado a lo largo del corredor y señalar en qué punto cambia la hora del pronóstico aplicada.
- Mostrar qué tramos dominan la ETA y cuáles usan supuestos provisionales o NoData.
- Mantener al alcance los protocolos y el recordatorio de emergencia; el gráfico nunca debe ocultar incertidumbre ni hacer parecer exacta la ETA.

**Criterio de entrega futuro:** revisar un prototipo en escritorio y móvil, validar accesibilidad y comparar las visualizaciones con la tabla de tramos y la ETA integrada calculada.
