import { redirect } from "next/navigation";
import { contaPortal } from "@/lib/escala/auth";
import { CabecalhoPortal } from "@/components/portal/CabecalhoPortal";
import { SalasNav } from "@/components/salas/SalasNav";
import { AoVivo } from "@/components/escala/AoVivo";

export const dynamic = "force-dynamic";

/** Qualquer conta Google @locgrupo.com.br agenda salas (não precisa estar na Escala). */
export default async function SalasPortalLayout({ children }: { children: React.ReactNode }) {
  const conta = await contaPortal();
  if (!conta) redirect("/salas/login");
  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      <CabecalhoPortal nome={conta.nome} modulo="salas" />
      <SalasNav />
      <AoVivo />
      <main className="esc-main">{children}</main>
    </div>
  );
}
