# Pruebas del TP5

## Verificación automatizada

Entorno: Windows, Node v26.1.0 y dependencias resueltas por lockfile. Se usaron binarios locales para evitar reconciliaciones automáticas concurrentes de pnpm.

- **45 pruebas frontend aprobadas, 11 archivos, 0 fallos**: Vitest.
- **6 pruebas backend aprobadas, 0 fallos**: Node:test. Total actual: **51 pruebas** entre frontend y backend.
- TypeScript correcto, lint sin advertencias y build de producción correcto.
- JS principal 272,85 kB / 85,19 kB gzip; Leaflet separado 148,61 kB / 43,32 kB gzip; CSS 25,07 kB / 9,17 kB gzip. Worker propio `injectManifest`, 16 recursos precacheados, 447,86 KiB. No se precarga el mapa externo.

La prueba global inicial incluyó por error suites Node:test y copias de respaldo dentro de Vitest. Se separaron `src/**/*.test.ts` y el runner Node. El comando `pnpm test` ejecuta ambos. Los tiempos de build y tamaños no prueban rendimiento de carga móvil.

| Área | Evidencia automatizada |
|---|---|
| Repositorio y dominio | Datos dañados, escritura rechazada, prioridad de memoria, impuestos, reclamos, adjuntos, estacionamiento y navegación. |
| Eventos locales | Preferencias, entregas diarias efectivas, día de Argentina, recordatorios por etapa, alarmas y vencimiento. |
| Bicicletas | Cambio sin recargar con reloj controlado, capacidad/anclajes, timestamp y cancelación del temporizador. |
| Payload push | Formato/límites, destinos internos y separación del canal diario. |
| Historial push | Inbox diferido conserva avisos y estado leído agregados durante la espera; deduplicación. |
| Backend | Proveedores/claves/origen, credencial de propietario, preferencias pausadas, envío con doble, recuperación410 y errores de persistencia. |
| Resiliencia y estáticos | Promesa diferida rechazada contenida; gzip negociado, contenido exacto descomprimible y respeto de `gzip;q=0`. |

Los tests backend sustituyen el proveedor por un doble: no prueban recepción real de Web Push. Se observaron fallos esperados antes de las correcciones de disponibilidad, contratos ausentes, apropiación de suscripción, carrera del inbox, promesa diferida y compresión.

Revisión previa a publicación del **2026-10-28**: si fallaba la persistencia del alta push, quedaba en memoria un registro cuya credencial no había recibido el cliente; el reintento devolvía 403. Se observó la regresión RED y, tras incorporar rollback del alta y de las actualizaciones autorizadas, las seis pruebas Node:test pasaron. Esta comprobación no repite ni modifica la evidencia anterior de navegador: conserva sus 28 comprobaciones y la ejecución automatizada histórica de 50 pruebas.

## Matriz de navegador

Ejecutar `node server/start.mjs` con el build en http://localhost:4175/. Un origen diferente tiene otro almacenamiento y permisos.

| Caso | Comprobación esperada |
|---|---|
| NAV01 | Siete servicios, Reclamos → Notificaciones, Atrás/Adelante y enlaces directos sin pantalla vacía. |
| BICI01 | Mapa geográfico con marcadores seleccionables por clic real; zoom/lista/geolocalización; cantidades variables y capacidad. |
| BICI02 | Reporte local conservado después de recargar; error de geolocalización con alternativa manual. |
| TAX01 | Cedulón, pago simulado sin duplicar, historial y comprobante descargado. |
| CLAIM01 | Validación; adjunto completo persistido, búsqueda y descarga con bytes iguales; estados simulados. |
| CONTACT01 | Enlace oficial correcto sin enviar mensajes durante las pruebas; canales ficticios claramente diferenciados. |
| ALARM01 | Suscripción/activación genera aviso correcto y respeta preferencias; selección del mapa. |
| PARK01 | Zona, pago, extensión, comprobante, temporizador y expiración reconciliada al recargar. |
| NOTIF01 | Preferencias, historial, filtros, leído y servicio relacionado; pausa no borra registros. |
| PUSH01 | Suscribir, programar, cerrar pestaña, recibir en sistema, pulsar y recuperar historial. Registrar recepción real por separado de HTTP202/aceptación. |
| PUSH02 | Pausar, filtrar tipo/zona, cancelar y reactivar; fallback ante rechazo del permiso o proveedor. |
| PWA01 | Worker activo, recarga offline y recorridos locales; lista alternativa cuando falla mapa externo. |
| PWA02 | Manifest/iconos y ausencia de desbordamiento en 320/390 px y escritorio. Instalación física se verifica aparte. |
| PERF01 | Primera carga con caché fría, red/CPU documentadas y medición de contenido visible/FCP/LCP. |

## Evidencia de navegador

Se ejecutó el recorrido sobre el build servido por Node en localhost: **28 de 28 comprobaciones aprobadas y cero errores JavaScript de la aplicación**. Las evidencias sanitizadas y tres capturas seleccionadas están en [evidencias](evidencias/QA_REPORT.md), dentro del material de entrega. Los perfiles temporales, credenciales y originales auxiliares de `tmp/` no se incluyen.

| Ejecución | Resultado observado y evidencia |
|---|---|
| Flujos de escritorio y móvil | Siete servicios, navegación, adjunto persistido/descargado con bytes iguales, progreso, pagos/comprobantes, alarmas, estacionamiento y preferencias correctos, sin errores JavaScript. [Resultados consolidados](evidencias/final-browser-results.json) y [captura móvil](evidencias/final-mobile-home.png). |
| Bicicletas | Variación de cantidades tras diez segundos, capacidad respetada y actualización visible. [Resultados consolidados](evidencias/final-browser-results.json). El reloj de la prueba se instaló antes de crear el temporizador para evitar un falso resultado. |
| Mapa geográfico | Clic real en marcador selecciona Terminal; clic en polígono selecciona su zona; marcador móvil seleccionable offline. Doce teselas de la vista normal respondieron HTTP200. `map-final-results.json`, `final-desktop-map-online.png` y `final-offline-map-fixed.png`. |
| PWA y offline | Worker propio activo, recarga sin red y navegación local correctas. La falta de mapa base mantiene las listas y los puntos de demostración. `final-browser-results.json`. |
| Worker aislado | Despacho sintético CDP con la pestaña cerrada verificó notificación, IndexedDB, importación y destino interno. `push-synthetic-results.json`. Esta prueba por sí sola no demuestra transporte de proveedor. |
| Web Push genuino | Chrome instalado, perfil persistente nuevo y exclusivo de la prueba: suscripción FCM real, registro en Node, programación desde la UI, cierre de pestaña manteniendo navegador abierto, notificación recibida por el worker, importación del historial al reabrir y baja desde la UI. Sin despacho sintético. `push-persistent-chrome-results.json`, duración aproximada 39,1 s. No se usó ni modificó un perfil personal. |
| Rendimiento | Caché fría/deshabilitada, viewport390×844, red simulada1,6Mbps bajada/0,75Mbps subida/150ms de latencia y CPU4×. Tras gzip: contenido visible1753ms, FCP/LCP observado1764ms y DOMContentLoaded1215ms. `performance-gzip-results.json`. Cumple el objetivo de tres segundos en estas condiciones medidas. |

La primera medición sin compresión dio contenido visible3548ms y FCP/LCP3352ms en las mismas condiciones; por eso se corrigió el servidor y se volvió a medir. La prueba de transporte primero usó contextos de incógnito que rechazaban la suscripción; no se cambió la seguridad global del navegador: se repitió en un perfil de prueba persistente y funcionó.

Quedan fuera de esta evidencia la instalación física, el banner/clic real del sistema operativo y la ejecución en Safari/Firefox o todos los dispositivos. El controlador de clic sí se comprobó mediante el evento sintético separado. Un viewport móvil no equivale a un teléfono físico, y estas medidas no garantizan menos de tres segundos en cualquier equipo o red. La recepción observada mantuvo Chrome y Node funcionando; no se promete recibir con el navegador completamente cerrado.

## Comandos

```powershell
.\node_modules\.bin\vitest.cmd run
node --test server/push.test.mjs
.\node_modules\.bin\oxlint.cmd
.\node_modules\.bin\tsc.cmd -b
# Solo si TypeScript termina correctamente:
.\node_modules\.bin\vite.cmd build
node server/start.mjs
```

Para offline: primera carga de producción, esperar activación del worker y después desconectar. Para teléfono físico, la IP HTTP de la computadora no sustituye HTTPS. Las notificaciones del sistema dependen también de la configuración del dispositivo.
