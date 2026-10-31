import { fishById, rodById } from './catalog.js';

const paths = {
  coin: '<circle cx="12" cy="12" r="8"/><path d="M12 7v10M9 9h5M10 15h5"/>',
  shop: '<path d="M3 9l2-5h14l2 5M4 10v10h16V10M3 9q2 5 5 0 2 5 5 0 3 5 8 0M10 20v-6h5v6"/>',
  fish: '<path d="M19 12l4-5v10l-4-5C13 4 5 5 1 12c4 7 12 8 18 0Z"/><circle cx="6" cy="11" r=".6"/>',
  gear: '<path d="m10 3 4 0 1 3 3 1 3 3-2 3-1 4-4 3-3-2-4-1-3-4 2-3 1-4Z"/><circle cx="12" cy="12" r="3"/>',
  hook: '<path d="M12 2v11q0 7 6 7t3-9l-3 3M7 3h10"/>',
  reel: '<path d="M7 4h10M12 4v10q0 7 6 7 5-1 3-7l-3 2M3 15V7l-3 3M3 7l3 3"/>',
  check: '<path d="m4 12 5 5L21 5"/>',
  save: '<path d="M4 3h13l4 4v14H3V3h1ZM7 3v6h10V3M7 21v-7h10v7"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  sound: '<path d="M3 9h4l5-5v16l-5-5H3ZM16 8q5 4 0 8M19 5q8 7 0 14"/>',
  mute: '<path d="M3 9h4l5-5v16l-5-5H3ZM17 9l5 6M22 9l-5 6"/>',
  expand: '<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  minus: '<path d="M4 12h16"/>',
  arrow: '<path d="m14 5-7 7 7 7M7 12h14"/>',
};
export function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.fish}</svg>`;
}
export function rodArt(rod) {
  return `<svg viewBox="0 0 220 80" aria-hidden="true"><path d="M18 68 175 17" stroke="#173c3b" stroke-width="9" stroke-linecap="round"/><path d="m48 58 127-41" stroke="${rod.color}" stroke-width="5"/><path d="m100 41 75-24" stroke="#eeeece" stroke-width="2"/><path d="M176 18v35q0 12-10 12-9-2-7-11l5 3" fill="none" stroke="#476a64" stroke-width="1.5"/><circle cx="48" cy="68" r="9" fill="#c9a166" stroke="#173c3b" stroke-width="3"/><circle cx="48" cy="68" r="3" fill="#173c3b"/></svg>`;
}
export function fishArt(id) {
  const fish = fishById(id) || fishById('small');
  return `<svg viewBox="0 0 140 64" aria-hidden="true"><defs><linearGradient id="fish-${fish.id}" x2="0" y2="1"><stop stop-color="#385b5c"/><stop offset=".48" stop-color="${fish.color}"/><stop offset=".7" stop-color="#e1e9d5"/><stop offset="1" stop-color="#7eaa9f"/></linearGradient></defs><path d="m83 28 39-16-5 20 5 20-39-16M46 25l14-20 29 20M54 38l17 20 7-20" fill="#547b72"/><path d="M10 31C36 3 81 11 101 32 79 54 34 60 10 33Z" fill="url(#fish-${fish.id})" stroke="#527a71" stroke-width="1"/><path d="M37 20q13 14 1 25M54 34l22 12-10-19" fill="none" stroke="#6c8d81"/><circle cx="25" cy="29" r="3" fill="#152c29"/><circle cx="24" cy="28" r="1" fill="#fff"/></svg>`;
}

function drawFish(ctx, x, y, size, direction, time, id, alpha = 1) {
  const fish = fishById(id); const tail = Math.sin(time * 4) * 5;
  ctx.save(); ctx.translate(x, y); ctx.scale(direction * size, size); ctx.globalAlpha = alpha;
  ctx.fillStyle = '#597b73'; ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(-50, -17 + tail); ctx.quadraticCurveTo(-41, 0, -50, 17 + tail); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-10, -9); ctx.lineTo(-4, -25); ctx.lineTo(20, -8); ctx.fill();
  const gradient = ctx.createLinearGradient(0, -15, 0, 15); gradient.addColorStop(0, '#3b6261'); gradient.addColorStop(.46, fish.color); gradient.addColorStop(.74, '#e2ead5'); gradient.addColorStop(1, '#708f83');
  ctx.fillStyle = gradient; ctx.beginPath(); ctx.moveTo(37, 0); ctx.bezierCurveTo(12, -24, -15, -19, -31, 0); ctx.bezierCurveTo(-13, 21, 12, 20, 37, 0); ctx.fill();
  ctx.strokeStyle = '#678d80'; ctx.lineWidth = .7;
  for (let i = -20; i < 17; i += 5) { ctx.beginPath(); ctx.ellipse(i, 0, 2, 9, .3, -.9, .9); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(13, -11); ctx.quadraticCurveTo(4, 0, 13, 12); ctx.stroke();
  ctx.fillStyle = '#779b8a'; ctx.beginPath(); ctx.moveTo(7, 2); ctx.lineTo(-5, 15 + Math.sin(time * 3) * 2); ctx.lineTo(-8, 2); ctx.fill();
  ctx.fillStyle = '#142a29'; ctx.beginPath(); ctx.arc(26, -3, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(26.5, -3.7, .7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export class LakeScene {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.length = 1.8;
    this.resize = new ResizeObserver(() => this.fit()); this.resize.observe(canvas);
    this.fit();
  }
  fit() {
    const box = this.canvas.getBoundingClientRect();
    this.w = box.width; this.h = box.height;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.w * ratio); this.canvas.height = Math.round(this.h * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  draw(time, state, trip) {
    const c = this.ctx, w = this.w, h = this.h;
    if (!w || !h) return;
    this.length += (state.length - this.length) * .16;
    c.clearRect(0, 0, w, h);
    const span = Math.min(w / 440, h / 720);
    // Sparse glints and submerged particles; background carries the landscape.
    for (let i = 0; i < 28; i++) {
      const x = (i * 71.6 + time * (1 + i % 3)) % w, y = h * (.38 + (i * .137) % .46);
      c.globalAlpha = .08 + .09 * (1 + Math.sin(time + i)); c.fillStyle = '#d9fff0'; c.beginPath(); c.ellipse(x, y, 2 + i % 4, .8, -.15, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
    for (let i = 0; i < 7; i++) {
      const direction = i % 2 ? 1 : -1;
      const x0 = ((i * 109 + time * (9 + i)) % (w + 140)) - 70;
      const x = direction === 1 ? x0 : w - x0;
      const y = h * (.47 + (i % 4) * .067) + Math.sin(time * .6 + i) * 9;
      const id = i % 3 === 0 ? 'large' : 'small';
      drawFish(c, x, y, span * (id === 'large' ? .83 : .55), direction, time + i, id, .42 + (i % 2) * .18);
    }
    const reach = this.length / 4.8;
    // Match the photographed waterline after CSS background-size: cover crops it.
    const photoScale = Math.max(w / 1536, h / 1024);
    const floatY = Math.max(h * .12, 338 * photoScale + (h - 1024 * photoScale) * (w >= 800 ? .45 : .5));
    const tip = { x: w * (.23 + .58 * reach), y: floatY - h * (.06 + .08 * reach) };
    const hook = { x: tip.x + w * .035, y: h * .63 };
    if (trip.phase !== 'ready') {
      const cast = trip.phase === 'waiting' ? Math.min(1, trip.elapsed / .65) : 1;
      let endY = tip.y + (hook.y - tip.y) * cast;
      if (trip.phase === 'caught') endY = hook.y - Math.min(1, trip.elapsed / .55) * h * .23;
      c.lineWidth = 1.2; c.strokeStyle = 'rgba(246,245,208,.85)'; c.beginPath(); c.moveTo(tip.x, tip.y); c.quadraticCurveTo(tip.x + w * .1 * (1 - cast), tip.y, hook.x, endY); c.stroke();
      const ring = trip.phase === 'bite' ? 20 + Math.sin(time * 6) * 8 : 13;
      c.strokeStyle = trip.phase === 'bite' ? '#f3ce89' : '#e4f4df'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(hook.x, floatY, ring * span, ring * span * .3, 0, 0, Math.PI * 2); c.stroke();
      c.save(); c.translate(hook.x, floatY + Math.sin(time * 3) * 2); c.fillStyle = '#eee6c9'; c.beginPath(); c.ellipse(0, 0, 4, 9, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#d8754b'; c.fillRect(-3, -9, 6, 7); c.restore();
      const progress = trip.phase === 'waiting' ? Math.max(0, Math.min(1, (trip.elapsed - .7) / (trip.waitTime - .7))) : 1;
      if (progress > 0) {
        const size = span * (trip.fish === 'large' ? 1.2 : .73);
        const fromX = hook.x > w / 2 ? -80 : w + 80, direction = hook.x > w / 2 ? 1 : -1;
        const toX = hook.x - direction * 36 * size;
        const fishX = fromX + (toX - fromX) * Math.sin(progress * Math.PI / 2);
        drawFish(c, fishX, endY + Math.sin(time * 2) * (1 - progress) * 8, size, direction, time, trip.fish);
      }
    }
    // Telescoping sections visibly slide rather than only changing line length.
    const base = { x: w * .08, y: h * .89 }, dx = tip.x - base.x, dy = tip.y - base.y;
    const rod = rodById(state.equipped), len = Math.hypot(dx, dy);
    c.save(); c.translate(base.x, base.y); c.rotate(Math.atan2(dy, dx));
    c.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const start = i * len / 4, end = (i + 1) * len / 4;
      c.strokeStyle = i % 2 ? '#345551' : rod.color; c.lineWidth = (10 - i * 2) * span;
      c.beginPath(); c.moveTo(start, 0); c.lineTo(end, 0); c.stroke();
      c.strokeStyle = '#e4cf9d'; c.lineWidth = 2 * span; c.beginPath(); c.moveTo(end - 3, -4 + i); c.lineTo(end - 3, 4 - i); c.stroke();
    }
    c.strokeStyle = '#27423b'; c.lineWidth = 15 * span; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.min(60 * span, len * .22), 0); c.stroke();
    for (let i = 5; i < 52 * span; i += 6) { c.strokeStyle = '#627269'; c.lineWidth = 1; c.beginPath(); c.moveTo(i, -5 * span); c.lineTo(i + 2, 5 * span); c.stroke(); }
    c.fillStyle = '#c2a276'; c.beginPath(); c.arc(48 * span, 12 * span, 12 * span, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#27423b'; c.lineWidth = 4 * span; c.stroke();
    c.fillStyle = '#2c4b45'; c.beginPath(); c.arc(48 * span, 12 * span, 5 * span, 0, Math.PI * 2); c.fill(); c.restore();
  }
}
