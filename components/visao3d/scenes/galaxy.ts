import * as THREE from "three";
import { formatCurrency } from "@/lib/finance/format";
import { createStage, glowTexture, seededRandom, shortMoney } from "../stage";
import type { SceneData, SceneHandle, SceneMount } from "../scene-types";
import type { GastoPoint } from "@/lib/finance/visao3d";

type GalaxyData = Extract<SceneData, { kind: "galaxia" }>;

type Star = { point: GastoPoint; sprite: THREE.Sprite; r: number; a: number; y: number };

function dayMonth(date: string) {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

/** Galáxia dos gastos: o sol são as entradas, cada categoria um planeta e cada compra uma estrela. */
export function buildGalaxy(mount: SceneMount, data: GalaxyData): SceneHandle {
  const cats = data.categories;
  const orbitOf = (i: number) => 3.2 + i * 1.3;
  const maxOrbit = orbitOf(Math.max(0, cats.length - 1));
  const st = createStage(mount.box, mount.tags, {
    theta: 0.3,
    phi: 1.12,
    target: [0, 0, 0],
    spin: 0.0012,
    tilt: [0.35, 1.45],
    // Órbita mais externa + planeta + estrelas em volta dele.
    fit: { radius: maxOrbit + 2, halfHeight: 1.6, near: 0.6 },
  });
  const { scene, reduce } = st;
  const rand = seededRandom(7);
  const tex = st.track(glowTexture());

  // Estrelas do fundo.
  const bgPos = new Float32Array(600 * 3);
  for (let i = 0; i < 600; i++) {
    const r = 40 + rand() * 60;
    const a = rand() * Math.PI * 2;
    const b = Math.acos(2 * rand() - 1);
    bgPos.set([r * Math.sin(b) * Math.cos(a), r * Math.cos(b), r * Math.sin(b) * Math.sin(a)], i * 3);
  }
  const bgGeo = new THREE.BufferGeometry();
  bgGeo.setAttribute("position", new THREE.BufferAttribute(bgPos, 3));
  scene.add(
    new THREE.Points(
      bgGeo,
      new THREE.PointsMaterial({ size: 0.6, map: tex, transparent: true, depthWrite: false, color: 0x8a8a99, opacity: 0.6 }),
    ),
  );

  // Sol = entradas do mês.
  const sunColor = new THREE.Color("#34d399");
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 40, 40), new THREE.MeshBasicMaterial({ color: sunColor })));
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, color: sunColor, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 }),
  );
  halo.scale.set(6, 6, 1);
  scene.add(halo);
  scene.add(new THREE.PointLight(sunColor, 14, 0, 1));
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const sunTag = st.tag("Entradas", shortMoney(data.entradas));

  const byCategory = new Map<string, GastoPoint[]>();
  for (const point of data.points) {
    const list = byCategory.get(point.category) ?? [];
    list.push(point);
    byCategory.set(point.category, list);
  }

  const maxValue = Math.max(1, ...cats.map((c) => c.value));
  const planets = cats.map((c, i) => {
    const orbit = orbitOf(i);
    const radius = 0.3 + 0.55 * Math.sqrt(c.value / maxValue);
    const color = new THREE.Color(c.color);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 32, 32),
      new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1, emissive: color, emissiveIntensity: 0.15 }),
    );
    mesh.userData = { index: i };
    scene.add(mesh);
    const ring = new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 129 }, (_, k) => {
        const a = (k / 128) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a) * orbit, 0, Math.sin(a) * orbit);
      }),
    );
    scene.add(new THREE.Line(ring, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08 })));

    const points = byCategory.get(c.name) ?? [];
    const biggest = points.reduce<GastoPoint | null>((top, p) => (!top || p.value > top.value ? p : top), null);
    const starMaterial = new THREE.SpriteMaterial({ map: tex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const group = new THREE.Group();
    scene.add(group);
    const stars: Star[] = points.map((point) => {
      const sprite = new THREE.Sprite(starMaterial);
      const size = 0.25 + 0.6 * Math.sqrt(point.value / Math.max(0.01, biggest?.value ?? 1));
      sprite.scale.set(size, size, 1);
      sprite.userData = { point };
      group.add(sprite);
      return { point, sprite, r: radius + 0.35 + rand() * (0.9 + Math.min(1.2, points.length / 120)), a: rand() * Math.PI * 2, y: (rand() - 0.5) * 0.5 };
    });
    return {
      cat: c,
      mesh,
      group,
      stars,
      orbit,
      radius,
      biggest,
      angle: i * 1.3,
      speed: 0.0035 / Math.sqrt(orbit / 3.2),
      tag: st.tag(c.name, shortMoney(c.value)),
    };
  });

  const place = new THREE.Vector3();
  st.onFrame((_now, k) => {
    for (const pl of planets) {
      if (!reduce) pl.angle += pl.speed * k;
      const x = Math.cos(pl.angle) * pl.orbit;
      const z = Math.sin(pl.angle) * pl.orbit;
      pl.mesh.position.set(x, 0, z);
      if (!reduce) pl.mesh.rotation.y += 0.004 * k;
      pl.group.position.set(x, 0, z);
      for (const star of pl.stars) {
        if (!reduce) star.a += (0.004 / star.r) * k;
        star.sprite.position.set(Math.cos(star.a) * star.r, star.y, Math.sin(star.a) * star.r);
      }
      place.set(x, pl.radius + 0.7, z);
      st.place(pl.tag, place);
    }
    place.set(0, 1.9, 0);
    st.place(sunTag, place);
  });

  const ray = new THREE.Raycaster();
  st.onTap((ndc) => {
    ray.setFromCamera(ndc, st.camera);
    const planetHit = ray.intersectObjects(
      planets.map((pl) => pl.mesh),
      false,
    )[0];
    if (planetHit) {
      const pl = planets[planetHit.object.userData.index as number];
      const biggest = pl.biggest ? ` · maior compra ${formatCurrency(pl.biggest.value)} (${pl.biggest.description})` : "";
      mount.onDetail({
        title: pl.cat.name,
        text: `${formatCurrency(pl.cat.value)} · ${pl.cat.count} ${pl.cat.count === 1 ? "compra" : "compras"}${biggest}`,
      });
      return;
    }
    const starHit = ray.intersectObjects(
      planets.map((pl) => pl.group),
      true,
    )[0];
    if (starHit) {
      const point = starHit.object.userData.point as GastoPoint;
      mount.onDetail({ title: point.description, text: `${formatCurrency(point.value)} em ${dayMonth(point.date)} · ${point.category}` });
      return;
    }
    mount.onDetail(null);
  });

  return { dispose: st.dispose };
}
