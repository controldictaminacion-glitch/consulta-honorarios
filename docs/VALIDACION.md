# Validación y aceptación

## Verificado automáticamente

Ejecutar `npm run check`, `npm test` y `npm run build`. Las pruebas usan únicamente datos sintéticos. Cubren búsqueda y filtros, importes/valores ausentes, exportadores XLSX/PDF y autorización/validación del backend. La compilación sólo empaqueta archivos públicos y no publica.

Revisión local del 26 de noviembre de 2026: 30 pruebas aprobadas, revisión de sintaxis y configuración privada correcta, paquete estático generado. En navegador se comprobaron búsqueda sin acentos, cambio 2026/2025, comparación con sumas incompletas no comparables, generación de ambos formatos y bloqueo de descargas sin conexión configurada. La vista móvil mantiene el ancho de la página y desplaza horizontalmente la tabla. El PDF generado también se renderizó e inspeccionó visualmente.

## Pendiente para cerrar la equivalencia

1. Recuperar el `Code.gs` de consulta y todos los ayudantes de `obtenerDatos`.
2. Confirmar mapeo de las 11 columnas por año, reglas de selección, exclusión de totales y vínculos enriquecidos. Resolver campo de dictamen e ingreso ausentes en 2025.
3. Con los mismos datos y filtros, cotejar cantidad de registros, órganos, folios, costo total y dictamen con la aplicación original. Comparar importes en centavos, no sólo su formato visual; documentar diferencias y filas implicadas en un registro privado.
4. Comparar exportación de resultados actuales y tabla completa incluyendo filas de otras páginas, orden, texto con ceros iniciales, fechas, enlaces, saltos de línea y ambos ejercicios.
5. Probar filtro vacío, exacto, acentos, importes cero, valores faltantes, fechas límite, orden numérico, enlaces compartidos, años alternados rápidamente y error de red.
6. Probar desde el origen final la respuesta JSON real de Apps Script, incluidos errores, redirecciones y permisos. No se ha desplegado un nuevo backend en esta tarea.
7. Probar las cuatro cuentas administradoras, cuenta no autorizada, visitante anónimo, revisión concurrente, ausencia de bitácora, fuente/año/encabezado incorrecto y reversión a configuración previa.
8. Revisar móvil, navegación por teclado y lectura de mensajes de estado. Confirmar fecha de modificación de fuente frente a fecha de consulta y antigüedad de caché.

## Restricciones de esta entrega

No se certifica que el nuevo backend reproduzca las reglas privadas de `obtenerDatos`, que no fue suministrado. No se habilitan fuentes por el mero hecho de que sus encabezados coincidan. La comparación usa sólo los registros de los datasets consultados y no equivale a una variación presupuestal certificada. Los campos ausentes no deben convertirse en cero ni producir porcentajes engañosos.

La lectura pública sigue cerrada; sólo existe demostración explícita con datos sintéticos. Las hojas originales y la aplicación actual permanecen sin cambios. No hay integración de PR ni despliegue automático a producción.
