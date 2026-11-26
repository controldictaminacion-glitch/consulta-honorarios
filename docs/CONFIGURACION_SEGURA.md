# Configuración segura

## Separación de interfaz y servicio

GitHub Pages sirve exclusivamente HTML, CSS, JavaScript y la biblioteca PDF local. Los datos se consultan en tiempo de ejecución a Google Apps Script. Los IDs de hojas, lista de administradores y reglas privadas permanecen en **Propiedades del script**, nunca en archivos públicos, artefactos o argumentos de GitHub Actions.

Publicar una interfaz estática no convierte un servicio de datos en privado. El backend incluido mantiene `PUBLIC_READ_ENABLED` cerrado por defecto. Habilitarlo significa permitir consulta de los campos seleccionados desde Internet. Esta propuesta no cambia ese ajuste ni las políticas de compartición de los libros. Debe acordarse el acceso de consulta antes de una publicación futura.

## Administración

Preparar un único proyecto Apps Script con dos despliegues de la misma versión:

1. Lectura, ejecutado como propietario, sin operaciones de escritura por HTTP. Sólo habilitar acceso público cuando esté autorizado.
2. Administración, ejecutado como **usuario que accede**, con autorización de Google. Su URL termina con `?action=admin`.

Todas las operaciones administrativas comprueban en servidor que la identidad activa no esté vacía, coincida con la identidad efectiva y figure en `ADMIN_EMAILS_JSON`. Nunca se acepta un correo enviado por el cliente ni se utiliza el propietario como identidad de un visitante anónimo. Si Google no devuelve la identidad, se deniega la operación. Las cuatro cuentas autorizadas se agregan manualmente a esa propiedad privada, sin copiarlas a documentación o ejemplos públicos.

El acceso del administrador a las hojas y a la bitácora depende de los permisos de su cuenta. Se requieren permisos de lectura sobre fuentes y escritura sobre la bitácora. La bitácora debe estar en un libro privado independiente; no habilitar la publicación web de ese libro. Las propiedades de configuración se comparten entre ambos despliegues del mismo proyecto: usar proyectos separados desincronizaría los cambios.

Google explica las diferencias entre ejecución como propietario y como usuario y las circunstancias en que la identidad está vacía: [web apps](https://developers.google.com/apps-script/guides/web), [Session](https://developers.google.com/apps-script/reference/base/session).

## Validación y bitácora

Configurar las propiedades descritas en `backend/README.md`. La administración permite editar URL por año, agregar futuros ejercicios y conservar 2025/2026. Los cambios validan fuente y esquema y usan bloqueo más revisión para evitar que dos administradores se sobrescriban. No hay cambios si falta la bitácora privada. Ésta registra actor, fecha, revisión y huellas; no vuelve público su contenido.

La validación técnica no reemplaza la conciliación contable. No declarar `rulesConfirmed` ni una nota de conciliación hasta recuperar y cotejar las reglas originales. Los tipos monetarios deben ser números nativos de Sheets; los textos con signos monetarios no se convierten silenciosamente.

## Comunicación entre dominios

El frontend utiliza `fetch` con respuesta JSON de sólo lectura y sigue la redirección de ContentService. No se usan JSONP, claves en URL ni `no-cors`. Debe probarse desde el origen final de GitHub Pages contra el despliegue real: redirecciones de autenticación, permisos y respuesta CORS dependen de la configuración del servicio. La documentación de [ContentService](https://developers.google.com/apps-script/guides/content) describe la redirección a Googleusercontent. Si la prueba entre dominios falla, hace falta un servicio intermedio autorizado que controle CORS; no abrir hojas ni retirar controles para resolverlo.

## Filtros y exportaciones

Los enlaces compartidos guardan filtros en el fragmento de URL; quien reciba el enlace verá esos términos. No incluyen IDs, configuración administrativa ni datos completos de la tabla. Las descargas se generan en el navegador, con el alcance seleccionado y números/fechas conservados. El XLSX escribe textos literales, evitando que un oficio que empiece por `=` se ejecute como fórmula. Los enlaces admiten sólo HTTP/HTTPS.

## GitHub y producción

Configurar autoría de Git con dirección `noreply` antes de subir commits. Revisar también metadatos de commits: `.gitignore` no los protege. `npm run check` revisa patrones de correos personales, URLs de hojas, despliegues reales y credenciales en archivos; complementa la revisión humana, no la sustituye.

El workflow actual tiene sólo lectura de contenido, no recibe secretos y no despliega. El paquete contiene una lista explícita de archivos públicos, excluyendo backend y documentación privada. No activar Pages ni añadir `deploy-pages` durante esta revisión. La futura publicación debe usar una revisión validada y un entorno protegido, siguiendo la [documentación de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
