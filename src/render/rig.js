// Muñeco articulado procedural de los 6 personajes. Cada parte es un SLOT (legs, torso, head, arm, weapon…)
// del render híbrido: si hay sprite en el atlas se usa; si no, se dibuja la forma de aquí.
// Origen: centro de los pies, mirando a la derecha (el flip lo aplica quien llama).
import { sprites } from './hybrid.js';
import { TAU } from '../util.js';

export const POSE0 = {
  lean: 0, bob: 0, squash: 1, crouch: 0,
  legA: 0, legB: 0, kneeA: 0.2, kneeB: 0.2,
  arm: 1.1, armB: 0.9, weaponRot: 0, headTilt: 0, blink: 0, cape: 0,
  sit: 0,
};

function limb(c, x0, y0, a0, l0, a1, l1, w, col) {
  const kx = x0 + Math.sin(a0) * l0, ky = y0 + Math.cos(a0) * l0;
  const fx = kx + Math.sin(a1) * l1, fy = ky + Math.cos(a1) * l1;
  c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(kx, ky); c.lineTo(fx, fy); c.stroke();
  return { kx, ky, fx, fy };
}

const HATS = {
  helm(c, pal) { // yelmo de espadachín con penacho
    c.fillStyle = pal.trim; c.beginPath(); c.arc(0, -1, 8.4, Math.PI, 0); c.lineTo(8.4, 2); c.lineTo(-8.4, 2); c.fill();
    c.fillStyle = pal.accent; c.fillRect(-1.5, -10, 3, 5);
    c.beginPath(); c.moveTo(-1, -10); c.quadraticCurveTo(-9, -12, -12, -5); c.lineTo(-7, -8); c.fill();
    c.fillStyle = '#1a2230'; c.fillRect(1, -1, 7, 2.5);
  },
  witch(c, pal) {
    c.fillStyle = pal.coat; c.beginPath(); c.ellipse(0, -5, 11, 3, 0, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(-7, -5); c.quadraticCurveTo(-3, -16, 6, -22); c.quadraticCurveTo(5, -14, 7, -5); c.fill();
    c.fillStyle = pal.accent; c.fillRect(-7, -8, 14, 2.5);
    c.fillStyle = pal.hair; c.beginPath(); c.arc(-6, 2, 5, 0, TAU); c.fill();
  },
  goggles(c, pal) {
    c.fillStyle = pal.hair; c.beginPath(); c.arc(0, -2, 7.8, Math.PI, 0); c.fill();
    c.fillStyle = pal.trim; c.fillRect(-8, -3, 16, 3);
    c.fillStyle = '#9fe3ff'; c.beginPath(); c.arc(3, -1.5, 3.2, 0, TAU); c.fill();
    c.strokeStyle = pal.accent; c.lineWidth = 1.5; c.beginPath(); c.arc(3, -1.5, 3.2, 0, TAU); c.stroke();
  },
  mask(c, pal) { // alquimista: capucha y máscara de pico
    c.fillStyle = pal.coat; c.beginPath(); c.arc(0, -1, 8.6, Math.PI * 0.9, Math.PI * 2.1); c.lineTo(5, 7); c.lineTo(-5, 7); c.fill();
    c.fillStyle = pal.trim; c.beginPath(); c.moveTo(4, -1); c.lineTo(13, 3); c.lineTo(4, 5); c.fill();
    c.fillStyle = '#ffe27a'; c.beginPath(); c.arc(3, -2, 2.2, 0, TAU); c.fill();
  },
  tophat(c, pal) {
    c.fillStyle = pal.coat; c.fillRect(-6.5, -17, 13, 13); c.fillRect(-10, -5.5, 20, 3);
    c.fillStyle = pal.accent; c.fillRect(-6.5, -9, 13, 2.5);
    c.fillStyle = pal.hair; c.beginPath(); c.arc(-4, 2, 5, 0, TAU); c.fill();
  },
  glasses(c, pal) {
    c.fillStyle = pal.hair; c.beginPath(); c.arc(0, -2, 8, Math.PI * 1.05, Math.PI * 1.95); c.lineTo(8, 1); c.lineTo(-8, 1); c.fill();
    c.fillStyle = '#eef6ff'; c.beginPath(); c.arc(3.5, 0, 3.4, 0, TAU); c.fill();
    c.strokeStyle = pal.trim; c.lineWidth = 1.5; c.beginPath(); c.arc(3.5, 0, 3.4, 0, TAU); c.stroke();
    c.fillStyle = '#222'; c.fillRect(3, -0.5, 1.5, 2);
  },
};

export function drawRig(ctx, p, kit, pose, t, alpha = 1) {
  const pal = kit.pal;
  const owner = kit.id;
  const anim = p.animName || 'idle';
  const hipY = -18 + pose.crouch;
  const shY = hipY - 14;
  ctx.save();
  if (alpha !== 1) ctx.globalAlpha *= alpha;
  ctx.translate(0, pose.bob);
  // lean sobre la cadera
  ctx.translate(0, hipY); ctx.rotate(pose.lean); ctx.translate(0, -hipY);

  const sq = pose.squash;
  const list = [];
  // brazo trasero
  list.push({ slot: 'armBack', z: 0, xf: { x: -1, y: shY }, fb: (c) => {
    c.strokeStyle = pal.skinDark || pal.skin; c.lineWidth = 4; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(0, 0);
    c.lineTo(Math.cos(pose.armB - 0.3) * 6.5, Math.sin(pose.armB - 0.3) * 6.5);
    c.lineTo(Math.cos(pose.armB) * 13, Math.sin(pose.armB) * 13); c.stroke();
  } });
  // capa / extra detrás del cuerpo
  if (kit.drawBack) list.push({ slot: 'back', z: 0.5, xf: { x: 0, y: shY }, fb: (c) => kit.drawBack(c, p, pose, t) });
  // piernas
  list.push({ slot: 'legs', z: 1, xf: { x: 0, y: hipY }, fb: (c) => {
    if (pose.sit) { // sentado en meditación
      c.strokeStyle = pal.pants; c.lineWidth = 5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-3, 0); c.lineTo(9, 8); c.lineTo(-6, 14); c.stroke();
      c.beginPath(); c.moveTo(3, 0); c.lineTo(-9, 8); c.lineTo(6, 14); c.stroke();
      return;
    }
    const a = limb(c, -2, 0, pose.legB, 9, pose.legB - pose.kneeB, 9, 5, pal.pantsDark || pal.pants);
    c.fillStyle = pal.boots; c.beginPath(); c.ellipse(a.fx + 2, a.fy, 4.5, 2.6, 0, 0, TAU); c.fill();
    const b = limb(c, 2, 0, pose.legA, 9, pose.legA - pose.kneeA, 9, 5, pal.pants);
    c.fillStyle = pal.boots; c.beginPath(); c.ellipse(b.fx + 2, b.fy, 4.5, 2.6, 0, 0, TAU); c.fill();
  } });
  // torso
  list.push({ slot: 'torso', z: 2, xf: { x: 0, y: hipY, sy: sq }, fb: (c) => {
    c.fillStyle = pal.coat;
    c.beginPath(); c.moveTo(-6, 0); c.lineTo(-7.5, -14); c.quadraticCurveTo(0, -17, 7.5, -14); c.lineTo(6.5, 0);
    if (pal.skirt) { c.lineTo(9, 8); c.lineTo(-9, 8); }
    c.closePath(); c.fill();
    c.fillStyle = pal.trim; c.fillRect(-6.8, -3, 13.6, 2.6);
    c.fillStyle = pal.accent; c.fillRect(-1.2, -3.2, 2.6, 3);
    if (pal.vest) { c.fillStyle = pal.vest; c.fillRect(-3, -13, 6, 10); }
    if (kit.drawTorso) kit.drawTorso(c, p, pose, t);
  } });
  // cabeza
  list.push({ slot: 'head', z: 3, xf: { x: 1, y: shY - 7 + (pose.headBob || 0), rot: pose.headTilt }, fb: (c) => {
    c.fillStyle = pal.skin; c.beginPath(); c.arc(0, 0, 7.4, 0, TAU); c.fill();
    if (pal.hat !== 'mask') {
      c.fillStyle = '#1b1b24';
      const bl = pose.blink > 0.5;
      if (bl) c.fillRect(2.4, -0.8, 3.6, 1.2); else { c.beginPath(); c.arc(4, -0.5, 1.5, 0, TAU); c.fill(); }
      c.fillStyle = 'rgba(200,80,80,0.5)'; c.fillRect(2, 2.5, 3, 1.4);
    }
    (HATS[pal.hat] || HATS.helm)(c, pal);
    if (kit.drawHead) kit.drawHead(c, p, pose, t);
  } });
  // brazo delantero + arma
  const armLen = 6.8;
  const hx = Math.cos(pose.arm) * armLen * 2, hy = Math.sin(pose.arm) * armLen * 2;
  list.push({ slot: 'arm', z: 4, xf: { x: 0, y: shY }, fb: (c) => {
    c.strokeStyle = pal.skin; c.lineWidth = 4.4; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(0, 0);
    const ex = Math.cos(pose.arm - 0.35) * armLen, ey = Math.sin(pose.arm - 0.35) * armLen;
    c.lineTo(ex, ey); c.lineTo(hx, hy); c.stroke();
    c.strokeStyle = pal.coat; c.lineWidth = 5; c.beginPath(); c.moveTo(0, 0); c.lineTo(ex * 0.7, ey * 0.7); c.stroke();
    c.fillStyle = pal.glove || pal.skin; c.beginPath(); c.arc(hx, hy, 2.8, 0, TAU); c.fill();
  } });
  if (kit.drawWeapon) {
    list.push({ slot: 'weapon', z: 5, xf: { x: hx, y: shY + hy, rot: pose.arm + pose.weaponRot }, fb: (c) => kit.drawWeapon(c, p, pose, t) });
  }
  sprites.slots(ctx, owner, anim, t, list);
  if (kit.drawFront) kit.drawFront(ctx, p, pose, t, { hx, hy: shY + hy, shY, hipY });
  ctx.restore();
}
