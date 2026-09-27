# Por qué pueden faltar datos automáticos

La falta de combustible es la incertidumbre temática principal, pero viento y elevación también dependen de proveedores externos y de la cobertura de sus respuestas. Una ETA calculable no demuestra que todas sus entradas sean observaciones completas.

## Elevación y pendiente

El navegador envía el perfil al servidor local o al Worker. Este pide ventanas ArcGrid al servicio WCS MDT05 del IGN. Cada ventana puede devolver una matriz válida con celdas `NoData`: el código mantiene esas posiciones como `null`, sin convertirlas en terreno llano. En un ensayo público anterior hubo tres tramos con pendiente supuesta; no se conservó el ráster bruto de esa consulta, por lo que no es posible atribuir esas tres celdas a una causa concreta. Entre las causas posibles están celdas sin valor del producto, bordes de cobertura o el muestreo en el borde de una celda; son hipótesis diagnósticas, no un fallo demostrado del IGN.

Una petición completa también puede fallar por conexión, plazo de 15 s del WCS, error HTTP, respuesta excesiva, excepción del servicio o ArcGrid incompleto. El cliente reintenta el perfil una vez. Si falla por completo, consulta Open-Meteo Elevation/GLO-90 y deja constancia de la fuente. Si tampoco responde, mantiene la ETA provisional con FP=2. Si IGN devuelve solo algunas celdas `NoData`, el cliente conserva el resto del perfil IGN y aplica FP=2 solo en los tramos que requieren esas celdas; actualmente no hace una consulta adicional a Open-Meteo para rellenarlas.

## Viento

El cálculo pide a Open-Meteo una serie horaria UTC de velocidad y dirección a 10 m para los puntos del corredor. Puede faltar por conexión, tiempo de espera de 12 s, HTTP no satisfactorio, JSON inválido, número de puntos incoherente, hora ausente o valor de velocidad no válido. La petición actual solicita siete días desde medianoche UTC; si el recorrido calculado alcanza una hora posterior al último dato, esa parte queda sin pronóstico. En cada hora sin velocidad válida se aplica FV=3 y se marca la ETA provisional. La dirección ausente puede impedir dibujar un cuadrante inicial aunque la velocidad baste para calcular la ETA.

La serie se consulta al pulsar «Calcular alerta». El viento mostrado en «Cómo se calculó» corresponde a las horas efectivamente usadas. El cuadrante solo refleja la dirección inicial y no sintetiza las direcciones posteriores.

## Qué informa la web

Los detalles técnicos muestran origen automático o manual, incidencias del proveedor cuando la petición falló, número de tramos con sustituciones y valores aplicados. Los factores V0=8, FV=3 y FP=2 son los máximos de la tabla VPIF actual; generan una ETA más corta dentro de ese modelo, pero no garantizan un tiempo real mínimo.

## Fuentes y comprobación pendiente

- [IGN/CNIG, MDT05](https://centrodedescargas.cnig.es/CentroDescargas/modelo-digital-terreno-mdt05-primera-cobertura): cobertura y características del modelo de 5 m.
- [Open-Meteo, Forecast API](https://open-meteo.com/en/docs): variables horarias y horizonte solicitado.
- [Open-Meteo, Elevation API](https://open-meteo.com/en/docs/elevation-api): respaldo GLO-90 de 90 m.

Para diagnosticar una incidencia específica se necesita conservar de forma temporal y controlada el código de error, la hora y la respuesta de cobertura de la consulta afectada, sin publicar coordenadas precisas ni registros personales. Los ensayos de integración verifican mecanismos de fallo y trazabilidad, no exactitud predictiva.
