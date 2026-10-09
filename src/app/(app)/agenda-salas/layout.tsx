import { notFound } from "next/navigation";
import { escalaHabilitada } from "@/lib/escala/auth";
import { lerConfig } from "@/lib/salas/servico";
import { AoVivo } from "@/components/escala/AoVivo";
import { EmPreparacao } from "@/components/salas/EmPreparacao";

export const dynamic = "force-dynamic";

/** Seção "SALAS" do LocControl: todo usuário interno agenda; administradores gerenciam. */
export default async function AgendaSalasLayout({ children }: { children: React.ReactNode }) {
  if (!escalaHabilitada()) notFound();
  const { instalado } = await lerConfig();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <AoVivo />
      {instalado ? children : <EmPreparacao />}
    </div>
  );
}
