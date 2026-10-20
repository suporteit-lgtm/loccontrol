import Link from "next/link";
import { AvatarCircle } from "@/components/ui";
import { ThemeToggleButton } from "@/components/ThemeToggle";

const ICONE = {
  // calendário
  escala: ["M3 5h18v16H3z", "M3 10h18", "M8 3v4", "M16 3v4"],
  // porta
  salas: ["M3 21h18", "M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17", "M15 12h.01"],
};

const MODULOS = [
  { id: "escala", href: "/escala", longo: "Escala de presença", curto: "Escala" },
  { id: "salas", href: "/salas", longo: "Salas de reunião", curto: "Salas" },
] as const;

/** Cabeçalho do portal (login Google): logo, troca entre Escala e Salas, tema e Sair. */
export function CabecalhoPortal({ nome, modulo }: { nome: string; modulo: "escala" | "salas" }) {
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
        <img src="/logo.png" alt="Locagora" data-logo="1" className="portal-logo" style={{ width: 96 }} />
        <div className="portal-separador" style={{ width: 1, height: 20, background: "var(--color-divider)" }} />
        <nav className="portal-modulos" aria-label="Módulos">
          {MODULOS.map((m) => (
            <Link key={m.id} href={m.href} aria-current={m.id === modulo ? "page" : undefined}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {ICONE[m.id].map((d) => (
                  <path key={d} d={d} />
                ))}
              </svg>
              <span className="portal-modulo-longo">{m.longo}</span>
              <span className="portal-modulo-curto">{m.curto}</span>
            </Link>
          ))}
        </nav>
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
