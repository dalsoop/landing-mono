// Hero: the sample upper arch (poseidon-000097) replaying an extraction plan cuAlign computed for it.
// The two teeth to extract lift out and fade, then the other teeth close the space stage by stage.
// Loaded by app.js only when WebGL works and reduced motion is off; the poster image stays otherwise.
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js';

// Neutral dental-viewer tones: ivory enamel, soft pink gingiva, white light.
const IVORY = new THREE.Color(0xf2ede3);
const GUM = new THREE.Color(0xd98f94);
// Timeline of one loop, in order.
const SHOW_MS = 1200;      // the arch as scanned
const LIFT_MS = 1100;      // they rise out of the arch, shrink a little and fade
const PLAY_MS = 7000;      // the remaining teeth move through every stage
const HOLD_MS = 1800;      // rest on the final stage
const BACK_MS = 1000;      // everything eases back to the start
const CYCLE_MS = SHOW_MS + LIFT_MS + PLAY_MS + HOLD_MS + BACK_MS;
const LIFT_MM = 9;         // how far an extracted tooth rises

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function geometry(part) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(part.v, 3));
  g.setIndex(part.f);
  g.computeVertexNormals();
  return g;
}

export async function mountHero({ stage, canvas, dataUrl, touch }) {
  const res = await fetch(dataUrl);
  if (!res.ok) throw new Error(`hero data ${res.status}`);
  const data = await res.json();
  const n = data.n_stages;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !touch, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 1, 1000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2a2a, 1.0));
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(40, 90, 80); scene.add(key);
  const back = new THREE.DirectionalLight(0xffffff, 0.5); back.position.set(-80, 30, -90); scene.add(back);
  const fill = new THREE.DirectionalLight(0xffffff, 0.4); fill.position.set(-40, -30, 60); scene.add(fill);

  // yaw (turntable) > pitch > model; the model is centred and turned so the crowns face up and the incisors face the camera.
  const yaw = new THREE.Group();
  const pitch = new THREE.Group();
  const model = new THREE.Group();
  scene.add(yaw); yaw.add(pitch); pitch.add(model);
  model.rotation.set(-Math.PI / 2, 0, Math.PI);

  const removed = new Set((data.removed ?? []).map(String));
  const teeth = {};
  for (const [id, part] of Object.entries(data.teeth)) {
    const mat = new THREE.MeshStandardMaterial({ color: IVORY, roughness: 0.42, metalness: 0 });
    if (removed.has(id)) mat.transparent = true;
    const mesh = new THREE.Mesh(geometry(part), mat);
    model.add(mesh);
    teeth[id] = mesh;
  }
  const gum = new THREE.Mesh(geometry(data.gum), new THREE.MeshStandardMaterial({
    color: GUM, roughness: 0.62, metalness: 0,
  }));
  model.add(gum);

  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  const radius = box.getSize(new THREE.Vector3()).length() / 2;

  // Extracted teeth leave along the crown direction: away from the gum, which reads as "up" on screen.
  const meanZ = (v) => { let z = 0; for (let i = 2; i < v.length; i += 3) z += v[i]; return z / (v.length / 3); };
  const gumZ = meanZ(data.gum.v);
  const lift = {};
  for (const id of removed) {
    if (!data.teeth[id]) continue;
    const g = teeth[id].geometry;
    g.computeBoundingBox();
    const c = g.boundingBox.getCenter(new THREE.Vector3());
    g.translate(-c.x, -c.y, -c.z);        // scale about the tooth's own centre
    lift[id] = { c, dir: Math.sign(meanZ(data.teeth[id].v) - gumZ) || 1 };
  }


  const offsetAt = (k, id) => (k > 0 ? data.stages[k - 1][id] ?? [0, 0, 0] : [0, 0, 0]);
  const angleAt = (k, id) => (k > 0 ? data.rotations[k - 1]?.[id] ?? 0 : 0);

  // Pose at a fractional stage s: blend the two neighbouring stages, then turn about the crown pivot c:
  // v' = R(v − c) + c + d  ⇒  position = d + c − R·c.
  function pose(s) {
    const k0 = Math.floor(s), k1 = Math.min(n, k0 + 1), t = s - k0;
    for (const [id, m] of Object.entries(teeth)) {
      if (removed.has(id)) continue;
      const a0 = offsetAt(k0, id), a1 = offsetAt(k1, id);
      const d = [0, 1, 2].map((i) => a0[i] + (a1[i] - a0[i]) * t);
      const deg = angleAt(k0, id) + (angleAt(k1, id) - angleAt(k0, id)) * t;
      const a = (deg * Math.PI) / 180, c = data.pivots[id] ?? [0, 0, 0];
      m.rotation.set(0, 0, a);
      m.position.set(
        d[0] + c[0] - (Math.cos(a) * c[0] - Math.sin(a) * c[1]),
        d[1] + c[1] - (Math.sin(a) * c[0] + Math.cos(a) * c[1]),
        d[2],
      );
    }
  }

  // Extracted teeth keep their colour: out (0..1) lifts, shrinks and fades them.
  function extract(out) {
    for (const id of removed) {
      const m = teeth[id], l = lift[id];
      if (!m || !l) continue;
      m.visible = out < 1;
      m.material.opacity = 1 - out;
      m.material.depthWrite = out === 0;
      m.scale.setScalar(1 - 0.15 * out);
      m.position.set(l.c.x, l.c.y, l.c.z + l.dir * LIFT_MM * out);
    }
  }

  // Where the loop is at time ms: stage s and extraction progress out.
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  function timeline(ms) {
    let t = ms % CYCLE_MS;
    if (t < SHOW_MS) return { s: 0, out: 0 };
    t -= SHOW_MS;
    if (t < LIFT_MS) return { s: 0, out: easeOut(t / LIFT_MS) };
    t -= LIFT_MS;
    if (t < PLAY_MS) return { s: n * ease(t / PLAY_MS), out: 1 };
    t -= PLAY_MS;
    if (t < HOLD_MS) return { s: n, out: 1 };
    t -= HOLD_MS;
    const b = ease(t / BACK_MS);
    return { s: n * (1 - b), out: 1 - b };
  }

  // Fit the arch into the canvas.
  let aspect = 1;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    aspect = w / h;
    camera.aspect = aspect;
    const vfov = (camera.fov * Math.PI) / 180;
    const fit = radius / Math.sin(Math.min(vfov, 2 * Math.atan(Math.tan(vfov / 2) * aspect)) / 2);
    camera.position.set(0, 0, fit * (aspect < 1.3 ? 0.7 : 0.9));   // the bounding sphere is loose; tighten on narrow screens
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // Timeline, auto-rotation, drag and scroll tilt.
  const BASE_PITCH = 0.62;
  let clock = 0, prev = performance.now(), dragging = null;
  let dragYaw = 0, dragPitch = 0, spin = 0, visible = true, raf = 0;

  function frame(now) {
    raf = 0;
    const dt = Math.min(64, now - prev); prev = now;
    if (!dragging) { clock += dt; spin += dt * 0.00018; }
    const rect = stage.getBoundingClientRect();
    const scrolled = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height)));
    yaw.rotation.y = Math.sin(spin) * 0.55 + dragYaw;
    pitch.rotation.x = BASE_PITCH + dragPitch + scrolled * 0.45;
    yaw.position.y = -scrolled * radius * 0.25;
    const at = timeline(clock);
    pose(at.s);
    extract(at.out);
    renderer.render(scene, camera);
    if (visible) raf = requestAnimationFrame(frame);
  }
  const start = () => { if (!raf) { prev = performance.now(); raf = requestAnimationFrame(frame); } };

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start();
  }).observe(stage);
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    if (visible) start();
  });

  if (!touch) {
    canvas.addEventListener('pointerdown', (e) => {
      dragging = { x: e.clientX, y: e.clientY, yaw: dragYaw, pitch: dragPitch };
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add('is-dragging');
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      dragYaw = dragging.yaw + (e.clientX - dragging.x) * 0.008;
      dragPitch = Math.max(-0.9, Math.min(0.7, dragging.pitch + (e.clientY - dragging.y) * 0.006));
    });
    const end = () => { dragging = null; canvas.classList.remove('is-dragging'); };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  // Draw once, then let the caller swap the poster out.
  pose(0);
  extract(0);
  renderer.render(scene, camera);
  start();
  return { stages: n };
}
