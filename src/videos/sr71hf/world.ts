// "The Leaky Bucket" — SR-71 episode, authored INSIDE the High Five system (same toon cast, same
// two-tone world materials, same post chain), not a separate renderer with effects bolted on.
//
// Three scenes share one always-resident world (the template's convention — there is no scene
// registry): a dusk/high-airfield apron with the black aircraft parked, the hangar mouth, and open
// sky for the flying beats. Per-shot variation comes from visibility + the cast staging.
import * as THREE from "three";
import { NOINK } from "../highfive/ink";
import { LIGHTS, LOOK } from "../highfive/lights";
import { lam, boxGeo, Batch, V } from "../highfive/build";
import { ctex, cloudHD } from "../highfive/paint";
import { Pool, Actor, Fx } from "../highfive/cast";
import { stage } from "./cast";
import { TONE, CHAR } from "../highfive/shade";
import { camAt, SHOTS, FPS, lightOf, sceneOf } from "./story";

export const G = 0; // ground plane (feet at y = 0)

/** flat slab from a top-view polygon ([x, z] pairs, clockwise) — used for the delta wing + tail */
const slab = (pts: [number, number][], th: number): THREE.BufferGeometry => {
  const pos: number[] = [], idx: number[] = [];
  const y0 = th / 2, y1 = -th / 2;
  for (const [x, z] of pts) pos.push(x, y0, z);              // 0..n-1 top
  for (const [x, z] of pts) pos.push(x, y1, z);              // n..2n-1 bottom
  const n = pts.length;
  for (let i = 1; i < n - 1; i++) { idx.push(0, i, i + 1); }                       // top fan
  for (let i = 1; i < n - 1; i++) { idx.push(n, n + i + 1, n + i); }               // bottom fan
  for (let i = 0; i < n; i++) {                                                    // sides
    const j = (i + 1) % n;
    idx.push(i, n + i, n + j, i, n + j, j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

/** weathered concrete: speckle + expansion joints, tiled by the caller */
const tarmac = () => ctex("sr71tarmac", 1024, 1024, (g, r) => {
  g.fillStyle = "#7b7f86"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 24000; i++) {
    const x = r() * 1024, y = r() * 1024, s = 0.6 + r() * 2.4;
    g.fillStyle = r() < 0.5 ? `rgba(255,255,255,${0.03 + r() * 0.07})` : `rgba(30,32,38,${0.03 + r() * 0.09})`;
    g.fillRect(x, y, s, s);
  }
  g.strokeStyle = "rgba(40,42,48,0.30)"; g.lineWidth = 4;
  for (let i = 0; i <= 4; i++) {
    const p = i * 256;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 1024); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(1024, p); g.stroke();
  }
});

/** the aircraft, authored at the same graphic level as the world: flat two-tone panels + ink */
const buildJet = (mBody: THREE.Material, mDark: THREE.Material, mGlass: THREE.Material) => {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); return mesh;
  };
  // fuselage: cylinder rotated x=90 has its LENGTH on local Y, so flatten on Z, never Y
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.5, 24, 12), mBody);
  fus.rotation.x = Math.PI / 2; fus.scale.set(1, 1, 0.66);
  fus.position.set(0, 0, 0); fus.castShadow = true; g.add(fus);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.15, 5.6, 12), mBody);
  nose.rotation.x = -Math.PI / 2; nose.scale.set(1, 1, 0.66); nose.position.set(0, 0, -14.8); g.add(nose);
  const tailC = new THREE.Mesh(new THREE.ConeGeometry(1.5, 6.5, 12), mBody);
  tailC.rotation.x = Math.PI / 2; tailC.scale.set(1, 1, 0.66); tailC.position.set(0, 0, 15.2); g.add(tailC);
  const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6), mDark);
  pitot.rotation.x = Math.PI / 2; pitot.position.set(0, 0, -18.6); g.add(pitot);
  // canopy
  const can = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), mGlass);
  can.scale.set(0.72, 0.42, 2.4); can.position.set(0, 0.75, -6.5); g.add(can);
  // chines: the sharp edge running the length of the body
  for (const s of [-1, 1]) add(boxGeo(V(1.0 * s, -0.12, -13), V(1.55 * s, 0.06, 7)), mDark);
  // delta wing (both sides, one slab each so the planform reads)
  for (const s of [-1, 1]) {
    add(slab([[0, -1.9], [13.4 * s, 1.6], [13.4 * s, 3.2], [0, 4.6]].map(([x, z]) => [x, z] as [number, number]), 0.34), mBody, 0, -0.1, 0);
  }
  // nacelles + inlet cones
  for (const s of [-1, 1]) {
    const nac = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.7, 9.5, 12), mBody);
    nac.rotation.x = Math.PI / 2; nac.position.set(3.1 * s, -0.72, 1.2); g.add(nac);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.9, 10), mDark);
    cone.rotation.x = -Math.PI / 2; cone.position.set(3.1 * s, -0.72, -3.9); g.add(cone);
  }
  // vertical fin + rudder line
  add(boxGeo(V(-0.16, 0.2, 8.4), V(0.16, 4.6, 10.6)), mBody);
  add(boxGeo(V(-0.2, 0.2, 8.2), V(0.2, 4.7, 8.45)), mDark);
  return g;
};

export class World {
  root = new THREE.Group();
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight; private fill: THREE.DirectionalLight;
  private fog = new THREE.Fog("#b9c8e2", 40, 620);
  private clouds: THREE.Mesh[] = [];
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private plane = new THREE.Group();
  private ground = new THREE.Group();
  private hangar = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = []; private fxs: Fx[] = [];
  private frustum = new THREE.Frustum(); private m4 = new THREE.Matrix4(); private sph = new THREE.Sphere();
  private sunCache = new Map<number, THREE.Vector3>();
  private sunV = new THREE.Vector3();

  constructor() {
    const R = this.root;

    // ---- sky: the template's 5-stop elevation shader, driven by LOOK[light] each frame ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);

    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    this.fill = new THREE.DirectionalLight("#9fb8ff", 0.35);
    R.add(this.hemi, this.sun, this.sun.target, this.fill, this.fill.target);

    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3, d = 700 + (i % 3) * 70;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
        map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 170 + (i % 4) * 40;
      m.position.set(Math.cos(a) * d, 150 + (i % 4) * 46, Math.sin(a) * d);
      m.scale.set(w, w / 2, 1); m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }

    // ---- the apron: one batched concrete field with a painted taxi line ----
    const b = new Batch();
    const M = {
      tarmac: lam("sr71tarmac", () => ({ map: tarmac() })),
      line: lam("sr71line", () => ({ color: "#e8c24a" })),
      steel: lam("sr71steel", () => ({ color: "#8d9299" })),
      dark: lam("sr71dark", () => ({ color: "#2b2f36" })),
      wall: lam("sr71wall", () => ({ color: "#b9b3a4" })),
      roof: lam("sr71roof", () => ({ color: "#7d7a72" })),
      body: lam("sr71body", () => ({ color: "#22262c" })),
    };
    R.add(...[]);
    b.add(new THREE.PlaneGeometry(900, 900), M.tarmac, new THREE.Matrix4().makeRotationX(-Math.PI / 2));
    // taxi line + hold-short bars
    b.add(boxGeo(V(-0.35, 0.012, -170), V(0.35, 0.03, 170)), M.line);
    for (let i = -6; i <= 6; i++) b.add(boxGeo(V(-9, 0.012, i * 9 - 0.4), V(9, 0.03, i * 9 + 0.4)), M.line);
    b.build(this.ground);
    R.add(this.ground);

    // ---- hangar: a wide shed with a dark mouth, so the ramp shot has a backdrop ----
    const HZ = -150, HW = 46, HH = 17, HD = 34;
    const hb = new Batch();
    hb.add(boxGeo(V(-HW, 0, HZ - HD), V(HW, HH, HZ + HD)), M.wall);
    hb.add(boxGeo(V(-HW - 1, HH, HZ - HD - 1), V(HW + 1, HH + 2.2, HZ + HD + 1)), M.roof);
    hb.build(this.hangar);
    // the mouth: a dark recess plane just proud of the front wall
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(HW * 1.5, HH * 0.82),
      new THREE.MeshBasicMaterial({ color: "#15171c" }));
    mouth.position.set(0, HH * 0.41, HZ + HD + 0.06);
    this.hangar.add(mouth);
    this.hangar.visible = false;
    R.add(this.hangar);

    // ---- the aircraft ----
    const body = lam("sr71body", () => ({ color: "#4b535f" }));
    const dark = lam("sr71dark2", () => ({ color: "#2a2f37" }));
    const glass = lam("sr71glass", () => ({ color: "#6d7d96" }));
    this.plane.add(buildJet(body, dark, glass));
    R.add(this.plane);

    // ---- ground props: fuel drums + a light cart, so the apron is not empty ----
    const pb = new Batch();
    for (let i = 0; i < 7; i++) {
      const x = -9 + (i % 4) * 2.1, z = -36 + Math.floor(i / 4) * 2.1;
      pb.add(new THREE.CylinderGeometry(0.42, 0.42, 1.15, 10), i % 2 ? M.steel : M.dark,
        new THREE.Matrix4().makeTranslation(x, 0.575, z));
    }
    pb.build(this.ground);

    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) this.actors.push(new Actor(R));
  }

  /** the sun of the shot: put it over the camera's shoulder so faces and the near side catch light */
  private shotSun(cam: THREE.PerspectiveCamera, el: number): THREE.Vector3 {
    const f = new THREE.Vector3(); cam.getWorldDirection(f);
    const az = 0.55, c = Math.cos(az), s = Math.sin(az);
    const right = new THREE.Vector3(-f.z, 0, f.x).normalize();
    const d = new THREE.Vector3(f.x * c - right.x * s, 0, f.z * c - right.z * s).normalize();
    d.y = Math.tan(el);
    return d.normalize();
  }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS;
    const s = SHOTS[id - 1];
    const light = lightOf(id);
    const scn = sceneOf(id);
    const L = LIGHTS[light], K = LOOK[light];

    // camera from the shot table
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look);
    cam.rotateZ(c.roll ?? 0); cam.fov = c.fov; cam.near = 0.2; cam.far = 1600;
    cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    const focus = new THREE.Vector3(...c.look);

    // light rig: presets drive the two-tone world shader AND the character card shader
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    this.fill.intensity = 0;
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term;
    TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade;
    CHAR.uGrad.value = L.charGrad; CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias;
    const sd = this.shotSun(cam, 0.42);
    this.sun.position.copy(focus).add(sd.multiplyScalar(240));
    this.sun.target.position.copy(focus); this.sun.target.updateMatrixWorld();
    const Rr = 130;
    const sc = this.sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 560;
    sc.updateProjectionMatrix();

    // sky + fog
    const sm = this.skyMat.uniforms;
    (["c0", "c1", "c2", "c3", "c4"] as const).forEach((k, i) => (sm[k].value as THREE.Color).set(K.sky.c[i]));
    sm.e.value.set(K.sky.e[0], K.sky.e[1], K.sky.e[2], K.sky.e[3]);
    this.sky.position.copy(cam.position);
    this.fog.color.set(L.fog); this.fog.near = L.fogNear; this.fog.far = scn === "sky" ? L.fogFar * 2.4 : L.fogFar;
    scene.fog = this.fog; scene.background = null;
    for (const m of this.clouds) {
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      (m.material as THREE.MeshBasicMaterial).map = this.cloudMaps[light][this.clouds.indexOf(m) % 4];
    }

    // ---- scene dressing ----
    const airborne = scn === "sky" || scn === "golden";
    this.hangar.visible = scn === "ramp";
    this.ground.visible = !airborne;   // no tarmac, no props, under the flying shots
    this.plane.visible = true;

    if (airborne) {
      // flying: high above the cloud deck, banked, drifting across frame
      this.plane.position.set(6 - ((t * 1.35) % 6), 26 + Math.sin(t * 0.5) * 1.1, -58);
      this.plane.rotation.set(0.045, Math.PI + 0.30 + Math.sin(t * 0.23) * 0.05, -0.075 + Math.sin(t * 0.31) * 0.02);
    } else {
      // parked on the apron, nose to the left. Kept well behind the crew (z=-30) so the 30 m
      // fuselage tail cannot occlude the two-shot.
      this.plane.position.set(6, 2.35, -52);
      this.plane.rotation.set(0, 1.334, 0); // long axis PERPENDICULAR to the sight line, nose to frame-left: seen side-on, never tail-on
    }

    // ---- cast ----
    const st = stage(id, t, { pos: cam.position, right: new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0) });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const usedA: Actor[] = [], usedF: Fx[] = [];
    let ai = 0, fi = 0;
    for (const p of st.places) {
      const a = this.actors[ai];
      if (!a) break;
      const psc = p.scale ?? 1, psz = p.size ?? ([1800, 3000, 3] as [number, number, number]);
      this.sph.center.set(p.x, p.y + 1.0 * psc, p.z); this.sph.radius = 1.4 * psc;
      if (!this.frustum.intersectsSphere(this.sph)) { continue; }
      a.r = this.pool.req(p.key, psz[0], psz[1], psz[2], p.draw);
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.scale.set(psz[2] * 0.6, psz[2], 1);
      a.mesh.rotation.set(0, Math.atan2(cam.position.x - p.x, cam.position.z - p.z) + (p.mirror ? Math.PI : 0), 0);
      a.mesh.visible = true;
      usedA.push(a); ai++;
    }
    for (const q of st.fx) {
      const e = this.fxs[fi];
      if (!e) break;
      e.r = this.pool.req(q.key, q.cw, q.ch, 1, q.draw);
      e.mesh.position.set(q.x, q.y, q.z);
      e.mesh.scale.set(q.w, q.h, 1); e.mesh.visible = true;
      usedF.push(e); fi++;
    }
    this.pool.flush();
    for (const a of usedA) a.bind();
    for (const e of usedF) e.bind();
    this.actors.forEach((a) => { if (!usedA.includes(a)) a.mesh.visible = false; });
    this.fxs.forEach((e) => { if (!usedF.includes(e)) e.mesh.visible = false; });

    return focus;
  }
}