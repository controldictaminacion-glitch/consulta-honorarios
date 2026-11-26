# Configuración privada del servicio

Este servicio adapta la consulta original a varios ejercicios. El `Code.GS.txt` inicial genera presentaciones y no se incorporó. El backend de consulta 2026 recibido posteriormente ya confirma el mapeo, la selección de filas y la serialización originales; sus reglas están cubiertas por pruebas sintéticas de compatibilidad. Falta conciliar el resultado con las fuentes reales antes de habilitarlo. No se ha creado ni actualizado ningún despliegue.

Usar **un mismo proyecto Apps Script**, con dos despliegues separados cuando se autorice su puesta en servicio:

1. Lectura: ejecutar como propietario. `doGet` solo sirve años/datos si `PUBLIC_READ_ENABLED` es exactamente `true`.
2. Administración: ejecutar como el usuario que accede. Su URL debe terminar en `?action=admin`. Las cuatro cuentas administradoras necesitan acceso a las fuentes y a la hoja privada de bitácora. Google solicita autorización individual.

Cada función administrativa comprueba en el servidor que el usuario activo existe, coincide con el usuario efectivo y está en la lista privada. No se acepta identidad enviada por el navegador ni se usa el propietario como sustituto de un usuario desconocido. Si el propietario autorizado tiene identidad activa verificable, también puede administrar desde su propio contexto; los demás administradores deben usar el despliegue que ejecuta como usuario. El acceso anónimo o sin identidad siempre se rechaza.

## Propiedades del script

Configurar estos valores en **Configuración del proyecto → Propiedades del script**, nunca en GitHub, ni en archivos de ejemplo locales que vayan a confirmarse:

| Propiedad | Valor |
|---|---|
| `ADMIN_EMAILS_JSON` | Arreglo JSON con las cuatro cuentas autorizadas proporcionadas de forma privada. No se devuelve al cliente. |
| `HONORARIOS_CONFIG_JSON` | Configuración por ejercicio y revisión; esquema inferior. |
| `PUBLIC_READ_ENABLED` | Mantener `false` durante revisión. Solo cambiar a `true` después de la conciliación y autorización de puesta en servicio. |
| `AUDIT_SPREADSHEET_ID` | Identificador privado de una hoja de bitácora, separado de las fuentes consultadas. |

Crear previamente en la hoja privada de bitácora una pestaña `Bitacora`, con exactamente estas siete cabeceras en A1:G1: `Fecha`, `Cuenta`, `Operacion`, `Revision`, `Estado`, `HashAnterior`, `HashNuevo`. Restringir acceso a las cuentas administradoras. Los cambios fallan si no existe o no tiene este formato.

Estado inicial seguro, que conserva ambos ejercicios sin conectarlos:

```json
{
  "revision": 0,
  "defaultYear": 2026,
  "years": [
    { "year": 2025, "enabled": false, "validated": false },
    { "year": 2026, "enabled": false, "validated": false }
  ]
}
```

Para completar cada ejercicio en el panel privado, agregar:

- `sourceUrl`: URL privada completa de la hoja, con su `gid`. Se transforma en `spreadsheetId` y `sheetId` al guardar; no sale por la API pública.
- `headerRow` y `startRow`: números de fila basados en 1.
- `yearEvidenceCell`: celda A1 cuyo valor mostrado contenga el año del ejercicio. Se verifica además que los años presentes en el título del archivo no lo contradigan.
- `columns`: exactamente 11 objetos `{ "title": "Título público", "type": "text", "column": 2, "sourceHeader": "Encabezado exacto" }`. `column` es la columna de origen basada en 1. Los tipos permitidos son `text`, `number`, `currency`, `date` y `link`.
- `rowSelection`: `{ "requiredColumn": 2, "excludeExact": [], "excludeRows": [] }`. La columna requerida determina qué filas con **valor mostrado** no vacío se incluyen; las listas excluyen etiquetas completas y números de fila. Puede limitarse con `lastRow`. En 2026 el original incluye todas las filas con B mostrada no vacía: mantener ambas listas vacías y no limitar `lastRow`. No excluir totales o etiquetas por su nombre si se quiere preservar esa consulta.
- `rulesConfirmed`: `true` únicamente tras revisar las reglas originales.
- `reconciliationNote`: al menos 20 caracteres describiendo la conciliación de filas, folios e importes efectuada contra la aplicación original.
- `enabled`: `true` únicamente cuando se haya completado la configuración y conciliación. El servidor calcula `validated`; no confía en el valor enviado por el cliente.

El orden de salida coincide con las 11 columnas del `Index.html`: órgano en índice 1, folios en 5, costo total en 6 y costo de dictamen en 10. Los índices aquí son basados en 0. Órgano/folios/costo total son obligatorios. Si una columna no existe o no está identificada, declararla con `column: null` y `sourceHeader: ""`; la API entregará `null` y la listará en `unavailableColumns`. Esto es necesario para los campos de 2025 todavía no identificados y evita atribuirles valores de otras columnas. No convertir montos desconocidos a cero.

Mapeo 2026 confirmado por el backend original: `headerRow: 1`, `startRow: 2`, columnas de origen A/B/C/E/F/G/H/I/J/K/X, o números basados en 1 `[1,2,3,5,6,7,8,9,10,11,24]`. Sus tipos, en ese orden, son `text`, `text`, `text`, `date`, `date`, `number`, `currency`, `text`, `text`, `link`, `currency`. Configurar `sourceHeader` con el encabezado mostrado verificado en cada columna. La URL y el identificador permanecen en las propiedades privadas. Este mapeo no se debe reutilizar para 2025, cuyo esquema difiere.

El panel permite agregar años, cambiar URLs y revisar la bitácora. Cambiar la URL crea un borrador; validar y guardar aplica la configuración bajo bloqueo y control de revisión. Se exige al menos un ejercicio habilitado como predeterminado para guardar. Los ejercicios 2025 y 2026 no se pueden eliminar, aunque pueden deshabilitarse. El servicio no edita registros de honorarios.

## API de lectura

- `?action=years`: ejercicios, disponibilidad y año predeterminado. Nunca devuelve fuentes, correos o configuración privada.
- `?action=data&year=2026`: 11 columnas y filas con valores nativos y representación mostrada; fecha de consulta (`loadedAt`) y modificación del archivo fuente (`sourceUpdatedAt`) por separado. Una modificación del archivo no implica necesariamente cambios en la pestaña consultada.
- `&refresh=1`: omite la caché del servidor y vuelve a leer la fuente. La caché normal dura hasta 90 segundos y solo guarda respuestas menores a 85 mil caracteres.

Los errores públicos son genéricos; no devuelven excepciones de Google que puedan incluir IDs. El servicio usa `ContentService` JSON y sus redirecciones. Verificar desde el origen real de GitHub Pages que la política del dominio permite lectura entre dominios. Esta compatibilidad todavía no se ha probado contra un nuevo despliegue; no usar JSONP ni un proxy público para sortearla.

La validación privada lee también las filas y aplica la serialización original:

- Textos, IDs y oficios usan el valor mostrado para conservar formatos y ceros iniciales.
- Folios e importes mantienen números nativos finitos. Si el origen contiene texto, se conserva su representación mostrada, sin convertirlo a número ni rechazar toda la consulta. La API devuelve avisos `warnings` con código `NUMERIC_TEXT`, índice y cantidad; las sumas incluyen únicamente números nativos, como en el original.
- Fechas nativas se formatean usando `getSpreadsheetTimeZone()` del libro; `timeZone` devuelve esa misma zona. Si no existe una zona configurada, se usa `America/Mexico_City`. Los seriales numéricos de Excel/Sheets se convierten con `Math.floor`, época 1899-12-30 y UTC. Otras fechas conservan el texto visible; un texto no interpretable no debe asumirse dentro de un intervalo de fechas.
- Las fechas normalizadas usan `YYYY-MM-DD` en `values` y `DD/MM/YYYY` en `display`. La procedencia conserva URLs textuales y enlaces enriquecidos HTTP/HTTPS; su URL queda también en `display`. Si no hay URL, conserva el texto visible como texto inerte.

Los campos expresamente ausentes conservan `null`, sin inferir valores de otras columnas. Los resultados admiten hasta 20 mil filas y 500 mil celdas de origen por consulta para limitar consumo de memoria. Las pruebas sintéticas de paridad no sustituyen cotejar registros, folios, importes y descargas con la consulta original de 2026.

## Bitácora y límites

La bitácora privada registra cuenta, fecha, revisión, identificador de operación y huellas SHA-256 de la configuración anterior/nueva. No almacena la URL ni el ID de la fuente dentro del registro. Se escribe `CONFIG_REQUESTED` antes de modificar la configuración y luego `CONFIG_APPLIED`. Si falla esa última marca, comparar revisión/huella con la configuración vigente. No existe una transacción distribuida entre PropertiesService y Sheets; un registro pendiente requiere conciliación, no debe suponerse un cambio aplicado.

Los editores del proyecto Apps Script pueden leer sus propiedades y modificar este código. Limitar también esos permisos. La lista de administradores se mantiene por propietarios del proyecto, de forma privada; el panel no permite que un administrador agregue cuentas por sí mismo.

Pruebas locales: `node --test tests/backend.test.js`. Simulan servicios de Google y comprueban guardas, errores, validación, ausencia de columnas, actualización de caché, bitácora y paridad del serializador original con casos sintéticos (fechas, ceros, texto numérico, B mostrada y procedencia). No reemplazan la prueba con dos despliegues reales y las cuentas autorizadas.
