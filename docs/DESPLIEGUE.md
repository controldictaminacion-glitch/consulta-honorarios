# Dejar operativa la consulta pública

Acceso acordado: cualquier persona con el enlace podrá consultar y descargar los campos seleccionados. Sólo las cuentas autorizadas podrán administrar fuentes. No se han activado Apps Script ni GitHub Pages en esta revisión.

## Servicio de Google

1. Crear un proyecto **nuevo** de Apps Script para la migración, conservando la aplicación actual. Agregar `backend/Code.gs`, `backend/Admin.html` y `backend/appsscript.json` con los nombres correspondientes en el editor.
2. En Propiedades del script, configurar de forma privada `ADMIN_EMAILS_JSON`, `HONORARIOS_CONFIG_JSON`, `AUDIT_SPREADSHEET_ID` y `PUBLIC_READ_ENABLED=false`. No subir esos valores a GitHub. El archivo privado entregado por separado facilita esta configuración; no pertenece al ZIP del código ni al repositorio.
3. Crear una hoja privada de bitácora con las siete cabeceras descritas en `backend/README.md`. Dar a las cuentas administradoras lectura sobre fuentes y escritura sobre la bitácora. No hacer públicos esos libros.
4. Preparar dos despliegues del mismo proyecto: consulta ejecutada como propietario, acceso «Cualquier persona»; administración ejecutada como usuario que accede, con autorización de Google. La administración usa `?action=admin` y verifica cada operación contra la lista privada.
5. Desde la administración, validar y guardar 2026 con el mapeo original. Para 2025, confirmar su adaptación independiente: ingreso/dictamen ausentes y procedencia I sin sustituir por otras columnas. Mantener deshabilitado cualquier ejercicio pendiente. El servidor calcula `validated` después de comprobar los datos.
6. Probar permisos y resultados. Habilitar `PUBLIC_READ_ENABLED=true` cuando se autorice poner el servicio en uso. Confirmar que un visitante sin sesión sólo recibe años/datos y nunca configuración ni bitácora.

Se requiere una sesión de Google con acceso a los libros para crear y autorizar el servicio. Los conectores de Drive permiten revisar las fuentes, pero no sustituyen los permisos y despliegues de Apps Script. No se necesita entregar contraseñas.

## Conexión con la página

Guardar en `config.json` únicamente la URL `/exec` de lectura (`apiUrl`) y la URL del despliegue administrativo con `?action=admin` (`adminUrl`). Los dos despliegues deben ser distintos. Ambas direcciones son públicas; los IDs de las hojas y los correos permanecen en el servidor.

Ejecutar:

```sh
npm run check
npm test
npm run check:deployment
npm run build
```

`check:deployment` debe fallar mientras falten las direcciones. No valida por sí solo autenticación ni CORS: probar en navegador la lectura entre dominios, filtros, ambos años, sumas, procedencias y descargas. Si el despliegue de Google no permite leer JSON desde el navegador, resolver la conexión con un servicio autorizado; no recurrir a JSONP ni a un proxy público.

## GitHub Pages

Después de aprobar la puesta en producción:

1. Integrar el cambio validado en `main` y confirmar las dos direcciones públicas configuradas.
2. En Settings → Pages, seleccionar GitHub Actions como origen. Configurar las protecciones del entorno `github-pages` si se requieren; el archivo YAML no las crea automáticamente.
3. Ejecutar manualmente «Publicar GitHub Pages (manual)» desde `main`. El workflow comprueba configuración, pruebas y compilación antes de publicar `dist/`. No publica al abrir un PR ni al hacer push.
4. Verificar el enlace devuelto por GitHub desde una sesión sin iniciar sesión. Comprobar por separado el acceso de administradores y una cuenta no autorizada.

La URL prevista del sitio de proyecto es `https://controldictaminacion-glitch.github.io/consulta-honorarios/`; sólo debe comunicarse como operativa cuando el despliegue termine correctamente.
