# Especificación de San Francisco Vecino

PWA académica para los siete servicios del TP5. La investigación acotada no localizó APIs municipales públicas documentadas; no demuestra su inexistencia. Se integran mapa/geolocalización, acceso a WhatsApp oficial y Web Push real. Las operaciones municipales se simulan hasta disponer de acceso documentado, sin rebajar sus recorridos funcionales.

## Requisitos funcionales

| Requisito | Comportamiento verificable |
|---|---|
| RF01 Navegación | Siete servicios, hash y enlaces directos, Atrás/Adelante y transición Reclamos → Notificaciones sin compartir estado de Hooks. |
| RF02 Bicicletas | Mapa geográfico de San Francisco con POI aproximados, bicicletas/anclajes variables cada diez segundos, capacidad y hora de actualización; selección accesible, estaciones cercanas por ubicación solicitada y reportes locales. |
| RF03 Tributos | Obligaciones, vencimientos, cedulón descargable, pago ficticio, historial y comprobante. Recordatorios próximos y vencidos sin duplicar la misma etapa. |
| RF04 Reclamos | Formulario validado, adjunto JPG/PNG/PDF completo dentro del límite local, búsqueda e historial, descarga después de recargar y progreso simulado Recibido → En revisión → Resuelto. |
| RF05 Contactos | Acceso por acción expresa al WhatsApp oficial verificado, sin envío automático. Diferenciar enlaces tel/mailto ficticios y mensaje local del canal real. |
| RF06 Alarmas | Mapa con ubicaciones ficticias, estados activados/desactivados por simulación, suscripción por zona y evento al activarse una alarma suscrita o cercana. Respetar preferencias. |
| RF07 Estacionamiento | Polígonos de zonas simuladas, tarifas/horarios, pago y comprobante ficticios, sesión de 60 minutos, aviso próximo/al vencer y extensión pagada de 30 minutos. |
| RF08 Notificaciones | Suscripción Web Push real, programación de prueba y cancelación; recepción mediante worker y recuperación del historial al reabrir. Preferencias de tipo/zona/frecuencia, filtros, leído y enlace al servicio. Avisos internos disponibles sin permiso push. |

## Requisitos no funcionales

- **Adaptabilidad:** controles utilizables desde 320 px y escritorio; listas alternativas al mapa y controles accesibles por teclado.
- **PWA:** manifest e iconos PNG, service worker propio con precache del shell. Comprobar producción en contexto seguro.
- **Sin conexión:** después de primera carga y activación del worker, pantallas y operaciones locales disponibles. El mapa base externo necesita red; no se descarga masivamente ni se promete entero offline.
- **Datos y privacidad:** validación de registros y archivos, límites de volumen, ubicación y permisos solo por acción expresa; no guardar datos bancarios ni exponer claves VAPID privadas.
- **Rendimiento:** objetivo de carga menor a tres segundos, medido con navegador/equipo/red/caché identificados. Build y tamaño de archivos no sustituyen la medición.
- **Mantenibilidad:** separar pantallas, dominio, repositorio, servicios y transporte; probar reglas y recuperación ante errores.
- **Escalabilidad:** contratos reemplazables para servicios simulados. El emisor incluido es una demostración local, no una plataforma pública multiusuario.

## Límites y entrega

Pagos, estados municipales, alarmas y zonas de estacionamiento son ficticios. Mapa base, geolocalización, acceso a WhatsApp y transporte push son reales. No hay autenticación municipal, API municipal conectada ni sincronización de trámites entre dispositivos.

Los recordatorios locales requieren app abierta y se reconcilian al volver. Web Push depende de proveedor, permisos, Internet y emisor funcionando; no se garantiza entrega con el navegador completamente cerrado. La frecuencia diaria cuenta por separado los canales local y push. Las suscripciones y claves se guardan en `.local/`, mientras datos funcionales e inbox quedan en el navegador.

La entrega incluye código, README, informe de arquitectura y pruebas con evidencia. Preparar repositorio remoto y demostración en clase son pasos posteriores: no se publican automáticamente.
