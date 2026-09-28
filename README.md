# Servilion Entregas

Aplicación Android offline-first para registrar la entrega de morrales en faena. Está construida con Expo, React Native y TypeScript.

## Flujos

- **Flujo 1, habitación:** escanea el QR de la boleta/OT y después el QR de la habitación. Si la puerta no coincide con el destino congelado en la guía, muestra ambas habitaciones y exige una segunda confirmación para registrar de todas maneras.
- **Flujo 2, cliente:** escanea sólo el QR del morral, informa que la entrega es al cliente y registra el hito final sin habitación.
- Ambos flujos exigen ubicación precisa. Sin permiso, GPS activo y una lectura con precisión disponible, la entrega no se guarda.
- **Lencería de hotelería:** registra el *reparto* de lencería limpia a un campamento y el *retiro* del sucio. Se elige el tipo de movimiento, el campamento y las piezas por tipo; se muestra el saldo del campamento y se avisa (sin bloquear) si un retiro lo deja en negativo. También exige ubicación precisa.

## Lencería de hotelería

La lencería es un stock rotativo del cliente: la planta la despacha a la faena, el supervisor la reparte a los campamentos y retira el sucio. Esta app registra esos dos últimos movimientos, con o sin señal.

- Al sincronizar se descarga el saldo de cada campamento (`GET /api/hospitality/balances`). En ruta, el saldo que se ve es ese más lo que el teléfono registró y el servidor todavía no tiene; lo ya enviado antes de la descarga no se vuelve a sumar.
- Cada movimiento recibe su `client_uuid` al guardarse y se envía por lotes a `POST /api/hospitality/field-sync`. Si la respuesta se pierde, el reenvío vuelve como `DUPLICADO` y se da por enviado.
- Si el servidor rechaza un movimiento por una regla del negocio (por ejemplo, un tipo que ya no es de hotelería), queda **Rechazado** en el historial y no se reintenta. Los errores de red quedan en **Reintentar**.

## Operación offline

Al iniciar sesión con conexión, la app descarga todas las guías `DESPACHADA`, las habitaciones activas y los saldos de lencería de hotelería. La sesión JWT se guarda en `SecureStore`; el catálogo y las entregas se almacenan en SQLite.

Cada entrega recibe un `client_uuid` antes de intentar enviarse. El mismo UUID se reutiliza en todos los reintentos, por lo que perder la respuesta del servidor no duplica el registro. Al recuperar conexión, la app envía primero la cola y luego refresca el catálogo.

Las entregas sincronizadas se conservan **30 días**, suficiente para cubrir dos rotaciones 14x14 y permitir revisión local. Las entregas pendientes o fallidas nunca se eliminan automáticamente.

## Desarrollo

```powershell
npm install
npm run typecheck
npm start
```

No es necesario generar un APK para revisar la aplicación:

- **Teléfono físico:** instala Expo Go, conecta el teléfono y el PC a la misma red Wi-Fi, ejecuta `npm start` y escanea el QR mostrado por Expo. Si la red bloquea conexiones LAN, usa `npx expo start --tunnel`.
- **Emulador Android:** abre un dispositivo virtual desde Android Studio y ejecuta `npm run android`.

El servidor de producción viene precargado como `https://api.34-228-25-198.nip.io`. En el emulador Android, un backend local se alcanza en `http://10.0.2.2:8000`. En un teléfono físico se debe ingresar la IP LAN del equipo que ejecuta Django, por ejemplo `http://192.168.1.20:8000`, y permitirla en `ALLOWED_HOSTS`.

Los usuarios admitidos son `SUPERVISOR` y `ADMIN`. El primer inicio de sesión requiere internet; después puede continuarse con la sesión y el catálogo guardados.

La interfaz usa las áreas seguras nativas en los cuatro bordes. En Android, la barra inferior queda por encima de los controles del sistema tanto con navegación gestual como con los tres botones tradicionales.

## Empaquetado

```powershell
npm run export:android
```

Para generar un APK/AAB instalable se debe configurar EAS Build o generar el proyecto nativo con `npx expo prebuild`. Los permisos de cámara y ubicación ya están declarados en `app.json`.

## Estructura

- `src/api.ts`: login, refresh JWT, descarga paginada y envío de entregas.
- `src/database.ts`: esquema SQLite, caché, cola y retención.
- `src/sync.ts`: sincronización de pendientes y catálogo.
- `src/screens/DeliveryScreen.tsx`: máquina de estados de ambos flujos, QR y GPS.
- `src/session.ts`: credenciales cifradas con SecureStore.