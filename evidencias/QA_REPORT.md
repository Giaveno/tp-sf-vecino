# TP5 browser QA

Current result: 28/28 checks passed, 0 failed, 0 application page or console errors.

## Verified behavior

- Seven municipal modules on desktop1440x1000 and mobile390x844; no horizontal overflow.
- Claims to Notifications and browser Back regression; attachment upload, reload, byte-identical download and status progression.
- Simulated tax payment and receipt; parking start, extension, receipts, warning and expiration with isolated virtual clock.
- Real Leaflet geographic map and clickable markers/polygons after CSS fix;12ordinary viewport tile responses HTTP200; mocked geolocation; offline mobile fallback remains clickable.
- Dynamic bicycle availability after10seconds, maintaining bicycles plus free docks equals capacity12.
- Official WhatsApp link inspected without opening or sending; alarm subscription and simulated activation; notification filters, paused and daily preferences.
- Custom service worker controls offline reload and navigation, including lazy Leaflet; manifest PNGs192/512 validated.
- Cold mobile after gzip: app visible1753ms,FCP/LCP1764ms with fresh context, cache disabled,1.6Mbps down/.75Mbps up,150ms latency and4x CPU slowdown. Earlier3548ms result is historical before fix.
- Genuine FCM Web Push in installed Chrome with a new task-owned persistent profile: subscribed, UI scheduled10seconds, app page closed while browser remained alive, notification received, inbox imported after reopening, unsubscribed. No synthetic dispatch in this test.
- Separate CDP synthetic push/inbox/notification-click test routed to alarms. It is not provider delivery evidence.

## Cleanup and limits

- Isolated browser contexts closed; no task-profile Chrome process remained. Local backend subscription count zero after unsubscribe. Node server left running for the user.
- No user browser profile or global permission modified; task profiles and QA artifacts remain under ignored tmp/. No endpoints, tokens or VAPID keys appear in this report.
- Physical phone, standalone installed-PWA shell,Firefox/Safari and persistent Edge were not tested. Actual OS banner/click not visually inspected.

## Selected screenshot files included in this bundle

- final-mobile-home.png: 66181 bytes, verified present.
- final-desktop-map-online.png: 245235 bytes, verified present.
- final-offline-map-fixed.png: 76234 bytes, verified present.

Detailed evidence: final-browser-results.json,performance-gzip-results.json,map-final-results.json,push-persistent-chrome-results.json,push-synthetic-results.json.

The consolidated JSON preserves the original run inventory, which also listed three additional local screenshots. This delivery bundle intentionally includes only the three screenshots above; no profiles, subscription credentials or private VAPID files are included.
