// Tipos das cenas 3D. Não importa o three: é usado pelo componente React,
// que só baixa o three (e as cenas) quando monta uma cena.
import type { BalanceMonth, CategorySlice, GastoPoint } from "@/lib/finance/visao3d";

export type SceneDetail = { title: string; text: string } | null;

export type SceneData =
  | { kind: "cidade"; monthName: string; categories: CategorySlice[]; total: number }
  | { kind: "moedas"; categories: CategorySlice[]; unit: number }
  | { kind: "galaxia"; categories: CategorySlice[]; points: GastoPoint[]; entradas: number }
  | { kind: "montanha"; months: BalanceMonth[] }
  | { kind: "holograma"; categories: CategorySlice[]; accountBalance: number };

export type SceneMount = {
  /** Caixa da cena: o canvas é criado e removido dentro dela pela própria cena. */
  box: HTMLDivElement;
  /** Camada dos rótulos HTML (vazia no React; a cena coloca e tira os rótulos). */
  tags: HTMLDivElement;
  onDetail: (detail: SceneDetail) => void;
};

export type SceneHandle = {
  dispose: () => void;
  replay?: () => void;
  setPyramid?: (on: boolean) => void;
};
