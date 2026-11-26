# Fuentes verificadas y equivalencia pendiente

Verificación de sólo lectura realizada el 26 de noviembre de 2026 mediante las hojas compartidas en la conversación privada. Los identificadores y las URLs no se copian al repositorio.

| Fuente privada | Ejercicio confirmado | Pestaña enlazada | Evidencia |
| --- | --- | --- | --- |
| Primera URL suministrada | 2025 | Analítico Desglose | Título y encabezado anual, fechas de muestra de 2025 |
| Segunda URL suministrada | 2026 | Concentrado | Título anual, encabezados y fechas de muestra de 2026 |

Los enlaces **no están en orden 2026/2025**. No se intercambian ni se cambia la hoja original de 2026.

## Mapeos candidatos, no conciliados

El frontend original obtiene los títulos y tipos desde `obtenerDatos`; por tanto, estos mapeos se basan en la inspección de encabezados y requieren validación contra ese servicio.

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
| 9 | Procedencia | I (revisar también vínculo en K) | K |
| 10 | Costo del dictamen | No identificado | X |

En 2025, L tiene importes sin encabezado; **no se asigna como costo del dictamen**. La pestaña Concentrado del mismo libro tiene otra estructura, con encabezados en fila 2, y no se utiliza como sustituto automático. Las cabeceras de folios y costo en Analítico Desglose incluyen totales en el propio texto; deben copiarse exactamente en la configuración privada y revisar cambios de encabezado al actualizar el libro.

Se necesitan las reglas para distinguir registros de subtotales/totales, rango efectivo de filas, tratamiento de vacíos, procedencias y posibles fórmulas o enlaces enriquecidos. Un muestreo de encabezados confirma el ejercicio y la estructura, **no certifica las sumas completas**.

## Archivos originales

- `Index.html`: inspeccionado; interfaz de consulta de 11 columnas y llamadas a `obtenerDatos()` y `Exportadores`.
- `Code.GS.txt` y primer texto pegado posterior: generador de Google Slides, ajeno al servicio de consulta. Se conserva fuera del repositorio público, con sus identificadores privados.
- `Exportadores`: recuperado del segundo texto pegado; adaptado a módulos y ejercicio dinámico, con PDF-lib local y licencia MIT.
- **Pendiente:** `Code.gs` de consulta que contiene `doGet()`, `obtenerDatos()`, `incluir_()` y sus ayudantes o archivos dependientes.

## Configuración inicial

Los años 2025 y 2026 existen como fuentes pendientes, deshabilitadas. El servidor mantiene la lectura pública cerrada salvo configuración explícita. El administrador declara el mapeo por año y confirma las reglas después de conciliar con la versión anterior. No hay configuración de fuentes reales en los tests, la demostración ni los artefactos de revisión.
