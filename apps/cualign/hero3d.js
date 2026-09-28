// Hero: the sample upper arch (poseidon-000131, expansion plan) replaying its treatment stages.
// Loaded by app.js only when WebGL works and reduced motion is off; the poster image stays otherwise.
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js';

const IVORY = new THREE.Color(0xe9e4da);
const GREEN = new THREE.Color(0x76b900);
const RED = new THREE.Color(0xe5484d);
const PLAY_MS = 6500;   // stage 0 → last
const HOLD_MS = 1600;   // rest on the final stage
const BACK_MS = 1100;   // ease back to stage 0
const REST_MS = 700;    // rest before the next run

// Universal 1..16 → FDI 18..11, 21..28 (the numbers a dentist reads).
const fdi = (u) => (u <= 8 ? 19 - u : 12 + u);
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function geometry(part) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(part.v, 3));
  g.setIndex(part.f);
  g.computeVertexNormals();
  return g;
}

export async function mountHero({ stage, canvas, hud, dataUrl, touch, parallaxRoot }) {
  const res = await fetch(dataUrl);
  if (!res.ok) throw new Error(`hero data ${res.status}`);
  const data = await res.json();
  const n = data.n_stages;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !touch, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 1, 1000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1f1c, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(40, 90, 80); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9be02a, 1.1); rim.position.set(-80, 30, -90); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(-40, -30, 60); scene.add(fill);

  // yaw (turntable) > pitch > model; the model is centred and turned so the crowns face up and the incisors face the camera.
  const yaw = new THREE.Group();
  const pitch = new THREE.Group();
  const model = new THREE.Group();
  scene.add(yaw); yaw.add(pitch); pitch.add(model);
  model.rotation.set(-Math.PI / 2, 0, Math.PI);

  const teeth = {};
  for (const [id, part] of Object.entries(data.teeth)) {
    const mesh = new THREE.Mesh(geometry(part), new THREE.MeshStandardMaterial({ color: IVORY.clone(), roughness: 0.38, metalness: 0.02 }));
    model.add(mesh);
    teeth[id] = mesh;
  }
  const gum = new THREE.Mesh(geometry(data.gum), new THREE.MeshStandardMaterial({
    color: 0x9a7478, roughness: 0.75, metalness: 0, transparent: true, opacity: 0.3, depthWrite: false,
  }));
  gum.renderOrder = -1;
  model.add(gum);

  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  const radius = box.getSize(new THREE.Vector3()).length() / 2;

  const last = data.stages[n - 1];
  const maxMove = Math.max(1e-6, ...Object.values(last).map((d) => Math.hypot(...d)));
  const badAt = {};
  for (const v of data.violations) {
    if (v.stage == null || !v.teeth) continue;
    (badAt[v.stage] ??= []).push(v);
  }

  const offsetAt = (k, id) => (k > 0 ? data.stages[k - 1][id] ?? [0, 0, 0] : [0, 0, 0]);
  const angleAt = (k, id) => (k > 0 ? data.rotations[k - 1]?.[id] ?? 0 : 0);

  // Pose at a fractional stage s: blend the two neighbouring stages, then turn about the crown pivot c:
  // v' = R(v − c) + c + d  ⇒  position = d + c − R·c.
  function pose(s) {
    const k0 = Math.floor(s), k1 = Math.min(n, k0 + 1), t = s - k0;
    const shown = Math.round(s);
    const bad = new Set((badAt[shown] ?? []).filter((v) => v.type === 'collision').flatMap((v) => v.teeth.map(String)));
    for (const [id, m] of Object.entries(teeth)) {
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
      if (bad.has(id)) m.material.color.copy(RED);
      else m.material.color.copy(IVORY).lerp(GREEN, Math.min(1, Math.hypot(...d) / maxMove) * 0.85);
    }
    const list = badAt[shown] ?? [];
    const collision = list.find((v) => v.type === 'collision');
    const rules = collision
      ? `collision ${collision.teeth.map(fdi).join('–')}`
      : list.length ? `${list.length} rule ${list.length === 1 ? 'issue' : 'issues'}` : 'Rules: pass';
    const text = `${shown === 0 ? 'Before treatment' : `Stage ${shown} / ${n}`} · ${rules}`;
    if (hud.textContent !== text) {
      hud.textContent = text;
      hud.classList.toggle('is-warn', list.length > 0);
    }
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

  // Timeline, auto-rotation, drag, pointer parallax and scroll tilt.
  const BASE_PITCH = 0.62;
  let clock = 0, prev = performance.now(), dragging = null;
  let dragYaw = 0, dragPitch = 0, spin = 0, visible = true, raf = 0;
  // Parallax: the pointer anywhere over the hero leans the arch toward it (target → eased value).
  const lean = { x: 0, y: 0, tx: 0, ty: 0 };

  function stageAt(ms) {
    const cycle = PLAY_MS + HOLD_MS + BACK_MS + REST_MS;
    const t = ms % cycle;
    if (t < PLAY_MS) return n * ease(t / PLAY_MS);
    if (t < PLAY_MS + HOLD_MS) return n;
    if (t < PLAY_MS + HOLD_MS + BACK_MS) return n * (1 - ease((t - PLAY_MS - HOLD_MS) / BACK_MS));
    return 0;
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(64, now - prev); prev = now;
    if (!dragging) { clock += dt; spin += dt * 0.00018; }
    const k = 1 - Math.pow(0.001, dt / 1000);   // frame-rate independent easing
    lean.x += (lean.tx - lean.x) * k; lean.y += (lean.ty - lean.y) * k;
    const rect = stage.getBoundingClientRect();
    const scrolled = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height)));
    yaw.rotation.y = Math.sin(spin) * 0.55 + dragYaw + lean.x * 0.35;
    yaw.rotation.z = -lean.x * 0.06;
    pitch.rotation.x = BASE_PITCH + dragPitch + lean.y * 0.22 + scrolled * 0.45;
    yaw.position.x = lean.x * radius * 0.05;
    yaw.position.y = -scrolled * radius * 0.25 - lean.y * radius * 0.04;
    pose(stageAt(clock));
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
    const root = parallaxRoot || stage;
    root.addEventListener('pointermove', (e) => {
      const r = root.getBoundingClientRect();
      lean.tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      lean.ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
    });
    root.addEventListener('pointerleave', () => { lean.tx = 0; lean.ty = 0; });
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
  renderer.render(scene, camera);
  start();
  return { stages: n };
}
