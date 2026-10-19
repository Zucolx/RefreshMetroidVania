# Steam (Electron)

```bash
npm run build:web
cp -r dist platforms/steam/game
cd platforms/steam && npm install && npm start      # probar
npm run dist                                          # instalador (electron-builder)
```

* `preload.js` expone `window.electronAPI`; `src/platform.js` lo detecta y guarda el progreso en un
  fichero JSON dentro de `userData` (sobrevive a limpiezas del navegador).
* Steamworks (logros, nube) es opcional: instala `steamworks.js` y define `STEAM_APP_ID`.
  Si falta, el juego no cambia. Para Tauri basta con exponer el mismo objeto `electronAPI` desde el frontend.
* Los mandos se gestionan con la Gamepad API de Chromium (varios a la vez, iconos Xbox/PlayStation/Switch).
