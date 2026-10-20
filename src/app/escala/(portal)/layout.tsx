import { redirect } from "next/navigation";
import { contaPortal } from "@/lib/escala/auth";
import Link from "next/link";
import { CabecalhoPortal } from "@/components/portal/CabecalhoPortal";
import { PortalNav } from "@/components/escala/PortalNav";
import { AoVivo } from "@/components/escala/AoVivo";

export const dynamic = "force-dynamic";

function Aviso({ titulo, texto, salas }: { titulo: string; texto: string; salas?: boolean }) {
  return (
    <div className="card elev-sm" style={{ textAlign: "center", padding: "var(--space-8)", gap: 8 }}>
      <div className="card-kicker">Escala de Presença</div>
      <div className="card-title">{titulo}</div>
      <p className="card-body">{texto}</p>
      {salas && (
        <Link href="/salas" className="btn btn-primary" style={{ alignSelf: "center", marginTop: 8 }}>
          Agendar uma sala de reunião →
        </Link>
      )}
    </div>
  );
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const conta = await contaPortal();
  if (!conta) redirect("/escala/login");

  let conteudo = children;
  let comAbas = true;
  if (!conta.escalaInstalada) {
    comAbas = false;
    conteudo = <Aviso titulo="Escala em preparação" texto="O módulo ainda está sendo configurado. Volte em breve." />;
  } else if (!conta.participante || !conta.participante.ativo) {
    comAbas = false;
    conteudo = <Aviso titulo="Você ainda não está em nenhuma escala" texto="Procure o RH para ser incluído em um grupo. Enquanto isso, você já pode agendar salas de reunião." salas />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      <CabecalhoPortal nome={conta.nome} modulo="escala" />
      {comAbas && <PortalNav />}
      {comAbas && <AoVivo />}
      <main className="esc-main">
        {conteudo}
      </main>
    </div>
  );
}
