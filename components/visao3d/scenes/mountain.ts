import * as THREE from "three";
import { formatCurrency } from "@/lib/finance/format";
import { addLights, createStage, easeOutCubic } from "../stage";
import type { SceneData, SceneHandle, SceneMount } from "../scene-types";

type MountainData = Extract<SceneData, { kind: "montanha" }>;

/** Montanha do saldo: uma faixa por mês com o saldo em conta de cada dia. */
export function buildMountain(mount: SceneMount, data: MountainData): SceneHandle {
  const months = data.months;
  const halfDepth = ((months.length - 1) / 2) * 0.8;
  const st = createStage(mount.box, mount.tags, {
    theta: 0.55,
    phi: 1.1,
    target: [0, 1.5, 0],
    sway: 0.5,
    tilt: [0.6, 1.4],
    // Faixas de x = -4,6 a 4,6 (mais o rótulo do mês) e de z = ±halfDepth.
    fit: { radius: Math.hypot(5.9, halfDepth + 0.3), halfHeight: 2 },
  });
  const { scene, reduce } = st;
  addLights(scene);

  const maxAbs = Math.max(1, ...months.flatMap((m) => m.days.map((d) => Math.abs(d.balance))));
  const sx = (day: number) => -4.6 + (day - 1) * (9.2 / 30);
  const sy = (value: number) => (value / maxAbs) * 3.6;
  const zOf = (i: number) => (i - (months.length - 1) / 2) * 0.8;
  // Do mês mais antigo (verde apagado) ao mais novo (verde do app), misturado em sRGB.
  const dim = [0x1f, 0x3a, 0x32];
  const accent = [0x34, 0xd3, 0x99];
  const shade = (t: number) =>
    new THREE.Color().setRGB(
      (dim[0] + (accent[0] - dim[0]) * t) / 255,
      (dim[1] + (accent[1] - dim[1]) * t) / 255,
      (dim[2] + (accent[2] - dim[2]) * t) / 255,
      THREE.SRGBColorSpace,
    );

  const ribbons = months.map((month, i) => {
    const color = shade(0.25 + 0.75 * (months.length > 1 ? i / (months.length - 1) : 1));
    const z = zOf(i);
    const positions: number[] = [];
    const indices: number[] = [];
    month.days.forEach((d) => positions.push(sx(d.day), 0, z, sx(d.day), sy(d.balance), z));
    for (let d = 0; d < month.days.length - 1; d++) {
      const a = d * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      roughness: 0.6,
      emissive: color,
      emissiveIntensity: 0.12,
    });
    const mesh = new THREE.Mesh(geo, material);
    mesh.userData = { index: i };
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(month.days.map((d) => new THREE.Vector3(sx(d.day), sy(d.balance) + 0.01, z))),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }),
    );
    if (!reduce) {
      mesh.scale.y = 0.001;
      line.scale.y = 0.001;
    }
    scene.add(mesh);
    scene.add(line);
    // Com muitos meses, os rótulos se encostam: fica um sim, um não (sempre com o último).
    const labeled = months.length <= 6 || (months.length - 1 - i) % 2 === 0;
    return { month, mesh, material, line, z, tag: labeled ? st.tag(month.label, undefined, "mini") : null };
  });

  const t0 = performance.now();
  const point = new THREE.Vector3();
  st.onFrame((now) => {
    ribbons.forEach((rb, i) => {
      const g = reduce ? 1 : easeOutCubic(Math.min(1, Math.max(0, (now - t0 - i * 90) / 900)));
      rb.mesh.scale.y = Math.max(0.001, g);
      rb.line.scale.y = Math.max(0.001, g);
      if (rb.tag) {
        point.set(sx(1) - 0.45, 0.15, rb.z);
        st.place(rb.tag, point);
      }
    });
  });

  const ray = new THREE.Raycaster();
  st.onTap((ndc) => {
    ray.setFromCamera(ndc, st.camera);
    const hit = ray.intersectObjects(
      ribbons.map((rb) => rb.mesh),
      false,
    )[0];
    ribbons.forEach((rb) => (rb.material.emissiveIntensity = 0.12));
    if (!hit) {
      mount.onDetail(null);
      return;
    }
    const rb = ribbons[hit.object.userData.index as number];
    rb.material.emissiveIntensity = 0.5;
    const { avg, max, min } = rb.month;
    mount.onDetail({
      title: rb.month.label,
      text: `saldo médio ${formatCurrency(avg)} · maior ${formatCurrency(max.balance)} (dia ${max.day}) · menor ${formatCurrency(min.balance)} (dia ${min.day})`,
    });
  });

  return { dispose: st.dispose };
}
