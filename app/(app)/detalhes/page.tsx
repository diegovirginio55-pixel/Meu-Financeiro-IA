import DetalhesClient from "@/components/detalhes/DetalhesClient";

export default function DetalhesPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-zinc-50">Detalhes</h1>
        <p className="text-sm text-zinc-400">
          Extrato completo dos lançamentos registrados pela IA, com filtros e
          edição manual.
        </p>
      </div>
      <DetalhesClient />
    </div>
  );
}
