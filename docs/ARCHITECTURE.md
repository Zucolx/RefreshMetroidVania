# Arquitectura — Laboratorio de mecánicas Metroidvania

Banco de pruebas en **HTML5 Canvas 2D + ES modules**, sin bundler ni dependencias en el build web.
Todo el código de juego (`src/` salvo `main.js`, `ui/`, `editor.js`, `touch.js`) es **independiente del DOM**:
por eso los tests (`tests/`) y el validador (`tools/validar-niveles.mjs`) lo ejecutan directamente en Node.

## Convenciones

| Concepto | Valor |
|---|---|
| Unidades | 1 tile = 32 px; velocidades en px/s; tiempos en s |
| Bucle | paso fijo de 60 Hz (`STEP`), interpolación de render para jugador y enemigos |
| Pantalla lógica | 960×540, escalada y centrada con `#frame` (letterbox) |
| Gravedad / caída máx. | 2400 / 1100 (`CONFIG.gravity`, `CONFIG.maxFall`) |
| Idioma | todo en español (UI, comentarios, docs) |

## Mapa de módulos

```
index.html · style.css · manifest.webmanifest        Entrada web
src/
  config.js        CONFIG (valores), TUNABLES (sliders del lab), TOGGLES, overrides persistentes
  util.js          clamp, lerp, rrange…
  world.js         Tiles (T), World (serialización RLE), hazardAt, los, floorBelow, rects dinámicos
  physics.js       Body, moveBody (colisión por ejes), standing, solidOverlap
  platform.js      Adaptador Web / Android (Capacitor) / Steam (Electron): almacenamiento, fullscreen, lifecycle
  storage.js       Store: monedas, niveles, amuletos, equipo, controles, lab, niveles propios, ajustes
  controls.js      Acciones, enlaces teclado (hasta 3/acción) y mando (perfil por defecto + por id), iconos por familia
  input.js         Input unificado: teclado + N mandos simultáneos + táctil → estado por paso (held/pressed/released)
  touch.js         Joystick flotante y botones dibujados en el canvas (pointer events, multitáctil)
  audio.js         Sonido procedural (WebAudio)
  game.js          Game: paso, hitboxes, explosiones, checkpoints, cámara (look), minimapa, dibujo
  player.js        Movimiento, daño, relevo de equipo, magia/maná, meditación e idles, amuletos
  combat.js        damageEnemy(), etiquetas de daño (MELEE/MAGIC/GHOST_OK/ARMOR_SAFE), parry, empuje
  projectiles.js   Projectile genérico con hooks (onHit, onTick…)
  zones.js         Zonas temporales (temblor, ácido, vapor, burbuja, estasis, pulso lento)
  coins.js · items.js · effects.js · decor.js · themes.js
  hud.js           HUD (vida, maná, equipo, monedas, minimapa)
  characters/      kit.js (clase base) + swordsman, mage, artificer, alchemist, puppeteer, clockmaker + index.js
  enemies/         base.js (Enemy) + basic, forest, volcano, valley, castle, theater + index.js (ENEMY_TYPES, ENEMY_META)
  props.js, props/theater.js   Trampillas, telones, focos, cuerdas, noria
  levels/          builder.js (LevelBuilder) + lab, forest, volcano, valley, castle, theater + index.js (LEVELS)
  render/hybrid.js SpriteSystem: slots con fallback procedural + atlas opcional (hot-reload)
  render/rig.js    Rig de personaje por slots (armBack, back, legs, torso, head, arm, weapon)
  validate.js      Validador de niveles (simula física real)
  editor.js        Editor de niveles (canvas propio)
  ui/              dom.js (helper h), menus.js, controls-menu.js, lab.js (panel del laboratorio)
  main.js          App: estados, bucle, escalado, navegación de menús
tools/validar-niveles.mjs   CLI del validador (exit 1 si hay problemas)
tools/build-web.mjs         Copia el build estático a dist/
platforms/android|steam     Envoltorios Capacitor y Electron
tests/                      node:test (227 pruebas)
```

## Flujo de un paso (`Game.step`)

1. `Input.beginStep()` produce `held / pressed / released` ya fusionados (teclado + mandos + táctil).
2. `Player.update` (movimiento, dash, sprint, salto, meditación/idles) y su `Kit` activo (ataque, magia, especial).
3. Enemigos, proyectiles, zonas, props y hitboxes (`addHitbox` con `atFn`, `cut`, `onHit`).
4. Daño centralizado en `combat.js`; monedas, checkpoints, meta, cámara y minimapa.

## Render híbrido

Cada elemento se pinta en **slots con nombre** (`owner.slot.anim`). Cada slot tiene un *fallback* procedural; si
`assets/sprites/` contiene un atlas con ese slot, se usa el sprite. Orden de búsqueda:
`owner.slot.anim → owner.slot → *.slot.anim → *.slot`. Modo (`CONFIG.render.mode`): `shapes` (Formas),
`sprites` (Sprites) o `mixed` (Mixto, forma translúcida bajo el sprite). El panel del lab (Tab) permite cambiar de modo y
**recargar** el atlas en caliente. Formato del atlas y ejemplos: `assets/sprites/README.md`.

## Entrada

* **Teclado**: hasta 3 teclas por acción, reasignables (Controles → Teclado).
* **Mandos**: todos los conectados a la vez; perfil por defecto y perfil propio por `gamepad.id`; iconos Xbox / PlayStation / Switch.
* **Táctil**: joystick flotante + botones; ESCUDO y EXPLOSIÓN son atajos ↓/↑ + MAGIA.
* Todo se guarda en `localStorage` (o fichero de usuario en Steam) mediante `Store` y `controls`.

## Guías de extensión

### Ajustar una mecánica
Los valores viven en `CONFIG` (`src/config.js`). Para exponerlos en el lab añade una entrada en `TUNABLES`
(`{ group, path, label, min, max, step }`); los cambios se persisten y `Restablecer` vuelve a `DEFAULTS`.

### Añadir un personaje
1. Crea `src/characters/nuevo.js` con una clase que extienda `Kit` (`combo`, `chargeFire`, `airDown`,
   `specialPress/Hold/Release`, `entry`, `idleBase/idleFlavor/drawFlavor`, `poseMod`, `drawWorld`).
2. Regístralo en `KITS` y `KIT_ORDER` de `characters/index.js` y añade su vida en `CONFIG.characters`.
3. Define sus slots de sprite (`nuevo.torso`, `nuevo.arm`…) para poder sustituir las formas.

### Añadir un enemigo
1. Extiende `Enemy` (`enemies/base.js`); usa `startAtk/updateAtk` para ataques con ventana de parry y `shoot()` para proyectiles.
2. Regístralo en `ENEMY_TYPES` y `ENEMY_META` (`enemies/index.js`); aparecerá en el editor y en `populate()`.
3. Añade pruebas en `tests/` y comprueba que respeta las etiquetas de daño.

### Añadir un nivel
1. Crea `src/levels/mi_nivel.js` con `LevelBuilder`: estructura (bandas, chunks, pozos) → enemigos y obstáculos → decoración.
2. Añádelo a `LEVELS` en `levels/index.js` indicando las habilidades que da por supuestas (`abilities`).
3. Ejecuta `node tools/validar-niveles.mjs mi_nivel`. Reglas: escalones ≤3 tiles, escaleras de plataformas cada 3 tiles,
   sin zonas trampa, puntos clave sobre suelo firme.

### Añadir sprites
Coloca el PNG en `assets/sprites/`, descríbelo en un JSON de atlas y lístalo en `assets/sprites/index.json`.
Pulsa *Recargar sprites* en el lab: no hace falta reiniciar.

### Añadir una plataforma
Implementa en `platform.js` la detección (`target`) y los métodos de almacenamiento/fullscreen/lifecycle; el resto del
código solo habla con el singleton `platform`. Android y Steam ya están hechos (ver `platforms/*/README.md`).

## Validador de niveles

`validate.js` simula vuelos reales (caminar, caída, atravesar plataformas, saltos con tiempos de pulsación, doble salto,
dash, sprint, salto alto), construye un grafo a resolución de tile y comprueba: alcanzabilidad de puntos clave, retorno al
inicio (detección de trampas), escaleras escalables y suelo firme bajo los puntos clave. Trampillas y telones se tratan
como abiertos. `node tools/validar-niveles.mjs [nivel]` devuelve código 1 si hay problemas.

## Correspondencia con la estructura de referencia

El apartado 10 del enunciado es una referencia, no un contrato. Diferencias principales: la entrada táctil vive en
`touch.js`, los kits se agrupan en `characters/` y los enemigos por bioma en `enemies/`; el panel del laboratorio es
`ui/lab.js`; el render por slots está dividido en `render/hybrid.js` (sistema de sprites) y `render/rig.js` (rig).
