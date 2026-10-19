# Sprites

Carpeta de sprites del render híbrido (vacía al inicio: el juego usa formas procedurales).

1. Pon aquí tus hojas (`*.png`) y sus atlas (`*.json`).
2. Lista los atlas en `index.json`: `{ "atlases": ["personajes.json", "efectos.json"] }`.
3. Pulsa **↻ Recargar sprites** en el laboratorio (Tab) y elige *Sprites* o *Mixto*.

Formato del atlas (una entrada por slot):

```json
{
  "image": "personajes.png",
  "sprites": [
    { "owner": "swordsman", "slot": "torso", "anim": "idle_base",
      "frames": [[0,0,32,48],[32,0,32,48]], "anchor": [0.5, 0.9],
      "fps": 8, "loop": true, "offset": [0,0], "rot": 0, "scale": 1, "z": 2 }
  ]
}
```

- `owner`: id de personaje (`swordsman`, `mage`, `artificer`, `alchemist`, `puppeteer`, `clockmaker`),
  id de enemigo (`wolf`, `ghost`…) o `fx` para efectos; `*` vale para cualquiera.
- `slot`: `legs`, `torso`, `head`, `arm`, `armBack`, `weapon`, `back` (personajes), `body` (enemigos),
  `dot`, `ring`, `disc`, `text`, `slash`, `smoke`, `proj_<forma>` (efectos y proyectiles).
- `anim` (opcional): `idle_base`, `idle_flavor`, `run`, `sprint`, `jump`, `fall`, `dash`, `attack`, `hurt`, `meditate`…
- Se busca por `owner.slot.anim` → `owner.slot` → `*.slot.anim` → `*.slot`.
- `z` sustituye al orden de capa del slot. Los puntos de unión son los de la plataforma procedural:
  origen de `legs`/`torso` en la cadera, `head` en la cabeza, `arm`/`weapon` en el hombro/mano.
