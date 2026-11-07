// 2D character layer for the SR-71 short.
// Bold cartoon figures with expressive faces, drawn in SCREEN space over the 3D set.
// Screen-space (not billboard) because every shot's framing is authored by hand, so placement is
// deterministic and cheap — no camera projection needed, no canvas-texture pool to manage.
//
// Style: heavy ink outline, flat fills, oversized head, thick rounded limbs. Cartoon-documentary,
// not realistic. Everything is a pure function of t so cloud-chunked rendering stays seamless.

export type Expr = "neutral" | "stern" | "grin" | "shock" | "nervous" | "smug" | "sad" | "awe";

export type ActorSpec = {
  who: "mechanic" | "foreman" | "crew";
  /** screen anchor, 0..1 across the target canvas. Unused when the actor is drawn to a world-space
   *  billboard card (CardActor supplies its own centre/baseline). */
  x?: number;
  y?: number;
  /** character height as a fraction of the target canvas height */
  h?: number;
  /** facing: -1 = looks/turns left, +1 = right */
  face?: -1 | 1;
  expr?: Expr;
  /** arm pose name; angles in degrees, 0 = straight down, +90 = straight out to that side */
  pose?: "idle" | "point" | "shrug" | "crossed" | "clipboard" | "clamp" | "lookUp" | "handsUp" | "wave";
  /** subtle walk cycle */
  walk?: number;
  breathe?: number;
};

const INK = "#1a1116";
const SKIN = "#f2c9a0";
const JACKET = "#2c4a6b";
const JACKET_D = "#1e3349";
const PANTS = "#22262e";
const VEST = "#d8631f";
const HAT = "#e8b93a";
const HAT_RIM = "#c99b22";

type C2 = CanvasRenderingContext2D;

// Scene light comes from upper-left (warm sodium key) with a cool fill from the right.
// Every fill gets a lit edge and a shadow edge so the 2D cast sits IN the 3D lighting, not on top.
const LIT = "rgba(255,214,150,0.55)";
const SHADOW = "rgba(12,18,30,0.42)";

const limb = (c: C2, x1: number, y1: number, x2: number, y2: number, w: number, col: string) => {
  c.strokeStyle = INK; c.lineWidth = w + 5; c.lineCap = "round";
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  c.strokeStyle = col; c.lineWidth = w; c.stroke();
  // shadow side (lower-right of the limb axis)
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  c.strokeStyle = SHADOW; c.lineWidth = w * 0.42;
  c.beginPath(); c.moveTo(x1 + nx * w * 0.22, y1 + ny * w * 0.22); c.lineTo(x2 + nx * w * 0.22, y2 + ny * w * 0.22); c.stroke();
  // lit edge (upper-left)
  c.strokeStyle = LIT; c.lineWidth = w * 0.26;
  c.beginPath(); c.moveTo(x1 - nx * w * 0.26, y1 - ny * w * 0.26); c.lineTo(x2 - nx * w * 0.26, y2 - ny * w * 0.26); c.stroke();
};

// arm angle: 0 = down, 90 = out horizontally to the character's right (screen), -90 = left
const arm = (c: C2, sx: number, sy: number, a: number, len: number, w: number, col: string, elbow: number) => {
  const r = (a * Math.PI) / 180;
  const ex = sx + Math.sin(r) * len * 0.52, ey = sy + Math.cos(r) * len * 0.52;
  const r2 = ((a + elbow) * Math.PI) / 180;
  const hx = ex + Math.sin(r2) * len * 0.48, hy = ey + Math.cos(r2) * len * 0.48;
  limb(c, sx, sy, ex, ey, w, col);
  limb(c, ex, ey, hx, hy, w * 0.92, col);
  return [hx, hy] as const;
};

const drawHead = (c: C2, cx: number, cy: number, r: number, e: Expr, face: number, vest: boolean) => {
  // neck
  limb(c, cx, cy + r * 0.85, cx, cy + r * 1.5, r * 0.42, vest ? VEST : JACKET);
  // head shape
  c.beginPath(); c.ellipse(cx, cy, r * 0.86, r, 0, 0, Math.PI * 2);
  const hg = c.createRadialGradient(cx - r * 0.34, cy - r * 0.36, r * 0.1, cx, cy, r * 1.12);
  hg.addColorStop(0, "#fde4c6"); hg.addColorStop(0.55, SKIN); hg.addColorStop(1, "#c98f63");
  c.fillStyle = hg; c.fill();
  c.strokeStyle = INK; c.lineWidth = Math.max(3, r * 0.075); c.stroke();
  // warm rim light on the shadow-facing edge, cool rim on the lit edge
  c.beginPath(); c.ellipse(cx, cy, r * 0.86, r, 0, Math.PI * 0.62, Math.PI * 1.12);
  c.strokeStyle = "rgba(255,176,67,0.75)"; c.lineWidth = Math.max(2, r * 0.055); c.stroke();

  // ears
  c.beginPath(); c.ellipse(cx - r * 0.84, cy + r * 0.05, r * 0.14, r * 0.2, 0, 0, Math.PI * 2); c.fillStyle = SKIN; c.fill(); c.stroke();
  c.beginPath(); c.ellipse(cx + r * 0.84, cy + r * 0.05, r * 0.14, r * 0.2, 0, 0, Math.PI * 2); c.fill(); c.stroke();

  const ex = cx + face * r * 0.1;
  const eyeY = cy - r * 0.08;
  const dx = r * 0.3;

  // brows carry most of the expression
  const brow = (bx: number, tilt: number) => {
    c.strokeStyle = INK; c.lineWidth = Math.max(2.5, r * 0.085); c.lineCap = "round";
    c.beginPath(); c.moveTo(bx - r * 0.17 * face, eyeY - r * 0.34 + tilt); c.lineTo(bx + r * 0.17 * face, eyeY - r * 0.34 - tilt); c.stroke();
  };
  switch (e) {
    case "stern": brow(ex - dx, -r * 0.05); brow(ex + dx, r * 0.05); break;
    case "shock": brow(ex - dx, -r * 0.02); brow(ex + dx, r * 0.02); break;
    case "nervous": brow(ex - dx, -r * 0.02); brow(ex + dx, r * 0.10); break;
    case "sad": brow(ex - dx, r * 0.10); brow(ex + dx, -r * 0.10); break;
    case "smug": brow(ex - dx, r * 0.06); brow(ex + dx, r * 0.02); break;
    case "grin": case "awe": brow(ex - dx, -r * 0.03); brow(ex + dx, r * 0.03); break;
    default: brow(ex - dx, 0); brow(ex + dx, 0);
  }

  // eyes
  const eyeR = e === "shock" || e === "awe" ? r * 0.23 : r * 0.175;
  const eye = (px: number) => {
    c.beginPath(); c.ellipse(px, eyeY, eyeR * 0.82, eyeR, 0, 0, Math.PI * 2);
    c.fillStyle = "#fff"; c.fill(); c.strokeStyle = INK; c.lineWidth = Math.max(2, r * 0.05); c.stroke();
    c.beginPath(); c.arc(px + face * eyeR * 0.24, eyeY + r * 0.02, eyeR * 0.5, 0, Math.PI * 2);
    c.fillStyle = INK; c.fill();
    c.beginPath(); c.arc(px - eyeR * 0.18, eyeY - eyeR * 0.26, eyeR * 0.17, 0, Math.PI * 2);
    c.fillStyle = "rgba(255,255,255,0.92)"; c.fill();
  };
  eye(ex - dx); eye(ex + dx);

  // mouth
  const my = cy + r * 0.42;
  c.strokeStyle = INK; c.lineWidth = Math.max(2.5, r * 0.07); c.lineCap = "round";
  const mouth = (w: number, curve: number, open = 0) => {
    c.beginPath(); c.moveTo(ex - w, my);
    c.quadraticCurveTo(ex, my + curve, ex + w, my);
    if (open > 0) { c.closePath(); c.fillStyle = "#5a1f22"; c.fill(); }
    c.stroke();
  };
  switch (e) {
    case "grin": mouth(r * 0.28, r * 0.22, r * 0.1); break;
    case "shock": mouth(r * 0.17, r * 0.02, r * 0.5); break;
    case "stern": mouth(r * 0.22, -r * 0.06); break;
    case "sad": mouth(r * 0.2, -r * 0.16); break;
    case "nervous": mouth(r * 0.16, -r * 0.02, r * 0.12); break;
    case "smug": mouth(r * 0.24, r * 0.12); break;
    case "awe": mouth(r * 0.15, r * 0.02, r * 0.34); break;
    default: mouth(r * 0.2, r * 0.04);
  }
};

/** Draw one character. (x,y) = centre of the ground contact point, h = full standing height. */
export const drawActor = (c: C2, s: ActorSpec, t: number, W = 1080, HGT = 1920) => {
  const face = s.face ?? 1;
  const H = (s.h ?? 0.32) * HGT;
  const cx = (s.x ?? 0.5) * W;
  const gy = (s.y ?? 0.92) * HGT;

  const b = s.breathe ?? 1;
  const br = Math.sin(t * 1.7 + ((s.x ?? 0.5) * 13)) * 0.012 * b;      // breathing
  const wk = s.walk ? Math.sin(t * 7.5) : 0;
  const lean = s.pose === "point" ? 0.03 * face : s.pose === "shrug" ? -0.01 : 0;

  const headR = H * 0.165;
  const headCy = gy - H * 0.80 - br * H;
  const shY = gy - H * 0.62 - br * H;   // shoulder line
  const hipY = gy - H * 0.34;
  const shoulderW = H * 0.155;
  const topX = cx + lean * H;

  // ground shadow
  c.beginPath(); c.ellipse(cx, gy + H * 0.012, H * 0.13, H * 0.028, 0, 0, Math.PI * 2);
  c.fillStyle = "rgba(0,0,0,0.42)"; c.fill();

  // legs
  const legLen = hipY - gy;
  if (s.walk) {
    limb(c, topX, hipY, topX + wk * H * 0.09, gy, H * 0.055, PANTS);
    limb(c, topX, hipY, topX - wk * H * 0.09, gy, H * 0.055, PANTS);
  } else {
    limb(c, topX, hipY, cx - H * 0.055, gy, H * 0.058, PANTS);
    limb(c, topX, hipY, cx + H * 0.055, gy, H * 0.058, PANTS);
  }
  void legLen;
  // boots
  [[cx - H * 0.055, 1], [cx + H * 0.055, 1]].forEach(([bx]) => {
    c.beginPath(); c.ellipse(bx as number, gy, H * 0.045, H * 0.022, 0, 0, Math.PI * 2);
    c.fillStyle = INK; c.fill();
  });

  // torso
  const vest = s.who === "mechanic" || s.who === "crew";
  c.beginPath();
  c.moveTo(topX - shoulderW, shY);
  c.quadraticCurveTo(topX, shY - H * 0.035, topX + shoulderW, shY);
  c.lineTo(topX + shoulderW * 0.82, hipY);
  c.quadraticCurveTo(topX, hipY + H * 0.02, topX - shoulderW * 0.82, hipY);
  c.closePath();
  const tg = c.createLinearGradient(topX - shoulderW, shY, topX + shoulderW, hipY);
  if (vest) { tg.addColorStop(0, "#f0762b"); tg.addColorStop(0.5, VEST); tg.addColorStop(1, "#a8451a"); }
  else { tg.addColorStop(0, "#3d6288"); tg.addColorStop(0.55, JACKET_D); tg.addColorStop(1, "#131e2b"); }
  c.fillStyle = tg; c.fill();
  c.strokeStyle = INK; c.lineWidth = Math.max(3, H * 0.012); c.stroke();

  if (vest) {  // hi-vis stripes
    c.save(); c.clip();
    c.fillStyle = "#f2f2ea";
    c.fillRect(topX - shoulderW, shY + H * 0.075, shoulderW * 2, H * 0.022);
    c.fillRect(topX - H * 0.014, shY, H * 0.028, hipY - shY);
    c.restore();
  } else {     // foreman: lighter jacket + collar
    c.beginPath(); c.moveTo(topX, shY); c.lineTo(topX + H * 0.05 * face, shY + H * 0.05); c.lineTo(topX + H * 0.01 * face, shY + H * 0.055); c.closePath();
    c.fillStyle = JACKET; c.fill();
  }

  // arms
  const armW = H * 0.05, armLen = H * 0.30;
  const axL = topX - shoulderW * 0.92, axR = topX + shoulderW * 0.92;
  const swing = s.walk ? Math.sin(t * 7.5) * 26 : 0;
  let handL: readonly [number, number], handR: readonly [number, number];
  switch (s.pose) {
    case "point":
      handR = arm(c, axR, shY, 74 * face, armLen * 1.15, armW, vest ? VEST : JACKET, 0);
      handL = arm(c, axL, shY, 12, armLen, armW, vest ? VEST : JACKET, 10);
      break;
    case "shrug":
      handR = arm(c, axR, shY, 62, armLen * 0.9, armW, vest ? VEST : JACKET, -55);
      handL = arm(c, axL, shY, -62, armLen * 0.9, armW, vest ? VEST : JACKET, 55);
      break;
    case "handsUp":
      handR = arm(c, axR, shY, 148, armLen, armW, vest ? VEST : JACKET, -20);
      handL = arm(c, axL, shY, -148, armLen, armW, vest ? VEST : JACKET, 20);
      break;
    case "wave":
      handR = arm(c, axR, shY, 152 + Math.sin(t * 9) * 16, armLen, armW, vest ? VEST : JACKET, -18);
      handL = arm(c, axL, shY, 10, armLen, armW, vest ? VEST : JACKET, 12);
      break;
    case "crossed":
      handR = arm(c, axR, shY, -34, armLen * 0.82, armW, vest ? VEST : JACKET, -62);
      handL = arm(c, axL, shY, 34, armLen * 0.82, armW, vest ? VEST : JACKET, 62);
      break;
    case "clipboard":
      handR = arm(c, axR, shY, 58, armLen * 0.86, armW, JACKET, -70);
      handL = arm(c, axL, shY, 30, armLen * 0.8, armW, JACKET, 40);
      break;
    case "clamp":
      handR = arm(c, axR, shY, 74, armLen * 0.95, armW, vest ? VEST : JACKET, -14);
      handL = arm(c, axL, shY, 40, armLen * 0.9, armW, vest ? VEST : JACKET, -8);
      break;
    case "lookUp":
      handR = arm(c, axR, shY, 70, armLen * 0.9, armW, vest ? VEST : JACKET, -40);
      handL = arm(c, axL, shY, -18, armLen, armW, vest ? VEST : JACKET, 14);
      break;
    default:
      handR = arm(c, axR, shY, 10 + swing, armLen, armW, vest ? VEST : JACKET, 12);
      handL = arm(c, axL, shY, -10 - swing, armLen, armW, vest ? VEST : JACKET, 12);
  }

  // clipboard prop
  if (s.pose === "clipboard") {
    const [hx, hy] = handR;
    c.save();
    c.translate(hx, hy); c.rotate(face * -0.22);
    c.fillStyle = "#e6dfcf"; c.strokeStyle = INK; c.lineWidth = Math.max(2.5, H * 0.009);
    c.beginPath(); c.rect(-H * 0.055, -H * 0.075, H * 0.11, H * 0.15); c.fill(); c.stroke();
    c.fillStyle = "#8a7f6b"; c.fillRect(-H * 0.03, -H * 0.075, H * 0.06, H * 0.016);
    c.restore();
  }

  // clamp prop
  if (s.pose === "clamp") {
    const [hx, hy] = handR;
    c.strokeStyle = "#9aa3ad"; c.lineWidth = H * 0.018; c.lineCap = "round";
    c.beginPath(); c.moveTo(hx - H * 0.03, hy - H * 0.03); c.lineTo(hx + H * 0.03, hy + H * 0.03); c.stroke();
  }
  void handL;

  // head
  drawHead(c, topX + face * H * 0.012, headCy, headR, s.expr ?? "neutral", face, vest);

  // hard hat
  if (s.who !== "foreman") {
    c.beginPath();
    c.arc(topX + face * H * 0.012, headCy - headR * 0.18, headR * 0.95, Math.PI * 1.02, Math.PI * 1.98);
    c.fillStyle = HAT; c.fill();
    c.strokeStyle = INK; c.lineWidth = Math.max(3, headR * 0.09); c.stroke();
    c.beginPath(); c.ellipse(topX + face * H * 0.012, headCy - headR * 0.12, headR * 1.12, headR * 0.17, 0, 0, Math.PI * 2);
    c.fillStyle = HAT_RIM; c.fill(); c.stroke();
  } else {
    // foreman: cap
    c.beginPath();
    c.ellipse(topX + face * H * 0.012, headCy - headR * 0.42, headR * 0.92, headR * 0.5, 0, Math.PI, Math.PI * 2);
    c.fillStyle = "#3b3f47"; c.fill(); c.strokeStyle = INK; c.lineWidth = Math.max(3, headR * 0.09); c.stroke();
    c.beginPath();
    c.moveTo(topX + face * headR * 0.3, headCy - headR * 0.44);
    c.lineTo(topX + face * headR * 1.25, headCy - headR * 0.36);
    c.lineTo(topX + face * headR * 1.2, headCy - headR * 0.26);
    c.closePath(); c.fillStyle = "#2f333a"; c.fill(); c.stroke();
  }
};

/** Per-shot actor direction. Authored so that every beat has somebody acting, not an empty set. */
export type Beat = { t0: number; t1: number; actors: (t: number) => ActorSpec[] };

export const BEATS: Beat[] = [
  { t0: 0.0, t1: 4.03, actors: () => [] },
  { t0: 4.03, t1: 9.496, actors: () => [
      { who: "crew", x: 0.24, y: 0.90, h: 0.30, face: 1, expr: "stern", pose: "clamp", walk: 1 },
      { who: "crew", x: 0.74, y: 0.90, h: 0.29, face: -1, expr: "neutral", pose: "idle", walk: 1 },
    ] },
  { t0: 9.496, t1: 16.934, actors: () => [
      { who: "mechanic", x: 0.34, y: 0.92, h: 0.36, face: 1, expr: "shock", pose: "point" },
      { who: "foreman", x: 0.70, y: 0.92, h: 0.38, face: -1, expr: "smug", pose: "clipboard" },
    ] },
  { t0: 16.934, t1: 27.626, actors: () => [] },
  { t0: 27.626, t1: 33.982, actors: () => [] },   // macro skin close-up: no actors
  { t0: 33.982, t1: 39.256, actors: () => [
      { who: "foreman", x: 0.30, y: 0.91, h: 0.34, face: 1, expr: "stern", pose: "point" },
      { who: "crew", x: 0.68, y: 0.91, h: 0.31, face: -1, expr: "awe", pose: "lookUp" },
    ] },
  { t0: 39.256, t1: 48.85, actors: () => [
      { who: "mechanic", x: 0.40, y: 0.93, h: 0.33, face: 1, expr: "sad", pose: "idle" },
    ] },
  { t0: 48.85, t1: 54.24, actors: () => [] },
  { t0: 54.24, t1: 57.19, actors: () => [] },    // macro skin close-up: no actors
  { t0: 57.19, t1: 999, actors: () => [
      { who: "mechanic", x: 0.32, y: 0.92, h: 0.34, face: 1, expr: "grin", pose: "wave" },
      { who: "crew", x: 0.68, y: 0.92, h: 0.32, face: -1, expr: "grin", pose: "wave" },
    ] },
];

export const actorsAt = (t: number): ActorSpec[] =>
  BEATS.find((b) => t >= b.t0 && t < b.t1)?.actors(t) ?? [];