# Consulta de Honorarios

Migración propuesta a GitHub Pages, con consulta por ejercicio y administración en Google Apps Script. **Borrador de revisión: sin publicación de producción.**

## Estado de la migración

La interfaz original `Index.html` fue inspeccionada y se conservan búsqueda por órgano (exacta o parcial, sin distinguir acentos), ordenamiento, paginación, vínculos de procedencia, indicadores y exportación de resultados actuales o tabla completa. El archivo `Code.GS.txt` compartido genera presentaciones: no contiene `doGet` ni `obtenerDatos` del servicio de consulta. El `Exportadores` recuperado se adapta con su XLSX nativo y PDF-lib local, corrigiendo el ejercicio fijo del pie de página.

**Falta el servicio original `obtenerDatos` para certificar equivalencia de selección de filas, exclusiones, cifras y enlaces.** No se simulan datos institucionales ni se habilitan fuentes reales sin esa conciliación.

| Mejora autorizada | Implementación en esta propuesta |
| --- | --- |
| Rediseño institucional | Guinda, dorado, blanco, jerarquía clara y navegación accesible |
| Panel de indicadores | Registros, órganos, folios, costo total y dictamen según filtros |
| Comparativo entre ejercicios | Mismos filtros por año; importes ausentes no se interpretan como cero |
| Filtros avanzados | Órgano, etiqueta, fechas y rango de costo |
| Excel y PDF | Archivos reales con todas las filas del alcance elegido y vínculos seguros |
| Control de administradores | Lista privada, identidad comprobada en cada operación de servidor |
| Bitácora | Hoja privada, revisión, actor, operación y huellas de configuración |
| Optimización | Búsqueda diferida, render por página y caché temporal en memoria/servidor |
| Diseño adaptable | Controles móviles y tabla con desplazamiento horizontal |
| Última actualización | Fecha de modificación de fuente separada de fecha de consulta |
| GitHub Actions | Pruebas, revisión de configuración privada y paquete de revisión; sin despliegue |
| Validación de fuentes | Ejercicio, URL, pestaña, encabezados, tipos y reglas declaradas |
| Enlaces con filtros | Estado de consulta en fragmento de URL |

Las funciones administrativas y lectura real están implementadas pero **no se han desplegado ni probado contra un nuevo servicio publicado**. Se requiere verificar autenticación de las cuatro cuentas y comunicación entre GitHub Pages y Apps Script antes de producción.

## Revisión local

Requiere Node.js 22 o posterior; no requiere instalar dependencias.

```sh
npm run check
npm test
npm run build
npm run preview
```

Abre `http://127.0.0.1:4173/?demo=1` para revisar datos **sintéticos** identificados como demostración. Sin ese parámetro y sin configurar un servicio, la aplicación muestra el estado pendiente de conexión. El paquete estático queda en `dist/` y contiene sólo la interfaz, biblioteca PDF y configuración pública de endpoints.

## Configuración

`config.json` contiene exclusivamente `apiUrl` y `adminUrl`, ambos vacíos al inicio. La segunda URL apunta al acceso privado con `?action=admin`. Son direcciones de servicios accesibles al navegador; no son secretos. No poner aquí URLs/IDs de hojas, correos, tokens ni claves. No usar GitHub Secrets para inyectar esos datos en JavaScript: el navegador los expondría.

Consulta [configuración segura](docs/CONFIGURACION_SEGURA.md), [verificación anual y pendientes](docs/FUENTES_Y_PENDIENTES.md) y [revisión antes de producción](docs/VALIDACION.md). Los detalles exactos del servidor se encuentran en [backend](backend/README.md).

## Producción

Este cambio no configura GitHub Pages, no publica Apps Script, no modifica las hojas y no integra automáticamente el PR. El workflow únicamente valida y guarda un artefacto de revisión. Una publicación futura requiere autorización y la conciliación descrita en la documentación.
