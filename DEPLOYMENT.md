# Publicación en Vercel con Neon

La PWA y `/api/push/*` se publican en el mismo origen HTTPS. Las Functions utilizan Neon PostgreSQL para suscripciones, preferencias, reservas y límites; no escriben archivos locales. El modo `pnpm start` conserva su almacenamiento local separado.

## Preparación realizada

- Repositorio: https://github.com/Giaveno/tp-sf-vecino.
- Migración versionada `server/migrations/001_push.sql`: crea únicamente el esquema `tp5_push` y sus tablas propias. Su ejecución es idempotente y no elimina tablas ajenas.
- La conexión Neon proporcionada se verificó con `SELECT 1`. Las pruebas de integración usan un namespace aleatorio y eliminan exclusivamente sus propios registros.
- El generador `pnpm env:prepare` agrega solo claves faltantes a `.env.local`, sin mostrarlas ni modificar `DATABASE_URL` o pares VAPID existentes. Ese archivo está excluido de Git.

## Configurar el proyecto

1. En Vercel, importar **Giaveno/tp-sf-vecino** desde GitHub. Seleccionar **Vite**, directorio raíz del repositorio, Node **24.x**, build **`pnpm build`** y salida **`dist`**. No usar `pnpm start` como comando de build.
2. Agregar las variables siguientes en **Settings → Environment Variables**, para **Production**. Copiar valores privados directamente desde `.env.local` al panel de Vercel; no pegarlos en chats, commits ni variables `VITE_*`.

| Variable | Valor que corresponde |
|---|---|
| `DATABASE_URL` | Conexión privada del proyecto Neon existente. |
| `VAPID_PUBLIC_KEY` | Clave pública generada en `.env.local`. |
| `VAPID_PRIVATE_KEY` | Clave privada del mismo par; solo el servidor puede utilizarla. |
| `VAPID_SUBJECT` | URL pública de contacto del proyecto; el generador usa el repositorio. |
| `APP_ORIGIN` | Dominio HTTPS real asignado por Vercel, sin rutas ni parámetros. Reemplazar el marcador de `.env.local`. |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1`, para respetar `pnpm@10.34.9` de `package.json`. |
| `PUSH_NAMESPACE` | Opcional: `sf-vecino:v1`. Usar otro namespace para entornos de prueba separados. |

3. Si todavía no se conoce el dominio, completar un primer despliegue y copiar el dominio de producción que muestre Vercel. Corregir `APP_ORIGIN` y hacer **Redeploy**. No inventar ni asumir que un nombre de dominio está disponible.
4. Si se trabaja con otra base, ejecutar **una vez** `pnpm db:migrate` con su `DATABASE_URL` en el archivo privado. Para la base de este proyecto la migración ya fue aplicada y comprobada. No ejecutar migraciones desde el navegador.
5. Desplegar y abrir el dominio HTTPS. `/api/push/config` debe responder JSON con **solo** la clave pública. Sin configuración completa responde 503 y el historial interno de la PWA sigue disponible. Un origen distinto del configurado responde 403.
6. En Notificaciones, activar Web Push, conceder permiso y programar la prueba de diez segundos. Cerrar la pestaña manteniendo el navegador e Internet activos, comprobar el aviso y volver a abrir para revisar el historial. Cancelar la suscripción al terminar.

Los despliegues Preview no heredan una autorización general de origen: para probar push allí, necesitan su propio origen explícito y un namespace de pruebas. No usar comodines de CORS para resolver un error de configuración.

## Alcance y límites de la publicación

Los trámites y avisos municipales continúan siendo simulados. Solo el transporte Web Push es real. Cada credencial permite operar únicamente su suscripción; el servidor comprueba proveedores conocidos, cuerpo de hasta 16 KiB, cuota por cliente y capacidad acotada. La IP se usa como HMAC para la cuota y no se almacena en texto claro. Sin identificador de red disponible se comparte una cuota conservadora.

Neon mantiene registros de suscripción durante 30 días; se excluyen al vencer y se purgan al registrar nuevas suscripciones. Los contadores de solicitudes caducados se purgan con nuevas solicitudes. Las reservas de envío tienen una vigencia de un minuto. Las operaciones de capacidad utilizan un bloqueo transaccional y los cambios de registros usan versiones o actualización atómica por trabajo; las instancias de Functions no dependen de memoria compartida.

La prueba diferida utiliza `waitUntil` y una Function con máximo de 60 segundos. No es una cola durable: si Vercel termina la función antes del envío, no hay reintento automático. Revisar el historial antes de reintentar; una respuesta del proveedor no certifica visualización del banner del sistema.

No se creó ni contrató ningún recurso de Vercel durante la preparación local. Las cuotas y condiciones de las cuentas deben revisarse en sus paneles. El despliegue y la recepción real desde el dominio público quedan pendientes hasta configurar y publicar el proyecto.

## Fuentes técnicas

- https://vercel.com/docs/functions/runtimes/node-js
- https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package
- https://vercel.com/docs/package-managers
- https://neon.com/docs/serverless/serverless-driver
- https://www.postgresql.org/docs/current/transaction-iso.html
