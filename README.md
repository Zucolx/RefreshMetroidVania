# Laboratorio de mecánicas Metroidvania

Banco de pruebas jugable en HTML5 Canvas 2D (ES modules, sin dependencias) para prototipar y afinar mecánicas de Metroidvania.
Funciona en **Web**, **Android** (Capacitor) y **Steam** (Electron/Tauri) desde el mismo `src/`.

## Ejecutar

```bash
npm run serve        # http://localhost:8000  (cualquier servidor estático sirve)
```

Parámetros útiles: `?level=forest&team=mage,artificer` arranca directo; `#editor` abre el editor.

## Controles (por defecto)

| Acción | Teclado | Mando (Xbox) |
|---|---|---|
| Mover | ←→ / A D | Stick izq. / cruceta |
| Saltar | Espacio / Z / J | A |
| Atacar | X / K | X |
| Dash | C / L / Shift | B |
| Magia | V / I | Y / LB |
| Especial | F / U | RB |
| Cambiar personaje (ant. / sig.) | 1 / 2 | LT / RT |
| Inventario · Pausa · Reaparecer | E · Esc · R | Select · Start · — |
| Panel del laboratorio | **Tab** | R3 (clic del stick der.) |

Todo es reasignable en *Controles* (teclado, mando por perfil y táctil). Se pueden usar varios mandos a la vez.

## Contenido

* 6 personajes (Espadachín, Maga, Artificiero, Alquimista, Titiritero, Relojero), equipo de 3 con relevo y entradas heroicas.
* 20 tipos de enemigo, peligros del teatro (trampillas, telones, focos, cuerdas, noria), 5 amuletos y monedas de plata.
* 6 niveles (Laboratorio, Bosque, Volcán, Valle, Castillo, Teatro) + editor con prueba en el acto.
* Meditación (3 s quieto → 3 maná/s y 10 HP/s), dos idles por personaje, minimapa y cámara de mirada.

## Herramientas

```bash
npm run validate     # valida los 6 niveles (exit 1 si falla)  ·  node tools/validar-niveles.mjs forest
npm test             # 227 pruebas con node:test
npm run build:web    # genera dist/
```

## Empaquetado

* Android: `platforms/android/README.md`
* Steam: `platforms/steam/README.md`

Más detalle técnico en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) y resumen de mecánicas en [`MECANICAS.info`](MECANICAS.info).
