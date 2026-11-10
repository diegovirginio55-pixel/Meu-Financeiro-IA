import * as THREE from "three";

export type StageOptions = {
  fov?: number;
  theta: number;
  phi: number;
  /** Distância da câmera (sem `fit`). */
  radius?: number;
  target: [number, number, number];
  /** Giro automático por quadro (medido a 60 fps). */
  spin?: number;
  /** Balanço automático (amplitude em radianos) em vez de giro contínuo. */
  sway?: number;
  /** Arrastar para cima/baixo inclina a câmera entre estes ângulos. */
  tilt?: [number, number];
  /** Fundo opaco; sem ele o canvas é transparente e aparece o fundo da caixa. */
  clearColor?: number;
  /**
   * Enquadramento automático: a distância da câmera é recalculada para caber
   * um "cilindro" em volta do alvo (raio no chão e meia altura), em qualquer
   * ângulo e proporção de tela (celular em pé ou computador). Ignora `radius`.
   * `depth`: quanto o conteúdo avança na direção da câmera (padrão: o raio);
   * `near`: 0 a 1, quanto descontar a perspectiva da borda de baixo.
   */
  fit?: { radius: number; halfHeight: number; depth?: number; near?: number; scale?: number };
};

export type Stage = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  /** prefers-reduced-motion: nada se mexe sozinho e só desenha quando precisa. */
  reduce: boolean;
  orbit: { theta: number; phi: number; radius: number; dragging: boolean };
  size: { width: number; height: number };
  /** `k` = quadros de 60 fps desde o último (para a velocidade não depender da tela). */
  onFrame: (fn: (now: number, k: number) => void) => void;
  onTap: (fn: (ndc: THREE.Vector2) => void) => void;
  /** Troca o desenho padrão (câmera orbital + render) por um próprio. */
  setRender: (fn: (now: number) => void) => void;
  place: (el: HTMLElement, point: THREE.Vector3, camera?: THREE.Camera) => void;
  tag: (label: string, value?: string, variant?: "mini") => HTMLDivElement;
  track: <T extends { dispose: () => void }>(resource: T) => T;
  invalidate: () => void;
  dispose: () => void;
};

const TAG_CLASS =
  "pointer-events-none absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-[#3f3f46] bg-[#09090b]/80 px-1.5 py-0.5 text-[11px] leading-tight text-[#f4f4f5] transition-opacity duration-300";
const MINI_TAG_CLASS =
  "pointer-events-none absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-[#3f3f46] bg-[#09090b]/70 px-1 py-px text-[10px] leading-tight text-[#a1a1aa]";
const TAG_VALUE_CLASS = "ml-1 font-mono text-[10px] text-[#a1a1aa]";

function disposeMaterial(material: THREE.Material) {
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) value.dispose();
  }
  if (material instanceof THREE.ShaderMaterial) {
    for (const uniform of Object.values(material.uniforms)) {
      if (uniform.value instanceof THREE.Texture) uniform.value.dispose();
    }
  }
  material.dispose();
}

/** Luzes padrão das cenas (intensidades já no modo físico do three r155+). */
export function addLights(scene: THREE.Scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 2.7);
  sun.position.set(6, 12, 8);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x34d399, 0.9);
  rim.position.set(-8, 5, -6);
  scene.add(rim);
}

/** Textura de brilho redondo (estrelas, halo do sol). */
export function glowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.25, "rgba(255,255,255,0.6)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Gerador pseudoaleatório com semente: a cena sai igual toda vez que abre. */
export function seededRandom(seed = 7) {
  let state = seed;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
}

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Valor curto para rótulo: "R$ 1.500" (sem os centavos quando são ,00). */
export function shortMoney(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/,00$/, "");
}

/**
 * Cena 3D dentro de `box`: cria o canvas, gira arrastando, detecta toque,
 * prende rótulos HTML a pontos 3D, pausa fora da tela/aba oculta e, no
 * `dispose`, libera renderer, geometrias, materiais e texturas.
 * Lança erro se o WebGL não abrir.
 */
export function createStage(box: HTMLElement, tagsLayer: HTMLElement, opt: StageOptions): Stage {
  const canvas = document.createElement("canvas");
  canvas.className = "block h-full w-full";
  canvas.setAttribute("aria-hidden", "true");
  box.prepend(canvas);

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: opt.clearColor === undefined });
  } catch (error) {
    canvas.remove();
    throw error;
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  if (opt.clearColor !== undefined) renderer.setClearColor(opt.clearColor, 1);
  else renderer.setClearColor(0x000000, 0);

  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(opt.fov ?? 40, 1, 0.1, 400);
  const target = new THREE.Vector3(...opt.target);
  const orbit = { theta: opt.theta, phi: opt.phi, radius: opt.radius ?? 15, dragging: false };
  const size = { width: 1, height: 1 };
  const frames: ((now: number, k: number) => void)[] = [];
  const tracked: { dispose: () => void }[] = [];
  let tap: ((ndc: THREE.Vector2) => void) | null = null;
  let customRender: ((now: number) => void) | null = null;
  let lastInteraction = -1e9;
  let moved = 0;
  let lastX = 0;
  let lastY = 0;
  let raf = 0;
  let lastNow = 0;
  let inView = true;
  let disposed = false;

  const active = () => !disposed && inView && document.visibilityState !== "hidden";

  /** Distância para o cilindro do conteúdo caber na largura e na altura da tela. */
  function fitDistance({ radius, halfHeight, depth = radius, near = 0, scale = 1 }: NonNullable<StageOptions["fit"]>) {
    const tanV = Math.tan((camera.fov * Math.PI) / 360);
    const tanH = tanV * camera.aspect;
    const elevation = Math.abs(Math.PI / 2 - orbit.phi);
    const cos = Math.cos(elevation);
    // Na largura: o lado mais perto da câmera aparece maior (perspectiva).
    const horizontal = radius * Math.sqrt(1 / (tanH * tanH) + cos * cos);
    // Na altura: visto de cima, o chão do cilindro vira uma elipse que também ocupa altura.
    const vertical = (halfHeight * cos + depth * Math.sin(elevation)) / tanV + near * depth * cos;
    return Math.max(horizontal, vertical) * scale;
  }
  // A tela cheia pode ser pedida num elemento que contém a caixa.
  const inFullscreen = () => Boolean(document.fullscreenElement?.contains(box));

  function frame(now: number) {
    raf = 0;
    if (!active()) return;
    const k = lastNow ? Math.min(4, Math.max(0, (now - lastNow) / (1000 / 60))) : 1;
    lastNow = now;
    if (!reduce && !orbit.dragging && now - lastInteraction > 2500) {
      if (opt.sway) orbit.theta += (opt.theta + Math.sin(now / 4000) * opt.sway - orbit.theta) * 0.02 * k;
      else if (opt.spin) orbit.theta += opt.spin * k;
    }
    for (const fn of frames) fn(now, k);
    if (opt.fit) orbit.radius = fitDistance(opt.fit);
    if (customRender) {
      customRender(now);
    } else {
      camera.position.set(
        target.x + orbit.radius * Math.sin(orbit.phi) * Math.sin(orbit.theta),
        target.y + orbit.radius * Math.cos(orbit.phi),
        target.z + orbit.radius * Math.sin(orbit.phi) * Math.cos(orbit.theta),
      );
      camera.lookAt(target);
      renderer.render(scene, camera);
    }
    // Sem "reduzir movimento", o laço segue enquanto a cena estiver visível;
    // com ele, só desenha de novo quando algo pede (arrastar, tocar, redimensionar).
    if (!reduce) raf = requestAnimationFrame(frame);
  }

  function invalidate() {
    if (!raf && active()) {
      // Voltando de uma pausa: o primeiro quadro não "pula" o tempo parado.
      lastNow = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  function resize() {
    const width = box.clientWidth;
    const height = box.clientHeight;
    if (!width || !height) return;
    size.width = width;
    size.height = height;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    invalidate();
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    orbit.dragging = true;
    moved = 0;
    lastX = event.clientX;
    lastY = event.clientY;
    lastInteraction = performance.now();
    try {
      box.setPointerCapture(event.pointerId);
    } catch {
      // Sem captura, o arraste só vale dentro da caixa.
    }
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!orbit.dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    orbit.theta -= dx * 0.01;
    if (opt.tilt) orbit.phi = Math.min(opt.tilt[1], Math.max(opt.tilt[0], orbit.phi - dy * 0.006));
    lastInteraction = performance.now();
    invalidate();
  };
  const onPointerUp = (event: PointerEvent) => {
    if (!orbit.dragging) return;
    orbit.dragging = false;
    lastInteraction = performance.now();
    if (moved < 6 && tap) {
      const rect = box.getBoundingClientRect();
      tap(
        new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1,
        ),
      );
    }
    invalidate();
  };
  const onPointerCancel = () => {
    orbit.dragging = false;
  };
  const onVisibility = () => invalidate();
  const onFullscreen = () => {
    inView = inView || inFullscreen();
    resize();
  };

  box.addEventListener("pointerdown", onPointerDown);
  box.addEventListener("pointermove", onPointerMove);
  box.addEventListener("pointerup", onPointerUp);
  box.addEventListener("pointercancel", onPointerCancel);
  document.addEventListener("visibilitychange", onVisibility);
  document.addEventListener("fullscreenchange", onFullscreen);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(box);
  const intersection = new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting || inFullscreen();
      if (inView) invalidate();
    },
    { threshold: 0.05 },
  );
  intersection.observe(box);

  const projected = new THREE.Vector3();

  const stage: Stage = {
    scene,
    camera,
    renderer,
    reduce,
    orbit,
    size,
    onFrame: (fn) => {
      frames.push(fn);
    },
    onTap: (fn) => {
      tap = fn;
    },
    setRender: (fn) => {
      customRender = fn;
    },
    place(el, point, cam = camera) {
      projected.copy(point).project(cam);
      const visible = projected.z > -1 && projected.z < 1 && Math.abs(projected.x) <= 1.1 && Math.abs(projected.y) <= 1.1;
      el.style.visibility = visible ? "visible" : "hidden";
      el.style.left = `${(projected.x * 0.5 + 0.5) * size.width}px`;
      el.style.top = `${(-projected.y * 0.5 + 0.5) * size.height}px`;
    },
    tag(label, value, variant) {
      const el = document.createElement("div");
      el.className = variant === "mini" ? MINI_TAG_CLASS : TAG_CLASS;
      el.style.visibility = "hidden";
      el.append(document.createTextNode(label));
      if (value) {
        const small = document.createElement("small");
        small.className = TAG_VALUE_CLASS;
        small.textContent = value;
        el.append(small);
      }
      tagsLayer.append(el);
      return el;
    },
    track(resource) {
      tracked.push(resource);
      return resource;
    },
    invalidate,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      resizeObserver.disconnect();
      intersection.disconnect();
      box.removeEventListener("pointerdown", onPointerDown);
      box.removeEventListener("pointermove", onPointerMove);
      box.removeEventListener("pointerup", onPointerUp);
      box.removeEventListener("pointercancel", onPointerCancel);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("fullscreenchange", onFullscreen);
      scene.traverse((object) => {
        const mesh = object as Partial<THREE.Mesh>;
        mesh.geometry?.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach(disposeMaterial);
        else if (material) disposeMaterial(material);
      });
      scene.clear();
      for (const resource of tracked) resource.dispose();
      tracked.length = 0;
      frames.length = 0;
      tap = null;
      customRender = null;
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      tagsLayer.replaceChildren();
    },
  };

  resize();
  invalidate();
  return stage;
}
