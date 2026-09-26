# RC1 — política provisional de combustible automático

**Estado: hipótesis provisional del modelo, sujeta a revisión técnica.** No es una validación científica de velocidades de propagación. En modo automático, la web identifica cada tramo con los recintos SIGPAC FEGA y, cuando existe, la información MFE25 local. En modo manual, aplica un combustible uniforme al corredor. Conserva código, identificador de recinto, regla, conflicto y fallback en el resultado automático.

| Evidencia en el tramo | Regla RC1 | V0 (m/min) |
|---|---|---:|
| SIGPAC PS o PA | Pastos | 3 |
| SIGPAC PR o MT | Matorral provisional | 6 |
| Dominio FO/PR/MT/PA con MFE25 concluyente | Pastos, quercus, matorral o pinar según campos MFE25 | 3, 4, 6 u 8 |
| Varios candidatos fiables | Máximo de los V0 candidatos, con etiqueta de ambigüedad | máximo |
| FO sin clase MFE25 concluyente | Combustible positivo no tipificado | 8 |
| Cultivo permanente OV/VI/FY/FS/CI | Combustible positivo no tipificado | 8 |
| Mezcla de clase tipificada con cultivo permanente | Valor conservador y conflicto visible | 8 |
| AG/CA/ED/ZU inequívoco | Discontinuidad; convención `t_gap = 0` | no aplica |
| TA/TH, IM/EP/ZC/ZV, SIGPAC ausente o uso sin correspondencia | NoData | indeterminada |

`V0 = 8` es el valor más alto de las cuatro clases actuales del modelo. Se utiliza como cota prudente **dentro de esta tabla**, solo donde el código acredita vegetación o forestal. No es una cota física demostrada para cualquier incendio. Una consulta fallida o un recinto sin código no se convierte en 8. Cuando falta V0 en cualquier tramo que no es una discontinuidad, la ETA automática completa de cada escenario queda indeterminada. La interfaz muestra esa condición y permite cambiar expresamente al modo manual.

La regla para FO evita inventar una especie: se muestra “combustible no tipificado”, no “pinar”. En viñedo, olivar y otros cultivos permanentes, 8 es una sobreestimación preventiva provisional de la velocidad base; cobertura, manejo y época pueden cambiar la realidad. Las clases PR/MT conservan por ahora `V0 = 6`, pese a la discrepancia con el intervalo 2–5 m/min del documento histórico.

El cálculo por tramos usa `VPIF_i,s = V0_i · FV_s · FP_i` y `ETA_s = Σ(d_i/VPIF_i,s)`. Viento horario y pendiente firmada se documentan en [DOCUMENTACION_TECNICA.md](DOCUMENTACION_TECNICA.md). Las discontinuidades con tiempo cero son una convención contable del modelo; **no demuestran que el fuego las atraviese instantáneamente ni que detengan un incendio**.

## Cuestiones para revisión técnica antes de consolidar la política

1. ¿Se aprueba `V0 = 8` como sobreestimación prudente para FO sin clase MFE25 y para OV/VI/FY/FS/CI, o deben quedar sin ETA?
2. ¿Deben variar estas hipótesis según densidad, manejo, época o cobertura del cultivo? ¿Qué campo verificable permitiría hacerlo automáticamente?
3. ¿Es adecuado usar el máximo entre candidatos MFE25/SIGPAC en límites y conflictos, o conviene otra regla?
4. ¿Se mantiene `V0 = 6` para PR/MT y el matorral MFE25 frente al intervalo histórico 2–5?
5. ¿Cómo debe tratarse una discontinuidad AG/CA/ED/ZU en una ETA de recorrido? ¿Qué prueba permite considerarla cortafuegos real?
6. ¿Debe mostrarse una ETA condicional cuando la zona cae fuera del sector principal según el viento?

**Criterio de cierre:** registrar respuesta, fecha y versión de reglas; modificar código, pruebas y textos si cambia una hipótesis; volver a validar con corredores reales antes de presentar el modelo como fiable.
