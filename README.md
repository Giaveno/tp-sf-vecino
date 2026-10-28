# San Francisco Vecino TP5

PWA de servicios municipales con React, TypeScript y Vite. Integra un mapa geográfico, geolocalización, acceso al WhatsApp oficial y transporte Web Push mediante un emisor Node local. Trámites, pagos, disponibilidad y alarmas municipales son simulaciones académicas identificadas como tales. No requiere Firebase, Neon ni cuentas externas.

## Ejecutar la demostración completa

Desde esta carpeta, con Node y pnpm instalados:

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Abrir **http://localhost:4175/** y mantener Node funcionando. El mismo origen sirve la aplicación compilada y `/api/push/*`; el service worker propio conserva el precache y recibe push. No alternar localhost y 127.0.0.1: son orígenes con datos y permisos diferentes. Si el puerto está ocupado, elegir otro `PORT` en esa consola antes de iniciar Node.

`pnpm dev` sirve para editar y tiene proxy hacia Node para `/api`; no sustituye la demostración de producción del worker. `pnpm preview` no incluye el emisor push. En un teléfono físico, HTTP sobre la IP de la computadora no equivale a localhost seguro: geolocalización, instalación y push necesitan HTTPS. El emisor incluido acepta exclusivamente localhost/127.0.0.1; su publicación pública requiere adaptar el despliegue y el control de acceso.

## Probar Web Push

1. Abrir Notificaciones, pulsar **Activar Web Push** y conceder permiso si se desea. Sin ese permiso el historial interno sigue disponible.
2. Configurar tipos, zonas y frecuencia. Los filtros del historial también determinan el tipo y la zona del evento de prueba.
3. Pulsar **Programar push de prueba en 10 segundos**. Cerrar la pestaña manteniendo Node, el navegador e Internet funcionando.
4. Comprobar el aviso del sistema y pulsarlo: debe abrir el servicio relacionado. Al volver, el evento recibido se incorpora al historial desde IndexedDB sin duplicar ni reemplazar eventos locales.
5. Pulsar **Desactivar Web Push** para cancelar la suscripción del navegador y su registro local.

El contenido municipal de prueba es ficticio; la suscripción y el transporte Web Push son reales. HTTP 202 solo confirma programación. Que el proveedor acepte un envío tampoco prueba recepción en el dispositivo: intervienen navegador, permisos y sistema operativo. La consola Node registra un identificador de trabajo y resultado, sin endpoints, tokens ni claves. Ante 410, desactivar y reactivar push. Si la sincronización de preferencias falla, reintentar con el servidor disponible o desactivar la suscripción.

Las claves VAPID y suscripciones se generan en **`.local/`**, excluido del repositorio y del contenido servido. Conservar esa carpeta entre reinicios; no compartirla ni copiarla al frontend. `VAPID_SUBJECT` permite configurar un contacto propio; el valor educativo es `mailto:demo@example.invalid`. Solo se permite enviar a la propia suscripción mediante su credencial. Es un emisor local de demostración, no un servicio municipal productivo.

## Recorrido de los siete servicios

1. **Bicicletas:** seleccionar Tecnoteca o Terminal en mapa/lista, solicitar ubicación y revisar disponibilidad simulada variable cada diez segundos, capacidad y hora de actualización. Guardar un reporte local.
2. **Tributos:** consultar obligaciones, descargar cedulón TXT, confirmar pago simulado y descargar comprobante. Revisar historial y recordatorios próximo/vencido.
3. **Reclamos:** crear con JPG/PNG/PDF completo de hasta 512 KiB, buscar, recargar, descargar el mismo archivo y simular Recibido → En revisión → Resuelto.
4. **Contactos:** consultar el WhatsApp oficial de Tana y abrirlo solo si se quiere contactar realmente. No se envía automáticamente ningún mensaje. Teléfonos/correos ficticios y mensajería interna permanecen señalizados como demostración.
5. **Alarmas:** seleccionar ubicación ficticia, suscribirse a una zona y simular activación/desactivación. Genera evento por suscripción o cercanía menor a 2 km, respetando preferencias.
6. **Estacionamiento:** seleccionar polígono de zona ficticia, consultar tarifa/horario, simular pago, descargar comprobante, extender y consultar temporizador. El control de demostración deja dos minutos para comprobar el aviso previo.
7. **Notificaciones:** configurar tipos, zonas y frecuencia; generar eventos locales o programar Web Push; filtrar, marcar leído y abrir el servicio relacionado. El límite diario por tipo/zona usa el día de Argentina y se aplica por separado a cada canal.

Comprobar también Reclamos → Notificaciones, Atrás/Adelante y enlaces directos `#claims`, `#parking` y `#notificaciones`.

## Mapas y datos

Leaflet solicita el mapa base de OpenStreetMap por HTTPS y muestra atribución. Las coordenadas de estaciones son aproximaciones de puntos de interés, no posiciones oficiales de anclajes ni ocupación real. Alarmas y polígonos de estacionamiento son ficticios e independientes. Sin red permanecen listas, datos locales y vectores cargados; **no se promete el mapa base completo offline** ni se descarga la ciudad por adelantado.

- La ubicación se solicita por botón, se usa en memoria y no se envía al backend push. El mapa externo recibe solicitudes de teselas al visualizarlo.
- Reclamos, pagos, preferencias, reportes, avisos y estacionamiento usan localStorage del origen. El inbox `sf-vecino-push/events` de IndexedDB conserva hasta 100 eventos; el historial local, hasta 200.
- Adjuntos JPG/PNG/PDF completos hasta 512 KiB cada uno, con presupuesto conjunto aproximado de 2 MiB binarios. Si falla el almacenamiento, aparece un aviso y los cambios pueden conservarse solo durante la sesión.
- Borrar datos del sitio elimina datos del navegador; `.local/` es almacenamiento separado del emisor. Usar datos ficticios. No se guardan tarjetas ni claves bancarias.
- Recordatorios tributarios y temporizador son eventos locales: requieren la app abierta y se reconcilian al volver. El botón de push demuestra transporte real con contenido simulado.

## Verificaciones

```powershell
pnpm test
pnpm lint
pnpm build
```

El comando `test` incluye Vitest y Node:test. En este equipo pnpm puede reconciliar dependencias al iniciar scripts; no ejecutar varios pnpm simultáneamente. Con dependencias instaladas:

```powershell
.\node_modules\.bin\vitest.cmd run
node --test server/push.test.mjs
.\node_modules\.bin\oxlint.cmd
.\node_modules\.bin\tsc.cmd -b
# Solo si TypeScript termina correctamente:
.\node_modules\.bin\vite.cmd build
node server/start.mjs
```

Alcance: [SPECS.md](SPECS.md). Arquitectura y fuentes: [INFORME.md](INFORME.md). Resultados y pendientes: [PRUEBAS.md](PRUEBAS.md). Material sanitizado para entregar: [evidencias](evidencias/QA_REPORT.md).
