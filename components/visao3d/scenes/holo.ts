import * as THREE from "three";
import { formatCurrency } from "@/lib/finance/format";
import { createStage, shortMoney } from "../stage";
import type { SceneData, SceneHandle, SceneMount } from "../scene-types";

type HoloData = Extract<SceneData, { kind: "holograma" }>;

type HoloUniforms = {
  uTime: { value: number };
  uColor: { value: THREE.Color };
  uBase: { value: number };
  uMap: { value: THREE.Texture | null };
  uUseMap: { value: number };
};

const VERTEX = /* glsl */ `
  varying vec3 vN; varying vec3 vView; varying vec3 vWorld; varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vN = normalize(normalMatrix * normal);
    vec4 mv = viewMatrix * world;
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;

// Brilho nas bordas (fresnel), linhas de varredura e tremulação de sinal.
const FRAGMENT = /* glsl */ `
  uniform float uTime; uniform vec3 uColor; uniform float uBase; uniform sampler2D uMap; uniform float uUseMap;
  varying vec3 vN; varying vec3 vView; varying vec3 vWorld; varying vec2 vUv;
  void main() {
    float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.0);
    float scan = 0.62 + 0.38 * sin(vWorld.y * 55.0 - uTime * 5.0);
    float flick = 0.93 + 0.07 * sin(uTime * 37.0) * sin(uTime * 11.0);
    float a = (uBase + fres * 0.95) * scan * flick;
    vec3 col = uColor * (0.55 + fres * 1.3);
    if (uUseMap > 0.5) {
      vec4 t = texture2D(uMap, vUv);
      a = t.a * (0.7 + 0.3 * scan) * flick;
      col = mix(uColor, vec3(1.0), t.r * 0.35);
    }
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }`;

/** Holograma: projetor, anéis por categoria (arco = % dos gastos) e o saldo em conta flutuando. */
export function buildHolo(mount: SceneMount, data: HoloData): SceneHandle {
  const st = createStage(mount.box, mount.tags, {
    fov: 36,
    theta: 0.4,
    phi: 1,
    radius: 9.5,
    target: [0, 2.3, 0],
    spin: 0.003,
    clearColor: 0x000000,
  });
  const { scene, camera, renderer, reduce } = st;
  const cyan = new THREE.Color("#5eead4");
  const uniforms: HoloUniforms[] = [];

  function holoMaterial(color: THREE.Color, base = 0.12, map: THREE.Texture | null = null) {
    const u: HoloUniforms = {
      uTime: { value: 0 },
      uColor: { value: color },
      uBase: { value: base },
      uMap: { value: map },
      uUseMap: { value: map ? 1 : 0 },
    };
    uniforms.push(u);
    return new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }

  // Projetor.
  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const lamp = new THREE.PointLight(cyan, 4, 12, 1);
  lamp.position.set(0, 1, 0);
  scene.add(lamp);
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.7, 1.95, 0.28, 64),
    new THREE.MeshStandardMaterial({ color: 0x15161a, metalness: 0.8, roughness: 0.35 }),
  );
  base.position.y = 0.14;
  scene.add(base);
  const lens = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.035, 8, 96), new THREE.MeshBasicMaterial({ color: cyan }));
  lens.rotation.x = Math.PI / 2;
  lens.position.y = 0.29;
  scene.add(lens);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 1.55, 4.4, 64, 1, true), holoMaterial(cyan, 0.015));
  beam.position.y = 2.5;
  scene.add(beam);

  // Anéis por categoria.
  const holo = new THREE.Group();
  scene.add(holo);
  const cats = data.categories;
  const ringStep = cats.length > 1 ? Math.min(0.48, 2.6 / (cats.length - 1)) : 0;
  const rings = cats.map((c, i) => {
    const color = new THREE.Color(c.color).lerp(cyan, 0.25);
    const y = 1.0 + i * ringStep;
    const track = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.018, 6, 96), holoMaterial(color, 0.05));
    track.rotation.x = Math.PI / 2;
    track.position.y = y;
    holo.add(track);
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(1.25, 0.075, 12, 128, Math.max(0.01, c.share * Math.PI * 2)),
      holoMaterial(color, 0.35),
    );
    arc.rotation.x = Math.PI / 2;
    arc.position.y = y;
    holo.add(arc);
    return {
      arc,
      y,
      share: c.share,
      tag: st.tag(c.name, `${Math.round(c.share * 100)}% · ${shortMoney(c.value)}`),
      speed: (i % 2 ? -1 : 1) * (0.25 + i * 0.07),
    };
  });

  // Saldo em conta como "tela" holográfica, sempre de frente para a câmera.
  const textCanvas = document.createElement("canvas");
  textCanvas.width = 1024;
  textCanvas.height = 256;
  const context = textCanvas.getContext("2d");
  const fontFamily = getComputedStyle(mount.box).fontFamily || "system-ui, sans-serif";
  const drawPanel = () => {
    if (!context) return;
    context.clearRect(0, 0, textCanvas.width, textCanvas.height);
    context.fillStyle = "#fff";
    context.textAlign = "center";
    context.font = `800 120px ${fontFamily}`;
    context.fillText(formatCurrency(data.accountBalance), 512, 140, 1000);
    context.font = `500 52px ${fontFamily}`;
    context.fillText("saldo em conta agora", 512, 222, 1000);
  };
  drawPanel();
  const panelTexture = new THREE.CanvasTexture(textCanvas);
  panelTexture.colorSpace = THREE.SRGBColorSpace;
  st.track(panelTexture);
  let disposed = false;
  document.fonts?.ready
    .then(() => {
      if (disposed) return;
      drawPanel();
      panelTexture.needsUpdate = true;
      st.invalidate();
    })
    .catch(() => {});
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), holoMaterial(cyan, 0, panelTexture));
  panel.position.y = 4.05;
  holo.add(panel);

  // Poeira subindo no feixe.
  const dustCount = 90;
  const dustPos = new Float32Array(dustCount * 3);
  const dust = Array.from({ length: dustCount }, () => {
    const r = Math.random() * 1.9;
    const a = Math.random() * Math.PI * 2;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: 0.3 + Math.random() * 4.2, s: 0.004 + Math.random() * 0.01 };
  });
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  scene.add(
    new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({ color: cyan, size: 0.035, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }),
    ),
  );

  let pyramid = false;
  let glitchUntil = 0;
  let nextGlitch = performance.now() + 2500;

  st.onFrame((now, k) => {
    for (const u of uniforms) u.uTime.value = reduce ? 0 : now / 1000;
    // Falha de sinal de vez em quando.
    if (!reduce && now > nextGlitch) {
      glitchUntil = now + 130;
      nextGlitch = now + 2500 + Math.random() * 3500;
    }
    const glitch = !reduce && now < glitchUntil;
    holo.position.x = glitch ? (Math.random() - 0.5) * 0.12 : 0;
    holo.scale.setScalar(glitch ? 0.98 + Math.random() * 0.04 : 1);
    if (!reduce) for (const ring of rings) ring.arc.rotation.z += ring.speed * 0.01 * k;
    dust.forEach((d, i) => {
      if (!reduce) {
        d.y += d.s * k;
        if (d.y > 4.6) d.y = 0.3;
      }
      dustPos[i * 3] = d.x;
      dustPos[i * 3 + 1] = d.y;
      dustPos[i * 3 + 2] = d.z;
    });
    dustGeo.attributes.position.needsUpdate = true;
  });

  const target = new THREE.Vector3(0, 2.3, 0);
  const aim = (azimuth: number, roll: number, aspect: number) => {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    camera.position.set(Math.sin(azimuth) * 9.5, 4.2, Math.cos(azimuth) * 9.5);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    if (roll) camera.rotateZ(roll);
  };
  const point = new THREE.Vector3();

  st.setRender(() => {
    const W = st.size.width;
    const H = st.size.height;
    const theta = st.orbit.theta;
    if (!pyramid) {
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, W, H);
      aim(theta, 0, W / H);
      panel.quaternion.copy(camera.quaternion);
      renderer.render(scene, camera);
      for (const ring of rings) {
        const end = ring.arc.rotation.z + ring.share * Math.PI * 2;
        point.set(Math.cos(end) * 1.25, ring.y + 0.12, Math.sin(end) * 1.25).applyMatrix4(holo.matrixWorld);
        st.place(ring.tag, point);
      }
      return;
    }
    // Modo pirâmide: 4 vistas em cruz, cada uma com o topo apontando para fora do centro.
    renderer.setScissorTest(true);
    renderer.setViewport(0, 0, W, H);
    renderer.setScissor(0, 0, W, H);
    renderer.clear();
    const s = Math.min(W, H) / 3;
    const cx = W / 2;
    const cy = H / 2;
    const views = [
      { x: cx - s / 2, y: cy + s / 2, az: theta, roll: 0 },
      { x: cx - s / 2, y: cy - (3 * s) / 2, az: theta + Math.PI, roll: Math.PI },
      { x: cx - (3 * s) / 2, y: cy - s / 2, az: theta - Math.PI / 2, roll: -Math.PI / 2 },
      { x: cx + s / 2, y: cy - s / 2, az: theta + Math.PI / 2, roll: Math.PI / 2 },
    ];
    for (const view of views) {
      renderer.setViewport(view.x, view.y, s, s);
      renderer.setScissor(view.x, view.y, s, s);
      aim(view.az, view.roll, 1);
      panel.quaternion.copy(camera.quaternion);
      renderer.render(scene, camera);
    }
    renderer.setScissorTest(false);
  });

  return {
    dispose() {
      disposed = true;
      st.dispose();
    },
    setPyramid(on) {
      pyramid = on;
      st.invalidate();
    },
  };
}
