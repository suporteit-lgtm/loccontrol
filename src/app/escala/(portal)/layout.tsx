import { redirect } from "next/navigation";
import { contaPortal } from "@/lib/escala/auth";
import { AvatarCircle } from "@/components/ui";
import { ThemeToggleButton } from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

function Cabecalho({ nome }: { nome: string }) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 16px",
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-divider)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Locagora" data-logo="1" style={{ width: 96 }} />
        <div style={{ width: 1, height: 20, background: "var(--color-divider)" }} />
        <span style={{ fontWeight: 800, fontSize: 12, letterSpacing: "0.16em", color: "var(--color-accent)" }}>ESCALA</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ThemeToggleButton />
        <AvatarCircle nome={nome} tamanho={30} />
        <form action="/escala/auth/sair" method="post">
          <button className="btn btn-secondary" style={{ height: 32, fontSize: 13 }}>
            Sair
          </button>
        </form>
      </div>
    </header>
  );
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="card elev-sm" style={{ textAlign: "center", padding: "var(--space-8)", gap: 8 }}>
      <div className="card-kicker">Escala de Presença</div>
      <div className="card-title">{titulo}</div>
      <p className="card-body">{texto}</p>
    </div>
  );
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const conta = await contaPortal();
  if (!conta) redirect("/escala/login");

  let conteudo = children;
  if (!conta.escalaInstalada)
    conteudo = <Aviso titulo="Escala em preparação" texto="O módulo ainda está sendo configurado. Volte em breve." />;
  else if (!conta.participante || !conta.participante.ativo)
    conteudo = <Aviso titulo="Você ainda não está em nenhuma escala" texto="Procure o RH para ser incluído em um grupo." />;

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      <Cabecalho nome={conta.nome} />
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "16px", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {conteudo}
      </main>
    </div>
  );
}
