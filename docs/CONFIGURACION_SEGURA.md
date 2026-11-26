# Configuración segura

## Separación de interfaz y servicio

GitHub Pages sirve exclusivamente HTML, CSS, JavaScript y la biblioteca PDF local. Los datos se consultan en tiempo de ejecución a Google Apps Script. Los IDs de hojas, lista de administradores y reglas privadas permanecen en **Propiedades del script**, nunca en archivos públicos, artefactos o argumentos de GitHub Actions.

El usuario confirmó consulta pública para cualquier persona con el enlace. El backend conserva `PUBLIC_READ_ENABLED` cerrado por defecto hasta finalizar su configuración y las pruebas. Habilitarlo permitirá consultar por Internet los campos seleccionados, sin inicio de sesión. Esto no requiere hacer públicas las hojas completas. Las políticas de compartición de los libros permanecen intactas.

## Administración

Preparar un único proyecto Apps Script con dos despliegues de la misma versión:

1. Lectura, ejecutado como propietario, sin operaciones de escritura por HTTP. Sólo habilitar acceso público cuando esté autorizado.
2. Administración, ejecutado como **usuario que accede**, con autorización de Google. Su URL termina con `?action=admin`.

Todas las operaciones administrativas comprueban en servidor que la identidad activa no esté vacía, coincida con la identidad efectiva y figure en `ADMIN_EMAILS_JSON`. Nunca se acepta un correo enviado por el cliente ni se utiliza el propietario como identidad de un visitante anónimo. Si Google no devuelve la identidad, se deniega la operación. Las cuatro cuentas autorizadas se agregan manualmente a esa propiedad privada, sin copiarlas a documentación o ejemplos públicos.

El acceso del administrador a las hojas y a la bitácora depende de los permisos de su cuenta. Se requieren permisos de lectura sobre fuentes y escritura sobre la bitácora. La bitácora debe estar en un libro privado independiente; no habilitar la publicación web de ese libro. Las propiedades de configuración se comparten entre ambos despliegues del mismo proyecto: usar proyectos separados desincronizaría los cambios.

Google explica las diferencias entre ejecución como propietario y como usuario y las circunstancias en que la identidad está vacía: [web apps](https://developers.google.com/apps-script/guides/web), [Session](https://developers.google.com/apps-script/reference/base/session).

## Validación y bitácora

Configurar las propiedades descritas en `backend/README.md`. La administración permite editar URL por año, agregar futuros ejercicios y conservar 2025/2026. Los cambios validan fuente y esquema y usan bloqueo más revisión para evitar que dos administradores se sobrescriban. No hay cambios si falta la bitácora privada. Ésta registra actor, fecha, revisión y huellas; no vuelve público su contenido.

La validación técnica no reemplaza la conciliación contable. El servicio original de 2026 ya fue recuperado y cotejado. Su serializador conserva números nativos o textos mostrados, sin convertir estos últimos; el frontend los señala como sumas parciales y evita comparaciones engañosas. Los campos ausentes de 2025 siguen siendo `null`. No declarar reglas históricas equivalentes sin evidencia.

## Comunicación entre dominios

El frontend utiliza `fetch` con respuesta JSON de sólo lectura y sigue la redirección de ContentService. No se usan JSONP, claves en URL ni `no-cors`. Debe probarse desde el origen final de GitHub Pages contra el despliegue real: redirecciones de autenticación, permisos y respuesta CORS dependen de la configuración del servicio. La documentación de [ContentService](https://developers.google.com/apps-script/guides/content) describe la redirección a Googleusercontent. Si la prueba entre dominios falla, hace falta un servicio intermedio autorizado que controle CORS; no abrir hojas ni retirar controles para resolverlo.

## Filtros y exportaciones

Los enlaces compartidos guardan filtros en el fragmento de URL; quien reciba el enlace verá esos términos. No incluyen IDs, configuración administrativa ni datos completos de la tabla. Las descargas se generan en el navegador, con el alcance seleccionado y números/fechas conservados. El XLSX escribe textos literales, evitando que un oficio que empiece por `=` se ejecute como fórmula. Los enlaces admiten sólo HTTP/HTTPS.

## GitHub y producción

Configurar autoría de Git con dirección `noreply` antes de subir commits. Revisar también metadatos de commits: `.gitignore` no los protege. `npm run check` revisa patrones de correos personales, URLs de hojas y credenciales. Los dos endpoints públicos de Apps Script sólo se permiten en `config.json`, con estructura validada; sus direcciones no son secretos. La comprobación complementa la revisión humana, no la sustituye.

El workflow de revisión tiene sólo lectura de contenido y no recibe secretos. `pages.yml` está preparado con ejecución exclusivamente manual desde `main`; no se ha ejecutado ni se ha activado Pages. El paquete contiene una lista explícita de archivos públicos, excluyendo backend y configuración privada. Antes de ejecutarlo se deben configurar las direcciones, comprobar permisos y conexión y obtener autorización de publicación. El entorno `github-pages` debe configurarse en GitHub con las restricciones de rama y revisión que correspondan; declarar su nombre en YAML no configura esas protecciones. Véase la [documentación de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
