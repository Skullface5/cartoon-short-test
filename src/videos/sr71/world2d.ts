// Flat vector backgrounds for the SR-71 short.
// Same drawing language as chars.ts — bold ink outlines, flat fills, 2-3 tone shading, warm sodium
// key / cool shadow — so world and cast are ONE image by construction instead of by grading.
// Canvas2D only: no 3D, no textures, no lighting rig. Deterministic in t.

type C2 = CanvasRenderingContext2D;

export const INK = "#1a1116";
const TITAN = "#20242b", TITAN_L = "#333944", TITAN_D = "#12151a";
const CONC = "#6b625a", CONC_L = "#877d73", CONC_D = "#4a443e";
const SKY_HI = "#0d1526", SKY_MID = "#1e334f", SKY_LO = "#4a6b85";
const WARM = "#ffb043", FUEL = "#c9791f", FUEL_HI = "#f0a94a";

const rnd = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const ink = (c: C2, w: number) => { c.strokeStyle = INK; c.lineWidth = w; c.lineJoin = "round"; c.lineCap = "round"; };

/** Horizontal aircraft-skin seam: upper panel, gap, lower panel, rivet row, fuel bead. */
export const skinMacro = (c: C2, t: number, close = false) => {
  const seamY = close ? 1180 : 1080;
  c.fillStyle = TITAN_D; c.fillRect(0, 0, 1080, 1920);

  // upper panel (tilted slightly toward camera)
  const ug = c.createLinearGradient(0, 0, 0, seamY);
  ug.addColorStop(0, TITAN_D); ug.addColorStop(0.65, TITAN); ug.addColorStop(1, TITAN_L);
  c.fillStyle = ug; c.fillRect(0, 0, 1080, seamY - 14);
  // lower panel
  const lg = c.createLinearGradient(0, seamY + 14, 0, 1920);
  lg.addColorStop(0, TITAN_L); lg.addColorStop(0.4, TITAN); lg.addColorStop(1, TITAN_D);
  c.fillStyle = lg; c.fillRect(0, seamY + 14, 1080, 1920 - seamY);

  // the gap itself
  c.fillStyle = "#05070a"; c.fillRect(0, seamY - 14, 1080, 28);
  ink(c, 5); c.beginPath(); c.moveTo(0, seamY - 14); c.lineTo(1080, seamY - 14); c.stroke();
  c.beginPath(); c.moveTo(0, seamY + 14); c.lineTo(1080, seamY + 14); c.stroke();

  // rivet row along the seam, both sides
  for (let i = 0; i < 11; i++) {
    const x = 55 + i * 97;
    [seamY - 62, seamY + 62].forEach((y) => {
      c.beginPath(); c.ellipse(x, y, 17, 13, 0, 0, Math.PI * 2);
      const rg = c.createRadialGradient(x - 5, y - 5, 2, x, y, 18);
      rg.addColorStop(0, "#5a626e"); rg.addColorStop(0.7, TITAN); rg.addColorStop(1, "#0b0d11");
      c.fillStyle = rg; c.fill(); ink(c, 3.5); c.stroke();
    });
  }
  // panel lines
  ink(c, 3); c.strokeStyle = "rgba(10,13,18,0.75)";
  for (let i = 0; i < 4; i++) { const y = seamY - 150 - i * 175; c.beginPath(); c.moveTo(0, y); c.lineTo(1080, y); c.stroke(); }
  for (let i = 0; i < 3; i++) { const y = seamY + 180 + i * 190; c.beginPath(); c.moveTo(0, y); c.lineTo(1080, y); c.stroke(); }

  // fuel bead on the lower lip, trembling, then a drip forms
  const wob = Math.sin(t * 3.1) * 1.6 + Math.sin(t * 7.7) * 0.7;
  const bx = 540, by = seamY + 16;
  c.beginPath(); c.ellipse(bx + wob, by + 6, 30, 26, 0, 0, Math.PI * 2);
  const bg = c.createRadialGradient(bx - 10, by - 2, 3, bx, by + 6, 32);
  bg.addColorStop(0, FUEL_HI); bg.addColorStop(0.55, FUEL); bg.addColorStop(1, "#5e3410");
  c.fillStyle = bg; c.fill(); ink(c, 4); c.stroke();
  // specular
  c.beginPath(); c.ellipse(bx - 9, by - 1, 8, 5, -0.5, 0, Math.PI * 2);
  c.fillStyle = "rgba(255,235,190,0.9)"; c.fill();
  // falling drip
  const fall = ((t * 0.55) % 1);
  if (fall > 0.55) {
    const dy = by + 34 + (fall - 0.55) * 900;
    c.beginPath(); c.ellipse(bx, dy, 11, 17, 0, 0, Math.PI * 2);
    c.fillStyle = FUEL; c.fill(); ink(c, 3); c.stroke();
  }
  return seamY;
};

/** Wide apron: aircraft belly overhead, jacks, puddles, distant hangars, floodlights. */
export const rampWide = (c: C2, t: number) => {
  const g = c.createLinearGradient(0, 0, 0, 900);
  g.addColorStop(0, SKY_HI); g.addColorStop(0.75, SKY_MID); g.addColorStop(1, "#3c556b");
  c.fillStyle = g; c.fillRect(0, 0, 1080, 920);

  // distant hangars + tower
  c.fillStyle = "#0f1724";
  c.beginPath(); c.moveTo(-40, 700); c.lineTo(-40, 520); c.quadraticCurveTo(230, 400, 500, 520); c.lineTo(500, 700); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(560, 700); c.lineTo(560, 470); c.quadraticCurveTo(800, 350, 1040, 470); c.lineTo(1040, 700); c.closePath(); c.fill();
  // tower
  c.fillStyle = "#131c2b"; c.fillRect(880, 250, 54, 300);
  c.beginPath(); c.ellipse(907, 250, 46, 26, 0, 0, Math.PI * 2); c.fillStyle = "#1b2740"; c.fill();
  ink(c, 3); c.stroke();
  // hangar light strips
  c.fillStyle = WARM;
  for (let i = 0; i < 6; i++) c.fillRect(30 + i * 88, 560, 52, 9);
  c.fillStyle = "rgba(255,176,67,0.85)"; c.fillRect(884, 232, 46, 7);

  // ground
  const gg = c.createLinearGradient(0, 900, 0, 1920);
  gg.addColorStop(0, CONC_L); gg.addColorStop(0.35, CONC); gg.addColorStop(1, CONC_D);
  c.fillStyle = gg; c.fillRect(0, 900, 1080, 1020);
  ink(c, 3); c.strokeStyle = "rgba(20,22,26,0.6)";
  for (let i = 0; i < 7; i++) { const y = 940 + i * 140; c.beginPath(); c.moveTo(0, y); c.lineTo(1080, y); c.stroke(); }
  for (let i = -3; i < 8; i++) { c.beginPath(); c.moveTo(540 + i * 200, 900); c.lineTo(540 + i * 560, 1920); c.stroke(); }

  // painted taxi line
  c.strokeStyle = "rgba(232,185,58,0.85)"; c.lineWidth = 14; c.setLineDash([70, 55]);
  c.beginPath(); c.moveTo(540, 920); c.lineTo(540, 1920); c.stroke(); c.setLineDash([]);

  // fuel puddles
  [[250, 1500, 190, 46], [760, 1660, 150, 38], [470, 1780, 120, 30]].forEach(([x, y, rx, ry], i) => {
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    const pg = c.createRadialGradient(x - 20, y - 8, 5, x, y, rx);
    pg.addColorStop(0, "rgba(240,169,74,0.85)"); pg.addColorStop(0.6, "rgba(120,66,18,0.9)"); pg.addColorStop(1, "rgba(40,26,12,0.95)");
    c.fillStyle = pg; c.fill();
    if (rnd(i) > 0.5) { c.beginPath(); c.ellipse(x - rx * 0.3, y - ry * 0.15, rx * 0.25, ry * 0.22, 0.3, 0, Math.PI * 2); c.fillStyle = "rgba(255,236,200,0.5)"; c.fill(); }
  });

  // aircraft belly overhead
  c.save();
  c.beginPath();
  c.moveTo(-80, 300); c.quadraticCurveTo(540, 120, 1160, 300); c.lineTo(1160, 560); c.quadraticCurveTo(540, 660, -80, 560); c.closePath();
  const bgd = c.createLinearGradient(0, 140, 0, 660);
  bgd.addColorStop(0, TITAN_L); bgd.addColorStop(0.45, TITAN); bgd.addColorStop(1, TITAN_D);
  c.fillStyle = bgd; c.fill(); ink(c, 7); c.stroke();
  // keel + panel lines
  ink(c, 3); c.strokeStyle = "rgba(8,10,14,0.8)";
  for (let i = 0; i < 5; i++) { const x = 120 + i * 210; c.beginPath(); c.moveTo(x, 300 + Math.abs(i - 2) * 26); c.lineTo(x - 40, 640); c.stroke(); }
  c.beginPath(); c.moveTo(-60, 430); c.quadraticCurveTo(540, 330, 1140, 430); c.stroke();
  c.restore();

  // jack stands
  [[210, 620], [860, 620]].forEach(([x, top]) => {
    ink(c, 6);
    c.strokeStyle = "#0d1015"; c.lineWidth = 26; c.beginPath(); c.moveTo(x, top); c.lineTo(x, 1480); c.stroke();
    c.strokeStyle = "#2b3038"; c.lineWidth = 17; c.beginPath(); c.moveTo(x, top); c.lineTo(x, 1480); c.stroke();
    c.fillStyle = WARM; c.fillRect(x - 22, 900, 44, 26); ink(c, 4); c.strokeRect(x - 22, 900, 44, 26);
    ink(c, 9); c.beginPath(); c.moveTo(x, 1440); c.lineTo(x - 62, 1512); c.stroke(); c.beginPath(); c.moveTo(x, 1440); c.lineTo(x + 62, 1512); c.stroke();
  });

  // floodlight glow
  c.globalCompositeOperation = "lighter";
  [[180, 780, 260], [900, 800, 220]].forEach(([x, y, r]) => {
    const fg = c.createRadialGradient(x, y, 10, x, y, r as number);
    fg.addColorStop(0, "rgba(255,176,67,0.20)"); fg.addColorStop(1, "rgba(255,176,67,0)");
    c.fillStyle = fg; c.fillRect((x as number) - (r as number), (y as number) - (r as number), (r as number) * 2, (r as number) * 2);
  });
  c.globalCompositeOperation = "source-over";
};

/** High altitude: near-black sky, deep cloud sea, black delta wing with heat shimmer. */
export const altitude = (c: C2, t: number) => {
  const g = c.createLinearGradient(0, 0, 0, 1400);
  g.addColorStop(0, "#05070d"); g.addColorStop(0.45, SKY_HI); g.addColorStop(0.8, SKY_MID); g.addColorStop(1, "#6d8fa8");
  c.fillStyle = g; c.fillRect(0, 0, 1080, 1500);

  // layered cloud sea (three bands, far to near) -> depth
  const bands: [number, string, number][] = [[1290, "#8fa9bd", 0.55], [1360, "#a9c0d0", 0.75], [1450, "#c6d7e2", 0.95]];
  bands.forEach(([base, col, al], bi) => {
    c.beginPath(); c.moveTo(0, 1500);
    for (let x = 0; x <= 1080; x += 40) {
      const y = base + Math.sin((x + bi * 300 + t * (6 + bi * 4)) * 0.006) * (18 + bi * 8)
                     + Math.sin((x * 0.017) + bi * 2 + t * 0.6) * (10 + bi * 5);
      c.lineTo(x, y);
    }
    c.lineTo(1080, 1500); c.closePath();
    c.globalAlpha = al; c.fillStyle = col; c.fill(); c.globalAlpha = 1;
  });
  // haze at the horizon
  const hz = c.createLinearGradient(0, 1180, 0, 1500);
  hz.addColorStop(0, "rgba(140,170,195,0)"); hz.addColorStop(1, "rgba(170,195,215,0.55)");
  c.fillStyle = hz; c.fillRect(0, 1180, 1080, 320);

  // the wing: matte black delta sweeping through the frame
  c.save();
  c.beginPath();
  c.moveTo(-120, 1180); c.lineTo(760, 980); c.lineTo(1180, 1010); c.lineTo(1180, 1330); c.lineTo(-120, 1560); c.closePath();
  const wg = c.createLinearGradient(0, 980, 0, 1560);
  wg.addColorStop(0, "#2a2f38"); wg.addColorStop(0.35, TITAN); wg.addColorStop(1, "#0a0c10");
  c.fillStyle = wg; c.fill(); ink(c, 8); c.stroke();
  // leading edge rim light + heat shimmer
  c.beginPath(); c.moveTo(-120, 1180); c.lineTo(760, 980); c.lineTo(1180, 1010);
  c.strokeStyle = "rgba(255,176,67,0.9)"; c.lineWidth = 7; c.stroke();
  for (let i = 0; i < 26; i++) {
    const k = i / 25, x = -120 + k * 1300, y = 1180 - k * 200 + Math.sin(t * 6 + i) * 6;
    c.globalAlpha = 0.30 * (1 - Math.abs(k - 0.5) * 1.4);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + 14 + Math.sin(t * 4 + i) * 8, y - 46 - Math.sin(t * 5 + i * 2) * 22);
    c.strokeStyle = "rgba(255,190,120,0.85)"; c.lineWidth = 3; c.stroke();
  }
  c.globalAlpha = 1;
  // panel lines on the wing
  ink(c, 2.5); c.strokeStyle = "rgba(0,0,0,0.7)";
  for (let i = 0; i < 4; i++) { const x = 120 + i * 280; c.beginPath(); c.moveTo(x, 1050 + i * 20); c.lineTo(x - 90, 1450); c.stroke(); }
  c.restore();
};

/** Hangar interior: ribs, work light, open door to night sky. */
export const hangar = (c: C2, t: number) => {
  c.fillStyle = "#0b0f16"; c.fillRect(0, 0, 1080, 1920);
  // open door: the only light block
  const dg = c.createLinearGradient(0, 200, 0, 1400);
  dg.addColorStop(0, "#1b2a44"); dg.addColorStop(1, "#42586f");
  c.fillStyle = dg; c.fillRect(250, 240, 580, 1120);
  ink(c, 10); c.strokeRect(250, 240, 580, 1120);
  // distant apron lights through the door
  c.fillStyle = "rgba(255,176,67,0.9)";
  for (let i = 0; i < 5; i++) c.fillRect(280 + i * 108, 1240, 44, 8);

  // structural ribs receding
  ink(c, 7);
  for (let i = 0; i < 5; i++) {
    const k = i / 4, inset = k * 210;
    c.strokeStyle = `rgba(30,38,50,${0.95 - k * 0.5})`; c.lineWidth = 16 - k * 9;
    c.beginPath(); c.moveTo(inset, 0); c.lineTo(inset, 1920); c.stroke();
    c.beginPath(); c.moveTo(1080 - inset, 0); c.lineTo(1080 - inset, 1920); c.stroke();
  }
  // ceiling trusses
  for (let i = 0; i < 4; i++) {
    const y = 120 + i * 90;
    c.strokeStyle = "rgba(28,36,48,0.9)"; c.lineWidth = 9;
    c.beginPath(); c.moveTo(0, y); c.lineTo(1080, y); c.stroke();
  }
  // overhead work light
  c.beginPath(); c.moveTo(540, 0); c.lineTo(540, 150); ink(c, 6); c.stroke();
  c.beginPath(); c.ellipse(540, 176, 78, 30, 0, 0, Math.PI * 2);
  c.fillStyle = "#2a3140"; c.fill(); ink(c, 5); c.stroke();
  c.beginPath(); c.ellipse(540, 190, 62, 20, 0, 0, Math.PI * 2); c.fillStyle = "#fff3c4"; c.fill();
  c.globalCompositeOperation = "lighter";
  const cg = c.createRadialGradient(540, 200, 20, 540, 200, 760);
  cg.addColorStop(0, "rgba(255,214,140,0.30)"); cg.addColorStop(0.5, "rgba(255,190,90,0.10)"); cg.addColorStop(1, "rgba(255,176,67,0)");
  c.fillStyle = cg; c.fillRect(0, 0, 1080, 1100);
  c.globalCompositeOperation = "source-over";

  // floor
  const fg = c.createLinearGradient(0, 1360, 0, 1920);
  fg.addColorStop(0, CONC); fg.addColorStop(1, "#221f1c");
  c.fillStyle = fg; c.fillRect(0, 1360, 1080, 560);
  ink(c, 3); c.strokeStyle = "rgba(20,22,26,0.55)";
  for (let i = 0; i < 4; i++) { const y = 1400 + i * 130; c.beginPath(); c.moveTo(0, y); c.lineTo(1080, y); c.stroke(); }
  for (let i = -2; i < 7; i++) { c.beginPath(); c.moveTo(540 + i * 180, 1360); c.lineTo(540 + i * 520, 1920); c.stroke(); }
};

export type WorldId = "skin" | "ramp" | "alt" | "hangar" | "seamClose";
export const drawWorld = (c: C2, id: WorldId, t: number) => {
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, 1080, 1920);
  switch (id) {
    case "skin": skinMacro(c, t, false); break;
    case "seamClose": skinMacro(c, t, true); break;
    case "ramp": rampWide(c, t); break;
    case "alt": altitude(c, t); break;
    case "hangar": hangar(c, t); break;
  }
};