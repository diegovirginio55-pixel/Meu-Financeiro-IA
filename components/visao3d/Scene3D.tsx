"use client";

import { useEffect, useRef, useState } from "react";
import type { SceneData, SceneDetail, SceneHandle, SceneMount } from "./scene-types";

type Builder = (mount: SceneMount) => SceneHandle;

/** Baixa o three e a cena só quando ela vai aparecer (nada disso entra no resto do app). */
async function loadBuilder(data: SceneData): Promise<Builder> {
  switch (data.kind) {
    case "cidade": {
      const { buildCity } = await import("./scenes/city");
      return (mount) => buildCity(mount, data);
    }
    case "moedas": {
      const { buildCoins } = await import("./scenes/coins");
      return (mount) => buildCoins(mount, data);
    }
    case "galaxia": {
      const { buildGalaxy } = await import("./scenes/galaxy");
      return (mount) => buildGalaxy(mount, data);
    }
    case "montanha": {
      const { buildMountain } = await import("./scenes/mountain");
      return (mount) => buildMountain(mount, data);
    }
    case "holograma": {
      const { buildHolo } = await import("./scenes/holo");
      return (mount) => buildHolo(mount, data);
    }
  }
}

const BACKGROUND: Record<SceneData["kind"], string> = {
  cidade: "radial-gradient(120% 90% at 50% 100%, #15241f, #18181b 60%)",
  moedas: "radial-gradient(120% 90% at 50% 100%, #15241f, #18181b 60%)",
  galaxia: "radial-gradient(90% 80% at 50% 50%, #0d1a16, #07070a 70%)",
  montanha: "radial-gradient(120% 90% at 50% 100%, #0f1d18, #18181b 65%)",
  holograma: "#000000",
};

const PYRAMID_TEXT =
  "4 vistas (frente, costas e lados) com o topo para fora: é o que a pirâmide reflete para formar a imagem no ar.";
const FULLSCREEN_UNAVAILABLE = "Tela cheia não está disponível neste aparelho ou navegador.";

const buttonClass =
  "rounded-full border border-zinc-800 bg-zinc-900 px-3.5 py-1.5 text-sm text-zinc-200 hover:border-zinc-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400";

type FullscreenTarget = HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void };

/**
 * Uma cena 3D: monta ao aparecer e desmonta (com dispose de tudo) ao sair.
 * Quem usa deve trocar a `key` quando a aba ou o mês mudam.
 */
export default function Scene3D({ data, label, idleDetail }: { data: SceneData; label: string; idleDetail: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const tagsRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<SceneHandle | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [detail, setDetail] = useState<SceneDetail>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pyramid, setPyramid] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    const tags = tagsRef.current;
    if (!host || !tags) return;
    let cancelled = false;
    let handle: SceneHandle | null = null;
    loadBuilder(data)
      .then((build) => {
        if (cancelled) return;
        handle = build({ box: host, tags, onDetail: setDetail });
        handleRef.current = handle;
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
      handle?.dispose();
      handleRef.current = null;
    };
  }, [data]);

  useEffect(() => {
    if (data.kind !== "holograma") return;
    const onChange = () => setFullscreen(Boolean(frameRef.current) && document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [data.kind]);

  function togglePyramid() {
    const next = !pyramid;
    setNotice(null);
    setPyramid(next);
    handleRef.current?.setPyramid?.(next);
  }

  function enterFullscreen() {
    const frame = frameRef.current as FullscreenTarget | null;
    if (!frame) return;
    setNotice(null);
    const request = frame.requestFullscreen
      ? () => frame.requestFullscreen()
      : frame.webkitRequestFullscreen
        ? () => frame.webkitRequestFullscreen?.()
        : null;
    if (!request) {
      setNotice(FULLSCREEN_UNAVAILABLE);
      return;
    }
    Promise.resolve()
      .then(request)
      .catch(() => setNotice(FULLSCREEN_UNAVAILABLE));
  }

  function exitFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }

  const isHolo = data.kind === "holograma";
  const sizeClass = pyramid ? "mx-auto aspect-square max-h-[82vh] max-w-[82vh]" : isHolo ? "h-[380px]" : "h-[340px]";
  const message = notice ?? (pyramid ? PYRAMID_TEXT : null);

  return (
    <div>
      <div
        ref={frameRef}
        className={`relative w-full overflow-hidden rounded-2xl border border-zinc-800 [&:fullscreen]:rounded-none [&:fullscreen]:border-0 ${sizeClass}`}
        style={{ background: BACKGROUND[data.kind] }}
      >
        <div
          ref={hostRef}
          role="img"
          aria-label={label}
          className="absolute inset-0 cursor-grab touch-pan-y select-none active:cursor-grabbing"
        />
        <div ref={tagsRef} className={`pointer-events-none absolute inset-0 ${pyramid ? "hidden" : ""}`} />
        {status === "loading" ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-[#a1a1aa]">
            Carregando o 3D…
          </div>
        ) : null}
        {status === "failed" ? (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-[#a1a1aa]">
            O 3D não abriu neste aparelho ou navegador. Os valores estão na lista logo abaixo.
          </div>
        ) : null}
        {fullscreen ? (
          <button
            type="button"
            onClick={exitFullscreen}
            className="absolute right-3 top-3 rounded-full border border-[#3f3f46] bg-[#09090b]/80 px-3 py-1.5 text-sm text-[#f4f4f5]"
          >
            Sair da tela cheia
          </button>
        ) : null}
      </div>

      <p aria-live="polite" className="mt-3 min-h-5 text-[13px] leading-snug text-zinc-400">
        {message ? (
          message
        ) : detail ? (
          <>
            <b className="font-semibold text-zinc-100">{detail.title}</b>: {detail.text}
          </>
        ) : (
          idleDetail
        )}
      </p>

      {data.kind === "moedas" && status === "ready" ? (
        <div className="mt-3">
          <button type="button" className={buttonClass} onClick={() => handleRef.current?.replay?.()}>
            Jogar as moedas de novo
          </button>
        </div>
      ) : null}

      {isHolo ? (
        <>
          {status === "ready" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={pyramid}
                className={`${buttonClass} ${pyramid ? "border-emerald-400/60 text-emerald-200" : ""}`}
                onClick={togglePyramid}
              >
                {pyramid ? "Voltar ao normal" : "Modo pirâmide"}
              </button>
              <button type="button" className={buttonClass} onClick={enterFullscreen}>
                Tela cheia
              </button>
            </div>
          ) : null}
          <details className="mt-3 text-[13px] text-zinc-400">
            <summary className="cursor-pointer text-zinc-200">Como fazer a pirâmide (5 minutos)</summary>
            <p className="mt-2 leading-relaxed">
              Corte 4 trapézios de plástico transparente (a capa de um CD serve): 1 cm no lado menor, 6 cm no maior e
              3,5 cm de altura. Junte as laterais com fita, ligue o modo pirâmide em tela cheia, apague a luz e coloque a
              pirâmide com a ponta menor para baixo, no centro da tela. Olhe de lado: o holograma aparece flutuando
              dentro dela.
            </p>
          </details>
        </>
      ) : null}
    </div>
  );
}
