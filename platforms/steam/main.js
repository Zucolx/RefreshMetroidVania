// Proceso principal de Electron. Carga el build web copiado en ./game (npm run build:web && cp -r ../../dist game).
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const ficheroDatos = () => path.join(app.getPath('userData'), 'datos.json');
let datos = {};
function cargar() { try { datos = JSON.parse(fs.readFileSync(ficheroDatos(), 'utf8')); } catch (e) { datos = {}; } }
function guardar() { try { fs.writeFileSync(ficheroDatos(), JSON.stringify(datos)); } catch (e) { /* disco lleno o sin permisos */ } }

// Steamworks es opcional y está desacoplado: sin el módulo el juego funciona igual.
let steam = null;
try { steam = require('steamworks.js').init(Number(process.env.STEAM_APP_ID) || 480); } catch (e) { steam = null; }

ipcMain.on('storage-get', (ev, k) => { ev.returnValue = Object.prototype.hasOwnProperty.call(datos, k) ? datos[k] : null; });
ipcMain.on('storage-set', (ev, k, v) => { datos[k] = String(v); guardar(); ev.returnValue = true; });
ipcMain.on('storage-remove', (ev, k) => { delete datos[k]; guardar(); ev.returnValue = true; });
ipcMain.on('set-fullscreen', (ev, v) => { const w = BrowserWindow.fromWebContents(ev.sender); if (w) w.setFullScreen(!!v); });
ipcMain.on('quit', () => app.quit());
ipcMain.handle('steam-achievement', (ev, id) => { try { return steam ? steam.achievement.activate(String(id)) : false; } catch (e) { return false; } });

function crearVentana() {
  const w = new BrowserWindow({
    width: 1280, height: 720, backgroundColor: '#000000', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  w.loadFile(path.join(__dirname, 'game', 'index.html'));
}

app.whenReady().then(() => { cargar(); crearVentana(); });
app.on('window-all-closed', () => app.quit());
