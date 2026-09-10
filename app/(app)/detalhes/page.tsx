import { Suspense } from "react";
import DetalhesClient from "@/components/detalhes/DetalhesClient";

export default function DetalhesPage() {
  return (
    <Suspense fallback={null}>
      <DetalhesClient />
    </Suspense>
  );
}
