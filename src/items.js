// Amuletos: metadatos y utilidades de inventario.
export const AMULETS = {
  water: { name: 'Amuleto de Agua', short: 'Agua', biome: 'Bosque', color: '#5fb8ff', icon: '💧',
    desc: 'Proyectil cargado de agua ×1,6 (72 daño), ×1,25 extra contra fuego. Apaga gólems: se petrifican sin explotar.' },
  fire: { name: 'Amuleto de Fuego', short: 'Fuego', biome: 'Volcán', color: '#ff7a2a', icon: '🔥',
    desc: 'La explosión lanza 3 bolas de fuego que persiguen enemigos (35 daño en 108 px). Sigue liberando de telarañas.' },
  earth: { name: 'Amuleto de Tierra', short: 'Tierra', biome: 'Valle', color: '#c9a46a', icon: '⛰',
    desc: 'Cae desde alto: 6 daño al atravesar y onda de 140 px al aterrizar. Escudo +2 s. Con escudo: onda 230 px y temblor.' },
  wind: { name: 'Amuleto de Viento', short: 'Viento', biome: 'Castillo', color: '#bfe9ff', icon: '🌀',
    desc: 'Dash ×1,25 vel. y ×1,2 duración, +1 dash aéreo. El sprint acumula hasta 3 cargas (×1,65) y atraviesa enemigos.' },
  threads: { name: 'Amuleto de los Hilos', short: 'Hilos', biome: 'Teatro', color: '#e0b3ff', icon: '🧵',
    desc: 'Cada golpe cuerpo a cuerpo deja un hilo 2 s. Volver a golpear: +40 % daño y +0,5 maná.' },
};
export const AMULET_IDS = Object.keys(AMULETS);
