# Configuración privada del servicio

Este servicio es nuevo. `Code.GS.txt` recibido genera presentaciones y no se incorporó. Las reglas de `obtenerDatos()` todavía deben cotejarse con el archivo original. No se ha creado ni actualizado ningún despliegue.

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
- `rowSelection`: `{ "requiredColumn": 2, "excludeExact": [], "excludeRows": [] }`. La columna requerida determina qué filas con valor se incluyen; las listas excluyen etiquetas completas y números de fila. Puede limitarse con `lastRow`. Definir estas reglas a partir del servicio original y conciliarlas, especialmente filas de totales.
- `rulesConfirmed`: `true` únicamente tras revisar las reglas originales.
- `reconciliationNote`: al menos 20 caracteres describiendo la conciliación de filas, folios e importes efectuada contra la aplicación original.
- `enabled`: `true` únicamente cuando se haya completado la configuración y conciliación. El servidor calcula `validated`; no confía en el valor enviado por el cliente.

El orden de salida coincide con las 11 columnas del `Index.html`: órgano en índice 1, folios en 5, costo total en 6 y costo de dictamen en 10. Los índices aquí son basados en 0. Órgano/folios/costo total son obligatorios. Si una columna no existe o no está identificada, declararla con `column: null` y `sourceHeader: ""`; la API entregará `null` y la listará en `unavailableColumns`. Esto es necesario para los campos de 2025 todavía no identificados y evita atribuirles valores de otras columnas. No convertir montos desconocidos a cero.

El panel permite agregar años, cambiar URLs y revisar la bitácora. Cambiar la URL crea un borrador; validar y guardar aplica la configuración bajo bloqueo y control de revisión. Se exige al menos un ejercicio habilitado como predeterminado para guardar. Los ejercicios 2025 y 2026 no se pueden eliminar, aunque pueden deshabilitarse. El servicio no edita registros de honorarios.

## API de lectura

- `?action=years`: ejercicios, disponibilidad y año predeterminado. Nunca devuelve fuentes, correos o configuración privada.
- `?action=data&year=2026`: 11 columnas y filas con valores nativos y representación mostrada; fecha de consulta (`loadedAt`) y modificación del archivo fuente (`sourceUpdatedAt`) por separado. Una modificación del archivo no implica necesariamente cambios en la pestaña consultada.
- `&refresh=1`: omite la caché del servidor y vuelve a leer la fuente. La caché normal dura hasta 90 segundos y solo guarda respuestas menores a 85 mil caracteres.

Los errores públicos son genéricos; no devuelven excepciones de Google que puedan incluir IDs. El servicio usa `ContentService` JSON y sus redirecciones. Verificar desde el origen real de GitHub Pages que la política del dominio permite lectura entre dominios. Esta compatibilidad todavía no se ha probado contra un nuevo despliegue; no usar JSONP ni un proxy público para sortearla.

La validación privada lee también las filas y comprueba tipos: los importes deben ser números nativos finitos, los folios enteros seguros y las fechas valores de fecha. No convierte importes formateados en texto silenciosamente. Los vínculos conservan enlaces de texto enriquecido o URLs HTTP/HTTPS. Los resultados admiten hasta 20 mil filas y 500 mil celdas de origen por consulta para limitar consumo de memoria.

## Bitácora y límites

La bitácora privada registra cuenta, fecha, revisión, identificador de operación y huellas SHA-256 de la configuración anterior/nueva. No almacena la URL ni el ID de la fuente dentro del registro. Se escribe `CONFIG_REQUESTED` antes de modificar la configuración y luego `CONFIG_APPLIED`. Si falla esa última marca, comparar revisión/huella con la configuración vigente. No existe una transacción distribuida entre PropertiesService y Sheets; un registro pendiente requiere conciliación, no debe suponerse un cambio aplicado.

Los editores del proyecto Apps Script pueden leer sus propiedades y modificar este código. Limitar también esos permisos. La lista de administradores se mantiene por propietarios del proyecto, de forma privada; el panel no permite que un administrador agregue cuentas por sí mismo.

Pruebas locales: `node --test tests/backend.test.js`. Simulan servicios de Google y comprueban guardas, errores, validación, tipos, ausencia de columnas, actualización de caché y bitácora. No reemplazan la prueba con dos despliegues reales y las cuentas autorizadas.
