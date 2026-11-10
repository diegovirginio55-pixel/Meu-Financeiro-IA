import * as THREE from "three";
import { formatCurrency } from "@/lib/finance/format";
import { addLights, createStage, easeOutCubic, shortMoney } from "../stage";
import type { SceneData, SceneHandle, SceneMount } from "../scene-types";

type CityData = Extract<SceneData, { kind: "cidade" }>;

/** Cidade do dinheiro: um prédio por categoria, altura = quanto foi gasto no mês. */
export function buildCity(mount: SceneMount, data: CityData): SceneHandle {
  const cats = data.categories;
  const max = Math.max(1, ...cats.map((c) => c.value));
  // As maiores atrás (longe da câmera), as menores na frente.
  const backCount = Math.ceil(cats.length / 2);
  // Meia largura da fileira mais larga + meio prédio + folga para o rótulo.
  const halfWidth = ((backCount - 1) / 2) * 2.5 + 0.75 + 0.6;
  const st = createStage(mount.box, mount.tags, {
    fov: 38,
    theta: 0.7,
    phi: 0.95,
    target: [0, 3.1, 0],
    spin: 0.0025,
    fit: { radius: Math.hypot(halfWidth, 2.3), halfHeight: 3.3 },
  });
  const { scene, reduce } = st;
  addLights(scene);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const grid = new THREE.GridHelper(18, 18, 0x2a2a30, 0x1f1f24);
  grid.position.y = 0.01;
  scene.add(grid);

  const spot = (i: number): [number, number] => {
    const back = i < backCount;
    const cols = back ? backCount : cats.length - backCount;
    const col = back ? i : i - backCount;
    return [(col - (cols - 1) / 2) * 2.5, back ? -1.4 : 1.5];
  };
  const stripGeo = st.track(new THREE.BoxGeometry(1.52, 0.06, 1.52));
  const stripMat = st.track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1 }));

  const buildings = cats.map((c, i) => {
    const h = 0.5 + (c.value / max) * 5.2;
    const color = new THREE.Color(c.color);
    const top = color.clone().lerp(new THREE.Color(0xffffff), 0.25);
    const side = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.15, emissive: color, emissiveIntensity: 0.08 });
    const cap = new THREE.MeshStandardMaterial({ color: top, roughness: 0.4, metalness: 0.1 });
    const geo = new THREE.BoxGeometry(1.5, h, 1.5);
    geo.translate(0, h / 2, 0);
    const mesh = new THREE.Mesh(geo, [side, side, cap, side, side, side]);
    const [x, z] = spot(i);
    mesh.position.set(x, 0, z);
    mesh.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 }),
      ),
    );
    // Janelas: faixas finas claras.
    for (let y = 0.45; y < h - 0.2; y += 0.55) {
      const strip = new THREE.Mesh(stripGeo, stripMat);
      strip.position.y = y;
      mesh.add(strip);
    }
    mesh.scale.y = reduce ? 1 : 0.001;
    mesh.userData = { index: i };
    scene.add(mesh);
    return { mesh, side, h, cat: c, tag: st.tag(c.name, shortMoney(c.value)) };
  });

  const t0 = performance.now();
  const point = new THREE.Vector3();
  st.onFrame((now) => {
    buildings.forEach(({ mesh, h, tag }, i) => {
      const g = reduce ? 1 : easeOutCubic(Math.min(1, Math.max(0, (now - t0 - i * 120) / 1200)));
      mesh.scale.y = Math.max(0.001, g);
      point.set(mesh.position.x, h * mesh.scale.y + 0.35, mesh.position.z);
      st.place(tag, point);
      tag.style.opacity = g > 0.6 ? "1" : "0";
    });
  });

  const ray = new THREE.Raycaster();
  st.onTap((ndc) => {
    ray.setFromCamera(ndc, st.camera);
    const hit = ray.intersectObjects(
      buildings.map((b) => b.mesh),
      false,
    )[0];
    buildings.forEach((b) => (b.side.emissiveIntensity = 0.08));
    if (!hit) {
      mount.onDetail(null);
      return;
    }
    const b = buildings[hit.object.userData.index as number];
    b.side.emissiveIntensity = 0.45;
    const pct = data.total > 0 ? Math.round((b.cat.value / data.total) * 100) : 0;
    mount.onDetail({
      title: b.cat.name,
      text: `${formatCurrency(b.cat.value)} · ${pct}% dos gastos de ${data.monthName} · ${b.cat.count} ${b.cat.count === 1 ? "gasto" : "gastos"}`,
    });
  });

  return { dispose: st.dispose };
}
