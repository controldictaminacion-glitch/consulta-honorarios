# Fuentes verificadas y equivalencia pendiente

Verificación de sólo lectura realizada el 26 de noviembre de 2026 mediante las hojas compartidas en la conversación privada. Los identificadores y las URLs no se copian al repositorio.

| Fuente privada | Ejercicio confirmado | Pestaña enlazada | Evidencia |
| --- | --- | --- | --- |
| Primera URL suministrada | 2025 | Analítico Desglose | Título y encabezado anual, fechas de muestra de 2025 |
| Segunda URL suministrada | 2026 | Concentrado | Título anual, encabezados y fechas de muestra de 2026 |

Los enlaces **no están en orden 2026/2025**. No se intercambian ni se cambia la hoja original de 2026.

## Mapeos por ejercicio

El `Code.gs` original de consulta recibido después del primer PR confirma el mapeo completo de 2026 y sus tipos. Para 2025 se conserva un adaptador independiente basado en los encabezados de la fuente; no se afirma equivalencia con un servicio histórico que no fue suministrado.

| Posición de consulta (base 0) | Campo | 2025: Analítico Desglose | 2026: Concentrado |
| --- | --- | --- | --- |
| 0 | Identificador | A | A |
| 1 | Órgano | B | B |
| 2 | Financiamiento | C | C |
| 3 | Desde | D | E |
| 4 | Hasta | E | F |
| 5 | Folios | F | G |
| 6 | Costo total | G | H |
| 7 | Oficio | H | I |
| 8 | Tipo de ingreso / etiqueta | No identificado | J |
| 9 | Procedencia | I, vacía en la revisión | K |
| 10 | Costo del dictamen | No identificado | X |

En 2025, L tiene importes sin encabezado; **no se asigna como costo del dictamen**. La pestaña Concentrado del mismo libro tiene otra estructura, con encabezados en fila 2, y no se utiliza como sustituto automático. Las cabeceras de folios y costo en Analítico Desglose incluyen totales en el propio texto; deben copiarse exactamente en la configuración privada y revisar cambios de encabezado al actualizar el libro.

El original de 2026 lee desde la fila 2 hasta la última fila usada e incluye toda fila cuya columna B mostrada no esté vacía. No excluye totales ni etiquetas adicionales. Su configuración equivalente tiene `requiredColumn: 2`, `excludeExact: []` y `excludeRows: []`, sin `lastRow` fijo. Los textos de identificación conservan lo mostrado, las fechas usan la zona de la hoja y se admiten seriales; las procedencias conservan enlaces enriquecidos.

Se realizó lectura completa acotada de las dos pestañas y comprobación de filas, tipos y sumas según esas reglas. El resumen de conciliación se mantiene fuera del repositorio. Todavía falta comparar contra la respuesta de un nuevo despliegue real. En 2025 se propone seleccionar B mostrada y dejar ingreso/dictamen como `null`; la procedencia I vacía no se sustituye por una columna diferente. Debe confirmarse esta adaptación antes de habilitar ese ejercicio.

Se conserva la precisión nativa de los importes y se redondea al presentar el total. Redondear cada fila antes de sumar puede cambiar el resultado de la fuente histórica.

## Archivos originales

- `Index.html`: inspeccionado; interfaz de consulta de 11 columnas y llamadas a `obtenerDatos()` y `Exportadores`.
- `Code.GS.txt` y primer texto pegado posterior: generador de Google Slides, ajeno al servicio de consulta. Se conserva fuera del repositorio público, con sus identificadores privados.
- `Exportadores`: recuperado del segundo texto pegado; adaptado a módulos y ejercicio dinámico, con PDF-lib local y licencia MIT.
- `Code.gs` de consulta: recibido; contiene `doGet()`, `obtenerDatos()`, `incluir_()`, `serializarCelda_()` y `verificarConexion()`. Su identificador privado no se copia al repositorio.

## Configuración inicial

Los años 2025 y 2026 existen como fuentes pendientes, deshabilitadas. El servidor mantiene la lectura pública cerrada salvo configuración explícita. El administrador declara el mapeo por año y confirma las reglas después de conciliar con la versión anterior. No hay configuración de fuentes reales en los tests, la demostración ni los artefactos de revisión.
