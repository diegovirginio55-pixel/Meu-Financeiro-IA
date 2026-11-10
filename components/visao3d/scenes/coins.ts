import * as THREE from "three";
import { formatCurrency } from "@/lib/finance/format";
import { coinCount } from "@/lib/finance/visao3d";
import { addLights, createStage, seededRandom, shortMoney } from "../stage";
import type { SceneData, SceneHandle, SceneMount } from "../scene-types";

type CoinsData = Extract<SceneData, { kind: "moedas" }>;

const COIN_HEIGHT = 0.14;

function bounce(t: number) {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}

/** Moedas que caem: cada moeda vale `unit`; uma pilha por categoria. */
export function buildCoins(mount: SceneMount, data: CoinsData): SceneHandle {
  const cats = data.categories;
  const counts = cats.map((c) => coinCount(c.value, data.unit));
  const spacing = 2;
  const halfWidth = ((cats.length - 1) / 2) * spacing + 0.6;
  const stackHeight = Math.max(1, ...counts) * COIN_HEIGHT;
  // Altura com o rótulo em cima da pilha mais alta.
  const height = stackHeight + 0.8;
  const st = createStage(mount.box, mount.tags, {
    fov: 40,
    theta: 0.5,
    phi: 1.05,
    target: [0, height / 2, 0],
    sway: 0.45,
    // A fileira nunca é vista de ponta (a câmera só balança), então avança menos que a largura.
    fit: { radius: Math.max(3, halfWidth + 1), halfHeight: Math.max(1.5, height / 2), depth: Math.max(2, halfWidth * 0.8) },
  });
  const { scene, reduce } = st;
  addLights(scene);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(Math.max(9, halfWidth + 3), 64),
    new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const rand = seededRandom(7);
  const geo = st.track(new THREE.CylinderGeometry(0.5, 0.5, 0.13, 40));
  const coins: THREE.Mesh[] = [];
  const stacks = cats.map((c, i) => {
    const count = counts[i];
    const x0 = (i - (cats.length - 1) / 2) * spacing;
    const color = new THREE.Color(c.color);
    const face = new THREE.MeshStandardMaterial({
      color: color.clone().lerp(new THREE.Color(0xffffff), 0.15),
      metalness: 0.75,
      roughness: 0.3,
    });
    const rim = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.45 });
    // Pilhas grandes caem mais rápido, para todas terminarem em ~2 s.
    const step = Math.min(70, 1600 / Math.max(1, count));
    for (let k = 0; k < count; k++) {
      const mesh = new THREE.Mesh(geo, [rim, face, face]);
      mesh.userData = {
        stack: i,
        k,
        x: x0 + (rand() - 0.5) * 0.1,
        z: (rand() - 0.5) * 0.1,
        delay: i * 140 + k * step,
        startY: 7 + stackHeight + rand() * 3,
      };
      mesh.rotation.y = rand() * Math.PI;
      mesh.visible = reduce;
      scene.add(mesh);
      coins.push(mesh);
    }
    return {
      cat: c,
      count,
      tag: st.tag(c.name, shortMoney(c.value)),
      x: x0,
      top: count * COIN_HEIGHT + 0.55,
      ready: i * 140 + count * step + 500,
    };
  });

  let t0 = performance.now();
  const point = new THREE.Vector3();
  st.onFrame((now) => {
    for (const mesh of coins) {
      const u = mesh.userData as { k: number; x: number; z: number; delay: number; startY: number };
      const rest = 0.07 + u.k * COIN_HEIGHT;
      const t = reduce ? 1 : Math.min(1, Math.max(0, (now - t0 - u.delay) / 650));
      mesh.position.set(u.x, u.startY + (rest - u.startY) * bounce(t), u.z);
      mesh.visible = t > 0;
    }
    for (const stack of stacks) {
      point.set(stack.x, stack.top, 0);
      st.place(stack.tag, point);
      stack.tag.style.opacity = reduce || now - t0 > stack.ready ? "1" : "0";
    }
  });

  const ray = new THREE.Raycaster();
  st.onTap((ndc) => {
    ray.setFromCamera(ndc, st.camera);
    const hit = ray.intersectObjects(coins, false)[0];
    if (!hit) {
      mount.onDetail(null);
      return;
    }
    const stack = stacks[hit.object.userData.stack as number];
    mount.onDetail({
      title: stack.cat.name,
      text: `${stack.count} ${stack.count === 1 ? "moeda" : "moedas"} de ${shortMoney(data.unit)} ≈ ${formatCurrency(stack.cat.value)}`,
    });
  });

  return {
    dispose: st.dispose,
    replay() {
      t0 = performance.now();
      st.invalidate();
    },
  };
}
