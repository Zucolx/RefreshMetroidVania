# Android (Capacitor)

El mismo `src/` se empaqueta tal cual: `src/platform.js` detecta `window.Capacitor` y activa
el modo nativo (pantalla completa inmersiva, bloqueo horizontal, vibración nativa, pausa al pasar a segundo plano).

```bash
npm run build:web                       # genera dist/
npm i -D @capacitor/core @capacitor/cli @capacitor/android
cp platforms/android/capacitor.config.json capacitor.config.json
npx cap add android
npx cap sync android
npx cap open android                    # compila y firma desde Android Studio
```

Plugins opcionales (si están instalados `platform.js` los usa; si no, cae a las APIs web):
`@capacitor/screen-orientation` (bloqueo horizontal), `@capacitor/haptics` (vibración),
`@capacitor/app` (ciclo de vida) y `@capacitor/status-bar`.

En `AndroidManifest.xml` añade `android:screenOrientation="sensorLandscape"` a la actividad principal.
Los mandos Bluetooth/USB llegan por la Gamepad API del WebView y funcionan a la vez que el táctil.
