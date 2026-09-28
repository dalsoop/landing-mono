// Effect 1: clear aligner trays. The plan plays as a series of trays; each tray is the next target shape,
// seats over the teeth, the teeth move into it, and it comes off before the next one. A highlight sweeps across each new tray.
const TRAYS = 6;          // trays shown per loop (each covers n / TRAYS stages)
const INFLATE_MM = 0.5;   // tray shell offset along the surface normal

export function createFx({ THREE, scene, model, teeth, removed, n, radius, toothPose }) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, transmission: 0.92, thickness: 0.6, ior: 1.5,
    roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08, transparent: true, opacity: 0, depthWrite: false,
  });
  // Glass read: a fresnel rim plus a soft highlight band that sweeps across the tray in world x.
  const rim = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uSweep: { value: -1e4 }, uWidth: { value: radius * 0.12 } },
    vertexShader: `
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform float uOpacity; uniform float uSweep; uniform float uWidth;
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        float band = exp(-pow((vW.x - uSweep) / uWidth, 2.0));
        float a = uOpacity * (0.10 + 0.75 * f + 0.55 * band);
        gl_FragColor = vec4(vec3(1.0), clamp(a, 0.0, 1.0));
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const shells = [];
  for (const [id, m] of Object.entries(teeth)) {
    if (removed.has(id)) continue;
    const g = m.geometry.clone();
    const p = g.attributes.position, nrm = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      p.setXYZ(i, p.getX(i) + nrm.getX(i) * INFLATE_MM, p.getY(i) + nrm.getY(i) * INFLATE_MM, p.getZ(i) + nrm.getZ(i) * INFLATE_MM);
    }
    g.computeVertexNormals();
    const shell = new THREE.Mesh(g, mat);
    shell.renderOrder = 2;
    const glow = new THREE.Mesh(g, rim);
    glow.renderOrder = 3;
    shell.add(glow);
    model.add(shell);
    shells.push({ id, shell });
  }

  // A white light that crosses the arch once per tray; the clearcoat picks it up as a moving reflection.
  const sweep = new THREE.DirectionalLight(0xffffff, 0);
  scene.add(sweep);

  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const clamp = (x) => Math.min(1, Math.max(0, x));
  const seg = (p) => {
    const f = Math.min(TRAYS - 1e-6, p * TRAYS);
    return { i: Math.floor(f), u: f - Math.floor(f) };
  };
  // Within a tray: 0–.25 seat, .25–.8 teeth move, .8–1 remove (the last tray stays on through the hold).
  const playS = (p) => {
    const { i, u } = seg(p);
    return (n * (i + ease(clamp((u - 0.25) / 0.55)))) / TRAYS;
  };

  let shownFor = -1;
  function placeShells(stage) {
    if (shownFor === stage) return;
    shownFor = stage;
    for (const { id, shell } of shells) {
      const q = toothPose(id, stage);
      shell.position.set(q[0], q[1], q[2]);
      shell.rotation.set(0, 0, q[3]);
    }
  }

  function update(at) {
    let opacity = 0, sweepT = -1;
    if (at.phase === 'play') {
      const { i, u } = seg(at.p);
      placeShells((n * (i + 1)) / TRAYS);
      const seat = clamp(u / 0.2);
      const off = i === TRAYS - 1 ? 1 : 1 - clamp((u - 0.8) / 0.18);
      opacity = Math.min(seat, off);
      sweepT = clamp(u / 0.45);
    } else if (at.phase === 'hold') {
      placeShells(n); opacity = 1;
    } else if (at.phase === 'back') {
      placeShells(n); opacity = 1 - clamp(at.p * 2.5);
    }
    mat.opacity = 0.35 * opacity;
    rim.uniforms.uOpacity.value = opacity;
    for (const { shell } of shells) shell.visible = opacity > 0.01;
    if (sweepT >= 0 && sweepT < 1) {
      const x = (sweepT * 2 - 1) * radius * 1.6;
      sweep.position.set(x, radius * 0.9, radius * 1.2);
      sweep.intensity = 1.6 * Math.sin(Math.PI * sweepT) * opacity;
      rim.uniforms.uSweep.value = model.localToWorld(new THREE.Vector3()).x + (sweepT * 2 - 1) * radius * 1.2;
    } else {
      sweep.intensity = 0;
      rim.uniforms.uSweep.value = -1e4;
    }
  }

  return { playS, update };
}
