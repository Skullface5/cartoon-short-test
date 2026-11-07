// SR-71 "leaky tank" sets: four self-contained low-poly environments, used one per shot. 1 unit = 1 m, ground near
// y = 0. Everything is generated here (no GLB, no textures off disk): shapes are plain BufferGeometry, patterns are
// canvases. No lights and no post — the composition owns the rig and the ink / grade pass, so colour is baked into
// the materials. update(t) is a pure function of t: same t -> same frame, no accumulation, no Math.random, so shots
// can be rendered out of order and the cloud layers tile without a seam.
import * as THREE from "three";

export interface Env {
  group: THREE.Group;      // add this to the scene
  update(t: number): void; // t = seconds; animate glow, shimmer, drip, etc.
  dispose?(): void;
}

// ---------------- palette: one family, so the four shots cut together ----------------
const TI_BLACK = "#14161a";   // deepest titanium, panel roots and shadow lines
const TI_DARK = "#1b1e23";    // panel face
const TI_MID = "#2a2d33";     // lit edges, hardware
const CONCRETE = "#6b625a";   // apron
const CONCRETE_SOOT = "#3d3934";
const SODIUM = "#ffb043";     // work lights
const FUEL = "#c9791f";       // jet fuel, the one accent
const SKY_LOW = "#3a4a63";
const SKY_HIGH = "#1b2436";

// ---------------- deterministic helpers ----------------
type Rnd = () => number;
/** seeded PRNG: same seed -> same world. Nothing in this file calls Math.random. */
const rng = (seed: number): Rnd => {
  let s = (seed * 9301 + 49297) % 233280 || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
};
const U = (r: Rnd, a: number, b: number) => a + (b - a) * r();
const TAU = Math.PI * 2;

/** canvas texture, sRGB, repeating */
const ctex = (w: number, h: number, draw: (g: CanvasRenderingContext2D, r: Rnd) => void, seed = 7) => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  draw(cv.getContext("2d")!, rng(seed));
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
};

/**
 * CEL SHADING. A 4-step nearest-filtered ramp makes MeshToonMaterial band the light into flat
 * steps instead of a smooth PBR falloff. That banding is what lets flat 2D characters sit inside
 * the set without looking pasted on - the world stops being "realistic dark" and becomes graphic.
 */
const RAMP = (() => {
  const steps = new Uint8Array([78, 132, 190, 255]);
  const t = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();

/** MeshToonMaterial ignores roughness/metalness, so drop them rather than let three warn. */
const celParams = (o: Record<string, unknown>) => {
  const rest: Record<string, unknown> = { ...o };
  delete rest.roughness; delete rest.metalness;
  return rest;
};

/** matte prop: banded, flat-faceted, no specular */
const matte = (color: string, o: Record<string, unknown> = {}) =>
  new THREE.MeshToonMaterial({ color, gradientMap: RAMP, flatShading: true, ...celParams(o) } as THREE.MeshToonMaterialParameters);

/** airframe skin: same banding, one step brighter so panels separate from props */
const metal = (color: string, o: Record<string, unknown> = {}) =>
  new THREE.MeshToonMaterial({ color, gradientMap: RAMP, flatShading: true, ...celParams(o) } as THREE.MeshToonMaterialParameters);

const box = (w: number, h: number, d: number, m: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (rt: number, rb: number, h: number, seg: number, m: THREE.Material, open = false) =>
  new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), m);
const put = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): T => {
  o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o;
};

/** free everything this env owns (materials + their maps + geometries) */
const disposeTree = (root: THREE.Object3D) => root.traverse((o) => {
  const mesh = o as THREE.Mesh;
  if (mesh.geometry) mesh.geometry.dispose();
  const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
  for (const m of mats) {
    const sm = m as THREE.MeshStandardMaterial;
    for (const t of [sm.map, sm.emissiveMap, sm.alphaMap]) t?.dispose();
    const sprite = m as THREE.SpriteMaterial;
    (sprite.map as THREE.Texture | null | undefined)?.dispose();
    m.dispose();
  }
});

// ---------------- painted textures ----------------
/** run fn at x and again a tile over when the stroke crosses the right edge (seamless in x) */
const wrapX = (W: number, x: number, w: number, fn: (x: number) => void) => {
  fn(x);
  if (x + w > W) fn(x - W);
  if (x < 0) fn(x + W);
};
/** scattered mark of radius rad, drawn at every wrap so the tile repeats */
const wrap2 = (W: number, H: number, x: number, y: number, rad: number, fn: (x: number, y: number) => void) => {
  for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) {
    const X = x + ox, Y = y + oy;
    if (X + rad > 0 && X - rad < W && Y + rad > 0 && Y - rad < H) fn(X, Y);
  }
};

/** Apron concrete: 1024 px = 8 m (4 m slabs, 128 px/m). Joint lines, tone drift, grit, cracks, optional oil. */
const concreteTex = (seed: number, oil = 0) => ctex(1024, 1024, (g, r) => {
  const S = 1024;
  g.fillStyle = CONCRETE; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 54; i++) { // broad tone drift: sun-bleached and soot-dark patches
    const x = U(r, 0, S), y = U(r, 0, S), rad = U(r, 60, 260), light = r() > 0.55;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, light ? "rgba(158,150,140,0.22)" : "rgba(58,52,47,0.24)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 5200; i++) { // grit
    const x = U(r, 0, S), y = U(r, 0, S), s = U(r, 0.6, 2.1), dark = r() < 0.55;
    g.fillStyle = dark ? `rgba(52,47,42,${U(r, 0.2, 0.45)})` : `rgba(190,182,170,${U(r, 0.15, 0.4)})`;
    g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
  }
  for (let i = 0; i < 7; i++) { // hairline cracks
    let x = U(r, 0, S), y = U(r, 0, S);
    g.strokeStyle = "rgba(48,44,40,0.55)"; g.lineWidth = U(r, 1, 2); g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 7; k++) { x += U(r, -34, 34); y += U(r, 8, 40); g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 5; i++) { // tyre scuffs: long soft arcs
    const x = U(r, 0, S), y = U(r, 0, S), rad = U(r, 180, 420);
    g.strokeStyle = `rgba(40,36,33,${U(r, 0.1, 0.2)})`; g.lineWidth = U(r, 10, 26); g.lineCap = "round";
    g.beginPath(); g.arc(x, y, rad, U(r, 0, 2), U(r, 2.5, 4.5)); g.stroke();
  }
  if (oil > 0) for (let i = 0; i < oil; i++) { // old oil / fuel spills, soft edged and darker than the slab
    const x = U(r, 30, S - 30), y = U(r, 30, S - 30), rad = U(r, 26, 80);
    const gr = g.createRadialGradient(x, y, rad * 0.15, x, y, rad);
    gr.addColorStop(0, "rgba(24,21,19,0.75)"); gr.addColorStop(0.55, "rgba(34,29,25,0.5)"); gr.addColorStop(1, "rgba(40,34,30,0)");
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rad * U(r, 1.1, 1.7), rad * U(r, 0.7, 1.05), U(r, 0, 3), 0, TAU); g.fill();
    g.fillStyle = "rgba(201,121,31,0.10)"; g.beginPath(); g.ellipse(x - rad * 0.2, y - rad * 0.2, rad * 0.5, rad * 0.3, 0, 0, TAU); g.fill();
  }
  // slab joints last, on the tile edge and through the middle: dark core + a lit lip on one side
  for (const p of [0, 512]) for (const [q, w] of [[p, 9], [(p + 512) % 1024, 9]] as const) {
    const x = q === 0 ? -w / 2 : q - w / 2;
    g.fillStyle = "rgba(38,34,31,0.85)"; g.fillRect(x, 0, w, S); g.fillRect(0, x, S, w);
    g.fillStyle = "rgba(180,172,160,0.35)"; g.fillRect(x + w, 0, 2, S); g.fillRect(0, x + w, S, 2);
  }
}, seed);

/** Airframe skin: 1024 px = 4 m. Brushed titanium, panel lines, rivet rows, scuffs, a faint fuel weep. */
const titaniumTex = (seed: number, panels: boolean, weep = false) => ctex(1024, 1024, (g, r) => {
  const S = 1024;
  g.fillStyle = TI_MID; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) { // brushed streaks
    const x = U(r, 0, S), y = U(r, 0, S), w = U(r, 40, 340), dark = r() < 0.5, a = U(r, 0.05, 0.15);
    g.strokeStyle = dark ? `rgba(9,10,13,${a})` : `rgba(160,168,180,${a * 0.6})`;
    g.lineWidth = U(r, 0.6, 2.4);
    wrapX(S, x, w, (xx) => { g.beginPath(); g.moveTo(xx, y); g.lineTo(xx + w, y + U(r, -1.5, 1.5)); g.stroke(); });
  }
  for (let i = 0; i < 16; i++) { // ground-in dust clouds
    const x = U(r, 0, S), y = U(r, 0, S), rad = U(r, 50, 190);
    wrap2(S, S, x, y, rad, (xx, yy) => {
      const gr = g.createRadialGradient(xx, yy, 0, xx, yy, rad);
      gr.addColorStop(0, `rgba(12,13,16,${U(r, 0.08, 0.16)})`); gr.addColorStop(1, "rgba(12,13,16,0)");
      g.fillStyle = gr; g.fillRect(xx - rad, yy - rad, rad * 2, rad * 2);
    });
  }
  if (panels) {
    for (let i = 0; i < 5; i++) { // panel seams: dark hairline + a lit lip, staggered
      const y = (i + 0.5) * (S / 5) + U(r, -14, 14);
      g.fillStyle = "rgba(8,9,12,0.85)"; g.fillRect(0, y, S, 3);
      g.fillStyle = "rgba(120,128,140,0.35)"; g.fillRect(0, y + 3, S, 1.5);
      for (let k = 0; k < 3; k++) { // panel breaks across
        const x = U(r, 0, S);
        g.fillStyle = "rgba(8,9,12,0.75)"; g.fillRect(x, y - S / 5, 3, S / 5);
      }
      for (let x = 12; x < S; x += 26) { // rivet row under each seam
        g.fillStyle = "rgba(10,11,14,0.55)"; g.beginPath(); g.arc(x, y + 10, 2.6, 0, TAU); g.fill();
        g.fillStyle = "rgba(150,158,170,0.30)"; g.beginPath(); g.arc(x - 0.9, y + 9.2, 1.1, 0, TAU); g.fill();
      }
    }
  }
  if (weep) { // a dark fuel weep running down the skin, with a warm edge where it thins out
    for (let i = 0; i < 3; i++) {
      const x = U(r, 120, S - 120), w = U(r, 10, 30), y0 = U(r, 0, S * 0.5), h = U(r, 180, 420);
      const gr = g.createLinearGradient(0, y0, 0, y0 + h);
      gr.addColorStop(0, "rgba(12,12,14,0.5)"); gr.addColorStop(0.6, "rgba(20,18,16,0.32)"); gr.addColorStop(1, "rgba(24,20,16,0)");
      g.fillStyle = gr; g.fillRect(x, y0, w, h);
      g.fillStyle = "rgba(201,121,31,0.18)"; g.fillRect(x + w * 0.35, y0, w * 0.3, h * 0.8);
    }
  }
}, seed);

/** radial amber glow: lamp sprites and the pools they throw on the apron */
const glowTex = () => ctex(256, 256, (g) => {
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.22, "rgba(255,255,255,0.55)");
  gr.addColorStop(0.55, "rgba(255,255,255,0.14)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
}, 3);

/** heat shimmer: soft horizontal bands with a sine ripple, seamless in x (offset.x scrolls it) */
const shimmerTex = (seed: number) => ctex(512, 256, (g, r) => {
  g.clearRect(0, 0, 512, 256);
  g.filter = "blur(5px)";
  for (let i = 0; i < 22; i++) {
    const y = U(r, 0, 256), h = U(r, 4, 13), a = U(r, 0.08, 0.30), k = U(r, 1.5, 4), ph = U(r, 0, TAU);
    const gr = g.createLinearGradient(0, y - h, 0, y + h);
    gr.addColorStop(0, "rgba(255,255,255,0)");
    gr.addColorStop(0.5, `rgba(255,255,255,${a})`);
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.beginPath();
    for (let x = 0; x <= 512; x += 16) g.lineTo(x, y + Math.sin((x / 512) * TAU * k + ph) * 5);
    for (let x = 512; x >= 0; x -= 16) g.lineTo(x, y + h + Math.sin((x / 512) * TAU * k + ph) * 5);
    g.closePath(); g.fill();
  }
  g.filter = "none";
}, seed);

/** cloud sea seen from above: one 1024 tile, soft puffs with lit crowns, alpha fades out at the rim */
const cloudBankTex = (seed: number, fade = 1) => ctex(1024, 1024, (g, r) => {
  const S = 1024;
  g.clearRect(0, 0, S, S);
  // 0. far haze floor so the sea reads solid at the horizon
  g.fillStyle = "rgba(150,158,172,0.30)"; g.fillRect(0, 0, S, S);
  const puff = (x: number, y: number, rad: number, lit: number) => {
    const gr = g.createRadialGradient(x - rad * 0.22, y - rad * 0.3, rad * 0.1, x, y, rad);
    gr.addColorStop(0, `rgba(226,230,236,${0.85 * lit})`);
    gr.addColorStop(0.55, "rgba(178,186,199,0.55)");
    gr.addColorStop(1, "rgba(120,128,143,0)");
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
  };
  for (let i = 0; i < 150; i++) {
    const x = U(r, 0, S), y = U(r, 0, S), rad = U(r, 26, 105), lit = U(r, 0.5, 1);
    const ox = [0, -S, S], oy = [0, -S, S];
    for (const a of ox) for (const b of oy) if (x + a > -140 && x + a < S + 140 && y + b > -140 && y + b < S + 140) puff(x + a, y + b, rad, lit);
  }
  if (fade > 0) { // radial alpha ramp: the disc melts into the sky instead of ending on an edge
    g.globalCompositeOperation = "destination-in";
    const gr = g.createRadialGradient(S / 2, S / 2, S * 0.22, S / 2, S / 2, S * 0.52);
    gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(0.72, "rgba(0,0,0,0.75)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = "source-over";
  }
}, seed);

/** flat fuel film: dark, wet, with a warm rim — used on puddles and inside drip trays */
const fuelTex = (seed: number) => ctex(512, 512, (g, r) => {
  g.fillStyle = "#211d19"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 22; i++) { // slow swirls in the film
    const x = U(r, 0, 512), y = U(r, 0, 512), rad = U(r, 40, 170);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(201,121,31,${U(r, 0.08, 0.24)})`); gr.addColorStop(1, "rgba(201,121,31,0)");
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 40; i++) { // thin bright films, thin dark folds
    const y = U(r, 0, 512), w = U(r, 30, 200), dark = r() < 0.55;
    g.strokeStyle = dark ? `rgba(8,7,6,${U(r, 0.2, 0.45)})` : `rgba(214,150,70,${U(r, 0.08, 0.22)})`;
    g.lineWidth = U(r, 1, 4);
    wrapX(512, U(r, 0, 512), w, (xx) => {
      g.beginPath(); g.moveTo(xx, y); g.quadraticCurveTo(xx + w / 2, y + U(r, -12, 12), xx + w, y); g.stroke();
    });
  }
}, seed);

// ---------------- shared geometry ----------------
/** dusk dome: vertex-coloured sphere, no shader, drawn behind everything. `rim` lifts the last few degrees
 *  above the horizon, where a flat sky reads dead in a vertical frame. */
const skyDome = (radius: number, low = SKY_LOW, mid = SKY_HIGH, high = "#070a10", rim = "#55647e", below = "#6e7a8b") => {
  const geo = new THREE.SphereGeometry(radius, 36, 22);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const c0 = new THREE.Color(low), c1 = new THREE.Color(mid), c2 = new THREE.Color(high), cr = new THREE.Color(rim), cb = new THREE.Color(below), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / radius; // -1 .. 1
    if (y < 0) c.copy(c0).lerp(cb, Math.min(1, -y * 3.2)); // below the horizon: haze, no hard seam
    else if (y < 0.26) c.copy(c0).lerp(c1, (y / 0.26) ** 0.8);
    else c.copy(c1).lerp(c2, Math.min(1, (y - 0.26) / 0.62));
    if (y > -0.03 && y < 0.07) c.lerp(cr, 0.55 * (1 - Math.abs(y - 0.02) / 0.05)); // horizon band
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false }));
  m.renderOrder = -1;
  m.frustumCulled = false;
  return m;
};

/** thin flat strip lying in the xz plane, length along its local x (shimmer over a leading edge etc.) */
const flatStrip = (len: number, w: number, m: THREE.Material) => {
  const g = new THREE.PlaneGeometry(len, w);
  g.rotateX(-Math.PI / 2);
  return new THREE.Mesh(g, m);
};

/** irregular flat puddle outline, seeded: a lumpy closed shape, not a circle */
const blobGeom = (rad: number, seed: number, squash = 0.8) => {
  const rr = rng(seed), n = 16, pts: THREE.Vector2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, k = 0.6 + rr() * 0.55;
    pts.push(new THREE.Vector2(Math.cos(a) * rad * k, Math.sin(a) * rad * k * squash));
  }
  const g = new THREE.ShapeGeometry(new THREE.Shape(pts));
  g.rotateX(-Math.PI / 2);
  return g;
};

// ===============================================================================================================
// 1. dusk apron: concrete slabs, hangar silhouettes, sodium work lights, heat haze off the ramp
// ===============================================================================================================
export function hangarApron(): Env {
  const group = new THREE.Group();
  group.add(skyDome(420));

  // ---- ground ----
  const conc = concreteTex(19, 0);
  conc.repeat.set(42, 42); // 400 m / 42 -> 9.5 m per tile: 4 m slabs read at roughly true size
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), matte("#ffffff", { map: conc, roughness: 0.96, metalness: 0.04, flatShading: false }));
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  // a darker apron band further out, so the ground does not read as one flat sheet to the horizon
  const far = new THREE.Mesh(new THREE.PlaneGeometry(400, 220), matte("#5a534c", { roughness: 1, flatShading: false }));
  far.rotation.x = -Math.PI / 2;
  far.position.set(0, 0.004, -290);
  group.add(far);

  // ---- painted apron markings: a lead-in line running away under the frame, a taxiway crossing, a stop bar
  // and dashes carrying on to the hangar. Lines only, no lettering anywhere on the set ----
  const paintM = new THREE.MeshStandardMaterial({ color: "#a8862c", roughness: 0.95, metalness: 0.02, transparent: true, opacity: 0.78, depthWrite: false });
  const paint = (x: number, z: number, w: number, len: number, yaw = 0) => {
    const g = new THREE.PlaneGeometry(w, len);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, paintM);
    m.position.set(x, 0.015, z);
    m.rotation.y = yaw;
    return m;
  };
  group.add(paint(-4.2, -12, 0.45, 96));       // lead-in line
  group.add(paint(0, -26, 130, 0.42));         // taxiway crossing the frame
  group.add(paint(0, -50, 30, 0.5));           // stop bar
  group.add(paint(7.2, -68, 0.42, 26, 0.2));   // angled lead-in toward the doors
  for (let i = 0; i < 6; i++) group.add(paint(-4.2, -62 - i * 5.4, 0.45, 3.4)); // dashes on to the hangar

  // ---- distant hangars: low-poly boxes under half-cylinder arches, doors dark with a warm strip above ----
  const bodyM = matte(TI_DARK, { roughness: 0.95, metalness: 0.08 });
  const roofM = matte("#191b20", { roughness: 0.9, metalness: 0.15 });
  const doorM = matte("#0c0e11", { roughness: 0.95, metalness: 0.05 });
  const litM = new THREE.MeshStandardMaterial({ color: "#3a2a18", emissive: SODIUM, emissiveIntensity: 1.6, roughness: 0.9 });
  const hangar = (x: number, z: number, w: number, h: number, d: number, yaw: number) => {
    const g = new THREE.Group();
    const body = box(w, h, d, bodyM);
    body.position.y = h / 2;
    g.add(body);
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(d / 2, d / 2, w, 12, 1, true, 0, Math.PI), roofM);
    arch.rotation.z = Math.PI / 2; // tube along x, arch bulging +y
    arch.position.y = h;
    g.add(arch);
    // door: a dark recess with the frame in front, one warm strip light over it
    const door = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.62, h * 0.78), doorM);
    door.position.set(0, h * 0.39, d / 2 + 0.06);
    g.add(door);
    const strip = box(w * 0.5, 0.22, 0.14, litM);
    strip.position.set(0, h * 0.86, d / 2 + 0.14);
    g.add(strip);
    for (const s of [-1, 1]) {
      const jamb = box(0.5, h * 0.8, 0.3, bodyM);
      jamb.position.set(s * w * 0.32, h * 0.4, d / 2 + 0.16);
      g.add(jamb);
    }
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    return g;
  };
  group.add(hangar(-78, -262, 64, 12, 40, 0.05));
  group.add(hangar(4, -286, 82, 14, 46, -0.02));
  group.add(hangar(96, -248, 54, 10, 32, 0.11));

  // control tower silhouette, right of frame: shaft, dark glass box, amber band
  const tower = new THREE.Group();
  const shaft = box(5.4, 17, 5.4, bodyM); shaft.position.y = 8.5; tower.add(shaft);
  const cab = box(7.6, 3.4, 7.6, matte("#22262c", { roughness: 0.7, metalness: 0.3 })); cab.position.y = 18.6; tower.add(cab);
  const band = box(7.7, 0.5, 7.7, litM); band.position.y = 16.9; tower.add(band);
  const mast = cyl(0.12, 0.18, 5, 5, metal(TI_MID), true); mast.position.y = 22.9; tower.add(mast);
  tower.position.set(56, 0, -298);
  group.add(tower);

  // ---- sodium work lights on poles: head, glow, and the pool it throws on the concrete ----
  const glow = glowTex();
  const poleM = matte(TI_MID, { roughness: 0.6, metalness: 0.5 });
  const headM = matte(TI_DARK, { roughness: 0.7, metalness: 0.35 });
  const lensM = new THREE.MeshStandardMaterial({ color: "#2a2d33", emissive: SODIUM, emissiveIntensity: 2.6, roughness: 0.4, metalness: 0.2 });
  const poolM = new THREE.MeshBasicMaterial({ map: glow, color: SODIUM, transparent: true, opacity: 0.30, blending: THREE.AdditiveBlending, depthWrite: false });
  const lamps: { glow: THREE.SpriteMaterial; pool: THREE.MeshBasicMaterial }[] = [];
  const lamp = (x: number, z: number, h: number, yaw: number) => {
    const g = new THREE.Group();
    const pole = cyl(0.13, 0.20, h, 6, poleM); pole.position.y = h / 2; g.add(pole);
    const foot = cyl(0.5, 0.62, 0.3, 8, poleM); foot.position.y = 0.15; g.add(foot);
    const head = box(1.05, 0.3, 0.62, headM);
    head.position.set(0.28, h + 0.1, 0); head.rotation.z = -0.13; g.add(head);
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.42), lensM);
    lens.rotation.x = Math.PI / 2 + 0.13;
    lens.position.set(0.28, h - 0.06, 0);
    g.add(lens);
    const gm = new THREE.SpriteMaterial({ map: glow, color: SODIUM, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    const sp = new THREE.Sprite(gm);
    sp.scale.setScalar(4.6); sp.position.set(0.28, h - 0.1, 0);
    g.add(sp);
    const pm = poolM.clone();
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), pm);
    pool.rotation.x = -Math.PI / 2; pool.position.set(0.28, 0.02, 0);
    g.add(pool);
    lamps.push({ glow: gm, pool: pm });
    g.position.set(x, 0, z); g.rotation.y = yaw;
    return g;
  };
  group.add(lamp(-5.5, -26, 8.4, 0.5));
  group.add(lamp(6.4, -34, 9.2, -0.7));
  group.add(lamp(-11, -56, 8.0, 0.2));
  group.add(lamp(13, -72, 8.8, -0.2));

  // ---- heat haze: soft amber bands standing off the tarmac, scrolling in t ----
  const hazes: { mesh: THREE.Mesh; tex: THREE.Texture; k: number }[] = [];
  for (const [z, y, w, h, k] of [[-58, 1.6, 150, 9, 1], [-84, 2.6, 190, 12, 0.7], [-112, 3.4, 230, 15, 0.5]] as const) {
    const tex = shimmerTex(31 + (k * 10 | 0));
    tex.repeat.set(6, 1);
    const m = new THREE.MeshBasicMaterial({ map: tex, color: SODIUM, transparent: true, opacity: 0.10 * k + 0.03, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    mesh.position.set(0, y + h * 0.32, z);
    group.add(mesh);
    hazes.push({ mesh, tex, k });
  }

  // ---- clutter at the sides, to give the apron a human scale (centre kept clear for the cast) ----
  const drumM = matte("#23272d", { roughness: 0.7, metalness: 0.4 });
  const bandM = matte(FUEL, { roughness: 0.75, metalness: 0.2 });
  const drum = (x: number, z: number, s = 1) => {
    const g = new THREE.Group();
    const body = cyl(0.42 * s, 0.42 * s, 0.92 * s, 10, drumM); body.position.y = 0.46 * s; g.add(body);
    for (const y of [0.3, 0.66]) { const b = cyl(0.435 * s, 0.435 * s, 0.1 * s, 10, bandM); b.position.y = y * s; g.add(b); }
    const lid = cyl(0.42 * s, 0.42 * s, 0.06 * s, 10, drumM); lid.position.y = 0.94 * s; g.add(lid);
    g.position.set(x, 0, z);
    return g;
  };
  group.add(drum(-8.6, 4.2), drum(-7.6, 5.4, 0.95), drum(10.4, -3.2), drum(11.3, -2.0, 0.9));

  const coneM = matte(FUEL, { roughness: 0.8, metalness: 0.1 });
  const cone = (x: number, z: number) => {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.72, 7), coneM); c.position.y = 0.36; g.add(c);
    const base = box(0.5, 0.06, 0.5, matte("#191b20")); base.position.y = 0.03; g.add(base);
    const stripe = cyl(0.15, 0.18, 0.1, 7, matte("#d9d3c6", { roughness: 0.9 })); stripe.position.y = 0.42; g.add(stripe);
    g.position.set(x, 0, z);
    return g;
  };
  for (let i = 0; i < 5; i++) group.add(cone(-5.6 + i * 0.9, 8.4 - i * 0.5));

  // ---- a parked aircraft far off: black, but with the hardware that makes it read as a jet — canopy,
  // engine nacelles, panel lines in the skin — so it is not a smear on the hangar ----
  const jetT = titaniumTex(43, true);
  jetT.repeat.set(3, 1);
  const jetM = metal("#c8ccd2", { map: jetT, roughness: 0.85, metalness: 0.3 });
  const jetDark = matte("#14161a", { roughness: 0.9, metalness: 0.2 });
  const glassM = metal("#37414f", { roughness: 0.14, metalness: 0.95 });
  const parked = new THREE.Group();
  const fus = cyl(1.18, 1.55, 26, 10, jetM); fus.rotation.x = Math.PI / 2; fus.position.y = 2.6; parked.add(fus);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.18, 4.6, 10), jetM);
  nose.rotation.x = -Math.PI / 2; nose.position.set(0, 2.6, -15.3); parked.add(nose);
  const pitot = cyl(0.05, 0.05, 2.2, 5, jetDark); pitot.rotation.x = Math.PI / 2; pitot.position.set(0, 2.6, -18.4); parked.add(pitot);
  // canopy: a long low bubble on the forward fuselage
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), glassM);
  canopy.scale.set(0.78, 0.5, 2.3); canopy.position.set(0, 3.66, -6.6); parked.add(canopy);
  const canopyRail = box(0.22, 0.16, 3.6, jetDark); canopyRail.position.set(0, 3.95, -6.4); parked.add(canopyRail);
  // chines down the fuselage sides
  for (const s of [-1, 1]) {
    const chine = box(0.46, 0.11, 21, jetDark);
    chine.position.set(s * 1.5, 2.45, -1);
    parked.add(chine);
  }
  // wings with a control-surface seam on top
  for (const s of [-1, 1]) {
    const wing = box(14.5, 0.3, 4.4, jetM);
    wing.position.set(s * 7.4, 2.15, 1.2);
    wing.rotation.z = -s * 0.05; wing.rotation.y = -s * 0.22;
    parked.add(wing);
    const seam = box(13.2, 0.05, 0.14, jetDark);
    seam.position.set(s * 7.4, 2.32, 3.05); seam.rotation.y = -s * 0.22;
    parked.add(seam);
  }
  // engine nacelles half-sunk in the wing roots, with inlet cones and dark intakes
  for (const s of [-1, 1]) {
    const nac = cyl(0.74, 0.62, 7.6, 12, jetM);
    nac.rotation.x = Math.PI / 2; nac.position.set(s * 3.05, 1.9, 1.4);
    parked.add(nac);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.7, 9), jetDark);
    cone.rotation.x = -Math.PI / 2; cone.position.set(s * 3.05, 1.9, -2.8); parked.add(cone);
    const intake = new THREE.Mesh(new THREE.CircleGeometry(0.7, 12), matte("#0a0b0e"));
    intake.rotation.y = Math.PI; intake.position.set(s * 3.05, 1.9, -2.35); parked.add(intake);
  }
  // fin with a dark leading edge, and the tailplane
  const fin = box(0.3, 4.2, 3.0, jetM); fin.position.set(0, 4.8, 9.4); fin.rotation.x = -0.25; parked.add(fin);
  const finLE = box(0.34, 4.3, 0.22, jetDark); finLE.position.set(0, 4.85, 7.95); finLE.rotation.x = -0.68; parked.add(finLE);
  const tail = box(7.4, 0.24, 2.2, jetM); tail.position.set(0, 3.0, 10.6); parked.add(tail);
  parked.position.set(13, 0, -118);
  parked.rotation.y = 0.78;
  group.add(parked);

  // ---- apron edge lights: a row of small amber dots on the horizon line ----
  const dotM = new THREE.MeshStandardMaterial({ color: "#2a2118", emissive: SODIUM, emissiveIntensity: 2.2, roughness: 0.6 });
  for (let i = 0; i < 21; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4), dotM);
    d.position.set(-100 + i * 10, 0.5, -104);
    group.add(d);
  }

  return {
    group,
    update(t: number) {
      for (let i = 0; i < lamps.length; i++) { // sodium lamps breathe a little (ballast hum)
        const k = 0.94 + 0.06 * Math.sin(t * 2.3 + i * 1.9);
        lamps[i].glow.opacity = 0.5 * k;
        lamps[i].pool.opacity = 0.30 * k;
      }
      for (let i = 0; i < hazes.length; i++) { // heat haze drifts along its own axis, never accumulates
        const h = hazes[i];
        h.tex.offset.x = ((t * 0.026 * (i + 1)) % 1 + 1) % 1;
        h.tex.offset.y = 0.05 * Math.sin(t * 0.7 + i * 2.1);
        (h.mesh.material as THREE.MeshBasicMaterial).opacity = (0.10 * h.k + 0.03) * (0.85 + 0.15 * Math.sin(t * 0.9 + i));
      }
      dotM.emissiveIntensity = 2.0 + 0.5 * Math.sin(t * 1.4);
    },
    dispose() { disposeTree(group); },
  };
}

// ===============================================================================================================
// 2. ramp deck: ground-level apron under the belly — jack stands, drip trays, buckets, fuel puddles
// ===============================================================================================================
export function rampDeck(): Env {
  const group = new THREE.Group();
  group.add(skyDome(300)); // dusk above the airframe: any gap past the belly reads as sky, never as a void

  // ---- ground: oil-stained concrete ----
  const conc = concreteTex(53, 9);
  conc.repeat.set(17, 17); // 140 m / 17 -> 8.2 m tile
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), matte("#ffffff", { map: conc, roughness: 0.95, metalness: 0.05, flatShading: false }));
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  // ---- hangar behind the jet: dim concrete, steel ribs, one high work light. Without it the space past the
  // stands is empty sky and the set reads unfinished ----
  const wallZ = -58;
  const wallM = matte("#1c2026", { roughness: 0.98, metalness: 0.05 });
  const wall = box(110, 26, 1.4, wallM);
  wall.position.set(0, 13, wallZ);
  group.add(wall);
  const ribM = metal("#282d34", { roughness: 0.72, metalness: 0.4 });
  for (let i = -9; i <= 9; i++) {
    const rib = box(0.75, 26, 0.55, ribM);
    rib.position.set(i * 5.8, 13, wallZ + 0.95);
    group.add(rib);
  }
  const beam = box(110, 0.9, 1.1, ribM); beam.position.set(0, 19.5, wallZ + 0.8); group.add(beam);
  // work light: hung off a rib clear of the belly's silhouette, so it is in shot and lights the back wall
  const lampY = 12.4, lampX = -12.5;
  const lampBody = box(2.6, 0.6, 1.2, metal("#333941", { roughness: 0.6, metalness: 0.5 }));
  lampBody.position.set(lampX, lampY, wallZ + 1.9); group.add(lampBody);
  const lampLens = new THREE.MeshStandardMaterial({ color: "#2a2d33", emissive: SODIUM, emissiveIntensity: 3.4, roughness: 0.4 });
  const lens = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.38), lampLens);
  lens.position.set(lampX, lampY - 0.34, wallZ + 2.52); group.add(lens);
  const lampGlowM = new THREE.SpriteMaterial({ map: glowTex(), color: SODIUM, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const lampGlow = new THREE.Sprite(lampGlowM);
  lampGlow.scale.setScalar(12); lampGlow.position.set(lampX, lampY - 0.4, wallZ + 2.6);
  group.add(lampGlow);
  const lampPool = new THREE.Mesh(new THREE.PlaneGeometry(26, 26),
    new THREE.MeshBasicMaterial({ map: glowTex(), color: SODIUM, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  lampPool.rotation.x = -Math.PI / 2; lampPool.position.set(lampX, 0.02, wallZ + 6);
  group.add(lampPool);

  // ---- the aircraft belly overhead: a nine-metre half tube, lowest point 4.5 m up. Every prop below hangs off
  // bellyY(x), so nothing floats away from the skin ----
  const R = 9, CY = 13.5;
  const bellyY = (x: number) => CY - Math.sqrt(Math.max(0.04, R * R - x * x));
  const skin = titaniumTex(7, true, true);
  skin.repeat.set(10, 1);
  const bellyM = metal("#d2d6dc", { map: skin, roughness: 0.72, metalness: 0.5, side: THREE.DoubleSide, emissive: "#1b1f26", emissiveIntensity: 0.9 });
  const bellyGeo = new THREE.CylinderGeometry(R, R, 96, 20, 1, true, -Math.PI / 2, Math.PI);
  bellyGeo.rotateX(Math.PI / 2); // tube along z, bulging down; long enough to pass through the hangar wall
  const belly = new THREE.Mesh(bellyGeo, bellyM);
  belly.position.set(0, CY, -22);
  group.add(belly);

  // belly hardware: keel strip, two hinged bay doors, an antenna blade
  const hardM = metal(TI_MID, { roughness: 0.6, metalness: 0.55 });
  const keel = box(0.34, 0.14, 30, hardM); keel.position.set(0, bellyY(0) + 0.03, 2); group.add(keel);
  for (const [z, w] of [[3.4, 2.6], [-2.2, 3.2]] as const) {
    const dg = new THREE.CylinderGeometry(R + 0.04, R + 0.04, 5.4, 12, 1, true, -0.22, 0.44);
    dg.rotateX(Math.PI / 2);
    const door = new THREE.Mesh(dg, metal(TI_DARK, { roughness: 0.7, metalness: 0.45, side: THREE.DoubleSide }));
    door.position.set(0, CY, z);
    group.add(door);
    const seam = box(w * 0.02, 0.02, 5.4, hardM); seam.position.set(0, bellyY(0) + 0.01, z);
    group.add(seam);
  }
  const bladeMount = box(0.5, 0.1, 1.5, hardM); bladeMount.position.set(-1.5, bellyY(-1.5) + 0.03, -6); group.add(bladeMount);
  const blade = box(0.12, 0.5, 1.2, hardM); blade.position.set(-1.5, bellyY(-1.5) - 0.2, -6); blade.rotation.x = 0.18; group.add(blade);

  // ---- landing gear leg, the frame's vertical anchor on the right ----
  const gearM = metal("#4b5158", { roughness: 0.55, metalness: 0.6 });
  const gx = 6.2, gy = bellyY(gx);
  const strut = cyl(0.16, 0.19, gy - 0.7, 8, gearM); strut.position.set(gx, (gy + 0.7) / 2, 2.6); strut.rotation.z = 0.05; group.add(strut);
  const trunnion = box(0.44, 0.3, 0.5, gearM); trunnion.position.set(gx, gy - 0.05, 2.6); group.add(trunnion);
  const brace = cyl(0.08, 0.08, 2.6, 6, gearM); brace.position.set(gx - 0.9, gy - 1.1, 2.0); brace.rotation.set(0.2, 0, 0.9); group.add(brace);
  const hub = cyl(0.34, 0.34, 0.34, 10, metal("#6b727a", { roughness: 0.5, metalness: 0.7 }));
  hub.rotation.z = Math.PI / 2; hub.position.set(gx + 0.18, 0.66, 2.6); group.add(hub);
  const tyre = cyl(0.64, 0.64, 0.42, 14, matte("#15161a", { roughness: 0.95, metalness: 0.05 }));
  tyre.rotation.z = Math.PI / 2; tyre.position.set(gx + 0.18, 0.66, 2.6); group.add(tyre);

  // ---- jack stands: post, three splayed feet, saddle up against the skin ----
  const jackM = metal("#3c424a", { roughness: 0.6, metalness: 0.55 });
  const warnM = matte(FUEL, { roughness: 0.8, metalness: 0.15 });
  const jack = (x: number, z: number) => {
    const surfY = bellyY(x);
    const slope = Math.atan(x / Math.sqrt(Math.max(0.04, R * R - x * x))); // tangent of the skin at this station
    const h = surfY - 0.06;
    const g = new THREE.Group();
    const post = box(0.2, h, 0.2, jackM); post.position.y = h / 2; g.add(post);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + 0.4;
      const leg = box(0.13, 0.13, 1.5, jackM);
      leg.position.set(Math.cos(a) * 0.62, 0.3, Math.sin(a) * 0.62);
      leg.rotation.y = -a + Math.PI / 2;
      leg.rotation.x = Math.atan2(1.0, 1.3);
      g.add(leg);
      const foot = box(0.3, 0.1, 0.3, jackM);
      foot.position.set(Math.cos(a) * 1.18, 0.05, Math.sin(a) * 1.18);
      g.add(foot);
    }
    // head tilted to the local tangent: the pad face lies on the belly instead of butting one point of it
    const head = new THREE.Group();
    head.position.set(0, surfY - 0.045, 0);
    head.rotation.z = slope;
    const saddle = box(0.62, 0.12, 0.62, jackM); head.add(saddle);
    const pad = cyl(0.3, 0.3, 0.08, 10, matte("#141519", { roughness: 0.95 })); pad.position.y = 0.07; head.add(pad);
    g.add(head);
    const band = box(0.24, 0.24, 0.24, warnM); band.position.y = h * 0.5; g.add(band);
    g.position.set(x, 0, z);
    return g;
  };
  group.add(jack(-2.8, 5.2), jack(2.6, -2.6), jack(-1.4, -7.4));

  // ---- drip trays + their fuel pools ----
  const trayM = metal("#4a5057", { roughness: 0.7, metalness: 0.4 });
  const fuelM = matte("#2a221a", { roughness: 0.22, metalness: 0.55 });
  const fuelT = fuelTex(29);
  fuelT.repeat.set(2, 2);
  const pools: THREE.Mesh[] = [];
  const tray = (x: number, z: number, w: number, d: number, seed: number) => {
    const g = new THREE.Group();
    const base = box(w, 0.14, d, trayM); base.position.y = 0.07; g.add(base);
    for (const [bw, bd, px, pz] of [[w, 0.12, 0, -d / 2], [w, 0.12, 0, d / 2], [0.12, d, -w / 2, 0], [0.12, d, w / 2, 0]] as const) {
      const rim = box(bw, 0.26, bd, trayM);
      rim.position.set(px, 0.16, pz);
      g.add(rim);
    }
    const pg = blobGeom(Math.min(w, d) * 0.42, seed, 0.62);
    const pool = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: fuelT, color: FUEL, roughness: 0.18, metalness: 0.6, transparent: true, opacity: 0.82 }));
    pool.position.y = 0.145;
    pool.scale.set(w / (Math.min(w, d) * 0.84), 1, d / (Math.min(w, d) * 0.84));
    g.add(pool);
    pools.push(pool);
    g.position.set(x, 0, z);
    return g;
  };
  group.add(tray(1.35, 3.2, 1.7, 1.05, 5), tray(-1.1, 5.4, 1.2, 0.85, 9));

  // ---- puddles on the slab: a wet dark rim and a thinner fuel film floating on it ----
  const pud = (x: number, z: number, rad: number, seed: number) => {
    const g = new THREE.Group();
    const wet = new THREE.Mesh(blobGeom(rad, seed, 0.72), new THREE.MeshStandardMaterial({ color: "#241f1b", roughness: 0.2, metalness: 0.4 }));
    wet.position.y = 0.006;
    g.add(wet);
    const film = new THREE.Mesh(blobGeom(rad * 0.72, seed + 1, 0.78),
      new THREE.MeshStandardMaterial({ map: fuelT, color: FUEL, roughness: 0.12, metalness: 0.65, transparent: true, opacity: 0.55, depthWrite: false }));
    film.position.y = 0.012;
    g.add(film);
    pools.push(film);
    g.position.set(x, 0, z);
    return g;
  };
  group.add(pud(-0.75, 1.4, 1.05, 3), pud(1.55, 0.15, 0.8, 11), pud(-1.3, -1.6, 0.9, 17), pud(1.9, 4.5, 0.65, 23));

  // ---- buckets: one upright with fuel in it, one on its side ----
  const bucketM = metal("#3b4148", { roughness: 0.65, metalness: 0.45 });
  const bucket = (x: number, z: number, yaw: number, tipped: boolean) => {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.14, 0.37, 10, 1, true), bucketM);
    shell.position.y = 0.185; g.add(shell);
    const bottom = cyl(0.14, 0.14, 0.02, 10, bucketM); bottom.position.y = 0.01; g.add(bottom);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.012, 4, 12), bucketM);
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.37; g.add(rim);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.01, 4, 10, Math.PI), bucketM);
    handle.position.y = 0.37; g.add(handle);
    if (!tipped) {
      const fuel = new THREE.Mesh(new THREE.CircleGeometry(0.16, 10), new THREE.MeshStandardMaterial({ map: fuelT, color: FUEL, roughness: 0.15, metalness: 0.6 }));
      fuel.rotation.x = -Math.PI / 2; fuel.position.y = 0.33; g.add(fuel);
    }
    g.position.set(x, tipped ? 0.17 : 0, z);
    g.rotation.set(tipped ? Math.PI / 2 : 0, yaw, tipped ? 0.5 : 0);
    return g;
  };
  group.add(bucket(1.55, 4.6, 0.3, false), bucket(-1.35, 2.6, -0.5, false), bucket(0.95, 1.7, 1.1, true));

  // ---- drips: beads leaving the belly seam, falling into the tray, splash rings on landing ----
  type Drip = { bead: THREE.Mesh; ring: THREE.Mesh; x: number; y0: number; z: number; y1: number; period: number; off: number };
  const beadM = new THREE.MeshStandardMaterial({ color: FUEL, roughness: 0.15, metalness: 0.35, transparent: true, opacity: 0.95 });
  const ringM = new THREE.MeshBasicMaterial({ color: "#e2a25a", transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
  const drips: Drip[] = [];
  const drip = (x: number, z: number, y1: number, period: number, off: number) => {
    const bead = new THREE.Mesh(new THREE.IcosahedronGeometry(0.042, 1), beadM);
    group.add(bead);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.055, 12), ringM.clone());
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y1 + 0.005, z);
    group.add(ring);
    drips.push({ bead, ring, x, y0: bellyY(x) - 0.04, z, y1, period, off });
  };
  drip(1.35, 3.15, 0.17, 1.7, 0);
  drip(1.75, 3.35, 0.17, 2.3, 0.9);
  drip(-1.05, 5.35, 0.17, 2.9, 1.7);

  return {
    group,
    update(t: number) {
      for (const d of drips) {
        const u = (((t + d.off) % d.period) + d.period) % d.period / d.period; // 0..1, pure in t
        const hang = 0.16, fall = 0.42;
        if (u < hang) { // swelling on the seam, stretching before it lets go
          const k = u / hang;
          d.bead.visible = true;
          d.bead.position.set(d.x, d.y0 - 0.03 - 0.05 * k, d.z);
          d.bead.scale.set(0.7 + 0.5 * k, 0.9 + 1.5 * k, 0.7 + 0.5 * k);
          d.bead.rotation.set(0, 0, 0);
          d.ring.scale.setScalar(0.01);
        } else if (u < hang + fall) { // falling, accelerating
          const k = (u - hang) / fall;
          d.bead.visible = true;
          d.bead.position.set(d.x, d.y0 - 0.08 - (d.y0 - 0.08 - d.y1) * k ** 1.7, d.z);
          d.bead.scale.set(0.9 - 0.25 * k, 1.5 - 0.5 * k, 0.9 - 0.25 * k);
          d.ring.scale.setScalar(0.01);
        } else { // landed: a ring spreads and dies, the bead is gone
          const k = (u - hang - fall) / (1 - hang - fall);
          d.bead.visible = false;
          d.ring.scale.setScalar(1 + 7 * k);
          (d.ring.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k) ** 2;
        }
      }
      for (let i = 0; i < pools.length; i++) { // wet films catch the light unevenly
        const m = pools[i].material as THREE.MeshStandardMaterial;
        m.opacity = (i < 2 ? 0.78 : 0.5) + 0.06 * Math.sin(t * 1.7 + i * 2.3);
      }
    },
    dispose() { disposeTree(group); },
  };
}

// ===============================================================================================================
// 3. altitude: gradient sky, cloud sea far below, the wing (and nacelle) passing through frame, LE heat shimmer
// ===============================================================================================================
export function altitudeSky(): Env {
  const group = new THREE.Group();

  // ---- sky: a pale, cold band at the horizon draining to near-black overhead. At 80,000 ft there is almost no
  // air left above the aircraft, so the gradient carries the height and the deck sits far below ----
  group.add(skyDome(900, "#93a5b9", "#141d2c", "#04060a", "#c9d0da"));

  // ---- stars: only well up the dome, dim and sparse ----
  const rr = rng(101), sp: number[] = [];
  for (let i = 0; i < 200; i++) {
    const a = U(rr, 0, TAU), el = Math.asin(U(rr, 0.32, 1)), r = 820;
    sp.push(Math.cos(a) * Math.cos(el) * r, Math.sin(el) * r, Math.sin(a) * Math.cos(el) * r);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
  group.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: "#8892a4", size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0.45, depthWrite: false })));

  // ---- cloud sea: three decks, each fading out at its own rim, so nothing ends on a hard edge. The far deck is
  // pale and low-contrast (air between us and it), the near one darker and crisper: that tonal stack is the depth
  // cue, and it keeps the space under the wing open air rather than a wall ----
  const deck = (rad: number, y: number, tex: THREE.Texture, tint: string, order: number, z: number) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(rad, 64),
      new THREE.MeshBasicMaterial({ map: tex, color: tint, transparent: true, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, y, z);
    m.renderOrder = order;
    return m;
  };
  group.add(deck(1600, -172, cloudBankTex(67), "#e6ecf4", 1, -80));
  group.add(deck(700, -104, cloudBankTex(83), "#c2ccdb", 2, -120));
  group.add(deck(320, -56, cloudBankTex(95), "#9aa8bb", 3, 20));

  // ---- cloud tops in real geometry, three depth bands, for parallax under the wing ----
  const cloudM = matte("#c2cbd8", { roughness: 1, metalness: 0, flatShading: true, emissive: "#3d4654", emissiveIntensity: 0.35 });
  const cr = rng(211);
  for (let i = 0; i < 15; i++) {
    const cl = new THREE.Group();
    const n = 3 + Math.floor(cr() * 4);
    for (let k = 0; k < n; k++) {
      const rad = U(cr, 9, 20);
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(rad, 1), cloudM);
      s.position.set(U(cr, -1.3, 1.3) * rad, U(cr, -0.25, 0.15) * rad, U(cr, -1.1, 1.1) * rad);
      s.scale.set(1.4, 0.5, 1.2);
      cl.add(s);
    }
    const band = i % 3; // -36 m, -78 m, -120 m
    cl.position.set(U(cr, -230, 230), -(36 + band * 42) - U(cr, 0, 9), -U(cr, 70, 360));
    group.add(cl);
  }

  // ---- the wing: a clean matte-black delta, knife-edge leading edge, slight dihedral. Forward is -z. ----
  const wingM = metal("#15171c", { roughness: 0.92, metalness: 0.16, side: THREE.DoubleSide });
  const rootLE = -3.0, rootTE = 4.8, tipLE = 9.5, tipTE = 12.8, span = 26;
  const y0 = -2.0, y1 = -1.3, th0 = 0.28, th1 = 0.1;
  const v = [
    0, y0 + th0 / 2, rootLE, 0, y0 + th0 / 2, rootTE, span, y1 + th1 / 2, tipTE, span, y1 + th1 / 2, tipLE,
    0, y0 - th0 / 2, rootLE, 0, y0 - th0 / 2, rootTE, span, y1 - th1 / 2, tipTE, span, y1 - th1 / 2, tipLE,
  ];
  const idx = [
    0, 1, 2, 0, 2, 3,            // top
    4, 6, 5, 4, 7, 6,            // bottom
    0, 3, 7, 0, 7, 4,            // leading edge (knife)
    1, 5, 6, 1, 6, 2,            // trailing edge
    0, 4, 5, 0, 5, 1,            // root cap
    3, 2, 6, 3, 6, 7,            // tip cap
  ];
  const wg = new THREE.BufferGeometry();
  wg.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  wg.setIndex(idx);
  wg.computeVertexNormals();
  group.add(new THREE.Mesh(wg, wingM));

  const yTop = (x: number) => y0 + (y1 - y0) * (x / span) + (th0 + (th1 - th0) * (x / span)) / 2;
  const leLen = Math.hypot(span, tipLE - rootLE);
  const leYaw = -Math.atan2(tipLE - rootLE, span);

  // thin warm rim riding the leading edge: the one hot line in an otherwise black silhouette
  const rimM = new THREE.MeshStandardMaterial({ color: "#3a1d09", emissive: "#ff8f3a", emissiveIntensity: 0.9, roughness: 0.5, metalness: 0.2 });
  const rim = box(leLen, 0.05, 0.09, rimM);
  rim.position.set(span / 2, (y0 + y1) / 2, (rootLE + tipLE) / 2);
  rim.rotation.y = leYaw;
  group.add(rim);

  // wingtip cap and a flap hinge line so the surface is not one empty plate
  const tipCap = box(0.14, 0.3, th1 * 4 + 1.6, metal("#22262c", { roughness: 0.8, metalness: 0.3 }));
  tipCap.position.set(span, y1 - 0.04, (tipLE + tipTE) / 2);
  group.add(tipCap);
  const hinge = box(span * 0.94, 0.05, 0.08, metal("#1d2127", { roughness: 0.85, metalness: 0.25 }));
  hinge.position.set(span * 0.5, yTop(span * 0.5) - 0.02, 4.6);
  hinge.rotation.y = leYaw * 0.15;
  group.add(hinge);

  // ---- nacelle: the SR-71 reads by its engine, so give it one, half-sunk in the wing ----
  const nacM = metal("#1b1f26", { roughness: 0.78, metalness: 0.28, side: THREE.DoubleSide });
  const nac = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.92, 9.4, 14, 1, true), nacM);
  nac.rotation.x = Math.PI / 2;
  nac.position.set(4.4, -1.95, 1.6);
  group.add(nac);
  const spike = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 10), metal("#101317", { roughness: 0.7, metalness: 0.3 }));
  spike.rotation.x = -Math.PI / 2; // apex forward (-z)
  spike.position.set(4.4, -1.95, -4.3);
  group.add(spike);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(1.03, 0.07, 5, 16),
    new THREE.MeshStandardMaterial({ color: "#40342a", emissive: "#ff8f3a", emissiveIntensity: 0.28, roughness: 0.5, metalness: 0.4 }));
  lip.position.set(4.4, -1.95, -3.1);
  group.add(lip);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.78, 0.7, 12, 1, true), metal("#0e1114", { roughness: 0.8, metalness: 0.3, side: THREE.DoubleSide }));
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.set(4.4, -1.95, 6.7);
  group.add(nozzle);
  const coreM = new THREE.MeshStandardMaterial({ color: "#2a1a10", emissive: FUEL, emissiveIntensity: 1.2, roughness: 0.8 });
  const core = new THREE.Mesh(new THREE.CircleGeometry(0.8, 12), coreM);
  core.position.set(4.4, -1.95, 6.9);
  group.add(core);

  // ---- heat shimmer rising off the leading edge: strips that clear the wing and scroll along their own length ----
  const sh: { tex: THREE.Texture; mat: THREE.MeshBasicMaterial; base: number }[] = [];
  for (const [dy, dz, w, op, k] of [[0.26, 0.0, 0.65, 0.30, 0.9], [0.62, 0.55, 1.05, 0.20, 0.6], [1.05, 1.15, 1.6, 0.12, 0.4]] as const) {
    const tex = shimmerTex(41 + (k * 10 | 0));
    tex.repeat.set(4, 1);
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: "#ffb877", transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const s = flatStrip(leLen * 0.92, w, mat);
    s.position.set(span / 2 + dz * 0.4, (y0 + y1) / 2 + dy, (rootLE + tipLE) / 2 - dz);
    s.rotation.y = leYaw - 0.02;
    group.add(s);
    sh.push({ tex, mat, base: op });
  }

  // ---- streamwise streaks on the skin: short, soft, running aft. Speed read, not motion blur ----
  const streakT = ctex(64, 256, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, "rgba(255,255,255,0)");
    gr.addColorStop(0.45, "rgba(255,255,255,0.9)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  }, 12);
  const streaks: { mesh: THREE.Mesh; z0: number; chord: number; off: number; mat: THREE.MeshBasicMaterial }[] = [];
  for (let i = 0; i < 8; i++) {
    const x = 2.4 + i * 2.9, u = x / span;
    const zl = rootLE + (tipLE - rootLE) * u, zt = rootTE + (tipTE - rootTE) * u;
    const g2 = new THREE.PlaneGeometry(0.07, 1.5);
    g2.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: streakT, color: "#ffd2a0", transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(g2, mat);
    m.position.set(x, yTop(x) + 0.012, zl + 0.6);
    group.add(m);
    streaks.push({ mesh: m, z0: zl + 0.6, chord: Math.max(1, zt - zl - 1.2), off: i * 0.29, mat });
  }

  // ---- two thin contrail streaks far out, for scale ----
  const streakT2 = shimmerTex(97);
  streakT2.repeat.set(8, 1);
  for (const [x, y, z, len, op] of [[-140, 34, -300, 300, 0.09], [170, 4, -220, 220, 0.06]] as const) {
    const t2 = streakT2.clone();
    t2.needsUpdate = true;
    const m = new THREE.MeshBasicMaterial({ map: t2, color: "#dfe4ec", transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
    const st = flatStrip(len, 2.2, m);
    st.position.set(x, y, z);
    st.rotation.y = 0.06;
    group.add(st);
  }

  return {
    group,
    update(t: number) {
      for (let i = 0; i < sh.length; i++) { // shimmer ripples run rearward along the LE, pure in t
        sh[i].tex.offset.x = -((t * (0.55 + i * 0.35)) % 1 + 1) % 1;
        sh[i].tex.offset.y = 0.02 * Math.sin(t * 2.2 + i);
        sh[i].mat.opacity = sh[i].base * (0.82 + 0.18 * Math.sin(t * 3.1 + i * 1.7));
      }
      for (const s of streaks) { // airflow dragging aft across the skin, fading at both ends of the run
        const k = (((t * 1.15 + s.off) % 1) + 1) % 1;
        s.mesh.position.z = s.z0 + k * s.chord;
        s.mat.opacity = 0.13 * Math.sin(Math.PI * k);
      }
      coreM.emissiveIntensity = 1.15 + 0.3 * Math.sin(t * 1.3);
    },
    dispose() { disposeTree(group); },
  };
}

// ===============================================================================================================
// 4. panel macro: the lip of an upper skin panel lapping over a lower one. The seam runs horizontally across
// frame, one row of rivets parallels it, and a bead of fuel hangs over the lower panel's edge. The set leans back
// a few degrees so a lens just above the seam, 2-3 m out, looks down onto the joint instead of flat at a wall.
// ===============================================================================================================
export function panelMacro(): Env {
  const group = new THREE.Group();

  const set = new THREE.Group();
  set.rotation.x = -0.2; // top of the skin leans away: the seam plane tilts up toward the lens
  group.add(set);

  const W = 3.4, H = 1.7, TH = 0.1, GAP = 0.045;
  const faceZ = TH / 2;          // front face of a plate at its own origin
  const upY = GAP / 2 + H / 2;   // upper panel: bottom edge sits just above the seam
  const lowY = -GAP / 2 - H / 2; // lower panel: top edge just below, so that top face is the lip
  const lowZ = 0.02;             // the lower skin laps slightly proud of the upper one
  const lipY = -GAP / 2;         // top face of the lower panel
  const lipZ = lowZ + faceZ;     // its front face

  // ---- the two skins: subtly dished so the flat-shaded facets take the key light ----
  const plateT = titaniumTex(61, false);
  plateT.repeat.set(2.2, 1.1);
  const skinM = metal("#ffffff", { map: plateT, roughness: 0.78, metalness: 0.42 });
  const plate = (w: number, h: number, seed: number) => {
    const g = new THREE.BoxGeometry(w, h, TH, 14, 8, 1);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (Math.abs(z) > TH / 2 - 0.002) p.setZ(i, z + 0.007 * Math.sin(x * 2.7 + seed) * Math.cos(y * 1.9 - seed) + 0.003 * Math.cos(x * 6.1 + y * 2.2));
    }
    g.computeVertexNormals();
    return new THREE.Mesh(g, skinM);
  };
  const upper = plate(W, H, 1.3);
  upper.position.set(0, upY, 0);
  set.add(upper);
  const lower = plate(W, H, 4.1);
  lower.position.set(0, lowY, lowZ);
  set.add(lower);

  // ---- behind the gap: a dark cavity with the top edge of a stringer catching a little light ----
  const voidM = new THREE.MeshStandardMaterial({ color: "#08090b", roughness: 0.95, metalness: 0.1, side: THREE.DoubleSide });
  const cav = box(W, 0.16, 0.03, voidM); cav.position.set(0, 0, -0.012); set.add(cav);
  const stringer = box(W, 0.09, 0.04, metal("#242932", { roughness: 0.85, metalness: 0.3 }));
  stringer.position.set(0, -0.012, -0.045); set.add(stringer);

  // ---- machined chamfers on both seam edges: the two bright lines that say "two plates", not one ----
  const edgeM = metal("#5e646d", { roughness: 0.5, metalness: 0.7 });
  const chamferUp = box(W, 0.01, 0.02, edgeM);
  chamferUp.position.set(0, GAP / 2 + 0.003, faceZ + 0.002);
  set.add(chamferUp);
  const chamferLow = box(W, 0.012, 0.022, edgeM);
  chamferLow.position.set(0, lipY - 0.004, lipZ - 0.004);
  set.add(chamferLow);

  // ---- one row of rivets, parallel to the seam, 0.15 m pitch ----
  const PITCH = 0.15, N = 23;
  const rivetG = new THREE.SphereGeometry(0.013, 8, 6);
  const rivetM = metal("#6e747d", { roughness: 0.55, metalness: 0.65 });
  const rivets = new THREE.InstancedMesh(rivetG, rivetM, N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    pos.set(-((N - 1) / 2) * PITCH + i * PITCH, GAP / 2 + 0.058, faceZ + 0.006);
    rivets.setMatrixAt(i, m4.compose(pos, q, one));
  }
  rivets.instanceMatrix.needsUpdate = true;
  rivets.frustumCulled = false;
  set.add(rivets);

  // ---- the fuel: one pear-shaped bead pooled on the lip, already bulging over the edge, with the wet trail
  // it has left running down the lower skin ----
  const BX = 0.1;
  const beadM = new THREE.MeshStandardMaterial({ color: FUEL, emissive: "#5a3208", emissiveIntensity: 0.45, roughness: 0.08, metalness: 0.35, transparent: true, opacity: 0.96 });
  const pearPts = [[0, 0], [0.011, -0.003], [0.018, -0.011], [0.019, -0.021], [0.0145, -0.031], [0.0075, -0.04], [0, -0.046]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const bead = new THREE.Mesh(new THREE.LatheGeometry(pearPts, 16), beadM);
  bead.position.set(BX, lipY + 0.004, lipZ - 0.01); // top of the pear sits on the lip
  set.add(bead);
  const drop = new THREE.Mesh(new THREE.IcosahedronGeometry(0.013, 2), beadM);
  set.add(drop);
  // baked catchlight: a small bright chip on the bead, since the env carries no lights of its own
  const glintM = new THREE.MeshBasicMaterial({ color: "#ffe0b0", transparent: true, opacity: 0.5 });
  const glint = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 6, 4), glintM);
  set.add(glint);

  const streakTex = ctex(64, 256, (g, r) => {
    g.clearRect(0, 0, 64, 256);
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, "rgba(255,255,255,0.85)");
    gr.addColorStop(0.35, "rgba(255,255,255,0.45)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 24; i++) { // ragged edges so the trail never reads as a rectangle
      g.fillStyle = "rgba(0,0,0,1)";
      g.globalCompositeOperation = "destination-out";
      const y = U(r, 0, 256), w = U(r, 2, 9);
      g.fillRect(r() < 0.5 ? 0 : 64 - w, y, w, U(r, 6, 22));
    }
    g.globalCompositeOperation = "source-over";
  }, 73);
  const trailM = new THREE.MeshStandardMaterial({ map: streakTex, transparent: true, opacity: 0.55, color: "#0d0b09", roughness: 0.2, metalness: 0.35, depthWrite: false });
  const trail = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.62), trailM);
  trail.position.set(BX + 0.004, lipY - 0.31, lipZ + 0.004);
  set.add(trail);
  const trail2 = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.33), trailM.clone());
  trail2.position.set(BX - 0.05, lipY - 0.17, lipZ + 0.004);
  (trail2.material as THREE.MeshStandardMaterial).opacity = 0.35;
  set.add(trail2);
  const wetLip = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.055),
    new THREE.MeshStandardMaterial({ map: fuelTex(71), color: FUEL, roughness: 0.1, metalness: 0.5, transparent: true, opacity: 0.85, depthWrite: false }));
  wetLip.rotation.x = -Math.PI / 2;
  wetLip.position.set(BX, lipY + 0.002, lipZ - 0.035);
  set.add(wetLip);

  return {
    group,
    update(t: number) {
      // 4 s cycle: the bead swells, its tail stretches over the lip, it lets go, and the next bead forms
      const P = 4.0, u = (((t % P) + P) % P) / P;
      const grow = Math.min(1, u / 0.66);
      const swell = 0.9 + 0.22 * Math.sin(Math.PI * grow);
      bead.scale.set(0.94 + 0.12 * grow, 0.85 + 0.45 * grow, 0.94 + 0.12 * grow); // anchored at the lip, stretches down
      glint.position.set(BX - 0.006, lipY - 0.004, lipZ + 0.004);
      glint.scale.setScalar(0.7 + 0.4 * swell);

      if (u < 0.66) { // still hanging: the tail thickens and necks down
        drop.visible = false;
      } else { // released at the neck, falls past the frame and thins out
        const k = (u - 0.66) / 0.34;
        drop.visible = true;
        drop.position.set(BX, lipY - 0.052 - 1.15 * k ** 1.7, lipZ - 0.006);
        drop.scale.set(1.1 - 0.3 * k, 1.25 - 0.35 * k, 1.1 - 0.3 * k);
        (drop.material as THREE.MeshStandardMaterial).opacity = 0.96 * (1 - k * k);
      }
    },
    dispose() { disposeTree(group); },
  };
}