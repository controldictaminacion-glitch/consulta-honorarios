# Validación y aceptación

## Verificado automáticamente

Ejecutar `npm run check`, `npm test` y `npm run build`. Las pruebas usan únicamente datos sintéticos. Cubren búsqueda y filtros, importes/valores ausentes, exportadores XLSX/PDF y autorización/validación del backend. La compilación sólo empaqueta archivos públicos y no publica.

Revisión local del 26 de noviembre de 2026: 30 pruebas aprobadas, revisión de sintaxis y configuración privada correcta, paquete estático generado. En navegador se comprobaron búsqueda sin acentos, cambio 2026/2025, comparación con sumas incompletas no comparables, generación de ambos formatos y bloqueo de descargas sin conexión configurada. La vista móvil mantiene el ancho de la página y desplaza horizontalmente la tabla. El PDF generado también se renderizó e inspeccionó visualmente.

Actualización con el servicio original recibido: 41 pruebas aprobadas. Se compararon en memoria todas las filas de 2026 del original y la migración, con coincidencia de valores, textos visibles, títulos y tipos. La lectura de Sheets representa fechas como seriales y comprueba ese respaldo; las fechas `Date` y la zona horaria se cubren además con pruebas unitarias. No se guardaron registros institucionales en el repositorio. Se verificó que la comprobación previa impida publicar con direcciones vacías y que la interfaz siga sin entregar datos cuando no existe conexión configurada.

## Pendiente para cerrar la equivalencia

1. El `Code.gs` original de consulta fue recuperado. La paridad de serialización, filas, fechas y enlaces se prueba localmente con casos sintéticos; falta la prueba de respuesta desplegada.
2. Mapeo de 2026 confirmado por el original. Confirmar la regla de selección del adaptador 2025 y conservar como ausentes ingreso/dictamen hasta identificarlos. No inferir importes sin encabezado.
3. Con los mismos datos y filtros, cotejar cantidad de registros, órganos, folios, costo total y dictamen con la aplicación original. Comparar importes en centavos, no sólo su formato visual; documentar diferencias y filas implicadas en un registro privado.
4. Comparar exportación de resultados actuales y tabla completa incluyendo filas de otras páginas, orden, texto con ceros iniciales, fechas, enlaces, saltos de línea y ambos ejercicios.
5. Probar filtro vacío, exacto, acentos, importes cero, valores faltantes, fechas límite, orden numérico, enlaces compartidos, años alternados rápidamente y error de red.
6. Probar desde el origen final la respuesta JSON real de Apps Script, incluidos errores, redirecciones y permisos. No se ha desplegado un nuevo backend en esta tarea.
7. Probar las cuatro cuentas administradoras, cuenta no autorizada, visitante anónimo, revisión concurrente, ausencia de bitácora, fuente/año/encabezado incorrecto y reversión a configuración previa.
8. Revisar móvil, navegación por teclado y lectura de mensajes de estado. Confirmar fecha de modificación de fuente frente a fecha de consulta y antigüedad de caché.

## Restricciones de esta entrega

Se integraron las reglas del `obtenerDatos` original de 2026; aún no se certifica el servicio real sin desplegar y comparar su respuesta. No se habilitan fuentes por el mero hecho de que sus encabezados coincidan. La comparación usa sólo los registros de los datasets consultados y no equivale a una variación presupuestal certificada. Los campos ausentes no deben convertirse en cero ni producir porcentajes engañosos.

El usuario eligió consulta pública; su activación real sigue pendiente de configurar y probar el nuevo servicio. La demostración continúa usando exclusivamente datos sintéticos. Las hojas originales y la aplicación actual permanecen sin cambios. La publicación de Pages está preparada para ejecución manual, sin despliegue automático.
